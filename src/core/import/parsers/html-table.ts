/**
 * HTML 표 파서 (파서 4종 중 4).
 *
 * 한국 마켓·솔루션의 "엑셀 다운로드"가 실제로는 HTML 표를 `.xls` 이름으로 내려주는
 * 경우가 흔하다. 픽스처 #12(`일별 매출현황.xls`)가 그렇다 — 선두가
 * `<meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=utf-8">`다.
 *
 * SheetJS의 HTML 경로를 쓰되 **바이트를 그대로 넘기지 않는다.** 인코딩을 우리가 풀어
 * 문자열로 준다:
 *   1. BOM이 있으면 BOM이 이긴다 (실제 바이트가 선언보다 우선)
 *   2. `<meta charset=…>` 선언이 있으면 그게 권위 있는 값이다
 *   3. 없으면 바이트 휴리스틱 (UTF-8 유효성 · EUC-KR)
 *
 * 구형 솔루션은 euc-kr HTML을 내려주는데, SheetJS 자동 감지에 맡기면 한글이
 * 깨진 채로 조용히 통과한다 — 헌장 A-5가 가장 싫어하는 실패 방식이다.
 */

import type {
  EncodingLabel,
  ParseOptions,
  ParsedSource,
  Parser,
  RawRow,
  SheetSummary,
} from "../types.js"
import { detectEncoding, decodeText } from "../recognition/encoding.js"
import {
  openWorkbook,
  previewWorkbook,
  readWorkbookFromText,
  readWorkbookWithWarnings,
  summarize,
} from "./sheetjs-common.js"

/** WHATWG 별칭을 우리가 쓰는 라벨로 좁힌다. */
function normalizeCharset(label: string): EncodingLabel | null {
  const l = label.trim().toLowerCase()
  if (l === "utf-8" || l === "utf8") return "utf-8"
  if (l === "utf-16" || l === "utf-16le" || l === "unicode") return "utf-16le"
  if (l === "utf-16be") return "utf-16be"
  if (["euc-kr", "euckr", "cp949", "ks_c_5601-1987", "ksc5601", "windows-949"].includes(l)) {
    return "euc-kr"
  }
  return null
}

/** `<meta charset>` / `<meta http-equiv="Content-Type" content="…charset=…">` 선언. */
export function charsetFromMeta(bytes: Uint8Array, limit = 4096): EncodingLabel | null {
  // 선언 자체는 ASCII 범위라 바이트를 1:1로 읽어도 안전하다.
  let head = ""
  const n = Math.min(bytes.length, limit)
  for (let i = 0; i < n; i++) head += String.fromCharCode(bytes[i]!)
  const m = head.match(/charset\s*=\s*["']?\s*([\w-]+)/i)
  return m?.[1] ? normalizeCharset(m[1]) : null
}

/** 바이트 → 문자열. 이 함수가 이 파서의 존재 이유다. */
export function decodeHtml(bytes: Uint8Array, opts?: ParseOptions): string {
  if (opts?.encoding) {
    return decodeText(bytes, { encoding: opts.encoding, confidence: 1, evidence: [], bomLength: 0 })
  }
  const guess = detectEncoding(bytes)
  // BOM은 선언을 이긴다 — 파일이 실제로 그 바이트로 시작한다는 사실이 더 강하다.
  if (guess.bomLength > 0) return decodeText(bytes, guess)

  const declared = charsetFromMeta(bytes)
  if (declared) {
    return decodeText(bytes, { encoding: declared, confidence: 1, evidence: [], bomLength: 0 })
  }
  return decodeText(bytes, guess)
}

export const htmlTableParser: Parser = {
  format: "html-table",

  async listSheets(bytes, opts): Promise<readonly SheetSummary[]> {
    // HTML에는 xlsx 같은 워크북 인덱스가 없어 목록만 얻으려 해도 표를 훑어야 한다.
    // `sheetRows: 1`로 셀 해석을 최소화한다.
    return summarize(readWorkbookFromText(decodeHtml(bytes, opts), { sheetRows: 1, raw: true }))
  },

  async preview(bytes, rows, opts): Promise<readonly RawRow[]> {
    return previewWorkbook(
      readWorkbookFromText(decodeHtml(bytes, opts), { sheetRows: rows, raw: true }),
      rows,
      opts,
    )
  },

  async open(bytes, opts): Promise<ParsedSource> {
    const { workbook, warnings } = readWorkbookWithWarnings(() =>
      readWorkbookFromText(decodeHtml(bytes, opts), { raw: true }),
    )
    return openWorkbook(workbook, opts, warnings)
  },
}

/**
 * ★ `raw: true`를 쓰는 이유 ★
 *
 * HTML 표에는 셀 타입이 없다 — 전부 텍스트다. 옵션 없이 읽으면 SheetJS가 추론해서
 * `"753,100"`을 숫자 `753100`으로, `"2025-10-01"`을 시리얼 `45931`로 바꾼다.
 *
 * 그 추론을 우리가 한다. 이유는 두 가지다:
 *   1. 그게 Normalization 단계의 일이고, 거기서는 변환 근거와 원본을 함께 남긴다
 *      (`NormalizedValue.raw`). SheetJS가 먼저 바꿔버리면 원본이 사라진다.
 *   2. 한국 마켓 파일의 표기(`"3,000원"` · `"12.4%"` · `"-"`)는 SheetJS의 추론
 *      대상이 아니라 우리 규칙의 대상이다. 절반만 추론되면 규칙이 두 겹이 된다.
 *
 * xlsx·BIFF는 반대다 — 파일이 셀 타입을 직접 갖고 있으므로 그쪽 타입 체계를
 * 존중한다. 요약하면: **파일에 타입 체계가 있으면 따르고, 없으면 우리가 정한다.**
 */
