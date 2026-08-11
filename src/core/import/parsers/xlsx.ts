/** xlsx 파서 (파서 4종 중 2). OOXML — 매직 바이트 `PK`. */

import type { Parser } from "../types.js"
import {
  listSheetsVia,
  previewWorkbook,
  openWorkbook,
  readWorkbook,
  readWorkbookWithWarnings,
} from "./sheetjs-common.js"

export const xlsxParser: Parser = {
  format: "xlsx",
  listSheets: (bytes) => listSheetsVia(bytes),
  // `sheetRows`가 SheetJS 안에서 파싱을 끊는다 — 전체를 읽지 않는다.
  preview: async (bytes, rows, opts) =>
    previewWorkbook(readWorkbook(bytes, { sheetRows: rows }), rows, opts),
  open: async (bytes, opts) => {
    const { workbook, warnings } = readWorkbookWithWarnings(() => readWorkbook(bytes))
    return openWorkbook(workbook, opts, warnings)
  },
}
