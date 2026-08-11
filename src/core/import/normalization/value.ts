/**
 * 값 정규화 — 셀 하나.
 *
 * 헌장 B-9 Normalization:
 *   `"3,000원"→3000`, `"12.4%"→0.124`, `"-"/""→null`, 날짜 4종, ragged row 패딩.
 *
 * 원본은 항상 보존한다(`NormalizedValue.raw`). 변환이 틀렸을 때 되돌아갈 곳이
 * 있어야 하고, 조정 레이어(헌장 B-3)가 "원본 + 조정"을 계산하려면 원본이 필요하다.
 */

import type { NormalizedKind, NormalizedValue, RawCell } from "../types.js"

/** null로 볼 표기. 마켓 파일이 "값 없음"을 적는 방식들이다. */
const NULL_TOKENS: ReadonlySet<string> = new Set(["", "-", "--", "―", "–", "n/a", "na", "null", "없음"])

/** 금액·수량 뒤에 붙는 단위. 숫자로 읽을 때 떼어낸다. */
const TRAILING_UNITS = /\s*(원|won|개|건|회|명|EA|ea)\s*$/

const DATE_PATTERNS: readonly RegExp[] = [
  // 2026-07-01 · 2026-07-01 13:05 · 2026-07-01T13:05:09
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  // 2026/07/01 · 2026/07/01 13:05
  /^(\d{4})\/(\d{2})\/(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  // 2026.07.01
  /^(\d{4})\.(\d{2})\.(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/,
  // 20260701 (구분자 없음)
  /^(\d{4})(\d{2})(\d{2})$/,
]

function toIsoDate(m: RegExpMatchArray): string | null {
  const [, y, mo, d, h, mi, s] = m
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  // 달력에 없는 날짜는 날짜가 아니다 — 20261345 같은 숫자를 날짜로 만들지 않는다.
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const base = `${y}-${mo}-${d}`
  if (h === undefined) return base
  return `${base}T${h}:${mi}:${s ?? "00"}`
}

export function parseDateLike(s: string): string | null {
  for (const re of DATE_PATTERNS) {
    const m = s.match(re)
    if (m) {
      const iso = toIsoDate(m)
      if (iso) return iso
    }
  }
  return null
}

/**
 * 순수 숫자 문자열인가 — 식별자 판정의 재료.
 *
 * 앞자리 0이 있으면 숫자로 바꾸는 순간 사라지므로 무조건 식별자다.
 * 자릿수가 커서 `Number`로 정밀도를 잃는 경우도 마찬가지다.
 */
export function isLosslessNumber(s: string): boolean {
  if (!/^-?\d+$/.test(s)) return false
  if (/^0\d/.test(s)) return false // 앞자리 0 — 변환하면 정보가 사라진다
  return Number.isSafeInteger(Number(s))
}

const NUMERIC_RE = /^[-+]?[\d,]*\.?\d+$/

/** `"3,000원"` · `"1,234.5"` · `"-500"` → number. 아니면 null. */
export function parseNumberLike(s: string): number | null {
  const cleaned = s.replace(TRAILING_UNITS, "").trim()
  if (!NUMERIC_RE.test(cleaned)) return null
  const n = Number(cleaned.replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

/** `"12.4%"` → 0.124. 퍼센트 표기가 아니면 null. */
export function parsePercentLike(s: string): number | null {
  const m = s.match(/^([-+]?[\d,]*\.?\d+)\s*%$/)
  if (!m?.[1]) return null
  const n = Number(m[1].replace(/,/g, ""))
  return Number.isFinite(n) ? n / 100 : null
}

export interface NormalizeOptions {
  /**
   * 이 컬럼을 무엇으로 읽을지 강제한다. 컬럼 단위 추론(`column.ts`)의 결과가
   * 들어온다 — 값만 보고는 주문번호와 수량을 구분할 수 없기 때문이다.
   */
  readonly kind?: NormalizedKind
}

const NULL_VALUE = (raw: RawCell): NormalizedValue => ({ kind: "null", value: null, raw })

export function normalizeValue(raw: RawCell, opts: NormalizeOptions = {}): NormalizedValue {
  if (raw === null || raw === undefined) return NULL_VALUE(raw)

  if (typeof raw === "boolean") {
    return { kind: "text", value: raw ? "true" : "false", raw }
  }

  if (typeof raw === "number") {
    // 파일이 숫자로 갖고 있던 값이다. 식별자 컬럼이면 문자열로 되돌린다 —
    // 엑셀이 주문번호를 숫자로 만들어버린 경우가 여기 걸린다.
    if (opts.kind === "identifier") {
      return { kind: "identifier", value: String(raw), raw }
    }
    return { kind: "number", value: raw, raw }
  }

  const s = raw.trim()
  if (NULL_TOKENS.has(s.toLowerCase())) return NULL_VALUE(raw)

  // 강제 지정이 있으면 그것을 따른다. 다만 null 표기는 위에서 이미 걸렀다.
  if (opts.kind === "identifier") return { kind: "identifier", value: s, raw }
  if (opts.kind === "text") return { kind: "text", value: s, raw }

  const pct = parsePercentLike(s)
  if (pct !== null) return { kind: "percent", value: pct, raw }

  const date = parseDateLike(s)
  if (date !== null) return { kind: "date", value: date, raw }

  if (opts.kind === "number") {
    const n = parseNumberLike(s)
    return n === null ? { kind: "text", value: s, raw } : { kind: "number", value: n, raw }
  }

  // 지정이 없을 때: 숫자로 읽되, 정보를 잃는 숫자 문자열은 식별자로 남긴다.
  const n = parseNumberLike(s)
  if (n !== null) {
    if (/^-?\d+$/.test(s) && !isLosslessNumber(s)) {
      return { kind: "identifier", value: s, raw }
    }
    return { kind: "number", value: n, raw }
  }

  return { kind: "text", value: s, raw }
}
