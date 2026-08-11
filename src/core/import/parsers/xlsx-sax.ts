/**
 * 대용량 단순 시트 xlsx 전용 fast path.
 *
 * ADR-001 성능 판정의 1단계 처방이다. SheetJS는 셀마다 JS 객체를 만들어
 * 픽스처 #13(80,138행 × 43열 = 344만 셀)에서 워크북만 569MB를 쓴다. 여기서는
 * 워크북을 만들지 않는다 — zip을 스트리밍으로 풀면서 `sheet1.xml`을 행 단위로
 * 훑어 `RowChunk`로 흘려보내고, 흘려보낸 행은 즉시 버린다.
 *
 * ★ 범용 리더가 아니다 ★
 * 대상은 "표준 단일 시트 xlsx"뿐이고, 크기 임계를 넘을 때만 이 경로를 탄다.
 * 조건을 하나라도 못 채우면 SheetJS로 되돌아간다 — 조용히 다른 결과를 내는
 * 것보다 느린 게 낫다 (헌장 A-5).
 *
 * 실측 근거 (#13):
 *   sheet1.xml       136MB (압축 10.5MB)  ← 문자열로 만들면 UTF-16이라 272MB
 *   sharedStrings    2.5MB · 62,050개      ← 사전 1패스 로드가 저렴하다
 *   styles.xml       674바이트 · 커스텀 numFmt 0개 · cellXfs 1개
 *                    → 날짜 서식이 없다. 숫자는 전부 그냥 숫자다
 */

import { Unzip, UnzipInflate } from "fflate"
import type {
  ParseOptions,
  ParsedSource,
  RawCell,
  RawRow,
  RowChunk,
  SheetInfo,
} from "../types.js"
import { DEFAULT_CHUNK_SIZE } from "../types.js"

/** 이 크기를 넘는 파일만 fast path를 탄다. 작은 파일은 SheetJS가 더 안전하다. */
export const FAST_PATH_MIN_BYTES = 5 * 1024 * 1024

const SHEET1 = "xl/worksheets/sheet1.xml"
const SHARED_STRINGS = "xl/sharedStrings.xml"
const WORKBOOK = "xl/workbook.xml"
const STYLES = "xl/styles.xml"

/** 압축 입력을 한 번에 밀어 넣을 크기. 작을수록 중간 버퍼가 작다. */
const PUSH_SLICE = 256 * 1024

// ─────────────────────────────────────────────────────────────
// XML 도구 — 우리가 다루는 좁은 범위만 처리한다
// ─────────────────────────────────────────────────────────────

const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
}

export function decodeXmlText(s: string): string {
  if (!s.includes("&")) return s
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(parseInt(body.slice(2), 16))
    }
    if (body.startsWith("#")) return String.fromCodePoint(parseInt(body.slice(1), 10))
    return ENTITIES[body] ?? whole
  })
}

/** `"AQ80138"` → 열 인덱스 42 (0-기준). 열 문자만 읽는다. */
export function columnOf(ref: string): number {
  let n = 0
  for (let i = 0; i < ref.length; i++) {
    const c = ref.charCodeAt(i)
    if (c < 65 || c > 90) break // A..Z 밖이면 행 번호 시작
    n = n * 26 + (c - 64)
  }
  return n - 1
}

function attr(tag: string, name: string): string | null {
  const i = tag.indexOf(` ${name}="`)
  if (i < 0) return null
  const start = i + name.length + 3
  const end = tag.indexOf('"', start)
  return end < 0 ? null : tag.slice(start, end)
}

// ─────────────────────────────────────────────────────────────
// zip 스트리밍
// ─────────────────────────────────────────────────────────────

/**
 * 지정한 항목만 골라 풀어 통째로 돌려준다. `start()`를 부르지 않은 항목은
 * 압축 해제 자체가 일어나지 않으므로, 큰 시트를 건드리지 않고 메타데이터만
 * 가져올 수 있다.
 */
