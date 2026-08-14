/**
 * 이미 있는 DB에 **밀린 마이그레이션만** 적용한다.
 *
 *   npx tsx tools/harness/migrate-db.ts [DB경로]
 *   기본값: .tmp/pnl.sqlite
 *
 * ★ 왜 필요한가 (2026-08-14) ★
 * `pnl.ts`는 DB를 **새로 만든다** — 돌리면 2d에서 사람이 만든 연결 79개와 SKU 61개가
 * 사라진다. 그런데 마이그레이션이 늘면(005) 기존 DB는 옛 스키마에 멈춰 있고, 앱과
 * 테스트가 `no such column`으로 죽는다.
 *
 * 즉 «새로 만들기»와 «그대로 두기» 사이에 **«따라잡기»가 없었다.** 그게 이 도구다.
 * `ALTER TABLE ADD COLUMN`은 가산적이고 `migrate`는 멱등하므로(테스트가 지킨다)
 * 몇 번 돌려도 안전하다.
 */

import { existsSync } from "node:fs"
import { openNodeDriver } from "../../src/core/store/driver-node.js"
import { migrate } from "../../src/core/store/migrate-node.js"

const DB = process.argv[2] ?? ".tmp/pnl.sqlite"

if (!existsSync(DB)) {
  console.error(`DB가 없다: ${DB}`)
  process.exit(1)
}

const db = openNodeDriver(DB, { pragmas: false })
try {
  const before = await db.prepare(`SELECT MAX(version) AS v FROM schema_migration`).get()
  const applied = await migrate(db)
  const after = await db.prepare(`SELECT MAX(version) AS v FROM schema_migration`).get()

  console.log(`${DB}`)
  console.log(`  이전 버전  ${String(before?.["v"] ?? "-")}`)
  console.log(`  적용       ${applied.length === 0 ? "없음 (이미 최신)" : applied.map((m) => m.version).join(", ")}`)
  console.log(`  현재 버전  ${String(after?.["v"] ?? "-")}`)
} finally {
  await db.close()
}
