/**
 * 리스팅이 하나도 안 붙은 SKU를 치운다.
 *
 *   npx tsx tools/harness/purge-orphans.ts [DB경로] [--yes]
 *
 * ★ 기본은 «보여주기»다 ★
 * `--yes` 없이 돌리면 **무엇이 지워질지만** 출력하고 아무것도 지우지 않는다.
 * 기준 데이터를 지우는 일이라 한 번 더 눈으로 보는 단계를 둔다.
 *
 * 고아는 «한 번 있었던 사고»가 아니라 연결을 옮기면 언제든 생기는 상태다 —
 * 리스팅을 다른 SKU로 재연결하면 원래 SKU가 빈다. 그래서 일회성 스크립트가 아니라
 * `Repository.purgeOrphanSkus` + 테스트로 두고, 이 파일은 그걸 부르기만 한다.
 */

import { openNodeDriver } from "../../src/core/store/driver-node.js"
import { Repository } from "../../src/core/store/repository.js"

const DB = process.argv[2]?.startsWith("--") ? ".tmp/pnl.sqlite" : (process.argv[2] ?? ".tmp/pnl.sqlite")
const apply = process.argv.includes("--yes")
const LIB = "lib-1"

const db = openNodeDriver(DB, { pragmas: false })
const repo = new Repository(db)

const orphans = await db
  .prepare(
    `SELECT s.id, s.code, s.name FROM sku s
      WHERE s.library_id = ?
        AND NOT EXISTS (SELECT 1 FROM marketplace_listing l
                         WHERE l.sku_id = s.id AND l.link_state = 'linked')
        AND NOT EXISTS (SELECT 1 FROM cost_history c WHERE c.sku_id = s.id)
      ORDER BY s.code`,
  )
  .all(LIB)

const total = await db.prepare(`SELECT COUNT(*) AS n FROM sku WHERE library_id = ?`).get(LIB)
console.log(`${DB} — SKU ${total?.["n"]}개 중 고아 ${orphans.length}개\n`)

for (const o of orphans) {
  console.log(`  ${String(o["code"]).padEnd(10)} ${String(o["name"]).slice(0, 56)}`)
}

if (orphans.length === 0) {
  console.log("치울 것이 없다.")
} else if (!apply) {
  console.log(`\n지우려면 --yes 를 붙인다. 리스팅도 원가도 붙지 않은 SKU만 대상이다.`)
} else {
  const r = await repo.purgeOrphanSkus(LIB)
  console.log(`\n지웠다 — SKU ${r.skus}개 · 껍데기 상품 ${r.products}개`)
}
await db.close()
