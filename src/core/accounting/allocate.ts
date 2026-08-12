/**
 * 정수 안분 — 광고비·고정비를 여러 항목에 나눈다 (ADR-009 ③).
 *
 * 금액은 원 단위 정수다(스키마 `INTEGER`, 부동소수 금지). 그래서 비례 배분하면
 * **잔차가 반드시 생긴다.** 버리면 합이 안 맞고, 다시 나누면 또 잔차가 생긴다.
 *
 * 규칙: **잔차는 금액이 가장 큰 항목에 전부 귀속한다.** 상대 오차가 가장 작고,
 * 결정적이라 같은 입력이 항상 같은 답을 낸다. 동점이면 먼저 오는 항목이 받는다.
 *
 * 불변식은 하나다 — **배분 합 === 원금.** 예외 없다.
 */

export interface Allocation {
  /** 항목별 배분액. 입력 `weights`와 같은 순서·길이. */
  readonly shares: readonly number[]
  /** 잔차를 받은 항목의 인덱스. 잔차가 0이면 `null`. */
  readonly residualTo: number | null
  /** 귀속된 잔차. 0 이상이며 `weights.length` 미만이다. */
  readonly residual: number
}

/**
 * `total`을 `weights` 비중으로 정수 안분한다.
 *
 * - `weights`가 비어 있으면 던진다 — 배분 대상이 없는데 금액이 있으면 그건 버그다.
 *   조용히 0을 돌려주면 그 금액이 어디로 갔는지 아무도 모르게 된다 (헌장 A-5)
 * - 가중치 합이 0이면(전부 0) 전액이 **첫 항목**에 간다. 비중을 못 정하는 것과
 *   금액을 잃는 것 중에서는 전자가 낫다
 * - 음수 가중치는 던진다. 비중에 음수는 의미가 없다
 */
export function allocate(total: number, weights: readonly number[]): Allocation {
  if (!Number.isInteger(total)) throw new Error(`배분 원금은 정수여야 한다: ${total}`)
  if (weights.length === 0) throw new Error("배분 대상이 없다 — 금액이 갈 곳이 없으면 버그다")
  for (const w of weights) {
    if (!Number.isFinite(w) || w < 0) throw new Error(`가중치는 0 이상 유한수여야 한다: ${w}`)
  }

  const sum = weights.reduce((a, b) => a + b, 0)
  const shares = new Array<number>(weights.length).fill(0)

  if (sum === 0) {
    shares[0] = total
    return { shares, residualTo: total === 0 ? null : 0, residual: total }
  }

  // 내림으로 배분한 뒤 남는 것을 최대 항목에 준다.
  // `Math.trunc`가 아니라 `Math.floor`인 이유: total이 음수여도 합이 유지된다.
  for (let i = 0; i < weights.length; i++) {
    shares[i] = Math.floor((total * weights[i]!) / sum)
  }

  const allocated = shares.reduce((a, b) => a + b, 0)
  const residual = total - allocated
  if (residual === 0) return { shares, residualTo: null, residual: 0 }

  // 최대 **가중치** 항목 = 금액이 가장 큰 항목. 동점이면 먼저 오는 쪽.
  let top = 0
  for (let i = 1; i < weights.length; i++) {
    if (weights[i]! > weights[top]!) top = i
  }
  shares[top] = shares[top]! + residual

  return { shares, residualTo: top, residual }
}
