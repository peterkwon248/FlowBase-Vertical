/**
 * 게이트 자가시험 — **가드가 아직 물 줄 아는가.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 이 도구가 생겼나 (2026-08-21) ★
 *
 * 이 저장소는 「가드는 부러뜨려 확인한다」를 규율로 갖고 있고(작업 리듬 3),
 * 실제로 매번 손으로 자해를 넣어 봤다. 그런데 그건 **작성 시점에 한 번**이다.
 * 그 뒤로 코드가 움직이면 가드는 조용히 죽고, 죽은 가드는 **초록이라는 거짓 신호**를
 * 낸다 — 문서 드리프트보다 나쁘다. 문서는 읽으면 낡은 게 보이지만, 죽은 가드는
 * 아무 말도 안 한다.
 *
 * 같은 날 두 표본이 나왔다:
 *   · `render-screen.ts`가 조회 중간에 `db.close()`를 해서 **어떤 화면도 못 그리는
 *     상태**였는데 아무 게이트도 몰랐다 (LOCK 6이 도구 안에서 깨져 있었다)
 *   · 「경로 정하는 자리는 하나」 시험이 «한 **파일**»을 세고 있었다 — 규칙은
 *     «한 **자리**»였고, 같은 파일에 둘째 함수를 넣자 **통과했다**
 *
 * 둘 다 자해를 돌렸기 때문에 나왔다. 그래서 자해를 **명령**으로 만든다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 어떻게 도나 ★
 *
 * ```
 * 백업 → 흠집 하나 → 그 가드를 돌린다 → **붉어져야 한다** → 복원 → 바이트 대조
 * ```
 *
 * ★ 케이스도 만료된다 ★ 찾을 문자열이 없거나 여러 곳이면 **케이스가 낡은 것**이므로
 * 실패로 친다. 「자해를 넣었는데 아무 일도 안 났다」와 「자해를 넣지도 못했다」는
 * 전혀 다른 결론이고, 뒤쪽을 통과로 세면 이 도구 자신이 죽은 가드가 된다.
 *
 * ★ 안전 ★ 백업은 `.finish/selftest-backup/`에 둔다. 프로세스가 중간에 죽어도
 * 다음 실행이 **잔재를 먼저 복원**한다. 복원 뒤에는 바이트를 대조해서 원본과 같은지
 * 확인한다 — 「복원했다」도 주장이지 사실이 아니다.
 *
 * ```bash
 * npm run gates:selftest            # 전부
 * npm run gates:selftest -- <id>    # 하나만
 * ```
 *
 * ⚠ **느리다** (케이스마다 시험 한 벌). Stop 훅에 걸지 않는다 — 사람이 부르는 명령이고,
 * 가드를 새로 만들거나 크게 고친 뒤에 돌린다.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"

const BACKUP = ".finish/selftest-backup"

interface Case {
  /** `npm run gates:selftest -- <id>` 로 하나만 돌릴 때 쓴다. */
  readonly id: string
  /** 이 가드가 **무엇을 지키나**. 붉어졌을 때 사람이 읽는 문장이다. */
  readonly guards: string
  readonly file: string
  /** 흠집 — 정확히 **한 곳**에서 발견돼야 한다. */
  readonly find: string
  readonly replace: string
  /** 이 명령이 **실패해야** 한다. 성공하면 가드가 죽은 것이다. */
  readonly verify: string
}

/**
 * 등재된 자해. **전부 실제로 났던 사고이거나 실제로 잡은 자해**다 —
 * 지어낸 흠집은 「그럴듯한 가드」를 만들 뿐이다.
 */
