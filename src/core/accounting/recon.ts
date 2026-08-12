/**
 * 대사 키 (ADR-009 ④).
 *
 * `recon_ack.recon_key`는 "무엇과 무엇을 비교했는지"의 식별자다. 스키마는
 * `UNIQUE (connection_id, recon_key)`이므로 `connection_id`는 키 문자열에
 * 다시 넣지 않는다.
 *
 * ★ 날짜는 문자열로 비교한다 ★
 * `Date` 객체를 만드는 순간 실행 기기의 시간대가 끼어들어, 노트북을 들고 여행하면
 * 7월 31일 주문이 8월로 넘어간다. 경계는 KST 자정이고 그 확정은 **파서 출력
 * 시점에 끝난다** (ADR-002의 연장). 이후 단계는 확정된 `YYYY-MM-DD` 문자열만 본다.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * `recon_key`를 만든다 — `{doc_type}:{period_start}:{period_end}`.
 *
 * 경계는 **양끝 포함**(inclusive)이다. `2026-07-01:2026-07-31`은 7월 전체다.
 * 반개구간을 쓰면 사람이 읽을 때 마지막 날이 빠진 것처럼 보이고, 대사 화면은
 * 사람이 읽는 화면이다.
 */
export function reconKey(docType: string, periodStart: string, periodEnd: string): string {
  if (!docType) throw new Error("doc_type이 비었다")
  for (const [label, d] of [
    ["기간 시작", periodStart],
    ["기간 끝", periodEnd],
  ] as const) {
    if (!DATE_RE.test(d)) {
      throw new Error(`${label}은 YYYY-MM-DD여야 한다 (KST 자정 경계, ADR-009 ④): ${d}`)
    }
  }
  if (periodStart > periodEnd) {
    throw new Error(`기간이 뒤집혔다: ${periodStart} > ${periodEnd}`)
  }
  return `${docType}:${periodStart}:${periodEnd}`
}

/**
 * 날짜가 기간 안인가. **문자열 비교다** — `Date`를 만들지 않는다.
 *
 * `YYYY-MM-DD`는 사전순과 시간순이 일치하도록 설계된 형식이라 이게 성립한다.
 * 시각이 붙은 값(`2026-07-31T23:59:59`)도 앞 10자가 날짜이므로 그대로 비교된다.
 */
export function withinPeriod(date: string, periodStart: string, periodEnd: string): boolean {
  const day = date.slice(0, 10)
  return day >= periodStart && day <= periodEnd
}