function readEntries(zip: Uint8Array, wanted: readonly string[]): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>()
  const parts = new Map<string, Uint8Array[]>()

  const unzip = new Unzip()
  unzip.register(UnzipInflate)
  unzip.onfile = (file) => {
    if (!wanted.includes(file.name)) return
    parts.set(file.name, [])
    file.ondata = (err, data, final) => {
      if (err) throw err
      parts.get(file.name)!.push(data)
      if (final) {
        const chunks = parts.get(file.name)!
        const total = chunks.reduce((a, c) => a + c.length, 0)
        const merged = new Uint8Array(total)
        let at = 0
        for (const c of chunks) {
          merged.set(c, at)
          at += c.length
        }
        out.set(file.name, merged)
        parts.delete(file.name)
      }
    }
    file.start()
  }

  for (let off = 0; off < zip.length; off += PUSH_SLICE) {
    const end = Math.min(off + PUSH_SLICE, zip.length)
    unzip.push(zip.subarray(off, end), end >= zip.length)
  }
  return out
}

/** sharedStrings.xml → 문자열 배열. `<si>` 하나가 여러 `<t>`로 쪼개질 수 있다. */
export function parseSharedStrings(xml: string): string[] {
  const out: string[] = []
  let at = 0
  for (;;) {
    const si = xml.indexOf("<si>", at)
    if (si < 0) break
    const end = xml.indexOf("</si>", si)
    if (end < 0) break
    const body = xml.slice(si + 4, end)
    // 서식이 섞인 문자열은 <r><t>조각</t></r>로 나뉜다 — 전부 이어 붙인다.
    let text = ""
    let p = 0
    for (;;) {
      const t = body.indexOf("<t", p)
      if (t < 0) break
      const open = body.indexOf(">", t)
      if (open < 0) break
      if (body[open - 1] === "/") {
        p = open + 1
        continue
      }
      const close = body.indexOf("</t>", open)
      if (close < 0) break
      text += body.slice(open + 1, close)
      p = close + 4
    }
    out.push(decodeXmlText(text))
    at = end + 5
  }
  return out
}

/**
 * `<dimension>`만 알아내고 즉시 멈춘다.
 *
 * dimension은 `sheet1.xml` 선두에 있으므로 첫 출력 청크에서 나온다. 시트를
 * `start()`한 뒤 값을 얻는 순간 push 루프를 끊으면, 136MB 중 앞부분만 풀고
 * 끝난다. 이렇게까지 하는 이유는 `physicalRowCount`를 0으로 내보내지 않기
 * 위해서다 — 모르는 값을 0으로 적으면 그게 곧 조용히 틀린 숫자다 (헌장 A-5).
 */
function probeDimension(zip: Uint8Array): { rows: number; cols: number } | null {
  let found: { rows: number; cols: number } | null = null
  let head = ""

  const unzip = new Unzip()
  unzip.register(UnzipInflate)
  unzip.onfile = (file) => {
    if (file.name !== SHEET1) return
    file.ondata = (err, data) => {
      if (err) throw err
      if (found) return
      head += new TextDecoder("utf-8").decode(data, { stream: true })
      found = parseDimension(head)
      // dimension 없이 sheetData가 시작하면 이 파일에는 없는 것이다.
      if (!found && head.includes("<sheetData")) found = null
      if (head.length > 64 * 1024) head = ""
    }
    file.start()
  }

  for (let off = 0; off < zip.length; off += PUSH_SLICE) {
    if (found) break
    const end = Math.min(off + PUSH_SLICE, zip.length)
    unzip.push(zip.subarray(off, end), end >= zip.length)
  }
  return found
}

function parseWorkbookSheetNames(xml: string): string[] {
  const names: string[] = []
  for (const m of xml.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)) {
    names.push(decodeXmlText(m[1] ?? ""))
  }
  return names
}

/** `<dimension ref="A1:AQ80138"/>` → 행·열 수. */
function parseDimension(xml: string): { rows: number; cols: number } | null {
  const m = xml.match(/<dimension\b[^>]*\bref="([^"]*)"/)
  if (!m?.[1]) return null
  const parts = m[1].split(":")
  const last = parts[parts.length - 1]
  if (!last) return null
  const rows = Number(last.replace(/^[A-Z]+/, ""))
  const cols = columnOf(last) + 1
  return Number.isFinite(rows) && rows > 0 ? { rows, cols } : null
}

