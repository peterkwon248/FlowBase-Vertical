import { describe, it, expect, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository, type BatchOpen } from "../src/core/store/repository.js"

/**
 * U-1 — 다중 배치에서의 UPSERT × 되돌리기.
 *
 * 헌장 B-2는 "되돌리기 = 해당 batch 행 제거"라고 적었지만, 그 문장은 한 행이
 * 한 배치에만 속할 때만 참이다. UPSERT가 있으면 한 행이 여러 배치를 거친다:
 *
 *   배치 A가 주문 X를 넣는다        → X.batch_id = A
 *   배치 B가 같은 X를 다시 가져온다  → X.batch_id = B (UPSERT)
 *   배치 B를 되돌린다               → X가 통째로 사라진다  ← 틀렸다
 *
 * X는 A가 정당하게 들여온 행이다. B의 되돌리기가 A의 데이터를 파괴하면 안 된다.
 *
 * 올바른 의미론:
 *   B가 **신규 삽입한** 행 → 삭제
 *   B가 **갱신한** 행     → 이전 버전으로 복원
 */

const LIB = "lib-1"
const CONN = "conn-1"

async function seed(db: Driver): Promise<void> {
  await migrate(db)
  await db.prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`).run(LIB, "기본", "t0")
  await db.prepare(
    `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(CONN, LIB, "kr-marketplace", "mk-a", "연결 1", "CONNECTED", "t0", "t0")
}

function batch(id: string, at: string): BatchOpen {
  return {
    id,
    libraryId: LIB,
    connectionId: CONN,
    sourceName: `${id}.xlsx`,
    sourceBytes: 100,
    containerFormat: "xlsx",
    mappingVersion: "mk-a/order/order@1",
    startedAt: at,
  }
}

const inRange = async (repo: Repository) =>
  repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")

