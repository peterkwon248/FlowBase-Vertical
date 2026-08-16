/**
 * 월 전환 — **8월이 들어와도 7월이 7월로 남는가.**
 *
 * MVP의 세 동작(다운로드 → 위저드 → 대시보드) 중 셋째가 **다음 달에도** 성립하려면
 * 두 가지가 각각 참이어야 한다:
 *
 * ```
 * ① 조회 층   두 달이 한 DB에 공존할 때 각 달의 숫자가 서로 안 섞인다
 * ② 화면 층   사용자가 볼 달을 고를 수 있다
 * ```
 *
 * **①을 먼저 잰다.** ②(월 선택기)를 붙였는데 ①이 거짓이면, 사용자는 달을 바꿀
 * 때마다 틀린 숫자를 보게 되고 그게 더 나쁘다 — 지금은 «7월만 보인다»라 최소한
 * 보이는 숫자는 맞다.
 *
 * 합성 데이터인 것은 의도다. 7월 실데이터에 8월 실파일이 아직 없고(8월은 진행
 * 중이다), 여기서 물어야 하는 것은 «우리 파일이 어떻게 생겼나»가 아니라
 * **«두 달이 섞이는 분기가 살아 있나»**다 (ADR-007의 합성 규율 — 정답지는
 * 합성하지 않는다).
 */

import { describe, expect, it, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository, type BatchOpen } from "../src/core/store/repository.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { loadOrderRows } from "../src/core/order/rows.js"
import { loadSettlementRows } from "../src/core/settlement/rows.js"
import type { Period } from "../src/core/profit/index.js"
import type { Driver } from "../src/core/store/driver.js"

const LIB = "lib-1"
const CONN = "conn-1"
const JULY: Period = { from: "2026-07-01", to: "2026-07-31" }
const AUG: Period = { from: "2026-08-01", to: "2026-08-31" }

let db: Driver
let repo: Repository

const batch = (id: string, name: string): BatchOpen => ({
  id,
  libraryId: LIB,
  connectionId: CONN,
  sourceName: name,
  sourceBytes: 10,
  containerFormat: "xlsx",
  mappingVersion: "esm/order/order-line@1",
  startedAt: "2026-09-01T00:00:00Z",
})

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
})

const order = (k: string, at: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id: `o-${k}`,
  source_key: k,
  ordered_at: at,
  status: "송금완료",
  total_amount: amount,
  ...extra,
})

const settlement = (k: string, orderKey: string, on: string, fee: number) => ({
  id: `s-${k}`,
  source_key: k,
  order_source_key: orderKey,
  settled_on: on,
  gross_amount: 0,
  fee_amount: fee,
  vat_amount: 0,
  shipping_amount: 0,
  net_amount: 0,
})

/** 두 달치를 각각 제 batch로 넣는다 — 실제 사용도 «달마다 파일 한 번»이다. */
async function loadTwoMonths(): Promise<void> {
  const jul = batch("b-jul", "26년 7월 주문.xlsx")
  await repo.openBatch(jul)
  await repo.loadChunk("fact_order", jul, [
    order("J1", "2026-07-05T10:00:00", 100_000),
    order("J2", "2026-07-31T23:10:00", 50_000),
  ])
  await repo.loadChunk("fact_settlement", jul, [settlement("SJ1", "J1", "2026-07-20", 7_000)])
  await repo.loadChunk("fact_claim", jul, [
    {
      id: "c-J1",
      source_key: "CJ1",
      order_source_key: "J1",
      claim_type: "RETURN",
      status: "완료",
      claimed_at: "2026-07-25",
      amount: 9_000,
    },
  ])
  await repo.loadChunk("fact_ad_spend", jul, [
    {
      id: "a-J1",
      source_key: "AJ1",
      campaign_key: "cam-1",
      campaign_name: "7월 캠페인",
      spent_on: "2026-07-10",
      campaign_type: "GROWTH",
      impressions: 10,
      clicks: 1,
      spend_amount: 3_000,
      conversions: 0,
      conversion_amount: 0,
    },
  ])
  await repo.commitBatch(jul.id, "t1")

  const aug = batch("b-aug", "26년 8월 주문.xlsx")
  await repo.openBatch(aug)
  await repo.loadChunk("fact_order", aug, [
    order("A1", "2026-08-03T09:00:00", 200_000),
    order("A2", "2026-08-31T22:00:00", 30_000),
  ])
  await repo.loadChunk("fact_settlement", aug, [settlement("SA1", "A1", "2026-08-20", 11_000)])
  await repo.loadChunk("fact_claim", aug, [
    {
      id: "c-A1",
      source_key: "CA1",
      order_source_key: "A1",
      claim_type: "CANCEL",
      status: "완료",
      claimed_at: "2026-08-15",
      amount: 4_000,
    },
  ])
  await repo.loadChunk("fact_ad_spend", aug, [
    {
      id: "a-A1",
      source_key: "AA1",
      campaign_key: "cam-1",
      campaign_name: "8월 캠페인",
      spent_on: "2026-08-10",
      campaign_type: "GROWTH",
      impressions: 20,
      clicks: 2,
      spend_amount: 5_000,
      conversions: 0,
      conversion_amount: 0,
    },
  ])
  await repo.commitBatch(aug.id, "t2")
}

