/**
 * SheetJS 기반 파서 3종(xlsx · BIFF xls · HTML 표)의 공통 기반.
 *
 * SheetJS는 ADR-001에 따라 npm이 아니라 cdn.sheetjs.com 타르볼 0.20.3에서 온다
 * (npm의 `xlsx`는 0.18.5에서 멈춰 있고 CVE 2건이 살아 있다).
 */

import * as XLSX from "xlsx"
import type {
  MergeRange,
  ParseOptions,
  ParsedSource,
  RawCell,
  RawRow,
  RowChunk,
  SheetInfo,
  SheetSummary,
} from "../types.js"
import { DEFAULT_CHUNK_SIZE } from "../types.js"

/**
 * 읽기 옵션.
 *
 * ADR-001 완화책을 여기서 건다 — SheetJS는 입력 스트리밍이 없어 워크북을 통째로
 * 메모리에 올린다. 안 쓰는 것을 최대한 안 만드는 게 유일한 방어다.
 *
 *   dense        희소 객체 대신 밀집 배열 (80,138행에서 차이가 크다)
 *   cellStyles   서식 정보를 만들지 않는다 — 우리는 값만 쓴다
 *   cellHTML     HTML 렌더 문자열을 만들지 않는다
 *   cellFormula  수식 문자열을 보관하지 않는다 (값만 필요)
 *   cellText     포맷된 텍스트(`w`)를 만들지 않는다 — 원본 값을 쓴다
 */
export const READ_OPTIONS = {
  type: "array",
  dense: true,
  cellStyles: false,
  cellHTML: false,
  cellFormula: false,
  cellText: false,
  cellDates: true,
  cellNF: false,
} as const

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0")
}

/**
 * Date → 직렬화 가능한 문자열.
 *
 * ★ 타임존 함정 ★
 * 엑셀의 날짜에는 타임존이 없다. SheetJS는 `cellDates: true`일 때 셀의 시리얼
 * 번호를 **UTC 자정**으로 실체화한다 — 픽스처 #11의 2026-07-01 셀은
 * `.v === 2026-07-01T00:00:00.000Z`다 (시리얼 46204).
 *
 * 따라서 **UTC 게터로 읽어야** 달력 날짜가 보존된다. 로컬 게터로 읽으면 KST에서
 * 9시간이 붙어 `2026-07-01T09:00:00`이 되고, UTC보다 서쪽 타임존에서는 **전날로
 * 밀린다.** 정산 날짜가 하루 밀리는 건 조용히 틀린 숫자의 전형이다 (헌장 A-5).
 *
 * 결과가 실행 환경의 타임존에 좌우되지 않는다는 점이 이 방식의 핵심이다.
 */
export function dateToRaw(d: Date): string {
  const y = d.getUTCFullYear()
  const mo = pad(d.getUTCMonth() + 1)
  const day = pad(d.getUTCDate())
  const h = d.getUTCHours()
  const mi = d.getUTCMinutes()
  const s = d.getUTCSeconds()
  if (h === 0 && mi === 0 && s === 0) return `${y}-${mo}-${day}`
  return `${y}-${mo}-${day}T${pad(h)}:${pad(mi)}:${pad(s)}`
}

/** SheetJS 셀 → RawCell. 파서 경계를 넘는 값은 반드시 직렬화 가능해야 한다. */
export function cellToRaw(cell: unknown): RawCell {
  if (cell === null || cell === undefined) return null
  const v = (cell as { v?: unknown }).v
  if (v === null || v === undefined) return null
  if (v instanceof Date) return dateToRaw(v)
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v
  return String(v)
}

/** dense 시트의 내부 배열. `sheet_to_json`을 거치지 않아 전체 복사본이 하나 줄어든다. */
type DenseData = readonly (readonly unknown[] | undefined)[]

function denseRows(ws: XLSX.WorkSheet): DenseData {
  return ((ws as unknown as { "!data"?: DenseData })["!data"] ?? []) as DenseData
}