// ─────────────────────────────────────────────────────────────
// 행 파서
// ─────────────────────────────────────────────────────────────

/**
 * `<row>` 하나를 `RawRow`로. `r` 속성으로 열 위치를 잡으므로 빈 셀이 생략된
 * 희소 행도 자리를 지킨다.
 */
export function parseRow(rowXml: string, shared: readonly string[], width: number): RawRow {
  const cells: RawCell[] = new Array(width).fill(null)
  let maxCol = -1
  let at = 0

  for (;;) {
    const c = rowXml.indexOf("<c", at)
    if (c < 0) break
    const tagEnd = rowXml.indexOf(">", c)
    if (tagEnd < 0) break
    const tag = rowXml.slice(c, tagEnd + 1)

    // <c r="A1"/> — 빈 셀
    if (rowXml[tagEnd - 1] === "/") {
      at = tagEnd + 1
      continue
    }

    const cellEnd = rowXml.indexOf("</c>", tagEnd)
    if (cellEnd < 0) break
    const body = rowXml.slice(tagEnd + 1, cellEnd)
    at = cellEnd + 4

    const ref = attr(tag, "r")
    const col = ref ? columnOf(ref) : maxCol + 1
    if (col < 0) continue
    if (col > maxCol) maxCol = col

    const type = attr(tag, "t")
    let value: RawCell = null

    if (type === "inlineStr") {
      const t = body.indexOf("<t")
      if (t >= 0) {
        const open = body.indexOf(">", t)
        const close = body.indexOf("</t>", open)
        if (open >= 0 && close >= 0) value = decodeXmlText(body.slice(open + 1, close))
      }
    } else {
      const v = body.indexOf("<v>")
      if (v >= 0) {
        const close = body.indexOf("</v>", v)
        if (close >= 0) {
          const raw = body.slice(v + 3, close)
          if (type === "s") {
            const idx = Number(raw)
            value = shared[idx] ?? null
          } else if (type === "b") {
            value = raw === "1"
          } else if (type === "str" || type === "e") {
            value = decodeXmlText(raw)
          } else {
            const n = Number(raw)
            value = Number.isFinite(n) ? n : decodeXmlText(raw)
          }
        }
      }
    }

    if (col < cells.length) cells[col] = value
    else {
      while (cells.length < col) cells.push(null)
      cells.push(value)
    }
  }

  // 뒤쪽 null을 잘라 ragged 상태를 보존한다 — SheetJS 경로와 같은 규칙이다.
  let end = Math.min(cells.length, Math.max(maxCol + 1, 0))
  while (end > 0 && cells[end - 1] === null) end--
  return cells.slice(0, end)
}

// ─────────────────────────────────────────────────────────────
// 진입점
// ─────────────────────────────────────────────────────────────

export interface FastPathRejection {
  readonly ok: false
  readonly reason: string
}

export type FastPathResult = { ok: true; source: ParsedSource } | FastPathRejection

/**
 * fast path로 열 수 있으면 연다. 조건을 못 채우면 사유와 함께 거절한다 —
 * 호출자는 SheetJS로 되돌아간다.
 */
