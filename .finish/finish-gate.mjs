#!/usr/bin/env node
/**
 * finish-gate.mjs — deterministic completion gate engine for Claude Code
 *
 * 철학: 프롬프트는 부탁, 하네스는 강제.
 * LLM은 사실을 만들지 않는다. 이 파일이 만드는 모든 판정은 exit code에서 나온다.
 *
 * Modes:
 *   node finish-gate.mjs                  # run dev-stage gates, print verdict
 *   node finish-gate.mjs --stage ship     # run ALL gates (dev + ship: deploy, smoke...)
 *   node finish-gate.mjs --gate <id>      # run a single gate
 *   node finish-gate.mjs --init           # generate .finish/gates.json from repo detection
 *   node finish-gate.mjs --install        # ONE-SHOT: self-copy to .finish/, register Stop hook
 *                                         #   in .claude/settings.json, generate gates.json
 *   node finish-gate.mjs --uninstall      # remove the Stop hook entry (files untouched)
 *   node finish-gate.mjs --hook           # Claude Code Stop hook mode (reads stdin JSON)
 *
 * Zero dependencies. Node >= 18.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// ---------- helpers ----------
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};

function readJSON(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}
function tail(str, n = 4000) {
  if (!str) return "";
  return str.length > n ? "…(truncated)…\n" + str.slice(-n) : str;
}

// ---------- paths (resolved per-project at runtime) ----------
function paths(cwd) {
  const dir = path.join(cwd, ".finish");
  return {
    dir,
    gates: path.join(dir, "gates.json"),
    status: path.join(dir, "status.json"),
    gap: path.join(dir, "PRODUCTION_GAP.md"),
    evidence: path.join(dir, "evidence"),
    count: path.join(dir, "loop-count"),
    paused: path.join(dir, "paused"),
    shipping: path.join(dir, "shipping"),
    manual: path.join(dir, "manual"),
  };
}

// ---------- gate execution ----------
function runGate(gate, cwd, P) {
  const timeoutMs = (gate.timeout_s ?? 300) * 1000;
  const t0 = Date.now();
  let res;
  try {
    res = spawnSync(gate.run, {
      cwd,
      shell: true,
      encoding: "utf8",
      timeout: timeoutMs,
      env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (e) {
    res = { status: 127, stdout: "", stderr: String(e) };
  }
  const ms = Date.now() - t0;
  const timedOut = res.signal === "SIGTERM" && ms >= timeoutMs - 50;
  const exit = timedOut ? 124 : res.status ?? 1;
  const out = tail((res.stdout || "") + (res.stderr || ""));
  fs.mkdirSync(P.evidence, { recursive: true });
  const evFile = path.join(P.evidence, `${gate.id}.log`);
  fs.writeFileSync(
    evFile,
    `# gate: ${gate.id}\n# cmd: ${gate.run}\n# exit: ${exit}${timedOut ? " (TIMEOUT)" : ""}\n# ms: ${ms}\n# ts: ${new Date().toISOString()}\n\n${out}\n`
  );
  return { id: gate.id, ok: exit === 0, exit, ms, timedOut, evidence: path.relative(cwd, evFile), required: gate.required !== false, stage: gate.stage ?? "dev", run: gate.run };
}

function selectGates(cfg, stage, onlyId) {
  let gs = (cfg.gates || []).filter((g) => g.enabled !== false);
  if (onlyId) return gs.filter((g) => g.id === onlyId);
  if (stage === "ship") return gs; // ship = dev + ship 전부
  return gs.filter((g) => (g.stage ?? "dev") === "dev");
}

function writeGap(cwd, P, cfg, stage, results, verdict, note = "") {
  const rows = results
    .map(
      (r) =>
        `| ${r.id} | ${r.stage} | ${r.ok ? "✅ PASS" : r.required ? "❌ FAIL" : "⚠️ WARN"} | exit ${r.exit}${r.timedOut ? " timeout" : ""} | ${r.evidence} |`
    )
    .join("\n");
  const firstFail = results.find((r) => !r.ok && r.required);
  const evTail = firstFail
    ? tail(fs.readFileSync(path.join(cwd, firstFail.evidence), "utf8"), 1500)
    : "";
  const md = `# PRODUCTION GAP — ${cfg.project ?? path.basename(cwd)}

- generated: ${new Date().toISOString()}
- stage: **${stage}**
- verdict: ${verdict ? "## ✅ COMPLETE (this stage)" : "## ❌ NOT COMPLETE"}
${note ? `- note: ${note}\n` : ""}
| gate | stage | status | exit | evidence |
|---|---|---|---|---|
${rows}

${
  firstFail
    ? `## Next action
First failing required gate: **${firstFail.id}**
Command: \`${firstFail.run}\`
Fix the underlying cause, then re-run \`node finish-gate --stage ${stage}\` (or just try to stop — the hook re-verifies).

### Evidence tail (${firstFail.evidence})
\`\`\`
${evTail}
\`\`\`
`
    : stage === "dev"
    ? `## Dev gates green.
Production is NOT verified yet. Run \`/finish:ship\` (or \`touch .finish/shipping\`) to enforce deploy + smoke gates.`
    : `## All gates green. SHIPPED.
Remove ship mode: \`rm .finish/shipping\``
}
`;
  fs.mkdirSync(P.dir, { recursive: true });
  fs.writeFileSync(P.gap, md);
}

function runAll(cwd, stage, onlyId = null) {
  const P = paths(cwd);
  const cfg = readJSON(P.gates);
  if (!cfg) {
    console.error(`no ${path.relative(cwd, P.gates)} — run: node finish-gate.mjs --init`);
    return { cfg: null, verdict: false, results: [] };
  }
  const gates = selectGates(cfg, stage, onlyId);
  const results = gates.map((g) => {
    process.stderr.write(`[gate] ${g.id} … `);
    const r = runGate(g, cwd, P);
    process.stderr.write(r.ok ? "PASS\n" : `FAIL (exit ${r.exit})\n`);
    return r;
  });
  const verdict = results.filter((r) => r.required).every((r) => r.ok) && results.length > 0;
  writeJSON(P.status, { ts: new Date().toISOString(), stage, verdict, results });
  writeGap(cwd, P, cfg, stage, results, verdict);
  return { cfg, verdict, results };
}

// ---------- --init: repo detection ----------
function init(cwd) {
  const P = paths(cwd);
  if (fs.existsSync(P.gates)) {
    console.error(`already exists: ${P.gates} (delete it to regenerate)`);
    process.exit(1);
  }
  generateGates(cwd);
}

function generateGates(cwd) {
  const P = paths(cwd);
  const pkg = readJSON(path.join(cwd, "package.json"), {});
  const s = pkg.scripts || {};
  const gates = [];
  if (s.build) gates.push({ id: "build", run: "npm run build", stage: "dev", timeout_s: 600 });
  if (s.typecheck) gates.push({ id: "typecheck", run: "npm run typecheck", stage: "dev" });
  else if (fs.existsSync(path.join(cwd, "tsconfig.json")))
    gates.push({ id: "typecheck", run: "npx tsc --noEmit", stage: "dev" });
  if (s.lint) gates.push({ id: "lint", run: "npm run lint", stage: "dev" });
  if (s.test) gates.push({ id: "test", run: "npm test", stage: "dev", timeout_s: 600 });
  gates.push({
    id: "drift",
    run: "npx depcruise src --validate",
    stage: "dev",
    enabled: false,
    _note: "설계이탈 게이트. .dependency-cruiser.cjs 설정 후 enabled:true",
  });
  const hasVercel =
    fs.existsSync(path.join(cwd, "vercel.json")) || fs.existsSync(path.join(cwd, ".vercel"));
  gates.push({
    id: "deploy",
    run: hasVercel ? "npx vercel deploy --prod --yes" : "echo 'TODO: set deploy command' && exit 1",
    stage: "ship",
    timeout_s: 900,
  });
  gates.push({
    id: "smoke",
    run: "curl -sfL --max-time 30 https://CHANGE-ME.example.com | grep -qi '<title>'",
    stage: "ship",
    _note: "배포된 실제 URL로 교체. grep 대상은 반드시 떠야 하는 문자열.",
  });
  const cfg = {
    version: 1,
    project: pkg.name ?? path.basename(cwd),
    max_loop: 5,
    gates,
  };
  writeJSON(P.gates, cfg);
  fs.mkdirSync(P.manual, { recursive: true });
  console.log(`created ${path.relative(cwd, P.gates)} — ${gates.length} gates detected.`);
  console.log(`edit it (especially deploy/smoke), then: node finish-gate.mjs`);
}

// ---------- --install / --uninstall ----------
const HOOK_CMD = "node .finish/finish-gate.mjs --hook";

function loadSettings(setPath) {
  if (!fs.existsSync(setPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(setPath, "utf8"));
  } catch {
    console.error(`ABORT: ${setPath} is not valid JSON. Fix it first — refusing to clobber.`);
    process.exit(1);
  }
}

function install(cwd) {
  const P = paths(cwd);
  // 1) self-copy: 이 파일 자신을 .finish/finish-gate.mjs 로
  fs.mkdirSync(P.dir, { recursive: true });
  fs.mkdirSync(P.manual, { recursive: true });
  const self = fs.realpathSync(process.argv[1]);
  const target = path.join(P.dir, "finish-gate.mjs");
  let same = false;
  try {
    same = fs.realpathSync(target) === self;
  } catch {}
  if (!same) fs.copyFileSync(self, target);
  // 2) .claude/settings.json 에 Stop hook 병합 (idempotent, 기존 키 보존)
  const setPath = path.join(cwd, ".claude", "settings.json");
  const settings = loadSettings(setPath);
  settings.hooks ??= {};
  settings.hooks.Stop ??= [];
  const exists = settings.hooks.Stop.some((m) =>
    (m.hooks || []).some((h) => h.command === HOOK_CMD)
  );
  if (!exists)
    settings.hooks.Stop.push({
      hooks: [{ type: "command", command: HOOK_CMD, timeout: 900 }],
    });
  fs.mkdirSync(path.dirname(setPath), { recursive: true });
  fs.writeFileSync(setPath, JSON.stringify(settings, null, 2) + "\n");
  // 3) gates.json 없으면 생성
  if (!fs.existsSync(P.gates)) generateGates(cwd);
  else console.log(`gates.json exists — keeping it.`);
  console.log(`
installed.
  engine : .finish/finish-gate.mjs (self-copied)
  hook   : .claude/settings.json → Stop → "${HOOK_CMD}"${exists ? " (already there)" : ""}
  gates  : .finish/gates.json

next:
  1. edit .finish/gates.json — 특히 deploy 커맨드와 smoke URL/grep 문자열
  2. restart Claude Code (훅은 세션 시작 시 로드됨)
  3. verify: node .finish/finish-gate.mjs
  4. 완주 모드: touch .finish/shipping  (해제: rm)
  escape: touch .finish/paused`);
}

function uninstall(cwd) {
  const setPath = path.join(cwd, ".claude", "settings.json");
  const settings = loadSettings(setPath);
  if (settings.hooks?.Stop) {
    settings.hooks.Stop = settings.hooks.Stop.filter(
      (m) => !(m.hooks || []).some((h) => h.command === HOOK_CMD)
    );
    if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;
    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
    fs.writeFileSync(setPath, JSON.stringify(settings, null, 2) + "\n");
  }
  console.log(`hook removed from .claude/settings.json — .finish/ 파일들은 그대로 (원하면 rm -rf .finish)`);
}

// ---------- --hook: Claude Code Stop hook ----------
function hookMode() {
  // fail-open on infra errors: never lock the user's session because of a bug here.
  try {
    let input = {};
    try {
      input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
    } catch {}
    const cwd = input.cwd || process.cwd();
    const P = paths(cwd);

    if (!fs.existsSync(P.gates)) process.exit(0); // 프로젝트가 opt-in 안 함
    if (fs.existsSync(P.paused)) process.exit(0); // escape hatch #1

    const cfg = readJSON(P.gates) || {};
    const maxLoop = cfg.max_loop ?? 5;
    const count = parseInt((readJSON(P.count) ?? { n: 0 }).n, 10) || 0;

    if (count >= maxLoop) {
      // escape hatch #2: 루프 상한. 세션을 인질로 잡지 않는다.
      writeJSON(P.count, { n: 0 });
      const cfg2 = readJSON(P.gates) || {};
      const stage = fs.existsSync(P.shipping) ? "ship" : "dev";
      writeGap(
        cwd,
        P,
        cfg2,
        stage,
        (readJSON(P.status) || { results: [] }).results,
        false,
        `max_loop(${maxLoop}) reached — hook released. Gates still failing; see table.`
      );
      process.exit(0);
    }

    const stage = fs.existsSync(P.shipping) ? "ship" : "dev";
    const { verdict, results } = runAll(cwd, stage);

    if (verdict) {
      writeJSON(P.count, { n: 0 });
      if (stage === "ship") {
        // 배포+스모크까지 전부 green. ship 모드 해제하고 통과.
        try {
          fs.unlinkSync(P.shipping);
        } catch {}
      }
      process.exit(0);
    }

    writeJSON(P.count, { n: count + 1 });
    const fails = results.filter((r) => !r.ok && r.required);
    const first = fails[0];
    const reason =
      `FINISH GATE [${stage}] ${count + 1}/${maxLoop}: ${fails.length} required gate(s) failing: ` +
      fails.map((f) => f.id).join(", ") +
      `. You are not done. Read .finish/PRODUCTION_GAP.md. ` +
      `First fix: gate "${first.id}" (command: ${first.run}, evidence: ${first.evidence}). ` +
      `Fix the root cause, do not weaken the gate. When you finish responding, gates re-run automatically. ` +
      `(User escape: create .finish/paused)`;
    console.log(JSON.stringify({ decision: "block", reason }));
    process.exit(0);
  } catch {
    process.exit(0); // fail-open
  }
}

// ---------- main ----------
if (has("--hook")) {
  hookMode();
} else if (has("--install")) {
  install(process.cwd());
} else if (has("--uninstall")) {
  uninstall(process.cwd());
} else if (has("--init")) {
  init(process.cwd());
} else {
  const stage = val("--stage") === "ship" ? "ship" : "dev";
  const onlyId = val("--gate");
  const { cfg, verdict, results } = runAll(process.cwd(), stage, onlyId);
  if (!cfg) process.exit(2);
  const failed = results.filter((r) => !r.ok && r.required).map((r) => r.id);
  console.log(
    verdict
      ? `✅ ${stage.toUpperCase()} COMPLETE (${results.length} gates)`
      : `❌ NOT COMPLETE — failing: ${failed.join(", ") || "(no gates ran)"} → .finish/PRODUCTION_GAP.md`
  );
  process.exit(verdict ? 0 : 1);
}