describe("U-1 — 배치 B의 되돌리기가 배치 A의 행을 파괴하지 않는다", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver()
    await seed(db)
    repo = new Repository(db)
  })

  it("A가 넣고 B가 갱신한 행은 B를 되돌리면 A 버전으로 남는다", async () => {
    const a = batch("b-A", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [
      { id: "o-1", source_key: "SK-1", ordered_at: "2026-07-10", status: "PAID", total_amount: 1000 },
    ])
    await repo.commitBatch("b-A", "t1")

    const b = batch("b-B", "t2")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [
      { id: "o-1", source_key: "SK-1", ordered_at: "2026-07-10", status: "SHIPPED", total_amount: 1500 },
    ])
    await repo.commitBatch("b-B", "t2")

    // B 적용 후: 값이 갱신되고 batch_id가 B로 옮겨갔다.
    let row = await db.prepare(`SELECT * FROM fact_order WHERE source_key='SK-1'`).get()
    expect(row?.total_amount).toBe(1500)
    expect(row?.batch_id).toBe("b-B")
    expect(row?.version).toBe(2)

    await repo.undoBatch("b-B", "t3")

    // ★ 여기가 핵심 ★ 행은 남아 있어야 하고, A가 넣었던 값이어야 한다.
    expect(await inRange(repo), "B를 되돌렸더니 A의 행까지 사라졌다").toBe(1)
    row = await db.prepare(`SELECT * FROM fact_order WHERE source_key='SK-1'`).get()
    expect(row?.total_amount).toBe(1000)
    expect(row?.status).toBe("PAID")
    expect(row?.batch_id).toBe("b-A")
    expect(row?.version).toBe(1)
  })

  it("B가 신규로 넣은 행만 삭제된다", async () => {
    const a = batch("b-A", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [
      { id: "o-1", source_key: "SK-1", ordered_at: "2026-07-10", status: "PAID", total_amount: 1000 },
    ])
    await repo.commitBatch("b-A", "t1")

    const b = batch("b-B", "t2")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [
      // 갱신 1건 + 신규 1건
      { id: "o-1", source_key: "SK-1", ordered_at: "2026-07-10", status: "SHIPPED", total_amount: 1500 },
      { id: "o-2", source_key: "SK-2", ordered_at: "2026-07-11", status: "PAID", total_amount: 2000 },
    ])
    await repo.commitBatch("b-B", "t2")
    expect(await inRange(repo)).toBe(2)

    await repo.undoBatch("b-B", "t3")

    // 갱신된 것은 복원, 신규는 삭제 → 1행.
    expect(await inRange(repo)).toBe(1)
    expect((await db.prepare(`SELECT COUNT(*) AS n FROM fact_order WHERE source_key='SK-2'`).get())?.n).toBe(0)
    expect(
      (await db.prepare(`SELECT total_amount FROM fact_order WHERE source_key='SK-1'`).get())?.total_amount,
    ).toBe(1000)
  })

  it("세 배치가 겹쳐도 마지막 것만 되돌아간다", async () => {
    for (const [i, id] of ["b-A", "b-B", "b-C"].entries()) {
      const bt = batch(id, `t${i + 1}`)
      await repo.openBatch(bt)
      await repo.loadChunk("fact_order", bt, [
        {
          id: "o-1",
          source_key: "SK-1",
          ordered_at: "2026-07-10",
          status: "PAID",
          total_amount: (i + 1) * 1000,
        },
      ])
      await repo.commitBatch(id, `t${i + 1}`)
    }
    expect((await db.prepare(`SELECT total_amount FROM fact_order`).get())?.total_amount).toBe(3000)

    await repo.undoBatch("b-C", "t4")
    expect((await db.prepare(`SELECT total_amount FROM fact_order`).get())?.total_amount).toBe(2000)
    expect((await db.prepare(`SELECT batch_id FROM fact_order`).get())?.batch_id).toBe("b-B")

    await repo.undoBatch("b-B", "t5")
    expect((await db.prepare(`SELECT total_amount FROM fact_order`).get())?.total_amount).toBe(1000)
    expect((await db.prepare(`SELECT batch_id FROM fact_order`).get())?.batch_id).toBe("b-A")

    await repo.undoBatch("b-A", "t6")
    expect(await inRange(repo)).toBe(0)
  })

  it("되돌린 배치의 그림자는 함께 정리된다", async () => {
    const a = batch("b-A", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [
      { id: "o-1", source_key: "SK-1", ordered_at: "2026-07-10", status: "PAID", total_amount: 1000 },
    ])
    await repo.commitBatch("b-A", "t1")

    const b = batch("b-B", "t2")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [
      { id: "o-1", source_key: "SK-1", ordered_at: "2026-07-10", status: "SHIPPED", total_amount: 1500 },
    ])
    await repo.commitBatch("b-B", "t2")
    expect(Number((await db.prepare(`SELECT COUNT(*) AS n FROM row_shadow`).get())?.n)).toBe(1)

    await repo.undoBatch("b-B", "t3")
    expect(Number((await db.prepare(`SELECT COUNT(*) AS n FROM row_shadow`).get())?.n)).toBe(0)
  })

  it("조정은 여전히 살아남는다 (기준 3과 함께 성립)", async () => {
    const a = batch("b-A", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [
      { id: "o-1", source_key: "SK-1", ordered_at: "2026-07-10", status: "PAID", total_amount: 1000 },
    ])
    await repo.commitBatch("b-A", "t1")

    await repo.addAdjustment({
      libraryId: LIB,
      connectionId: CONN,
      table: "fact_order",
      sourceKey: "SK-1",
      field: "total_amount",
      previousValue: 1000,
      newValue: 1100,
      reason: "정정",
      createdAt: "t1b",
    })

    const b = batch("b-B", "t2")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [
      { id: "o-1", source_key: "SK-1", ordered_at: "2026-07-10", status: "SHIPPED", total_amount: 1500 },
    ])
    await repo.commitBatch("b-B", "t2")
    await repo.undoBatch("b-B", "t3")

    expect(await repo.adjustmentsFor(CONN, "fact_order", "SK-1")).toHaveLength(1)
    expect(await inRange(repo)).toBe(1)
  })
})