export function openXlsxFast(bytes: Uint8Array, opts?: ParseOptions): FastPathResult {
  if (bytes.length < FAST_PATH_MIN_BYTES) {
    return { ok: false, reason: `${(bytes.length / 1024 / 1024).toFixed(1)}MB — 임계 미만` }
  }

  const meta = readEntries(bytes, [WORKBOOK, SHARED_STRINGS, STYLES])
  const workbookXml = meta.get(WORKBOOK)
  if (!workbookXml) return { ok: false, reason: "xl/workbook.xml이 없다" }

  const dec = new TextDecoder("utf-8")
  const names = parseWorkbookSheetNames(dec.decode(workbookXml))
  if (names.length !== 1) {
    return { ok: false, reason: `시트가 ${names.length}개 — 단일 시트만 지원한다` }
  }

  // 날짜 서식이 있으면 styles를 해석해야 하는데, 그건 이 fast path의 범위가 아니다.
  const stylesXml = meta.get(STYLES)
  if (stylesXml) {
    const styles = dec.decode(stylesXml)
    if (/<numFmt\b/.test(styles)) {
      return { ok: false, reason: "커스텀 숫자 서식이 있다 — 날짜 판별이 필요하다" }
    }
  }

  const ssXml = meta.get(SHARED_STRINGS)
  const shared = ssXml ? parseSharedStrings(dec.decode(ssXml)) : []

  const dim = probeDimension(bytes)
  if (!dim) {
    return { ok: false, reason: "<dimension>이 없다 — 행·열 수를 미리 알 수 없다" }
  }
  const dimensionRows = dim.rows
  const dimensionCols = dim.cols

  let closed = false
  const sheetInfo: SheetInfo = {
    name: names[0]!,
    index: 0,
    role: "data",
    reason: `fast path — 단일 시트 ${dim.rows}행 × ${dim.cols}열`,
    physicalRowCount: dim.rows,
    columnCount: dim.cols,
    // 수식 여부는 이 경로에서 세지 않는다. 마켓 export에는 수식이 없고,
    // 있다면 그건 사람이 만든 워크북이라 크기 임계에 걸리지 않는다.
    formulaRatio: null,
    merges: [],
  }

  const source: ParsedSource = {
    sheets: [sheetInfo],
    warnings: [],

    async *stream(sheetIndex, streamOpts): AsyncIterable<RowChunk> {
      if (closed) throw new Error("close() 이후에는 stream할 수 없다")
      if (sheetIndex !== 0) throw new Error(`시트 ${sheetIndex}는 없다`)

      const chunkSize = streamOpts?.chunkSize ?? opts?.chunkSize ?? DEFAULT_CHUNK_SIZE
      const onProgress = streamOpts?.onProgress ?? opts?.onProgress

      const pending: RawRow[] = []
      let carry = ""
      const width = dimensionCols
      let emitted = 0

      const streamDecoder = new TextDecoder("utf-8")

      const consume = (text: string): void => {
        carry += text

        for (;;) {
          const start = carry.indexOf("<row")
          if (start < 0) {
            // `<row`의 앞부분이 잘렸을 수 있으니 꼬리 몇 글자만 남긴다.
            if (carry.length > 8) carry = carry.slice(-8)
            break
          }
          const openEnd = carry.indexOf(">", start)
          if (openEnd < 0) {
            carry = carry.slice(start)
            break
          }
          if (carry[openEnd - 1] === "/") {
            // <row .../> — 내용 없는 행
            pending.push([])
            carry = carry.slice(openEnd + 1)
            continue
          }
          const close = carry.indexOf("</row>", openEnd)
          if (close < 0) {
            carry = carry.slice(start)
            break
          }
          pending.push(parseRow(carry.slice(openEnd + 1, close), shared, width))
          carry = carry.slice(close + 6)
        }
      }

      const unzip = new Unzip()
      unzip.register(UnzipInflate)
      unzip.onfile = (file) => {
        if (file.name !== SHEET1) return
        file.ondata = (err, data, final) => {
          if (err) throw err
          consume(streamDecoder.decode(data, { stream: !final }))
        }
        file.start()
      }

      let startRow = 0
      for (let off = 0; off < bytes.length; off += PUSH_SLICE) {
        const end = Math.min(off + PUSH_SLICE, bytes.length)
        unzip.push(bytes.subarray(off, end), end >= bytes.length)

        while (pending.length >= chunkSize) {
          const rows = pending.splice(0, chunkSize)
          yield { sheetIndex: 0, startRow, rows, isLast: false }
          startRow += rows.length
          emitted += rows.length
          onProgress?.({ phase: "extraction", rowsDone: emitted, rowsTotal: dimensionRows })
        }
      }

      while (pending.length > chunkSize) {
        const rows = pending.splice(0, chunkSize)
        yield { sheetIndex: 0, startRow, rows, isLast: false }
        startRow += rows.length
        emitted += rows.length
      }

      emitted += pending.length
      yield { sheetIndex: 0, startRow, rows: pending.splice(0), isLast: true }
      onProgress?.({ phase: "extraction", rowsDone: emitted, rowsTotal: dimensionRows })
    },

    close(): void {
      closed = true
      shared.length = 0
    },
  }

  return { ok: true, source }
}
