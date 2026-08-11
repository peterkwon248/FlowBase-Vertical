/**
 * Normalization — 파이프라인 3단계.
 *
 * Extraction이 꺼낸 표를 값 수준에서 정규화한다. 컬럼 종류를 먼저 정하고
 * (`column.ts`), 그 종류로 셀을 읽는다 (`value.ts`).
 *
 * ragged row 패딩도 여기서 한다 — 마켓 파일은 트레일링 값이 없으면 칸 자체를
 * 생략하는 경우가 많다(픽스처 #1·#2의 `"-"` 생략). 컬럼 수를 헤더에 맞춰야
 * 이후 매핑이 위치로 접근할 수 있다.
 */

import type { ExtractedSheet, NormalizedValue, RawRow } from "../types.js"
import { normalizeValue } from "./value.js"
import { inferColumnKind, type ColumnInference } from "./column.js"

export interface NormalizedSheet {
  readonly columns: readonly string[]
  readonly kinds: readonly ColumnInference[]
  readonly rows: readonly (readonly NormalizedValue[])[]
  /** 패딩으로 칸을 채운 행 수. 0이 아니면 원본이 ragged였다는 뜻이다. */
  readonly paddedRows: number
}

/** 모자란 칸을 null로 채우고 넘치는 칸은 그대로 둔다 — 데이터를 버리지 않는다. */
function pad(row: RawRow, width: number): RawRow {
  if (row.length >= width) return row
  return [...row, ...new Array<null>(width - row.length).fill(null)]
}

export function normalizeSheet(sheet: ExtractedSheet): NormalizedSheet {
  const columns = sheet.header.columns
  const width = Math.max(columns.length, ...sheet.rows.map((r) => r.length), 0)

  let paddedRows = 0
  const padded: RawRow[] = sheet.rows.map((r) => {
    if (r.length < width) paddedRows++
    return pad(r, width)
  })

  const kinds: ColumnInference[] = []
  for (let c = 0; c < width; c++) {
    kinds.push(inferColumnKind(columns[c] ?? "", padded, c))
  }

  const rows = padded.map((row) =>
    row.map((cell, c) => {
      const kind = kinds[c]?.kind
      // `null` 추론은 "표본이 없다"는 뜻이라 강제하지 않는다.
      return normalizeValue(cell, kind && kind !== "null" ? { kind } : {})
    }),
  )

  return { columns, kinds, rows, paddedRows }
}

export { normalizeValue, parseNumberLike, parsePercentLike, parseDateLike, isLosslessNumber } from "./value.js"
export { inferColumnKind } from "./column.js"
export type { ColumnInference } from "./column.js"
