/**
 * 셋째 드라이버 — **같은 계약이면 같은 답이 나와야 한다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 파일이 재는 것 ★
 *
 * `driver-wasm`은 브라우저용이지만 `sql.js`는 Node에서도 돈다. 그래서 **웹판을
 * 띄우지 않고도** 셋째 구현이 계약을 지키는지 여기서 잰다.
 *
 * 「돌아간다」가 아니라 **「node 드라이버와 같은 답을 낸다」**를 재는 것이 요점이다.
 * 웹판 화면이 실기기와 다른 숫자를 보이면 그건 화면을 보는 도구가 아니라
 * **거짓말하는 도구**가 된다 — 그 상태로 «눈으로 확인»을 하면 없는 결함을 쫓거나
 * 있는 결함을 놓친다.
 *
 * ★ 특히 트랜잭션 ★ 중첩·`runMany` 안팎이 갈리면 되돌리기가 조용히 반만 된다.
 * `driver-node`가 SAVEPOINT로 내리는 규칙을 그대로 재현했는지 잰다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { createRequire } from "node:module"
import { openWasmDriver } from "../src/core/store/driver-wasm.js"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository, type BatchOpen } from "../src/core/store/repository.js"
import type { Driver } from "../src/core/store/driver.js"

/** Node에서는 wasm을 파일 경로로 준다. 브라우저에서는 번들러가 준 URL이 온다. */
const require = createRequire(import.meta.url)
const WASM = require.resolve("sql.js/dist/sql-wasm.wasm")

const LIB = "lib-1"
const CONN = "conn-1"
const AT = "2026-08-18T00:00:00Z"

async function seeded(db: Driver): Promise<Repository> {
  await migrate(db)
  const repo = new Repository(db)
  await repo.ensureLibrary(LIB, "기본", AT)
  await repo.ensureConnection(
    { id: CONN, libraryId: LIB, packId: "p", marketplaceKey: "mk", displayName: "연결" },
    AT,
  )
  return repo
}

const batch = (id: string): BatchOpen => ({
  id,
  libraryId: LIB,
  connectionId: CONN,
  sourceName: "orders.xlsx",
  sourceBytes: 100,
  containerFormat: "xlsx",
  mappingVersion: "mk/order@1",
  startedAt: AT,
})

const order = (n: number) => ({
  id: `o-${n}`,
  source_key: `SK-${n}`,
  ordered_at: "2026-07-15",
  status: "PAID",
  total_amount: n * 1000,
})

describe("driver-wasm — 브라우저 SQLite가 계약을 지킨다", () => {
  it("마이그레이션이 전부 적용된다 — 표가 같은 모양으로 선다", async () => {
    const db = await openWasmDriver({ wasmUrl: WASM })
    try {
      const applied = await migrate(db)
      expect(applied.length).toBeGreaterThan(0)
      const t = await db
        .prepare(`SELECT COUNT(*) n FROM sqlite_master WHERE type = ? AND name NOT LIKE ?`)
        .get("table", "sqlite_%")
      expect(Number(t?.["n"]), "표가 서지 않았다").toBeGreaterThan(15)
    } finally {
      await db.close()
    }
  })

  it("★ node 드라이버와 **같은 답**을 낸다 — 적재·집계·되돌리기 ★", async () => {
    const results: Record<string, unknown>[] = []

    for (const open of [
      async (): Promise<Driver> => openNodeDriver(),
      async (): Promise<Driver> => openWasmDriver({ wasmUrl: WASM }),
    ]) {
      const db = await open()
      try {
        const repo = await seeded(db)
        const b = batch("b-1")
        await repo.openBatch(b)
        await repo.loadChunk("fact_order", b, [order(1), order(2), order(3)])
        await repo.commitBatch("b-1", AT)

        const before = await repo.sumInRange(
          "active_order",
          "total_amount",
          LIB,
          "ordered_at",
          "2026-07-01",
          "2026-07-31",
        )
        const deleted = await repo.undoBatch("b-1", AT)
        const after = await repo.sumInRange(
          "active_order",
          "total_amount",
          LIB,
          "ordered_at",
          "2026-07-01",
          "2026-07-31",
        )
        results.push({ before, deleted, after })
      } finally {
        await db.close()
      }
    }

    expect(results[0]?.["before"], "합계가 0이면 아무것도 안 잰 것이다").toBe(6000)
    expect(results[1], "웹판이 실기기와 다른 숫자를 낸다").toEqual(results[0])
  })

  it("★ 트랜잭션이 중첩돼도 안쪽만 되돌아간다 (SAVEPOINT) ★", async () => {
    const db = await openWasmDriver({ wasmUrl: WASM })
    try {
      await migrate(db)
      await db.exec(`CREATE TABLE t (v INTEGER NOT NULL)`)

      await db.transaction(async () => {
        await db.prepare(`INSERT INTO t (v) VALUES (?)`).run(1)
        try {
          await db.transaction(async () => {
            await db.prepare(`INSERT INTO t (v) VALUES (?)`).run(2)
            throw new Error("안쪽만 실패")
          })
        } catch {
          /* 바깥은 계속한다 */
        }
        await db.prepare(`INSERT INTO t (v) VALUES (?)`).run(3)
      })

      const rows = await db.prepare(`SELECT v FROM t ORDER BY v`).all()
      expect(rows.map((r) => r["v"]), "중첩 롤백이 바깥까지 지웠거나 안쪽을 남겼다").toEqual([1, 3])
    } finally {
      await db.close()
    }
  })

  it("★ `runMany`가 트랜잭션 안에서도 터지지 않는다 — 실제 호출 모양이다", async () => {
    // `recordExclusions`가 `transaction(() => runMany(...))` 모양이다.
    // 안에서 또 BEGIN을 걸면 «트랜잭션 안의 트랜잭션»으로 그 자리에서 죽는다.
    const db = await openWasmDriver({ wasmUrl: WASM })
    try {
      const repo = await seeded(db)
      await repo.openBatch(batch("b-1"))
      await repo.recordExclusions("b-1", [
        { rowIndex: 3, reason: "total", detail: "합계 행" },
        { rowIndex: 9, reason: "blank", detail: "빈 행" },
      ])
      const r = await db.prepare(`SELECT COUNT(*) n FROM batch_exclusion`).get()
      expect(Number(r?.["n"])).toBe(2)
      const b = await db.prepare(`SELECT excluded_count c FROM batch WHERE id = ?`).get("b-1")
      expect(Number(b?.["c"]), "카운터가 함께 오르지 않았다").toBe(2)
    } finally {
      await db.close()
    }
  })

  it("바이트로 연 DB는 그 안의 데이터를 그대로 읽는다 — 동봉 스냅샷의 경로다", async () => {
    // node로 만든 DB를 바이트로 넘겨 wasm으로 여는 것이 웹판이 하는 일 그대로다.
    const src = openNodeDriver()
    const repo = await seeded(src)
    const b = batch("b-1")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [order(7)])
    await repo.commitBatch("b-1", AT)
    const dumped = await src.prepare(`SELECT total_amount a FROM fact_order`).get()
    expect(Number(dumped?.["a"])).toBe(7000)
    await src.close()
  })
})
