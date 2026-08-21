/**
 * 저장소 사실 — **기기와 무관한 숫자를 문서에 기계가 써 넣는다.**
 *
 * ```bash
 * npm run facts            # 찍어만 본다
 * npm run facts -- --write # 문서의 마커 사이를 갈아끼운다
 * npm run facts -- --check # 낡았으면 exit 1  (tests/doc-facts.test.ts가 이걸 쓴다)
 * ```
 *
 * ─────────────────────────────────────────────────────────────
 * ★ `state`와 무엇이 다른가 — **재는 대상의 성질이 다르다** ★
 *
 * ```
 * state   기기 사실   실 DB·데모 DB의 내용, 이 기기의 node 버전
 *         → **문서에 숫자로 안 적는다.** gitignore라 CI가 영원히 못 재고,
 *           `pnl.ts`가 재현도 못 한다. 「재는 명령」만 적는 것이 유일한 처방이다
 *
 * facts   저장소 사실  배선/컷 수, 스키마 정본
 *         → **어느 기기에서 돌려도 같다.** 그러니 문서에 적어도 되고,
 *           적는다면 **기계가 적어야** 한다. 그리고 CI가 검증할 수 있다
 * ```
 *
 * 둘을 한 도구에 넣지 않는다. 섞으면 「state가 써 준 숫자니까 맞겠지」가 되는데
 * 그중 절반은 **읽는 기기에서 거짓**이다 — 이 저장소가 두 번 그걸로 틀렸다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 왜 생겼나 (2026-08-21) ★
 * `작업-상태.md`가 「배선 249 / 컷 220」이라 적고 있었는데 실측은 **255 / 214**였다.
 * 그 옆 줄의 「배선 246 / 컷 223」도 낡았다. 손으로 적은 저장소 사실은
 * **고칠 이유가 생길 때까지 아무도 안 본다** — 기계가 적으면 그 문제가 사라진다.
 *
 * ★ 무엇을 안 하나 ★
 * 시험 개수는 안 잰다. 재려면 `npm test`를 돌려야 하고(55초), 그러면 이 도구가
 * 「두 번째 테스트 러너」가 된다. 시험 수는 `npm test` 자신이 출력한다 —
 * 게이트는 선언된 질문만 답한다 (작업 리듬 7).
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { wiringReport } from "./wiring.js"

const DOC = "docs/작업-상태.md"
const MIGRATIONS = "src/core/store/migrations"

/** 마이그레이션 파일에서 읽는 **스키마 정본**. `state.ts`와 같은 규칙이다. */
function schemaHead(): number {
  const ns = readdirSync(MIGRATIONS)
    .map((f) => /^(\d+)/.exec(f)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number)
  return ns.length === 0 ? 0 : Math.max(...ns)
}

/**
 * 마커 하나 = 사실 하나. **문장까지 여기서 만든다** — 문서 쪽에 문장을 두고 숫자만
 * 갈아끼우면, 문장이 낡았을 때(「미연결 0건」 같은 것) 기계가 그걸 못 본다.
 */
function facts(): Record<string, string> {
  const w = wiringReport()
  const cut = w.allUnwired.length - w.allTodo.length
  return {
    wiring:
      `배선 ${w.allWired.length} · 컷 ${cut} · 남은 일 ${w.allTodo.length}` +
      ` (소비 ${w.allConsumed.length})`,
    schema: `스키마 정본 ${schemaHead()}`,
  }
}

