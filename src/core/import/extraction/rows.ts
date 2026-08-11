/** 행 판정에 쓰는 작은 도구들. Extraction 안에서만 쓴다. */

import type { RawCell, RawRow } from "../types.js"

export function isBlankCell(c: RawCell | undefined): boolean {
  if (c === null || c === undefined) return true
  if (typeof c === "string") return c.trim().length === 0
  return false
}

export function isBlankRow(row: RawRow | undefined): boolean {
  if (!row) return true
  return row.every(isBlankCell)
}

export function filledCount(row: RawRow | undefined): number {
  if (!row) return 0
  let n = 0
  for (const c of row) if (!isBlankCell(c)) n++
  return n
}

export function cellText(c: RawCell | undefined): string {
  if (c === null || c === undefined) return ""
  return String(c).trim()
}

/**
 * 마지막 실데이터 행의 인덱스. 없으면 -1.
 *
 * 엑셀 시트는 서식만 넣어둔 빈 행 때문에 `max_row`가 실제보다 훨씬 클 수 있다.
 * 픽스처 #3·#7의 1000·3000 같은 라운드 숫자가 그 흔적이다 — 뒤에서부터 훑어
 * 진짜 끝을 찾는다 (대조표 함정 #2).
 */
export function lastNonBlankRow(rows: readonly RawRow[]): number {
  for (let r = rows.length - 1; r >= 0; r--) {
    if (!isBlankRow(rows[r])) return r
  }
  return -1
}

/** 숫자로 읽히는 셀인가. 문자열이어도 숫자 표기면 참으로 본다. */
export function looksNumeric(c: RawCell | undefined): boolean {
  if (typeof c === "number") return true
  if (typeof c !== "string") return false
  const s = c.trim()
  if (s.length === 0) return false
  // "1,234" · "3,000원" · "12.4%" · "-500" 같은 한국 마켓 표기를 포괄한다.
  return /^[-+]?[\d,]+(\.\d+)?\s*(원|%|개|건)?$/.test(s)
}
