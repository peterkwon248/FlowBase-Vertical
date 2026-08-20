/**
 * 잘못 들어간 원가 한 줄을 지운다.
 *
 *   npx tsx tools/harness/cost-remove.ts --sku SKU-0001,SKU-0002 --on 2026-08-16 [--amount 1234]
 *   npx tsx tools/harness/cost-remove.ts … --yes        # 실제로 지운다
 *
 * ★ 왜 이 도구가 있나 ★
 * 앱에는 원가를 **지우는 길이 없다.** 넣기(`addCost`)와 같은 날짜 정정(`replace`)뿐이다.
 * 시험 삼아 넣은 값이 남아 그날 이후 손익이 통째로 틀리는데 화면에서는 손댈 수 없다 —
 * 그래서 도구로 연다. 앱 표면을 늘리는 결정은 별건이다.
 *
 * ★ 기본은 «보여주기»다 ★ (`purge-orphans` 판례)
 * `--yes` 없이 돌리면 무엇이 지워질지와 **지운 뒤 무엇이 남는지**만 출력한다.
 * 기준 데이터를 지우는 일이고 `row_shadow`가 없어 되돌릴 수 없다.
 *
 * ★ 지우기 전에 반드시 보이는 것 셋 ★
 *   ① 지울 행의 전 컬럼      복구 재료는 이 출력이 전부다
 *   ② 지운 뒤 남는 이력      비면 그 SKU는 «0원»이 아니라 **«미상»**이 되어
 *                          손익 합계에서 통째로 빠진다 (`costAt` → null)
 *   ③ 다리 사전(ADR-016)     resolved 대기 행이 이 SKU를 가리키면 다음 원가 파일
 *                          가져오기가 같은 값을 **다시 넣는다**
 */

import { openNodeDriver } from "../../src/core/store/driver-node.js"
import { Repository } from "../../src/core/store/repository.js"
import { COST_KIND_LABEL, type CostKind } from "../../src/core/cost/index.js"

const argv = process.argv.slice(2)

function flag(name: string): string | null {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return null
  return argv[i + 1] ?? null
}

const DB = flag("db") ?? ".tmp/pnl.sqlite"
const LIB = flag("lib") ?? "lib-1"
const KIND = (flag("kind") ?? "COGS") as CostKind
const ON = flag("on")
const AMOUNT = flag("amount") === null ? null : Number(flag("amount"))
const CODES = (flag("sku") ?? "").split(",").map((s) => s.trim()).filter((s) => s !== "")
const APPLY = argv.includes("--yes")

