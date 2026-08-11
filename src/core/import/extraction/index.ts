/**
 * Extraction — 파이프라인 2단계.
 *
 * 파서가 준 원시 행에서 "표"를 꺼낸다: 어디가 헤더고, 어디까지가 데이터고,
 * 무엇을 빼야 하는가.
 *
 * 제외한 것은 반드시 사유와 함께 남긴다 (헌장 A-5·C-5). 행 인덱스는 전부
 * **절대 기준**이다 — 사용자에게 "12행이 제외됐습니다"라고 말할 때 그 12행이
 * 파일을 열었을 때의 12행이어야 한다.
 */

import type {
  ExcludedRow,
  ExtractedSheet,
  ParsedSource,
  RawRow,
  SheetInfo,
} from "../types.js"
import { isBlankRow, lastNonBlankRow } from "./rows.js"
import { detectHeader, headerSpan, type HeaderOptions } from "./header.js"
import { stripTotals, type TotalsOptions } from "./totals.js"
import { classifySheet, type SheetClassifyOptions } from "./sheets.js"

export interface ExtractOptions extends HeaderOptions, TotalsOptions, SheetClassifyOptions {}

/** 한 시트를 뽑는다. `rows`는 절대 0행부터의 전체 행이다. */
export function extractSheet(
  sheet: SheetInfo,
  rows: readonly RawRow[],
  opts: ExtractOptions = {},
): ExtractedSheet {
  const excluded: ExcludedRow[] = []

  // 1) 꼬리의 빈 행을 자른다.
  //    서식만 남은 행 때문에 max_row가 1000·3000으로 부푼 시트가 있다
  //    (픽스처 #3·#7 — 대조표 함정 #2).
  const lastReal = lastNonBlankRow(rows)
  if (lastReal < rows.length - 1) {
    excluded.push({
      rowIndex: lastReal + 1,
      reason: "trailing-blank",
      detail: `${lastReal + 2}행부터 ${rows.length}행까지 ${rows.length - lastReal - 1}행이 비어 있다 (서식만 남은 행)`,
    })
  }
  const live = rows.slice(0, lastReal + 1)

  if (live.length === 0) {
    return {
      sheet: { ...sheet, role: "empty", reason: "내용이 있는 행이 없다" },
      header: { rowIndex: null, columns: [], confidence: 0, evidence: ["행이 없다"] },
      rows: [],
      excluded,
      dataRowCount: 0,
    }
  }

  const width = Math.max(sheet.columnCount, ...live.map((r) => r.length))

  // 2) 시트 성격을 먼저 본다 — 요약 시트에 헤더 판정을 강요하지 않는다.
  const cls = classifySheet(sheet.name, live, width, opts)
  // 수식 비율은 역할을 정하지 않지만 사람이 판단할 때 필요한 재료라 함께 남긴다.
  const reason =
    sheet.formulaRatio === null
      ? cls.reason
      : `${cls.reason}, 수식 ${(sheet.formulaRatio * 100).toFixed(0)}%`

  // 3) 헤더 탐지.
  const header = detectHeader(live, width, opts)

  if (header.rowIndex === null) {
    return {
      sheet: { ...sheet, role: cls.role, reason },
      header,
      rows: [],
      excluded,
      dataRowCount: 0,
    }
  }

  // 제목·설명 행 — 헤더 위쪽은 전부 제외한다 (#4·#5·#6의 1~5행).
  for (let r = 0; r < header.rowIndex; r++) {
    if (isBlankRow(live[r])) continue
    excluded.push({
      rowIndex: r,
      reason: "subtitle",
      detail: `헤더(${header.rowIndex + 1}행) 위의 제목·설명 행`,
    })
  }

  // 4) 데이터 영역. 2단 병합 헤더면 한 행 더 건너뛴다 (#12).
  const span = headerSpan(live, header.rowIndex, width)
  const dataStart = header.rowIndex + span
  if (span > 1) {
    excluded.push({
      rowIndex: header.rowIndex + 1,
      reason: "subtitle",
      detail: "2단 헤더의 아랫단 — 컬럼 이름에 합쳐 넣었다",
    })
  }

  const body = live.slice(dataStart)

  // 5) 빈 행과 합계 행을 걷어낸다.
  //    둘 다 `body` 위에서 판정한다 — 한쪽을 먼저 지우면 남은 쪽의 절대 행
  //    번호가 어긋나고, 그러면 사용자에게 몇 행이 빠졌는지 말할 수 없게 된다.
  for (const [i, row] of body.entries()) {
    if (isBlankRow(row)) {
      excluded.push({ rowIndex: dataStart + i, reason: "blank", detail: "빈 행" })
    }
  }

  const totals = stripTotals(body, dataStart, opts)
  const totalRowIndices = new Set(
    totals.excluded.filter((e) => e.reason === "total").map((e) => e.rowIndex),
  )
  excluded.push(...totals.excluded)

  const finalRows = body.filter(
    (row, i) => !isBlankRow(row) && !totalRowIndices.has(dataStart + i),
  )

  return {
    sheet: { ...sheet, role: cls.role, reason: cls.reason },
    header,
    rows: finalRows,
    excluded,
    dataRowCount: finalRows.length,
  }
}

/** 열린 원본 전체를 뽑는다. 시트마다 독립적으로 판정한다. */
export async function extractAll(
  source: ParsedSource,
  opts: ExtractOptions = {},
): Promise<readonly ExtractedSheet[]> {
  const out: ExtractedSheet[] = []
  for (const sheet of source.sheets) {
    const rows: RawRow[] = []
    for await (const chunk of source.stream(sheet.index)) rows.push(...chunk.rows)
    out.push(extractSheet(sheet, rows, opts))
  }
  return out
}

export { detectHeader, headerSpan } from "./header.js"
export { isTotalRow, stripTotals, DEFAULT_TOTAL_LABELS } from "./totals.js"
export { classifySheet, DEFAULT_SUMMARY_HINTS } from "./sheets.js"
export { lastNonBlankRow, isBlankRow, filledCount, looksNumeric } from "./rows.js"
