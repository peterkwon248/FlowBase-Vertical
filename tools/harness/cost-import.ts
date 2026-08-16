/**
 * 원가 일괄 입력 — **표를 받아 `cost_history`에 넣는다.**
 *
 * ```
 * npx tsx tools/harness/cost-import.ts            리허설 (아무것도 안 쓴다)
 * npx tsx tools/harness/cost-import.ts --apply    실제로 넣는다
 * npx tsx tools/harness/cost-import.ts --apply --from 2026-01-01 --db .tmp/pnl.sqlite
 * ```
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 도구가 하는가 — 연결은 사람이 하고 원가는 도구가 한다 ★
 *
 * 연결(리스팅 → SKU)은 **판단**이다. 「이 둘이 같은 상품인가」는 데이터에 답이 없고,
 * 그래서 이 앱은 점수를 쓰기 함수의 인자로조차 받지 않는다(§21-6 완료 기준 b).
 *
 * 원가는 다르다. **사용자가 이미 원가표에 적어 둔 값을 옮기는 일**이고, 판단은 그
 * 표를 만들 때 끝났다. 46행을 손으로 치는 것은 사람의 시간을 쓰되 정확도는 떨어뜨린다
 * (오타 하나가 손익에 그대로 남는다).
 *
 * 스키마도 처음부터 그걸 알고 있었다 — `cost_history.entered_by CHECK IN ('user','import')`.
 * 001부터 있던 그 칸이 오늘 처음 `'import'`를 받는다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 덮어쓰지 않는다 ★
 * 같은 `(SKU · 종류 · 적용일)`이 이미 있으면 **건너뛴다**. `addCost`가 그 판정을
 * 하고(`replace`를 주지 않는다), 사람이 화면에서 넣은 값을 도구가 조용히 밀어내는
 * 일이 구조적으로 없다. 그래서 **여러 번 돌려도 안전하다.**
 */

import { existsSync, readFileSync } from "node:fs"
import { openNodeDriver } from "../../src/core/store/driver-node.js"
import { Repository } from "../../src/core/store/repository.js"
import { loadPnlSnapshot } from "../../src/core/profit/snapshot.js"

const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : dflt
}
const APPLY = process.argv.includes("--apply")
const DB = arg("db", ".tmp/pnl.sqlite")
const TABLE = arg("table", "_ref/원가/SKU별-입력표.tsv")
const FROM = arg("from", "2026-01-01")
const LIB = arg("lib", "lib-1")
const NOW = arg("now", new Date().toISOString().slice(0, 19))
const PERIOD = { from: arg("period-from", "2026-07-01"), to: arg("period-to", "2026-07-31") }

if (!existsSync(TABLE)) {
  console.error(`입력표가 없다: ${TABLE}`)
  process.exit(1)
}

/** 표에서 «상태 = 입력»인 행만. 사람 판정·못 찾음은 **비워 두는 것이 정직하다** (§22). */
const rows = readFileSync(TABLE, "utf-8")
  .split(/\r?\n/)
  .slice(1)
  .map((l) => l.split("\t"))
  .filter((c) => c.length >= 7 && c[3] !== "" && c[5]!.startsWith("입력"))
  .map((c) => ({ code: c[0]!, qty: Number(c[1]), amount: Number(c[3]), note: c[4]!, name: c[6]! }))

console.log(`${APPLY ? "실행" : "리허설"} — ${TABLE}에서 ${rows.length}행 · 적용일 ${FROM} · kind=COGS`)
if (rows.length === 0) process.exit(0)

const db = openNodeDriver(DB)
const repo = new Repository(db)
const before = await loadPnlSnapshot(db, LIB, PERIOD)

let inserted = 0
let skipped = 0
let missing = 0
const skippedRows: string[] = []
for (const r of rows) {
  const s = await db.prepare(`SELECT id FROM sku WHERE library_id = ? AND code = ?`).get(LIB, r.code)
  if (s === undefined) {
    missing++
    console.log(`  ✘ ${r.code} — 그 코드의 SKU가 없다`)
    continue
  }
  if (!APPLY) {
    const dup = await db
      .prepare(
        `SELECT amount FROM cost_history
          WHERE library_id = ? AND sku_id = ? AND kind = 'COGS' AND effective_from = ?`,
      )
      .get(LIB, String(s["id"]), FROM)
    if (dup) { skipped++; skippedRows.push(`${r.code} (이미 ${Number(dup["amount"]).toLocaleString("ko-KR")})`) }
    else inserted++
    continue
  }
  const out = await repo.addCost({
    libraryId: LIB,
    skuId: String(s["id"]),
    kind: "COGS",
    amount: r.amount,
    effectiveFrom: FROM,
    note: r.note,
    now: NOW,
    enteredBy: "import",
  })
  if (out.inserted) inserted++
  else { skipped++; skippedRows.push(`${r.code} (이미 ${(out.previous ?? 0).toLocaleString("ko-KR")})`) }
}

const after = APPLY ? await loadPnlSnapshot(db, LIB, PERIOD) : before
const won = (n: number): string => n.toLocaleString("ko-KR")
console.log(`\n넣은 것 ${inserted} · 이미 있어 건너뜀 ${skipped} · SKU 못 찾음 ${missing}`)
if (skippedRows.length > 0) console.log(`   건너뛴 것: ${skippedRows.slice(0, 8).join(" · ")}`)
console.log(`\n${PERIOD.from} ~ ${PERIOD.to}`)
console.log(`  매입원가  ${won(before.pnl.cogs)} → ${won(after.pnl.cogs)}`)
console.log(`  순이익    ${won(before.pnl.netProfit)} → ${won(after.pnl.netProfit)}`)
console.log(`  기여이익률 ${((before.pnl.productContribution / before.pnl.revenue) * 100).toFixed(1)}% → ${((after.pnl.productContribution / after.pnl.revenue) * 100).toFixed(1)}%`)
console.log(`  원가 못 붙은 품목 ${before.cogsBasis.itemsWithoutCost} → ${after.cogsBasis.itemsWithoutCost}`)
if (!APPLY) console.log(`\n실제로 넣으려면 --apply. 같은 (SKU·종류·적용일)은 덮지 않고 건너뛴다.`)
await db.close()