/**
 * 시트의 물리적 행 수.
 *
 * `!ref`의 **끝 행 인덱스 + 1**을 쓴다. openpyxl의 `max_row`와 같은 정의라
 * `docs/픽스처-대조표.md`와 바로 대조할 수 있다. 시작 행이 0이 아닌 시트
 * (#12는 `A2:N127`)에서도 절대 기준을 유지한다.
 */
export function physicalRowCount(ws: XLSX.WorkSheet): number {
  const ref = ws["!ref"]
  if (!ref) return 0
  try {
    return XLSX.utils.decode_range(ref).e.r + 1
  } catch {
    return 0
  }
}

export function columnCount(ws: XLSX.WorkSheet): number {
  const ref = ws["!ref"]
  if (!ref) return 0
  try {
    return XLSX.utils.decode_range(ref).e.c + 1
  } catch {
    return 0
  }
}

function rowAt(data: DenseData, r: number, width: number): RawRow {
  const raw = data[r]
  if (!raw) return []
  const out: RawCell[] = new Array(Math.min(width, raw.length))
  for (let c = 0; c < out.length; c++) out[c] = cellToRaw(raw[c])
  // 뒤쪽 null을 잘라 ragged 상태를 보존한다 — 원본이 몇 칸이었는지가 정보다.
  let end = out.length
  while (end > 0 && out[end - 1] === null) end--
  return out.slice(0, end)
}

/**
 * SheetJS가 `console.error`로 흘리는 경고를 가로챈다.
 *
 * SheetJS는 복구 가능한 이상(비표준 zip 헤더 등)을 만나면 stderr에 쓰고 그냥
 * 진행한다. 반환값에도 예외에도 나타나지 않으므로, 훔쳐보는 것 말고는 알 방법이
 * 없다. 헌장 A-5가 조용한 실패를 최악의 버그로 규정한 이상 이 정도 침습은
 * 정당하다 — 대안은 "모르고 넘어가기"뿐이다.
 *
 * `XLSX.read`는 동기 함수라 교체 구간에 다른 코드가 끼어들지 않는다.
 */
function captureWarnings<T>(fn: () => T): { result: T; warnings: string[] } {
  const warnings: string[] = []
  const original = console.error
  console.error = (...args: unknown[]) => {
    warnings.push(args.map(String).join(" "))
  }
  try {
    return { result: fn(), warnings }
  } finally {
    console.error = original
  }
}

/** 바이너리 컨테이너(xlsx · BIFF)용. */
export function readWorkbook(bytes: Uint8Array, extra: XLSX.ParsingOptions = {}): XLSX.WorkBook {
  return XLSX.read(bytes, { ...READ_OPTIONS, ...extra } as XLSX.ParsingOptions)
}

/** 경고까지 함께 돌려주는 읽기. `open` 경로가 쓴다. */
export function readWorkbookWithWarnings(
  read: () => XLSX.WorkBook,
): { workbook: XLSX.WorkBook; warnings: string[] } {
  const { result, warnings } = captureWarnings(read)
  return { workbook: result, warnings }
}

/**
 * 텍스트 컨테이너(HTML 표)용. 호출자가 인코딩을 이미 풀어 문자열로 준다.
 *
 * 바이트를 그대로 넘기지 않는 이유는 html-table.ts에 적혀 있다 — `<meta charset>`
 * 선언을 우리가 존중해야 euc-kr HTML이 조용히 깨지지 않는다.
 */
export function readWorkbookFromText(text: string, extra: XLSX.ParsingOptions = {}): XLSX.WorkBook {
  return XLSX.read(text, { ...READ_OPTIONS, type: "string", ...extra } as XLSX.ParsingOptions)
}

/** 시트 목록만. `bookSheets`는 워크북 인덱스만 읽고 셀을 건드리지 않는다. */
export async function listSheetsVia(bytes: Uint8Array): Promise<readonly SheetSummary[]> {
  const wb = XLSX.read(bytes, { type: "array", bookSheets: true } as XLSX.ParsingOptions)
  return summarize(wb)
}

export function summarize(wb: XLSX.WorkBook): readonly SheetSummary[] {
  return wb.SheetNames.map((name, index) => ({ name, index }))
}