const CASES: readonly Case[] = [
  {
    id: "cut-stale",
    guards:
      "낡은 컷 선언 — 배선된 것을 「안 만든다」고 적어 두면 다음 사람이 그 화면을 안 본다. " +
      "2026-08-20·21에 세 번 났다 (exp[A-Z] · toggleHeadMore · ad*)",
    file: "tools/harness/wiring.ts",
    find: `fields: /^(cd[A-Z]|cost(Changes|Miss|Rows|Total)|set(CdCost|CdFrom|CdMemo))/`,
    replace: `fields: /^(ad(Alloc|Count|Roas|Rows|Total|Unalloc)|ctAd|cd[A-Z]|cost(Changes|Miss|Rows|Total)|set(CdCost|CdFrom|CdMemo))/`,
    verify: `npx vitest run tests/wiring-coverage.test.ts -t "배선된 필드를 덮는 컷"`,
  },
  {
    id: "layer-direction",
    guards:
      "안쪽 층이 바깥쪽을 import한다 — core가 팩을 알면 「매처는 주입받는다」가 무너진다. " +
      "이름 검사(마켓 이름 10종)는 이걸 **못 잡는다**: import 경로에 「쿠팡」이 없기 때문이다 " +
      "(2026-08-21 신설 — 그전까지 방향은 규율이었지 게이트가 아니었다)",
    file: "src/core/linking/view.ts",
    find: `import type { Driver } from "../store/driver.js"`,
    replace:
      `import type { Driver } from "../store/driver.js"
` +
      `import { krLinkingMatcher } from "../../packs/kr-marketplace/linking-matcher.js"
` +
      `void krLinkingMatcher`,
    verify: `npx vitest run tests/core-env-neutral.test.ts -t "src/core → packs import 0건"`,
  },
  {
    id: "db-path-baked",
    guards:
      "앱이 **빌드한 기계의 절대경로**를 연다 — 다른 PC에 설치하면 첫 열기에서 끝난다 " +
      "(조사 2.9 · ADR-024)",
    file: "src/app/data.ts",
    find: "openTauriDriver(await appDbPath(), {",
    replace: "openTauriDriver(DEV_DB_PATH, {",
    verify: `npx vitest run tests/db-path.test.ts -t "구워진 프로젝트 경로"`,
  },
  {
    id: "db-path-one-site",
    guards:
      "경로를 정하는 자리가 둘이 된다 (ADR-024 따름 조건 1). " +
      "★ 이 자해가 처음엔 **안 물었다** — 시험이 «한 파일»을 세고 규칙은 «한 자리»였다",
    file: "src/app/data.ts",
    find: "async function appDbPath(): Promise<string> {",
    replace:
      'export async function otherPath(): Promise<string> {\n' +
      '  const { appDataDir } = await import("@tauri-apps/api/path")\n' +
      "  return appDataDir()\n" +
      "}\n\n" +
      "async function appDbPath(): Promise<string> {",
    verify: `npx vitest run tests/db-path.test.ts -t "자리를 정하는 곳은"`,
  },
  {
    id: "preview-reads-all",
    guards:
      "미리보기가 8만 행을 통째로 읽는다 (헌장 B-9 · LOCK 5). " +
      "시간이 아니라 **읽은 양**을 재므로 기계 부하와 무관하다",
    file: "tests/parsers.test.ts",
    find: "readWorkbook(bytes, { sheetRows: 20 })",
    replace: "readWorkbook(bytes, {})",
    verify: `npx vitest run tests/parsers.test.ts -t "미리보기는"`,
  },
  {
    id: "roas-denominator",
    guards:
      "전환매출이 없는 캠페인이 ROAS 분모에 들어간다 — **조용히 낮아진다** " +
      "(실측: 4.00x → 2.00x). 「잴 수 없다」와 「0」은 다르다 (LOCK 6 · U-7)",
    file: "src/app/costs.ts",
    find: "const conv = ads.filter((a) => a.convRev > 0)",
    replace: "const conv = ads",
    verify: `npx vitest run tests/costs-screen.test.ts -t "ROAS 분모"`,
  },
  {
    id: "unallocated-subtraction",
    guards:
      "미배분을 뺄셈이 아니라 갈래 덧셈으로 만든다 — 하나를 빠뜨리면 **총 광고비가 " +
      "조용히 줄어든다** (ADR-022)",
    file: "src/app/costs.ts",
    find: "vals.adUnalloc = `${won(total - alloc)}원`",
    replace: "vals.adUnalloc = `${won(sum((a) => a.noKey) + sum((a) => a.noListing))}원`",
    verify: `npx vitest run tests/costs-screen.test.ts -t "KPI는 표와"`,
  },
  {
    id: "doc-facts-stale",
    guards:
      "문서의 **저장소 사실**이 실측과 갈린다. 손으로 적은 숫자는 «고칠 이유가 생길 " +
      "때까지 아무도 안 본다» — 실제로 「배선 249 / 컷 220」이 실측 255 / 214와 " +
      "갈린 채 떠 있었다 (2026-08-21)",
    file: "tools/harness/facts.ts",
    find: "`배선 ${w.allWired.length} · 컷 ${cut} · 남은 일 ${w.allTodo.length}`",
    replace: "`배선 ${w.allWired.length + 1} · 컷 ${cut} · 남은 일 ${w.allTodo.length}`",
    verify: `npx vitest run tests/doc-facts.test.ts -t "실측과 같다"`,
  },
  {
    id: "sign-signed-target",
    guards:
      "`net_amount`의 음수에 abs()가 걸린다 — 「마켓에 갚는 달」이 **받은 적 없는 지급액**이 " +
      "되고, 정산 항등식이 우리 버그를 파일 탓으로 지목한다 (ADR-025 결정 1)",
    file: "src/core/import/mapping/targets.ts",
    find: '["fact_settlement"], "signed"),',
    replace: '["fact_settlement"]),',
    verify: `npx vitest run tests/sign-policy.test.ts -t "그대로 저장되고"`,
  },
  {
    id: "sign-undeclared-loads",
    guards:
      "선언 없는 음수가 **적재된다** — Fact에 음수가 들어가면 `SUM()`이 조용히 틀린다. " +
      "ADR-009 ②가 막으려던 그것이다 (ADR-025 결정 3)",
    file: "src/core/import/issues.ts",
    find: `    fatal: true,
    scope: "row",
    what: "음수인데 부호 규칙 선언이 없다 — 값을 지어내지 않고 그 행을 제외한다",`,
    replace: `    fatal: false,
    scope: "row",
    what: "음수인데 부호 규칙 선언이 없다 — 값을 지어내지 않고 그 행을 제외한다",`,
    verify: `npx vitest run tests/sign-policy.test.ts -t "적재하지도 않는다"`,
  },
  {
    id: "doc-expired",
    guards:
      "한시 문서의 만료가 지났는데 아무도 안 문다 — 한시 문서 둘이 스스로 「소비되면 " +
      "지운다」고 적고 몇 주째 남아 있었다. 선언만 있고 집행이 없으면 규칙이 아니라 소망이다",
    file: "docs/코드-남은일-2026-08-20.md",
    find: "expires: 2026-09-30",
    replace: "expires: 2026-08-01",
    verify: `npx vitest run tests/doc-facts.test.ts -t "지난 만료"`,
  },
  {
    id: "db-parent-dir",
    guards:
      "설치본의 첫 열기 — 앱 데이터 폴더가 **없는 채로** 시작한다. " +
      "`Connection::open`은 파일은 만들어도 폴더는 안 만든다 (ADR-024 결정 3)",
    file: "src-tauri/src/db.rs",
    find: `            std::fs::create_dir_all(dir)
                .map_err(|e| format!("{} 폴더를 만들지 못했다: {e}", dir.display()))?;`,
    replace: "            let _ = dir; // selftest 자해",
    verify: "cargo test --manifest-path src-tauri/Cargo.toml 없는_폴더에도_db를_연다",
  },
]