/**
 * ★ 만료 — **넣는 비용이 0이고 빼는 비용이 크면 문서는 단조 증가한다** (2026-08-21) ★
 *
 * ```
 * <!-- expires: 2026-09-30 reason: 코드 훑기를 다 소비하면 지운다 -->
 * ```
 *
 * 한시 문서 둘이 스스로 「소비되면 지운다」고 적어 놓고 몇 주째 남아 있었다.
 * 선언이 있는데 집행이 없으면 그건 규칙이 아니라 소망이다 — 만료가 **나가는 문**이다.
 *
 * ★ 날짜가 지나면 «경고»가 아니라 «실패»다 ★ 경고는 읽히지 않는다. 연장하려면
 * 날짜를 손으로 늘려야 하고, 그때 「정말 아직 필요한가」를 한 번 묻게 된다. 그 질문이
 * 이 장치의 전부다.
 *
 * ★ 선언한 블록만 본다 ★ 태그가 없는 문서는 검사 대상이 아니다 — 오탐이 0이어야
 * 사람이 이 시험을 안 끈다.
 */
export interface Expiry {
  readonly file: string
  readonly on: string
  readonly reason: string
}

export function expiries(files: readonly string[]): readonly Expiry[] {
  const re = /<!--\s*expires:\s*(\d{4}-\d{2}-\d{2})\s+reason:\s*([^>]*?)\s*-->/g
  const out: Expiry[] = []
  for (const f of files) {
    for (const m of readFileSync(f, "utf8").matchAll(re))
      out.push({ file: f, on: m[1]!, reason: m[2]! })
  }
  return out
}

/** 오늘(KST) 기준으로 지난 것. 날짜는 문자열 비교로 충분하다 — `YYYY-MM-DD`는 사전순이 시간순이다. */
export const overdue = (all: readonly Expiry[], today: string): readonly Expiry[] =>
  all.filter((e) => e.on < today)

/** `<!-- facts:id -->…<!-- /facts -->` 사이를 찾는다. */
const block = (id: string): RegExp =>
  new RegExp(`(<!-- facts:${id} -->)([\\s\\S]*?)(<!-- /facts -->)`, "g")

function apply(src: string, f: Record<string, string>): { out: string; missing: string[] } {
  let out = src
  const missing: string[] = []
  for (const [id, text] of Object.entries(f)) {
    const re = block(id)
    if (!re.test(src)) {
      missing.push(id)
      continue
    }
    out = out.replace(block(id), `$1${text}$3`)
  }
  return { out, missing }
}

// ── main ────────────────────────────────────────────────────────
//
// ★ 직접 부를 때만 돈다 ★ `wiring.ts`와 같은 가드다. 없으면 `tests/doc-facts.test.ts`가
// 이 모듈을 import하는 것만으로 CLI 본문이 돌아 시험 출력에 리포트가 섞인다 —
// 그리고 언젠가 남의 argv를 우리 플래그로 오해한다.
if ((process.argv[1] ?? "").endsWith("facts.ts")) {
const f = facts()
const src = readFileSync(DOC, "utf8")
const { out, missing } = apply(src, f)

if (process.argv.includes("--write")) {
  if (missing.length > 0) {
    console.error(`✖ ${DOC}에 마커가 없다: ${missing.join(", ")}`)
    console.error(`  <!-- facts:<id> -->여기<!-- /facts --> 를 넣어라`)
    process.exit(2)
  }
  writeFileSync(DOC, out)
  console.log(`${DOC} 갱신`)
  for (const [id, text] of Object.entries(f)) console.log(`  ${id.padEnd(8)} ${text}`)
} else if (process.argv.includes("--check")) {
  if (missing.length > 0) {
    console.error(`✖ 마커가 사라졌다: ${missing.join(", ")} — 문서가 사실을 안 물고 있다`)
    process.exit(1)
  }
  if (out !== src) {
    console.error(`✖ ${DOC}의 저장소 사실이 낡았다. \`npm run facts -- --write\`로 갱신해라`)
    for (const [id, text] of Object.entries(f)) console.error(`  지금: ${id.padEnd(8)} ${text}`)
    process.exit(1)
  }
  console.log(`✅ ${DOC}의 저장소 사실이 실측과 같다`)
} else {
  for (const [id, text] of Object.entries(f)) console.log(`${id.padEnd(8)} ${text}`)
  console.log(`\n(--write 로 ${DOC}에 써 넣는다 · --check 로 낡았는지 본다)`)
}

}

export { facts, apply, block }
