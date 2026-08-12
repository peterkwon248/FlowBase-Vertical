/**
 * 회계 정책 테스트 — ADR-009를 실행 가능한 형태로 못 박는다.
 *
 * 세 축: 부호 규약 · 배분 잔차 · 인식 기준 일관성. 여기가 깨지면 화면의 숫자가
 * 조용히 틀린다 — 헌장 A-5가 "최악의 버그"라 부른 종류다.
 */

import { describe, it, expect } from "vitest"
import { allocate } from "../src/core/accounting/allocate.js"
import { toMagnitude, assertStoredPositive } from "../src/core/accounting/sign.js"
import {
  profitDateColumn,
  claimSign,
  PROFIT_BASIS,
  CASH_BASIS,
} from "../src/core/accounting/recognition.js"
import { reconKey, withinPeriod } from "../src/core/accounting/recon.js"

// ─────────────────────────────────────────────────────────────
// ② 부호 규약
// ─────────────────────────────────────────────────────────────

describe("부호 규약 — 저장은 양수, 의미는 타입이 정한다 (ADR-009 ②)", () => {
  it("음수 입력은 크기로 정규화되고, 음수였다는 사실이 함께 나온다", () => {
    expect(toMagnitude(-200000)).toEqual({ magnitude: 200000, wasNegative: true })
    expect(toMagnitude(200000)).toEqual({ magnitude: 200000, wasNegative: false })
  })

  it("같은 사실이 마켓마다 다른 부호로 와도 같은 값으로 저장된다", () => {
    // 반품 20만원 — A마켓은 음수로, B마켓은 양수로 적는다.
    const a = toMagnitude(-200000)
    const b = toMagnitude(200000)
    expect(a.magnitude).toBe(b.magnitude)
    // 부호가 달랐다는 사실 자체는 남는다 — 조용히 뭉개지 않는다.
    expect(a.wasNegative).not.toBe(b.wasNegative)
  })

  it("-0은 0으로 눕힌다 — Object.is 비교에서 새는 자리를 막는다", () => {
    expect(toMagnitude(-0)).toEqual({ magnitude: 0, wasNegative: false })
    expect(Object.is(toMagnitude(-0).magnitude, 0)).toBe(true)
  })

  it("양수 규약을 어긴 값은 저장 직전에 막힌다", () => {
    expect(() => assertStoredPositive("amount", -1)).toThrow(/양수로 저장/)
    expect(() => assertStoredPositive("amount", 0)).not.toThrow()
  })

  it("차감 여부는 값이 아니라 claim_type이 정한다", () => {
    expect(claimSign("REFUND")).toBe(-1)
    expect(claimSign("CANCEL")).toBe(-1)
    expect(claimSign("RETURN")).toBe(-1)
    // 교환은 매출을 되돌리지 않는다 — 물건이 바뀔 뿐 거래는 살아 있다.
    expect(claimSign("EXCHANGE")).toBe(0)
    expect(() => claimSign("UNKNOWN")).toThrow(/알 수 없는 claim_type/)
  })
})

// ─────────────────────────────────────────────────────────────
// ③ 배분 잔차 — 속성 테스트
// ─────────────────────────────────────────────────────────────

describe("배분 잔차 — 합은 언제나 원금이다 (ADR-009 ③)", () => {
  it("예시: 100,000원을 1:1:1로 → 잔차 1원이 최대 항목에", () => {
    const r = allocate(100_000, [1, 1, 1])
    expect(r.shares).toEqual([33_334, 33_333, 33_333])
    expect(r.shares.reduce((a, b) => a + b, 0)).toBe(100_000)
    // 동점이면 먼저 오는 항목이 받는다 — 결정성.
    expect(r.residualTo).toBe(0)
    expect(r.residual).toBe(1)
  })

  it("잔차는 금액이 가장 큰 항목에 간다", () => {
    // 1,001을 1:7:2로 — 내림하면 100+700+200=1,000이고 1원이 남는다.
    const r = allocate(1_001, [1, 7, 2])
    expect(r.shares).toEqual([100, 701, 200])
    expect(r.residualTo).toBe(1) // 가중치 7이 최대
    expect(r.shares.reduce((a, b) => a + b, 0)).toBe(1_001)
  })

  it("나누어떨어지면 잔차가 없다 — 없는 잔차를 만들지 않는다", () => {
    const r = allocate(1_000, [1, 7, 2])
    expect(r.shares).toEqual([100, 700, 200])
    expect(r.residual).toBe(0)
    expect(r.residualTo).toBeNull()
  })

  it("★ 속성: 무작위 입력 500건에서 배분 합 === 원금 ★", () => {
    // 결정적 의사난수 — 실패를 재현할 수 있어야 한다.
    let seed = 20260812
    const rnd = (n: number): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed % n
    }

    for (let t = 0; t < 500; t++) {
      const n = 1 + rnd(12)
      const weights = Array.from({ length: n }, () => rnd(10_000))
      const total = rnd(50_000_000)

      const r = allocate(total, weights)
      const sum = r.shares.reduce((a, b) => a + b, 0)

      expect(sum).toBe(total)
      expect(r.shares).toHaveLength(n)
      expect(r.shares.every((s) => Number.isInteger(s))).toBe(true)
      // 잔차는 항목 수보다 작다 — 그보다 크면 내림 계산이 틀린 것이다.
      expect(r.residual).toBeLessThan(n === 0 ? 1 : n)
    }
  })

  it("가중치가 전부 0이면 전액이 첫 항목에 — 금액을 잃지 않는다", () => {
    const r = allocate(777, [0, 0, 0])
    expect(r.shares).toEqual([777, 0, 0])
    expect(r.shares.reduce((a, b) => a + b, 0)).toBe(777)
  })

  it("배분 대상이 없으면 던진다 — 금액이 갈 곳 없이 사라지지 않는다", () => {
    expect(() => allocate(1000, [])).toThrow(/배분 대상이 없다/)
  })

  it("정수가 아닌 원금·음수 가중치는 던진다", () => {
    expect(() => allocate(100.5, [1])).toThrow(/정수/)
    expect(() => allocate(100, [-1, 2])).toThrow(/0 이상/)
  })
})

