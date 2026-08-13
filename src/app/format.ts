/**
 * 표시용 포맷 — 목업 L3199~3201 그대로.
 *
 * 분해 규칙의 마지막 갈래("남는 것 = 표시용 포맷팅뿐")에 해당하므로 옮겨도
 * 두 번째 진실이 생기지 않는다. **산수가 아니라 표기**다 — 여기서 값을
 * 더하거나 빼면 그 순간 계산기가 둘이 된다.
 */

/** `Math.round` 후 천 단위 구분. 목업과 같은 로케일을 쓴다. */
export function won(n: number): string {
  return Math.round(n).toLocaleString("ko-KR")
}

/** 음수는 앞에 `-`. 절댓값을 포맷하고 부호를 붙인다 (목업과 동일). */
export function signed(n: number): string {
  return (n < 0 ? "-" : "") + won(Math.abs(n))
}

/** 분모가 0이면 `—`. 숫자를 만들어내지 않는다. */
export function pct(a: number, b: number): string {
  return b === 0 ? "—" : `${((a / b) * 100).toFixed(1)}%`
}

/**
 * 억·만 단위 축약 — 목업 L3202~3207 그대로. KPI 카드가 이걸 쓴다.
 *
 * 원 단위가 필요한 자리(비용 구성 금액)는 `won`을 쓴다. 두 표기가 공존하는
 * 것이 목업 설계다 — 큰 숫자는 한눈에, 정확한 숫자는 자세히 보는 곳에.
 */
export function compact(n: number): string {
  const v = Math.abs(n)
  const sign = n < 0 ? "-" : ""
  if (v >= 100_000_000) return `${sign}${(v / 100_000_000).toFixed(v >= 1_000_000_000 ? 0 : 2)}억`
  if (v >= 10_000) return `${sign}${Math.round(v / 10_000).toLocaleString("ko-KR")}만`
  return sign + Math.round(v).toLocaleString("ko-KR")
}
