/**
 * 기간 경계 — **마지막 날이 사라지지 않는가.**
 *
 * 실제로 사라졌다. 2026-08-12 실측:
 *
 *   ESM 7월 주문 155건 중 7월 31일 3건(97,600원)이 조용히 빠져
 *   총매출이 8,285,200 → 8,187,600으로 나왔다.
 *
 * 원인은 매핑도 정규화도 아니고 **범위 질의**였다. `ordered_at`이
 * `2026-07-31T16:41:20`처럼 시각을 갖는데 `BETWEEN ? AND '2026-07-31'`은
 * 문자열 비교라 그것을 범위 밖으로 판정한다 — 접두가 같고 뒤가 길면
 * 사전순으로 뒤에 오기 때문이다.
 *
 * 이런 버그를 잡는 테스트가 없어서 CLI 출력의 숫자 차이로 발견됐다.
 * 여기가 그 자리를 메운다.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository, type BatchOpen } from "../src/core/store/repository.js"
import type { Driver } from "../src/core/store/driver.js"

const LIB = "lib-1"
const CONN = "conn-1"

const BATCH: BatchOpen = {
  id: "b-1",
  libraryId: LIB,
  connectionId: CONN,
  sourceName: "orders.xlsx",
  sourceBytes: 10,
  containerFormat: "xlsx",
  mappingVersion: "esm/order/order-line@1",
  startedAt: "2026-08-12T00:00:00Z",
}

let db: Driver
let repo: Repository

beforeEach(async () => {
  db = openNodeDriver()
  await migrate(db)
  await db.prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`).run(LIB, "기본", "t0")
  await db
    .prepare(
      `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(CONN, LIB, "kr-marketplace", "esm", "연결", "CONNECTED", "t0", "t0")
  repo = new Repository(db)
  await repo.openBatch(BATCH)
})

const order = (n: number, at: string, amount: number) => ({
  id: `o${n}`,
  source_key: `K${n}`,
  ordered_at: at,
  status: "송금완료",
  total_amount: amount,
})

describe("기간 경계 — 마지막 날의 시각값이 빠지지 않는다", () => {
  it("★ 7월 31일의 시각값 3건이 7월 조회에 들어온다 ★ (실측 회귀)", async () => {
    // 실제로 빠졌던 그 세 행이다.
    await repo.loadChunk("fact_order", BATCH, [
      order(1, "2026-07-31T16:41:20", 31_800),
      order(2, "2026-07-31T15:40:09", 45_900),
      order(3, "2026-07-31T13:27:52", 19_900),
      order(4, "2026-07-15T09:00:00", 100_000),
    ])
    await repo.commitBatch(BATCH.id, "t")

    const n = await repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")
    const sum = await repo.sumInRange(
      "active_order",
      "total_amount",
      LIB,
      "ordered_at",
      "2026-07-01",
      "2026-07-31",
    )
    expect(n).toBe(4)
    // 97,600 = 31,800 + 45,900 + 19,900 — 사라졌던 금액이다.
    expect(sum).toBe(197_600)
  })

  it("시각이 없는 값(바닥 날짜)도 그대로 포함된다", async () => {
    await repo.loadChunk("fact_order", BATCH, [
      order(1, "2026-07-01", 1_000),
      order(2, "2026-07-31", 2_000),
    ])
    await repo.commitBatch(BATCH.id, "t")
    expect(await repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")).toBe(2)
  })

  it("범위 밖은 여전히 밖이다 — 경계를 넓히지 않았다", async () => {
    await repo.loadChunk("fact_order", BATCH, [
      order(1, "2026-06-30T23:59:59", 1_000), // 하루 전
      order(2, "2026-08-01T00:00:00", 2_000), // 하루 뒤
      order(3, "2026-08-01", 3_000),
      order(4, "2026-07-31T23:59:59", 4_000), // 마지막 순간 — 들어와야 한다
    ])
    await repo.commitBatch(BATCH.id, "t")

    const n = await repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")
    const sum = await repo.sumInRange(
      "active_order",
      "total_amount",
      LIB,
      "ordered_at",
      "2026-07-01",
      "2026-07-31",
    )
    expect(n).toBe(1)
    expect(sum).toBe(4_000)
  })

  it("하루짜리 기간도 그날의 시각값을 전부 담는다", async () => {
    await repo.loadChunk("fact_order", BATCH, [
      order(1, "2026-07-15T00:00:00", 1_000),
      order(2, "2026-07-15T23:59:59", 2_000),
      order(3, "2026-07-16T00:00:00", 4_000),
    ])
    await repo.commitBatch(BATCH.id, "t")
    expect(
      await repo.sumInRange("active_order", "total_amount", LIB, "ordered_at", "2026-07-15", "2026-07-15"),
    ).toBe(3_000)
  })

  it("월·연 경계를 넘어도 맞다", async () => {
    await repo.loadChunk("fact_order", BATCH, [
      order(1, "2026-12-31T18:00:00", 1_000),
      order(2, "2027-01-01T09:00:00", 2_000),
    ])
    await repo.commitBatch(BATCH.id, "t")
    expect(
      await repo.sumInRange("active_order", "total_amount", LIB, "ordered_at", "2026-12-01", "2026-12-31"),
    ).toBe(1_000)
    expect(
      await repo.sumInRange("active_order", "total_amount", LIB, "ordered_at", "2026-12-31", "2027-01-01"),
    ).toBe(3_000)
  })
})