// ── 잔재 복원 ────────────────────────────────────────────────────
//
// 프로세스가 중간에 죽으면 흠집이 남는다. 다음 실행이 **먼저** 되돌린다 —
// 그 위에 또 자해를 얹으면 무엇이 원본인지 알 수 없게 된다.
function restoreLeftovers(): void {
  if (!existsSync(BACKUP)) return
  const left = readdirSync(BACKUP)
  if (left.length === 0) return
  console.error(`⚠ 지난 실행의 잔재 ${left.length}건을 먼저 되돌린다:`)
  for (const name of left) {
    const meta = JSON.parse(readFileSync(`${BACKUP}/${name}`, "utf8")) as {
      file: string
      body: string
    }
    writeFileSync(meta.file, meta.body)
    console.error(`   복원: ${meta.file}`)
    rmSync(`${BACKUP}/${name}`)
  }
}

function runCase(c: Case): { ok: boolean; note: string } {
  const original = readFileSync(c.file, "utf8")

  /**
   * ★ 줄바꿈을 파일에 맞춘다 (2026-08-21) ★
   *
   * 이 저장소는 CRLF다. 케이스는 소스에 LF로 적히므로 **여러 줄 흠집이 전부 안 맞고**,
   * 그 결과가 「케이스가 낡았다」로 보고된다 — 실제로는 가드가 멀쩡하고 하네스가 못 넣은 것이다.
   * 두 실패를 구별하겠다고 만든 도구가 **셋째 실패(넣을 줄 몰랐다)를 둘째로 보고**하고 있었다.
   */
  const CR = String.fromCharCode(13)
  const LF = String.fromCharCode(10)
  const crlf = original.includes(CR + LF)
  const fix = (t: string): string =>
    crlf ? t.split(CR + LF).join(LF).split(LF).join(CR + LF) : t
  const find = fix(c.find)
  const replace = fix(c.replace)

  // ★ 케이스 만료 검사 — 자해를 «넣지도 못한 것»을 통과로 세지 않는다 ★
  const hits = original.split(find).length - 1
  if (hits === 0) return { ok: false, note: "흠집 자리를 못 찾았다 — **케이스가 낡았다**" }
  if (hits > 1) return { ok: false, note: `흠집 자리가 ${hits}곳이다 — 한 곳만 짚도록 좁혀라` }

  mkdirSync(BACKUP, { recursive: true })
  const stash = `${BACKUP}/${c.id}.json`
  writeFileSync(stash, JSON.stringify({ file: c.file, body: original }))

  let verdict: { ok: boolean; note: string }
  try {
    writeFileSync(c.file, original.replace(find, replace))
    const r = spawnSync(c.verify, {
      shell: true,
      encoding: "utf8",
      env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 600_000,
    })
    // 붉어져야 한다. 초록이면 **가드가 죽은 것**이다.
    verdict =
      r.status === 0
        ? { ok: false, note: "자해를 넣었는데 **통과했다** — 이 가드는 더 이상 안 문다" }
        : { ok: true, note: `물었다 (exit ${r.status})` }
  } finally {
    // `finally`에서 return하지 않는다 — try의 판정을 덮어 버린다.
    writeFileSync(c.file, original)
  }

  // 「복원했다」도 주장이다 — 바이트로 확인한다.
  if (readFileSync(c.file, "utf8") !== original) {
    console.error(`
✖✖ ${c.file} 복원 실패 — 백업이 ${stash}에 있다. 손으로 되돌려라`)
    process.exit(2)
  }
  rmSync(stash)
  return verdict
}