/**
 * 앞 N행만. 워크북은 이미 `sheetRows`로 잘려 들어와야 한다 — 그래야 SheetJS
 * 안에서 파싱 자체가 끊기고, 헌장 B-9의 "미리보기와 전체 파싱 분리"가 성립한다.
 */
export function previewWorkbook(
  wb: XLSX.WorkBook,
  rows: number,
  opts?: ParseOptions,
): readonly RawRow[] {
  const idx = opts?.sheetIndex ?? 0
  const name = wb.SheetNames[idx]
  if (name === undefined) return []
  const ws = wb.Sheets[name]
  if (!ws) return []
  const data = denseRows(ws)
  const width = columnCount(ws)
  const out: RawRow[] = []
  for (let r = 0; r < Math.min(rows, data.length); r++) out.push(rowAt(data, r, width))
  return out
}

function mergesOf(ws: XLSX.WorkSheet): MergeRange[] {
  const raw = ws["!merges"]
  if (!Array.isArray(raw)) return []
  return raw.map((m) => ({
    startRow: m.s.r,
    endRow: m.e.r,
    startCol: m.s.c,
    endCol: m.e.c,
  }))
}

function classify(ws: XLSX.WorkSheet | undefined, name: string, index: number): SheetInfo {
  if (!ws || !ws["!ref"]) {
    return {
      name,
      index,
      role: "empty",
      reason: "셀 범위(!ref)가 없다",
      physicalRowCount: 0,
      columnCount: 0,
      merges: [],
    }
  }
  const count = physicalRowCount(ws)
  return {
    name,
    index,
    // 여기서는 비었는지만 본다. 데이터/요약 판정은 Extraction의 몫이다
    // (헤더 모양과 행 수를 봐야 판단할 수 있다).
    role: count === 0 ? "empty" : "data",
    reason: count === 0 ? "행이 없다" : `${count}행`,
    physicalRowCount: count,
    columnCount: columnCount(ws),
    merges: mergesOf(ws),
  }
}

/** SheetJS 워크북을 `ParsedSource`로 감싼다. 3종 파서가 이걸 공유한다. */
export function openWorkbook(
  source: XLSX.WorkBook,
  opts?: ParseOptions,
  warnings: readonly string[] = [],
): ParsedSource {
  let wb: XLSX.WorkBook | null = source
  const sheets: SheetInfo[] = source.SheetNames.map((name, index) =>
    classify(source.Sheets[name], name, index),
  )

  return {
    sheets,
    warnings,

    async *stream(sheetIndex, streamOpts): AsyncIterable<RowChunk> {
      if (!wb) throw new Error("close() 이후에는 stream할 수 없다")
      const name = wb.SheetNames[sheetIndex]
      if (name === undefined) throw new Error(`시트 ${sheetIndex}는 없다`)
      const ws = wb.Sheets[name]
      const chunkSize = streamOpts?.chunkSize ?? opts?.chunkSize ?? DEFAULT_CHUNK_SIZE
      const onProgress = streamOpts?.onProgress ?? opts?.onProgress

      if (!ws || !ws["!ref"]) {
        yield { sheetIndex, startRow: 0, rows: [], isLast: true }
        return
      }

      const data = denseRows(ws)
      const total = physicalRowCount(ws)
      const width = columnCount(ws)

      let buf: RawRow[] = []
      let start = 0
      for (let r = 0; r < total; r++) {
        buf.push(rowAt(data, r, width))
        if (buf.length >= chunkSize) {
          yield { sheetIndex, startRow: start, rows: buf, isLast: r === total - 1 }
          start = r + 1
          buf = []
          onProgress?.({ phase: "extraction", rowsDone: start, rowsTotal: total })
        }
      }
      yield { sheetIndex, startRow: start, rows: buf, isLast: true }
      onProgress?.({ phase: "extraction", rowsDone: total, rowsTotal: total })
    },

    close(): void {
      // ADR-001 완화책 — 워크북 참조를 끊어 GC가 가져갈 수 있게 한다.
      wb = null
    },
  }
}