// ─────────────────────────────────────────────────────────────
// ① 인식 기준 일관성
// ─────────────────────────────────────────────────────────────

describe("인식 기준 일관성 — 화면마다 다른 순이익이 나오지 않게 (ADR-009 ①)", () => {
  it("손익은 주문일·발생일·집행일 기준이다", () => {
    expect(profitDateColumn("fact_order")).toBe("ordered_at")
    expect(profitDateColumn("fact_order_item")).toBe("ordered_at")
    expect(profitDateColumn("fact_claim")).toBe("claimed_at")
    expect(profitDateColumn("fact_ad_spend")).toBe("spent_on")
  })

  it("★ 클레임은 발생일 기준이다 — 원거래 월로 소급하지 않는다 ★", () => {
    // 7월 주문이 8월에 반품돼도 8월에 잡힌다. 확정된 과거는 흔들리지 않는다.
    expect(PROFIT_BASIS.fact_claim).toBe("claimed_at")
    expect(PROFIT_BASIS.fact_claim).not.toBe("ordered_at")
  })

  it("★ 정산은 손익에 쓸 수 없다 — 발생주의와 현금주의를 섞지 않는다 ★", () => {
    expect(() => profitDateColumn("fact_settlement")).toThrow(/현금 관점 전용/)
    // 정산 화면은 지급일을 본다.
    expect(CASH_BASIS.fact_settlement).toBe("pay_out_on")
  })

  it("기준이 정의되지 않은 테이블은 조용히 통과시키지 않는다", () => {
    expect(() => profitDateColumn("fact_unknown")).toThrow(/정의되지 않은/)
  })
})

// ─────────────────────────────────────────────────────────────
// ④ 대사 키
// ─────────────────────────────────────────────────────────────

describe("대사 키 — (connection_id, doc_type, 기간) (ADR-009 ④)", () => {
  it("키 형식은 doc_type:시작:끝", () => {
    expect(reconKey("settlement", "2026-07-01", "2026-07-31")).toBe(
      "settlement:2026-07-01:2026-07-31",
    )
  })

  it("경계는 양끝 포함이다", () => {
    expect(withinPeriod("2026-07-01", "2026-07-01", "2026-07-31")).toBe(true)
    expect(withinPeriod("2026-07-31", "2026-07-01", "2026-07-31")).toBe(true)
    expect(withinPeriod("2026-08-01", "2026-07-01", "2026-07-31")).toBe(false)
  })

  it("★ 시각이 붙어도 Date를 만들지 않고 문자열로 비교한다 ★", () => {
    // Date를 쓰면 실행 기기 시간대에 따라 7/31 23:59가 8월로 넘어간다.
    expect(withinPeriod("2026-07-31T23:59:59", "2026-07-01", "2026-07-31")).toBe(true)
    expect(withinPeriod("2026-07-01T00:00:00", "2026-07-01", "2026-07-31")).toBe(true)
  })

  it("형식이 틀리거나 기간이 뒤집히면 던진다", () => {
    expect(() => reconKey("ad", "2026/07/01", "2026-07-31")).toThrow(/YYYY-MM-DD/)
    expect(() => reconKey("ad", "2026-07-31", "2026-07-01")).toThrow(/뒤집혔다/)
  })
})
