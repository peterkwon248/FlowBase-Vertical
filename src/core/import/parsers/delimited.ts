/**
 * 구분자 텍스트 파서 (파서 4종 중 1).
 *
 * 헌장 C-8 이식 지시: upstream `lib/parsers.ts`의 `parseDelimited`를 가져오되
 * **CSV 멀티라인 quoted 셀 버그를 문자 단위 상태머신으로 수정한 뒤** 쓴다.
 *
 * 원본의 버그:
 *
 *     const lines = cleaned.replace(/\r\n?/g, "\n").split("\n").filter(...)
 *     return lines.map((line) => { ...줄마다 inQuote를 새로 시작... })
 *
 * 줄로 먼저 쪼개고 줄마다 독립 파싱하므로, 따옴표 안에 줄바꿈이 든 셀
 * (`"서울시 강남구\n테헤란로 1"` 같은 주소)에서 `inQuote`가 리셋된다. 한 셀이
 * 두 행으로 찢어지고 이후 컬럼이 통째로 밀린다.
 *
 * 부수적으로 원본은 `filter((l) => l.length > 0)`로 빈 줄을 버려 행 번호가
 * 어긋나고(오류 행을 사용자에게 짚어줄 수 없다), 셀마다 `.trim()`을 걸어
 * 되돌릴 수 없는 손실을 만든다.
 *
 * 아래는 텍스트 전체를 한 번만 훑는 문자 단위 상태머신이다. 줄바꿈은 따옴표
 * 밖에 있을 때만 행 경계가 된다.
 */

import type { ParseOptions, ParsedSource, Parser, RawRow, RowChunk, SheetInfo, SheetSummary } from "../types.js"
import { DEFAULT_CHUNK_SIZE } from "../types.js"
import { detectEncoding, decodeText } from "../recognition/encoding.js"
import { detectDelimiter } from "../recognition/delimiter.js"

export interface DelimitedOptions {
  readonly delimiter?: string
  /** 셀 양끝 공백 제거. 기본 true (원본 동작 유지) — 끄면 원문 그대로 보존한다. */
  readonly trimCells?: boolean
}

/**
 * 문자 단위 상태머신. 행이 완성될 때마다 하나씩 내보낸다.
 *
 * 제너레이터라 전체 행 배열을 메모리에 쌓지 않는다 — 호출자가 청크로 받아
 * 바로 흘려보낼 수 있다 (헌장 B-9).
 */
export function* iterateDelimited(
  text: string,
  delimiter: string,
  trimCells = true,
): Generator<string[], void, undefined> {
  const finish = (s: string): string => (trimCells ? s.trim() : s)

  let cells: string[] = []
  let cur = ""
  let inQuote = false
  // 따옴표로 시작한 셀인지. 빈 셀("")과 따옴표로 감싼 빈 문자열을 구분하지는
  // 않지만, 행이 끝났는지 판단할 때 필요하다.
  let sawAnyContent = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]!

    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          // "" → 리터럴 따옴표. 상태를 뒤집지 않는다.
          cur += '"'
          i++
        } else {
          inQuote = false
        }
      } else {
        // ★ 여기가 수정의 핵심 — 따옴표 안의 \n은 그냥 셀 내용이다.
        cur += c
      }
      continue
    }

    if (c === '"') {
      inQuote = true
      sawAnyContent = true
    } else if (c === delimiter) {
      cells.push(finish(cur))
      cur = ""
      sawAnyContent = true
    } else if (c === "\n" || c === "\r") {
      // \r\n은 한 번만 센다.
      if (c === "\r" && text[i + 1] === "\n") i++
      cells.push(finish(cur))
      yield cells
      cells = []
      cur = ""
      sawAnyContent = false
    } else {
      cur += c
      sawAnyContent = true
    }
  }

  // 마지막 행 — 파일이 개행으로 끝나지 않는 경우.
  if (cur.length > 0 || cells.length > 0 || sawAnyContent) {
    cells.push(finish(cur))
    yield cells
  }
}

/** 편의 함수 — 전량을 배열로. 작은 파일과 테스트용이다. */
export function parseDelimited(text: string, delimiter: string, trimCells = true): string[][] {
  return [...iterateDelimited(text, delimiter, trimCells)]
}

const SHEET_NAME = "(텍스트)"

function decode(bytes: Uint8Array, opts?: ParseOptions): { text: string; delimiter: string } {
  const guess = opts?.encoding
    ? { encoding: opts.encoding, confidence: 1, evidence: [], bomLength: 0 }
    : detectEncoding(bytes)
  const text = decodeText(bytes, guess)
  const delimiter = opts?.delimiter ?? detectDelimiter(text).delimiter
  return { text, delimiter }
}

export const delimitedParser: Parser = {
  format: "delimited",

  async listSheets(): Promise<readonly SheetSummary[]> {
    // 구분자 텍스트에는 시트 개념이 없다. 하나로 취급한다.
    return [{ name: SHEET_NAME, index: 0 }]
  },

  async preview(bytes, rows, opts): Promise<readonly RawRow[]> {
    const { text, delimiter } = decode(bytes, opts)
    const out: RawRow[] = []
    for (const row of iterateDelimited(text, delimiter)) {
      out.push(row)
      if (out.length >= rows) break
    }
    return out
  },

  async open(bytes, opts): Promise<ParsedSource> {
    const { text, delimiter } = decode(bytes, opts)
    // 텍스트 파일은 이미 통째로 메모리에 있다 — 행 배열을 또 만들지 않고
    // 스트림 시점에 상태머신을 다시 돌린다.
    let physicalRowCount = 0
    let columnCount = 0
    for (const row of iterateDelimited(text, delimiter)) {
      physicalRowCount++
      if (row.length > columnCount) columnCount = row.length
    }

    const sheet: SheetInfo = {
      name: SHEET_NAME,
      index: 0,
      role: physicalRowCount === 0 ? "empty" : "data",
      reason: "구분자 텍스트 — 시트가 하나뿐이다",
      physicalRowCount,
      columnCount,
      // 구분자 텍스트에는 병합 개념이 없다.
      merges: [],
    }

    let released = false

    return {
      sheets: [sheet],
      // 상태머신이 직접 도는 경로라 외부 라이브러리 경고가 없다.
      warnings: [],
      async *stream(sheetIndex, streamOpts): AsyncIterable<RowChunk> {
        if (released) throw new Error("close() 이후에는 stream할 수 없다")
        if (sheetIndex !== 0) throw new Error(`시트 ${sheetIndex}는 없다`)
        const chunkSize = streamOpts?.chunkSize ?? opts?.chunkSize ?? DEFAULT_CHUNK_SIZE
        let buf: RawRow[] = []
        let start = 0
        let seen = 0
        for (const row of iterateDelimited(text, delimiter)) {
          buf.push(row)
          seen++
          if (buf.length >= chunkSize) {
            yield { sheetIndex: 0, startRow: start, rows: buf, isLast: seen === physicalRowCount }
            start = seen
            buf = []
          }
        }
        // 마지막 청크는 비어 있어도 내보낸다 — 소비자가 isLast를 못 받고 끝나면 안 된다.
        yield { sheetIndex: 0, startRow: start, rows: buf, isLast: true }
      },
      close(): void {
        released = true
      },
    }
  },
}
