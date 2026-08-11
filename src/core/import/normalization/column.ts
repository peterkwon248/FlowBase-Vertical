/**
 * 컬럼 단위 종류 추론.
 *
 * ★ 이 파일이 있는 이유 ★
 * 값만 보고는 `"20260804119"`가 주문번호인지 금액인지 알 수 없다. 둘 다 숫자로
 * 읽히지만 주문번호를 숫자로 바꾸면 안 된다 — 대조표 함정 #3:
 *
 *   "주문번호는 숫자 변환 금지(identifier 유지 — 엑셀이 이미 float로 만든 걸
 *    파서가 또 망치면 안 되니까)"
 *
 * 그래서 컬럼 전체(헤더 이름 + 표본값)를 함께 본다. 헤더 이름은 힌트고,
 * 표본값의 성질이 주 근거다.
 */

import type { NormalizedKind, RawCell, RawRow } from "../types.js"
import { isLosslessNumber, parseDateLike, parseNumberLike, parsePercentLike } from "./value.js"

/**
 * 식별자를 암시하는 헤더 어휘.
 *
 * 마켓 이름이 아니라 **필드 역할을 가리키는 일반 어휘**다 (헌장 B-8).
 * 팩이 목록을 대체할 수 있다.
 */
const IDENTIFIER_HINTS: readonly RegExp[] = [
  /번호/,
  /코드/,
  /\bID\b/i,
  /아이디/,
  /_id$/i,
  /(^|[^a-z])no\.?$/i,
  /운송장/,
  /사업자/,
  /우편/,
]

/** 식별자가 **아님**을 강하게 암시하는 어휘 — "번호"가 들어가도 수량인 것들. */
const NOT_IDENTIFIER_HINTS: readonly RegExp[] = [/개수/, /수량/, /금액/, /단가/, /비용/, /매출/]

export interface ColumnInference {
  readonly kind: NormalizedKind
  readonly confidence: number
  readonly reason: string
}

function sampleColumn(rows: readonly RawRow[], col: number, limit = 200): RawCell[] {
  const out: RawCell[] = []
  for (const row of rows) {
    const v = row[col]
    if (v === null || v === undefined) continue
    if (typeof v === "string" && v.trim() === "") continue
    out.push(v)
    if (out.length >= limit) break
  }
  return out
}

export function inferColumnKind(
  header: string,
  rows: readonly RawRow[],
  col: number,
): ColumnInference {
  const values = sampleColumn(rows, col)
  if (values.length === 0) {
    return { kind: "null", confidence: 0.5, reason: "표본이 없다" }
  }

  const strings = values.map((v) => (typeof v === "string" ? v.trim() : String(v)))

  // ── 헤더 이름 힌트 ──────────────────────────────────────
  const nameSaysId =
    IDENTIFIER_HINTS.some((re) => re.test(header)) &&
    !NOT_IDENTIFIER_HINTS.some((re) => re.test(header))

  // ── 값의 성질 ──────────────────────────────────────────
  const allDigits = strings.every((s) => /^-?\d+$/.test(s))
  const anyLossy = strings.some((s) => /^-?\d+$/.test(s) && !isLosslessNumber(s))
  // 자릿수가 고르면 식별자일 확률이 높다 (주문번호·운송장번호).
  const lengths = new Set(strings.filter((s) => /^\d+$/.test(s)).map((s) => s.length))
  const uniformLength = allDigits && lengths.size <= 2 && [...lengths].every((l) => l >= 8)

  if (anyLossy) {
    return {
      kind: "identifier",
      confidence: 1,
      // 앞자리 0 또는 안전 정수 초과 — 숫자로 바꾸면 값이 달라진다.
      reason: "숫자로 변환하면 정보를 잃는 값이 있다 (앞자리 0 또는 정밀도 초과)",
    }
  }

  if (nameSaysId && allDigits) {
    return { kind: "identifier", confidence: 0.9, reason: `헤더 "${header}" + 전부 정수 표기` }
  }

  if (uniformLength && nameSaysId) {
    return { kind: "identifier", confidence: 0.9, reason: `헤더 "${header}" + 자릿수 일정` }
  }

  if (nameSaysId) {
    return { kind: "identifier", confidence: 0.7, reason: `헤더 "${header}"가 식별자를 가리킨다` }
  }

  const pct = strings.filter((s) => parsePercentLike(s) !== null).length
  if (pct / strings.length >= 0.8) {
    return { kind: "percent", confidence: pct / strings.length, reason: "대부분 퍼센트 표기" }
  }

  const dates = strings.filter((s) => parseDateLike(s) !== null).length
  if (dates / strings.length >= 0.8) {
    return { kind: "date", confidence: dates / strings.length, reason: "대부분 날짜 표기" }
  }

  const nums = values.filter(
    (v) => typeof v === "number" || (typeof v === "string" && parseNumberLike(v) !== null),
  ).length
  if (nums / values.length >= 0.8) {
    return { kind: "number", confidence: nums / values.length, reason: "대부분 숫자" }
  }

  return { kind: "text", confidence: 0.6, reason: "숫자·날짜·퍼센트로 일관되지 않는다" }
}

export { IDENTIFIER_HINTS, NOT_IDENTIFIER_HINTS }