function die(msg: string): never {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

if (CODES.length === 0) die("--sku 가 없다. 예: --sku SKU-0001,SKU-0002")
if (ON === null || !/^\d{4}-\d{2}-\d{2}$/.test(ON)) {
  die("--on 이 없거나 YYYY-MM-DD가 아니다. 적용일로 행을 특정한다 (id는 기기마다 다르다)")
}
if (AMOUNT !== null && !Number.isInteger(AMOUNT)) die(`--amount 는 원 단위 정수여야 한다: ${AMOUNT}`)

/**
 * `pragmas: false` — 이 도구는 **앱의 DB 파일을 건드린다.** `journal: true`로 열면
 * `journal_mode`가 파일에 남아 앱 화면이 통째로 비는 사고가 난다 (ADR-014).
 */
const db = openNodeDriver(DB, { pragmas: false })
const repo = new Repository(db)

const won = (n: number): string => n.toLocaleString("ko-KR")

console.log(`${DB} — 원가 삭제 (${COST_KIND_LABEL[KIND] ?? KIND} · 적용일 ${ON})`)
if (!APPLY) console.log("※ 보여주기만 한다. 실제로 지우려면 --yes\n")
else console.log("※ ⚠ 앱이 켜져 있으면 닫고 돌린다 — 화면과 DB가 어긋난다\n")

let found = 0
let missing = 0
let mismatched = 0
let bridged = 0
let orphaned = 0

for (const code of CODES) {
  const sku = await db
    .prepare(`SELECT id, name FROM sku WHERE library_id = ? AND code = ?`)
    .get(LIB, code)

  if (sku === undefined) {
    // 조용히 넘어가지 않는다 (LOCK 6) — 오타 한 글자면 «지울 게 없다»로 읽힌다
    console.log(`  ${code.padEnd(12)} ✖ 그런 SKU가 없다 (library ${LIB})`)
    missing++
    continue
  }
  const skuId = String(sku["id"])

  const row = await db
    .prepare(
      `SELECT id, amount, effective_from, note, entered_at, entered_by FROM cost_history
        WHERE library_id = ? AND sku_id = ? AND kind = ? AND effective_from = ?`,
    )
    .get(LIB, skuId, KIND, ON)

  if (row === undefined) {
    console.log(`  ${code.padEnd(12)} · 그 날짜에 원가가 없다 — 지울 것 없음`)
    missing++
    continue
  }

  const amount = Number(row["amount"])
  // 금액까지 맞춰 보는 이유: 날짜만으로 열면 **엉뚱한 행**을 지울 수 있다.
  // 되돌릴 수 없는 일이므로 부르는 사람이 아는 값과 대조할 길을 준다.
  if (AMOUNT !== null && amount !== AMOUNT) {
    console.log(
      `  ${code.padEnd(12)} ✖ 금액이 다르다 — 파일에는 ${won(amount)}원, --amount 는 ${won(AMOUNT)}원. 건너뛴다`,
    )
    mismatched++
    continue
  }

  found++
  console.log(`  ${code.padEnd(12)} ${String(sku["name"]).slice(0, 30)}`)
  console.log(
    `    지울 행   ${won(amount)}원 · ${row["effective_from"]} · ${row["entered_by"]} · ` +
      `입력 ${row["entered_at"]}${row["note"] === null ? "" : ` · «${String(row["note"])}»`}`,
  )

  if (!APPLY) {
    const rest = await db
      .prepare(
        `SELECT amount, effective_from FROM cost_history
          WHERE library_id = ? AND sku_id = ? AND kind = ? AND effective_from <> ?
          ORDER BY effective_from DESC`,
      )
      .all(LIB, skuId, KIND, ON)
    report(rest)
    const bridge = await db
      .prepare(
        `SELECT source_key, title, amount FROM pending_cost
          WHERE library_id = ? AND kind = ? AND resolved_sku_id = ? AND state = 'resolved'`,
      )
      .all(LIB, KIND, skuId)
    warnBridge(bridge)
    continue
  }

  const r = await repo.removeCost({ libraryId: LIB, skuId, kind: KIND, effectiveFrom: ON })
  if (r.removed === null) die(`${code}: 방금 본 행이 사라졌다 — 다른 것이 DB를 쓰고 있다`)
  console.log(`    ✔ 지웠다`)
  report(r.remaining)
  warnBridge(r.bridge)
}

function report(rest: readonly Record<string, unknown>[]): void {
  if (rest.length === 0) {
    // «0원»이 아니라 «미상»이다 — 손익 합계에서 이 SKU가 통째로 빠지고 gaps가 켜진다
    console.log(`    남는 이력 없음 → ★ 이 SKU의 원가가 «미상»이 된다 (0원이 아니다)`)
    console.log(`                    손익에서 빠지고 「일부 미입력」이 켜진다. 원가를 다시 넣어야 한다`)
    orphaned++
    return
  }
  const head = rest[0]
  console.log(
    `    남는 이력 ${rest.length}건 → 이제부터 ${won(Number(head?.["amount"]))}원 ` +
      `(${String(head?.["effective_from"])}부터)`,
  )
}

function warnBridge(bridge: readonly Record<string, unknown>[]): void {
  if (bridge.length === 0) return
  bridged++
  console.log(`    ⚠ 다리 사전에 이 SKU가 ${bridge.length}건 걸려 있다 (ADR-016)`)
  for (const b of bridge) {
    console.log(`       «${String(b["title"]).slice(0, 28)}» ${won(Number(b["amount"]))}원`)
  }
  console.log(`       같은 원가 파일을 다시 넣으면 **이 값이 되살아난다.** resolved 행은`)
  console.log(`       지우지 않는 것이 ADR-016의 결정이라 여기서 손대지 않는다 — 알고 결정한다`)
}

console.log(
  `\n대상 ${CODES.length}개 · ${APPLY ? "지웠다" : "지울 수 있다"} ${found} · 없음 ${missing}` +
    (mismatched > 0 ? ` · 금액 불일치 ${mismatched}` : "") +
    (orphaned > 0 ? ` · ★ 원가 미상이 되는 SKU ${orphaned}` : "") +
    (bridged > 0 ? ` · ⚠ 다리 사전 ${bridged}` : ""),
)
if (!APPLY && found > 0) console.log("지우려면 --yes 를 붙인다. 되돌릴 수 없다 (row_shadow가 없다)")

await db.close()