describe("월 전환 — 두 달이 공존해도 각 달이 제 숫자를 낸다", () => {
  it("★ 손익 스냅샷이 달마다 갈린다 — 매출·광고비·클레임 전부 ★", async () => {
    await loadTwoMonths()
    const jul = await loadPnlSnapshot(db, LIB, JULY)
    const aug = await loadPnlSnapshot(db, LIB, AUG)

    expect(jul.pnl.revenue).toBe(150_000)
    expect(aug.pnl.revenue).toBe(230_000)
    expect(jul.orderCount).toBe(2)
    expect(aug.orderCount).toBe(2)
    expect(jul.pnl.adDirect + jul.pnl.adUnallocated).toBe(3_000)
    expect(aug.pnl.adDirect + aug.pnl.adUnallocated).toBe(5_000)
    expect(jul.pnl.claims).toBe(9_000)
    expect(aug.pnl.claims).toBe(4_000)
    expect(jul.claimCount).toBe(1)
    expect(aug.claimCount).toBe(1)
  })

  it("주문 목록·정산 목록도 달마다 갈린다 (화면이 읽는 그 함수)", async () => {
    await loadTwoMonths()
    const julOrders = await loadOrderRows(db, LIB, JULY)
    const augOrders = await loadOrderRows(db, LIB, AUG)
    // 주문 2 + 홀로 선 클레임은 주문에 붙으므로 행 수는 2다 (order/rows.ts의 통합).
    expect(julOrders.every((r) => r.at.startsWith("2026-07"))).toBe(true)
    expect(augOrders.every((r) => r.at.startsWith("2026-08"))).toBe(true)
    expect(julOrders.length).toBeGreaterThan(0)
    expect(augOrders.length).toBeGreaterThan(0)

    const julSet = await loadSettlementRows(db, LIB, JULY)
    const augSet = await loadSettlementRows(db, LIB, AUG)
    expect(julSet.length).toBe(1)
    expect(augSet.length).toBe(1)
  })

  it("8월을 넣어도 7월 숫자가 안 변한다 — 이 두 값이 MVP의 신뢰다", async () => {
    const jul = batch("b-jul", "26년 7월 주문.xlsx")
    await repo.openBatch(jul)
    await repo.loadChunk("fact_order", jul, [
      order("J1", "2026-07-05T10:00:00", 100_000),
      order("J2", "2026-07-31T23:10:00", 50_000),
    ])
    await repo.commitBatch(jul.id, "t1")
    const before = await loadPnlSnapshot(db, LIB, JULY)

    const aug = batch("b-aug", "26년 8월 주문.xlsx")
    await repo.openBatch(aug)
    await repo.loadChunk("fact_order", aug, [order("A1", "2026-08-03T09:00:00", 200_000)])
    await repo.commitBatch(aug.id, "t2")
    const after = await loadPnlSnapshot(db, LIB, JULY)

    expect(after.pnl.revenue).toBe(before.pnl.revenue)
    expect(after.orderCount).toBe(before.orderCount)
    expect(after.pnl.netProfit).toBe(before.pnl.netProfit)
  })

  /**
   * ★ 실제로 매달 일어나는 모양 — **8월에 정산되는 7월 주문** ★
   *
   * ADR-009 ①은 「금액은 정산에서, 날짜는 주문에서」다. 그래서 8월 정산 파일에 든
   * 7월 주문의 수수료는 **7월 손익**에 잡혀야 한다. 이게 안 되면 사용자는 7월을
   * 닫은 뒤에 수수료가 8월로 새는 것을 본다.
   */
  it("★ 8월에 정산된 7월 주문의 수수료는 7월에 잡힌다 (ADR-009 ①) ★", async () => {
    const jul = batch("b-jul", "26년 7월 주문.xlsx")
    await repo.openBatch(jul)
    await repo.loadChunk("fact_order", jul, [order("J1", "2026-07-05T10:00:00", 100_000)])
    await repo.commitBatch(jul.id, "t1")

    // 8월에 들어온 정산 파일. 대상은 7월 주문이다.
    const aug = batch("b-aug", "26년 8월 정산.xlsx")
    await repo.openBatch(aug)
    await repo.loadChunk("fact_settlement", aug, [settlement("SA1", "J1", "2026-08-10", 12_000)])
    await repo.commitBatch(aug.id, "t2")

    const julSnap = await loadPnlSnapshot(db, LIB, JULY)
    const augSnap = await loadPnlSnapshot(db, LIB, AUG)

    expect(julSnap.pnl.fee).toBe(12_000)
    expect(augSnap.pnl.fee).toBe(0)
  })

  /**
   * 기간 집계 행(제트 로켓그로스, 마이그레이션 005)은 `ordered_at`이 기간 시작일이다.
   * 8월 파일의 기간 집계가 7월로 새지 않는지 본다 — 월 전환의 가장 미묘한 자리다.
   */
  it("기간 집계 행도 제 달에만 선다 (date_precision='period')", async () => {
    const jul = batch("b-jul", "26년 7월 제트.xlsx")
    await repo.openBatch(jul)
    await repo.loadChunk("fact_order", jul, [
      order("JP", "2026-07-01", 70_000, { date_precision: "period", period_end: "2026-07-31" }),
    ])
    await repo.commitBatch(jul.id, "t1")

    const aug = batch("b-aug", "26년 8월 제트.xlsx")
    await repo.openBatch(aug)
    await repo.loadChunk("fact_order", aug, [
      order("AP", "2026-08-01", 80_000, { date_precision: "period", period_end: "2026-08-31" }),
    ])
    await repo.commitBatch(aug.id, "t2")

    const julSnap = await loadPnlSnapshot(db, LIB, JULY)
    const augSnap = await loadPnlSnapshot(db, LIB, AUG)
    expect(julSnap.pnl.revenue).toBe(70_000)
    expect(augSnap.pnl.revenue).toBe(80_000)
    expect(julSnap.periodAggregated.count).toBe(1)
    expect(augSnap.periodAggregated.count).toBe(1)
    // 달 안에 온전히 들어가므로 «달 경계를 걸친» 행은 0이어야 한다.
    expect(julSnap.periodAggregated.spilling).toBe(0)
    expect(augSnap.periodAggregated.spilling).toBe(0)
  })
})
