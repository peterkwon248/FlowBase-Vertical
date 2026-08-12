/**
 * 부호 규약 (ADR-009 ②) — 저장은 양수, 의미는 타입이 정한다.
 *
 * 마켓 파일마다 부호 관습이 다르다. 반품을 `-200,000`으로 적는 파일과 `200,000`으로
 * 적고 컬럼 이름으로만 구분하는 파일이 섞여 들어온다. 그대로 저장하면 같은 사실이
 * 마켓마다 다른 부호로 쌓이고 `SUM()`이 조용히 틀린다 (헌장 A-5).
 *
 * ★ 여기가 값 수준 정규화가 아닌 이유 ★
 * `normalization/value.ts`는 셀이 무슨 의미인지 모른다 — `-500`이 반품액인지
 * 온도인지 잔액 변동인지 구분할 수 없다. 거기서 `abs()`를 걸면 정당한 음수까지
 * 뭉갠다. 금액이라는 것을 아는 곳은 **프로파일이 필드를 선언한 Mapping 단계**다.
 */

/**
 * 금액을 크기로 정규화한다. 부호는 버리고 **버렸다는 사실을 알린다.**
 *
 * `wasNegative`를 함께 돌려주는 이유: 호출부가 타입 컬럼을 채울 때 쓰거나,
 * 부호가 타입과 어긋날 때(예: `SALE`인데 음수) 경고할 수 있어야 하기 때문이다.
 * 조용히 절대값만 취하면 파일이 뭘 말하려 했는지가 사라진다.
 */
export function toMagnitude(value: number): { magnitude: number; wasNegative: boolean } {
  if (!Number.isFinite(value)) throw new Error(`금액이 유한수가 아니다: ${value}`)
  // -0을 그대로 두면 `Object.is(-0, 0)`이 false라 비교에서 새는 자리가 생긴다.
  if (value === 0) return { magnitude: 0, wasNegative: false }
  return { magnitude: Math.abs(value), wasNegative: value < 0 }
}

/**
 * 저장 직전 검증. 양수 규약을 어긴 값이 fact 테이블에 들어가는 것을 막는다.
 *
 * 스키마에 `CHECK (amount >= 0)`이 없는 것은 스키마 LOCK(헌장 규칙 1) 때문이며,
 * 그동안 이 함수가 그 자리를 대신한다. 마이그레이션 대기목록에 올려뒀다.
 */
export function assertStoredPositive(field: string, value: number): void {
  if (value < 0) {
    throw new Error(
      `${field}는 양수로 저장한다 (ADR-009 ②). 차감 여부는 타입 컬럼이 정한다. 받은 값: ${value}`,
    )
  }
}
