/**
 * BIFF xls 파서 (파서 4종 중 3). 구형 엑셀 — OLE2 매직 바이트 `D0 CF 11 E0`.
 *
 * ADR-001 조건 2가 "BIFF .xls도 SheetJS로 처리하고 11st 정산확정 픽스처로 검증"
 * 이라고 못 박았다 — 픽스처 #6이 그 검증 대상이며 15개 중 유일한 진짜 BIFF다.
 *
 * BIFF는 xlsx와 달리 부분 읽기의 이득이 작다. `sheetRows`는 SheetJS가 결과를
 * 잘라줄 뿐 파일 자체는 통째로 해석된다. 다만 BIFF의 포맷 상한이 65,536행이라
 * 대용량 문제가 생기지 않는다.
 */

import type { Parser } from "../types.js"
import {
  listSheetsVia,
  previewWorkbook,
  openWorkbook,
  readWorkbook,
  readWorkbookWithWarnings,
} from "./sheetjs-common.js"

export const biffParser: Parser = {
  format: "biff",
  listSheets: (bytes) => listSheetsVia(bytes),
  preview: async (bytes, rows, opts) =>
    previewWorkbook(readWorkbook(bytes, { sheetRows: rows }), rows, opts),
  open: async (bytes, opts) => {
    const { workbook, warnings } = readWorkbookWithWarnings(() => readWorkbook(bytes))
    return openWorkbook(workbook, opts, warnings)
  },
}