// ── main ────────────────────────────────────────────────────────
restoreLeftovers()

const only = process.argv.slice(2).find((a) => !a.startsWith("-"))
const cases = only === undefined ? CASES : CASES.filter((c) => c.id === only)
if (cases.length === 0) {
  console.error(`그런 케이스가 없다: ${only}\n등재된 것: ${CASES.map((c) => c.id).join(" · ")}`)
  process.exit(2)
}

console.log(`게이트 자가시험 — 흠집 ${cases.length}건을 넣고 **붉어지는지** 본다\n`)
const failed: string[] = []
for (const c of cases) {
  process.stdout.write(`  ${c.id.padEnd(24)} `)
  const { ok, note } = runCase(c)
  console.log(ok ? `✅ ${note}` : `❌ ${note}`)
  if (!ok) {
    failed.push(c.id)
    console.log(`     지키는 것: ${c.guards}`)
    console.log(`     흠집: ${c.file}`)
  }
}

console.log("")
if (failed.length === 0) {
  console.log(`✅ ${cases.length}건 전부 물었다 — 이 가드들은 살아 있다`)
} else {
  console.error(`✖ ${failed.length}건이 안 물었다: ${failed.join(", ")}`)
  console.error(`  «가드가 죽었다»와 «케이스가 낡았다»는 다르다 — 위 note를 먼저 읽어라`)
  process.exitCode = 1
}
