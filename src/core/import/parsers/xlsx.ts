/**
 * xlsx 파서 (파서 4종 중 2). OOXML — 매직 바이트 `PK`.
 *
 * 두 갈래로 읽는다:
 *
 *   fast path   대용량 단일 시트 → `xlsx-sax.ts`. 워크북을 만들지 않고
 *               `sheet1.xml`을 행 단위로 흘린다
 *   SheetJS     그 외 전부 — 멀티시트·병합·수식·날짜 서식을 제대로 다룬다
 *
 * fast path는 조건을 하나라도 못 채우면 **사유와 함께 거절하고** SheetJS로
 * 되돌아간다. 조용히 다른 결과를 내는 것보다 느린 게 낫다 (헌장 A-5).
 * 어느 경로를 탔는지는 `ParsedSource.warnings`에 남아 사람이 볼 수 있다.
 */

import type { Parser } from "../types.js"
import {
  listSheetsVia,
  previewWorkbook,
  openWorkbook,
  readWorkbook,
  readWorkbookWithWarnings,
} from "./sheetjs-common.js"
import { openXlsxFast, FAST_PATH_MIN_BYTES } from "./xlsx-sax.js"

export const xlsxParser: Parser = {
  format: "xlsx",

  listSheets: (bytes) => listSheetsVia(bytes),

  // `sheetRows`가 SheetJS 안에서 파싱을 끊는다 — 전체를 읽지 않는다.
  // 미리보기는 크기와 무관하게 SheetJS로 충분하다.
  preview: async (bytes, rows, opts) =>
    previewWorkbook(readWorkbook(bytes, { sheetRows: rows }), rows, opts),

  open: async (bytes, opts) => {
    if (bytes.length >= FAST_PATH_MIN_BYTES) {
      const fast = openXlsxFast(bytes, opts)
      if (fast.ok) return fast.source
      // 거절 사유를 삼키지 않는다 — 왜 느린 경로를 탔는지 알 수 있어야 한다.
      const { workbook, warnings } = readWorkbookWithWarnings(() => readWorkbook(bytes))
      return openWorkbook(workbook, opts, [
        ...warnings,
        `fast path 거절: ${fast.reason} — SheetJS 경로로 처리했다`,
      ])
    }
    const { workbook, warnings } = readWorkbookWithWarnings(() => readWorkbook(bytes))
    return openWorkbook(workbook, opts, warnings)
  },
}

export { FAST_PATH_MIN_BYTES }
