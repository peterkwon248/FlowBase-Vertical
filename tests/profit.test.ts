/**
 * 손익 3층 계산기 — 유일한 구현이므로 여기가 유일한 방어선이다 (작업-상태 LOCK).
 *
 * 화면이 이 계산기를 소비만 하기로 했으므로, 목업의 `profit()`이 갖고 있던
 * 결함(이슈 20·22·23)은 "이식하며 고친다"가 아니라 **여기서 처음부터 옳다**로
 * 해소된다. 그 옳음을 여기서 못 박는다.
 */

import { describe, it, expect } from "vitest"
import { computePnl, prorateFixed, daysInPeriod, type Period } from "../src/core/profit/index.js"

const JULY: Period = { from: "2026-07-01", to: "2026-07-31" }

const base = {
  period: JULY,
  revenue: 0,
  fee: 0,
  vat: 0,
  shipping: 0,
  claims: [] as { type: string; amount: number }[],
  cogs: 0,
  adDirect: 0,
  adUnallocated: 0,
}

describe("손익 3층 — 층이 실제로 갈린다", () => {
  it("상품 → 채널 → 회사 순으로 빠진다", () => {
    const p = computePnl({
      ...base,
      revenue: 1_000_000,
      fee: 100_000,
      vat: 50_000,
      shipping: 20_000,
      cogs: 400_000,
      adDirect: 80_000,
      ops: 30_000,
      adUnallocated: 70_000,
      fixed: 60_000,
    })
    // 1,000,000 − 100,000 − 50,000 − 20,000 − 400,000 − 80,000 − 30,000
    expect(p.productContribution).toBe(320_000)
    expect(p.channelContribution).toBe(250_000) // − 미배분 광고비 70,000
    expect(p.netProfit).toBe(190_000) // − 고정비 60,000
  })

  it("★ 상품 기여이익의 합은 회사 순이익이 아니다 ★ — 미배분 광고비·고정비 때문", () => {
    const p = computePnl({ ...base, revenue: 100_000, adUnallocated: 10_000, fixed: 5_000 })
    expect(p.productContribution).toBe(100_000)
    expect(p.netProfit).toBe(85_000)
    expect(p.productContribution).not.toBe(p.netProfit)
  })
})

describe("클레임 — 유형이 부호를 정한다 (ADR-009 ②)", () => {
  it("취소·반품·환불은 빠지고 교환은 빠지지 않는다", () => {
    const p = computePnl({
      ...base,
      revenue: 1_000_000,
      claims: [
        { type: "CANCEL", amount: 10_000 },
        { type: "RETURN", amount: 20_000 },
        { type: "REFUND", amount: 30_000 },
        { type: "EXCHANGE", amount: 99_999 }, // 매출을 되돌리지 않는다
      ],
    })
    expect(p.claims).toBe(60_000)
    expect(p.productContribution).toBe(940_000)
  })

  it("음수로 들어와도 크기로 읽는다 — 두 번 빠지지 않는다", () => {
    // ADR-009 ②: 저장은 양수지만, 호출자가 실수로 음수를 넣어도 부호가 뒤집혀
    // 매출이 늘어나는 일은 없어야 한다.
    const p = computePnl({ ...base, revenue: 100_000, claims: [{ type: "REFUND", amount: -5_000 }] })
    expect(p.claims).toBe(5_000)
    expect(p.productContribution).toBe(95_000)
  })
})

describe("고정비 안분 — 이슈 20의 해소 (조회 기간 기준)", () => {
  it("한 달 전체를 조회하면 월 고정비가 통째로 들어간다", () => {
    expect(prorateFixed(3_100_000, JULY)).toBe(3_100_000)
  })

  it("★ 기간을 좁히면 고정비도 줄어든다 ★ — 8/31 고정이 아니다", () => {
    // 7월 1~10일 = 10/31. 목업은 여기서도 월 전액을 넣어 순이익을 처박았다.
    const p = prorateFixed(3_100_000, { from: "2026-07-01", to: "2026-07-10" })
    expect(p).toBe(1_000_000)
    expect(p).toBeLessThan(3_100_000)
  })

  it("달의 길이를 실제로 센다 — 30일 근사를 쓰지 않는다", () => {
    // 2월(28일)의 하루와 7월(31일)의 하루는 다른 비율이다.
    const feb = prorateFixed(280_000, { from: "2026-02-01", to: "2026-02-01" })
    const jul = prorateFixed(310_000, { from: "2026-07-01", to: "2026-07-01" })
    expect(feb).toBe(10_000)
    expect(jul).toBe(10_000)
  })

  it("여러 달에 걸치면 달마다 안분해 더한다", () => {
    // 7월 전체(31/31) + 8월 1일(1/31)
    expect(prorateFixed(310_000, { from: "2026-07-01", to: "2026-08-01" })).toBe(310_000 + 10_000)
  })

  it("잔차가 생겨도 원금을 넘지 않는다 (ADR-009 ③)", () => {
    for (let d = 1; d <= 31; d++) {
      const to = `2026-07-${String(d).padStart(2, "0")}`
      const v = prorateFixed(100_000, { from: "2026-07-01", to })
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100_000)
    }
    expect(prorateFixed(100_000, JULY)).toBe(100_000)
  })

  it("0이면 0이고, 기간이 뒤집히면 던진다", () => {
    expect(prorateFixed(0, JULY)).toBe(0)
    expect(() => prorateFixed(1000, { from: "2026-07-31", to: "2026-07-01" })).toThrow(/뒤집혔다/)
  })
})

describe("기간 계산 — 실행 기기 시간대에 흔들리지 않는다", () => {
  it("양끝 포함으로 센다", () => {
    expect(daysInPeriod(JULY)).toBe(31)
    expect(daysInPeriod({ from: "2026-07-01", to: "2026-07-01" })).toBe(1)
    expect(daysInPeriod({ from: "2026-02-01", to: "2026-02-28" })).toBe(28)
  })

  it("월·연 경계를 넘어도 맞다", () => {
    expect(daysInPeriod({ from: "2026-12-31", to: "2027-01-01" })).toBe(2)
  })
})
