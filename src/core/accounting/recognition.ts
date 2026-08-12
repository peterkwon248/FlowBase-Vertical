/**
 * 손익 인식 기준 (ADR-009 ①).
 *
 * **어느 날짜 컬럼이 그 사실을 어느 달에 귀속시키는가**를 한 곳에 모은다.
 * 화면마다 다른 컬럼을 쓰면 화면마다 다른 순이익이 나온다.
 *
 * 핵심 두 가지:
 *   1. 클레임은 **발생일**(`claimed_at`)에 잡는다. 원거래 월로 소급하지 않는다 —
 *      확정된 과거는 흔들리지 않는다
 *   2. 정산은 **손익이 아니다.** 현금 관점 전용이다. 손익 화면이 `fact_settlement`를
 *      집계하면 발생주의와 현금주의가 섞인다
 */

/** 손익(발생주의) 집계에 쓰는 fact 테이블과 그 기준 날짜 컬럼. */
export const PROFIT_BASIS = {
  fact_order: "ordered_at",
  fact_order_item: "ordered_at",
  fact_claim: "claimed_at",
  fact_ad_spend: "spent_on",
} as const

export type ProfitTable = keyof typeof PROFIT_BASIS

/** 현금 관점(정산 화면) 전용. 손익에 쓰지 않는다. */
export const CASH_BASIS = {
  fact_settlement: "pay_out_on",
} as const

/**
 * 손익 집계에 쓸 날짜 컬럼. 손익에 쓰면 안 되는 테이블이면 던진다.
 *
 * 던지는 쪽을 택한 이유: `fact_settlement`를 손익에 섞는 것은 조용히 틀린 숫자를
 * 만드는 실수다. `undefined`를 돌려주면 호출부가 그냥 넘어가버린다 (헌장 A-5).
 */
export function profitDateColumn(table: string): string {
  const col = (PROFIT_BASIS as Record<string, string>)[table]
  if (col) return col
  if (table in CASH_BASIS) {
    throw new Error(
      `${table}은 현금 관점 전용이다 — 손익 집계에 쓰지 않는다 (ADR-009 ①). ` +
        `정산 화면은 ${CASH_BASIS.fact_settlement}를 쓴다`,
    )
  }
  throw new Error(`손익 인식 기준이 정의되지 않은 테이블: ${table}`)
}

/**
 * 클레임의 부호. 저장은 양수이고(ADR-009 ②) 손익에서 뺄지 말지는 여기서 정한다.
 *
 * `EXCHANGE`(교환)가 0인 이유: 교환은 매출을 되돌리지 않는다. 물건이 바뀔 뿐
 * 거래는 살아 있다. 배송비가 발생하면 그건 비용 쪽에서 잡히지 클레임 금액이 아니다.
 */
export function claimSign(claimType: string): -1 | 0 {
  switch (claimType) {
    case "CANCEL":
    case "RETURN":
    case "REFUND":
      return -1
    case "EXCHANGE":
      return 0
    default:
      throw new Error(`알 수 없는 claim_type: ${claimType}`)
  }
}
