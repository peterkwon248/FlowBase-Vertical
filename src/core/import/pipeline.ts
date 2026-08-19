/**
 * 스트리밍 파이프라인 — Recognition → Extraction → Normalization을 청크로 잇는다.
 *
 * 헌장 B-9: "전체 메모리 적재 금지 — 청크→SQLite."
 *
 * 어려운 점은 Extraction이 본래 시트 전체를 봐야 한다는 것이다. 헤더는 앞쪽
 * 몇 행만 보면 되지만, 컬럼 종류 추론과 라벨 열 판정에는 본문 표본이 필요하고,
 * 꼬리의 빈 행은 끝까지 가봐야 안다. 세 가지를 이렇게 푼다:
 *
 *   헤더·컬럼 종류  앞부분(prologue)만 버퍼링해 한 번 결정하고 재사용
 *   꼬리 빈 행      빈 행을 바로 내보내지 않고 보류했다가, 다음 실데이터가
 *                   오면 그때 함께 내보낸다. 끝까지 실데이터가 없으면 그
 *                   보류분이 곧 꼬리이므로 버린다
 *   합계 행         행 단위 판정이라 스트리밍과 충돌하지 않는다
 *
 * 결과적으로 어느 시점에도 메모리에 있는 행은 `prologue + chunk + 보류 빈 행`
 * 뿐이다. 80,138행 파일에서도 상수에 가깝다.
 */

import type {
  ExcludedRow,
  HeaderDetection,
  NormalizedChunk,
  ParseOptions,
  ParsedSource,
  RawCell,
  RawRow,
  SheetInfo,
} from "./types.js"
import { KIND_NULL, KIND_TEXT } from "./types.js"
import { readBlocks, type BlockReadRule } from "./extraction/blocks.js"
import { detectHeader, headerSpan, type HeaderOptions } from "./extraction/header.js"
import { isTotalRow, DEFAULT_TOTAL_LABELS } from "./extraction/totals.js"
import { isBlankRow } from "./extraction/rows.js"
import { inferColumnKind, type ColumnInference } from "./normalization/column.js"
import { normalizeInto } from "./normalization/value.js"

export interface StreamPipelineOptions extends ParseOptions, HeaderOptions {
  /** 헤더·컬럼 종류를 정하기 위해 앞에서 버퍼링할 행 수. */
  readonly prologueRows?: number
  readonly totalLabels?: readonly string[]
  /** 정규화를 건너뛰고 원시 행만 흘린다 — 적재 비용만 재고 싶을 때. */
  readonly skipNormalization?: boolean
  /**
   * ★ 이 시트는 표가 아니라 **카드**다 (2026-08-19) ★
   *
   * 주면 파서와 헤더 탐지 **사이**에 블록 리더가 낀다 — 카드를 표로 펴고 합성
   * 헤더 행을 앞에 붙인다. 그 뒤로는 평범한 표라서 이 파일의 나머지도, 뒤 단계도
   * 아무것도 안 바뀐다.
   *
   * 블록 리더가 거부하면(주기가 고르지 않다 등) **그 예외가 그대로 올라온다.**
   * 여기서 표로 물러나지 않는다 — 카드를 표로 읽으면 라벨 행이 데이터가 된다.
   */
  readonly blockRead?: BlockReadRule
}

export type { NormalizedChunk } from "./types.js"

export interface PipelineSummary {
  readonly sheet: SheetInfo
  readonly header: HeaderDetection
  readonly columnKinds: readonly ColumnInference[]
  readonly dataRowCount: number
  readonly excluded: readonly ExcludedRow[]
}

const DEFAULT_PROLOGUE = 200

/**
 * 한 시트를 청크로 흘린다. 마지막에 `summary`가 담긴 객체가 해석 결과를 준다.
 *
 * 제너레이터가 끝난 뒤 `getSummary()`를 부르면 헤더·컬럼 종류·제외 행 목록을
 * 받는다. 스트리밍 중에는 아직 확정되지 않은 값이 있으므로 끝난 뒤에 읽는다.
 */
/**
 * 카드 시트면 표로 펴서 한 덩어리로 흘리고, 아니면 파서를 그대로 통과시킨다.
 *
 * ★ 왜 통째로 모으나 ★
 * 블록 주기를 판정하려면 **앵커 사이의 간격**을 봐야 하고, 그건 시트 전체를 봐야
 * 나온다. 청크 경계에서 블록이 잘리면 그 블록만 짧게 읽혀 조용히 틀린다.
 *
 * 카드 시트는 사람이 손으로 만든 표라 크지 않다 — 실측 15시트 최대 205행이고,
 * 전체 200블록이다. LOCK 5(전체 메모리 적재 금지)는 8만 행짜리 마켓 파일을 겨눈
 * 규칙이고, 그 파일들은 카드가 아니라 표라 이 경로를 지나지 않는다.
 */
async function* blockAware(
  source: ParsedSource,
  sheetIndex: number,
  opts: StreamPipelineOptions,
): AsyncIterable<{ rows: readonly RawRow[] }> {
  if (opts.blockRead === undefined) {
    yield* source.stream(sheetIndex, opts)
    return
  }
  const all: RawRow[] = []
  for await (const c of source.stream(sheetIndex, opts)) all.push(...c.rows)
  const r = readBlocks(all, opts.blockRead)
  // 합성 헤더를 앞에 붙인다 — 뒤의 헤더 탐지가 평범하게 0행을 헤더로 잡는다.
  yield { rows: [r.header, ...r.rows] }
}

export function streamSheet(
  source: ParsedSource,
  sheetIndex: number,
  opts: StreamPipelineOptions = {},
): { chunks: AsyncIterable<NormalizedChunk>; getSummary: () => PipelineSummary } {
  const sheet = source.sheets[sheetIndex]
  if (!sheet) throw new Error(`시트 ${sheetIndex}는 없다`)

  const prologueSize = opts.prologueRows ?? DEFAULT_PROLOGUE
  const totalLabels = opts.totalLabels ?? DEFAULT_TOTAL_LABELS

  let header: HeaderDetection = { rowIndex: null, columns: [], confidence: 0, evidence: [] }
  let kinds: ColumnInference[] = []
  let dataRowCount = 0
  const excluded: ExcludedRow[] = []

  async function* generate(): AsyncIterable<NormalizedChunk> {
    const prologue: RawRow[] = []
    let absoluteRow = 0
    let decided = false
    let dataStart = 0
    let width = sheet!.columnCount

    // 꼬리 빈 행 보류함. 실데이터가 다시 오면 함께 흘려보내고,
    // 끝까지 안 오면 그게 곧 꼬리다.
    let pendingBlanks: { row: RawRow; index: number }[] = []

    // ── columnar 버퍼 ──────────────────────────────────────────
    // 청크 하나당 배열 3개. 셀 수와 무관하게 3개다.
    const cap = opts.chunkSize ?? 5_000
    let kindCodes: Uint8Array | null = null
    let values: (string | number | null)[] = []
    let raws: RawCell[] = []
    /** 청크 각 행의 **물리 행 번호**. 합계·빈 행이 빠져 startRow+i로는 못 구한다. */
    let rowIndices: Int32Array = new Int32Array(0)
    let rowsInChunk = 0
    let bufWidth = 0
    let outStart = 0

    const alloc = (w: number): void => {
      bufWidth = w
      kindCodes = new Uint8Array(cap * w)
      // `fill`은 배열을 PACKED로 만든다. 구멍 난 배열은 V8이 느린 경로로 다룬다.
      values = new Array<string | number | null>(cap * w).fill(null)
      raws = new Array<RawCell>(cap * w).fill(null)
      rowIndices = new Int32Array(cap)
      rowsInChunk = 0
    }

    /** 지금까지 채운 만큼을 청크로 떼어낸다. 버퍼는 재사용하지 않는다 — 내보낸 것을 덮게 된다. */
    const flush = (isLast: boolean): NormalizedChunk => {
      if (kindCodes === null) {
        return {
          sheetIndex,
          startRow: outStart,
          rowIndices: new Int32Array(0),
          isLast,
          width: bufWidth,
          rowCount: 0,
          kinds: new Uint8Array(0),
          values: [],
          raws: [],
        }
      }
      const n = rowsInChunk * bufWidth
      // 남는 칸이 붙어 나가면 소비자가 셀 수를 오해한다. 정확히 채운 만큼만.
      const chunk: NormalizedChunk = {
        sheetIndex,
        startRow: outStart,
        rowIndices: rowIndices.slice(0, rowsInChunk),
        isLast,
        width: bufWidth,
        rowCount: rowsInChunk,
        kinds: n === kindCodes.length ? kindCodes : kindCodes.slice(0, n),
        values: n === values.length ? values : values.slice(0, n),
        raws: n === raws.length ? raws : raws.slice(0, n),
      }
      kindCodes = null
      rowsInChunk = 0
      return chunk
    }

    const decide = (): void => {
      width = Math.max(sheet!.columnCount, ...prologue.map((r) => r.length), 0)
      header = detectHeader(prologue, width, opts)
      if (header.rowIndex === null) {
        dataStart = 0
        kinds = []
        return
      }
      for (let r = 0; r < header.rowIndex; r++) {
        if (isBlankRow(prologue[r])) continue
        excluded.push({
          rowIndex: r,
          reason: "subtitle",
          detail: `헤더(${header.rowIndex + 1}행) 위의 제목·설명 행`,
        })
      }
      const span = headerSpan(prologue, header.rowIndex, width)
      if (span > 1) {
        excluded.push({
          rowIndex: header.rowIndex + 1,
          reason: "subtitle",
          detail: "2단 헤더의 아랫단 — 컬럼 이름에 합쳐 넣었다",
        })
      }
      dataStart = header.rowIndex + span
      // 컬럼 종류는 prologue의 본문 부분만 보고 정한다. 전체를 보면
      // 스트리밍이 아니게 되고, 앞 수백 행이면 종류 판정에는 충분하다.
      const body = prologue.slice(dataStart).filter((r) => !isBlankRow(r))
      kinds = []
      for (let c = 0; c < width; c++) {
        kinds.push(inferColumnKind(header.columns[c] ?? "", body, c))
      }
    }

    /**
     * 행 하나를 버퍼에 쓴다. 청크가 차면 그 자리에서 내보내므로 제너레이터다.
     *
     * ragged row 패딩은 배열을 새로 만들지 않는다 — 모자란 칸은 그냥 `null`을 쓴다.
     */
    function* emit(row: RawRow, index: number): Generator<NormalizedChunk> {
      if (isTotalRow(row, totalLabels)) {
        excluded.push({ rowIndex: index, reason: "total", detail: "합계 행" })
        return
      }

      // 선언된 폭보다 긴 행. 15개 픽스처에는 없지만(실측), 생기면 자르지 않고
      // 폭을 넓힌다 — 조용히 버리는 것은 헌장 규칙 6 위반이다.
      if (row.length > width) {
        if (rowsInChunk > 0) yield flush(false)
        width = row.length
        kindCodes = null
      }

      if (kindCodes === null) alloc(width)
      if (rowsInChunk === 0) outStart = index
      rowIndices[rowsInChunk] = index

      const base = rowsInChunk * bufWidth
      for (let c = 0; c < bufWidth; c++) {
        const cell = c < row.length ? (row[c] ?? null) : null
        const i = base + c
        raws[i] = cell
        if (opts.skipNormalization) {
          // 측정 전용 경로 — 해석하지 않고 원본을 그대로 흘린다.
          kindCodes![i] = cell === null ? KIND_NULL : KIND_TEXT
          values[i] = typeof cell === "boolean" ? String(cell) : cell
        } else {
          const k = kinds[c]?.kind
          // `null` 추론은 "표본이 없다"는 뜻이라 강제하지 않는다.
          normalizeInto(cell, k && k !== "null" ? k : undefined, kindCodes!, values, i)
        }
      }

      rowsInChunk++
      dataRowCount++
      if (rowsInChunk >= cap) yield flush(false)
    }

    for await (const chunk of blockAware(source, sheetIndex, opts)) {
      for (const row of chunk.rows) {
        const index = absoluteRow++

        if (!decided) {
          prologue.push(row)
          if (prologue.length >= prologueSize) {
            decide()
            decided = true
            // 버퍼에 쌓인 본문을 이제 흘려보낸다.
            for (let r = dataStart; r < prologue.length; r++) {
              const p = prologue[r]!
              if (isBlankRow(p)) pendingBlanks.push({ row: p, index: r })
              else {
                pendingBlanks = []
                yield* emit(p, r)
              }
            }
            // prologue는 여기서 역할이 끝난다 — 참조를 끊어 GC가 가져가게 한다.
            prologue.length = 0
          }
          continue
        }

        if (isBlankRow(row)) {
          pendingBlanks.push({ row, index })
          continue
        }
        // 실데이터가 왔으니 보류분은 중간 빈 행이었다.
        for (const b of pendingBlanks) {
          excluded.push({ rowIndex: b.index, reason: "blank", detail: "빈 행" })
        }
        pendingBlanks = []
        yield* emit(row, index)
      }
    }

    // 파일이 prologue보다 짧았던 경우.
    if (!decided) {
      decide()
      for (let r = dataStart; r < prologue.length; r++) {
        const p = prologue[r]!
        if (isBlankRow(p)) pendingBlanks.push({ row: p, index: r })
        else {
          pendingBlanks = []
          yield* emit(p, r)
        }
      }
      prologue.length = 0
    }

    if (pendingBlanks.length > 0) {
      excluded.push({
        rowIndex: pendingBlanks[0]!.index,
        reason: "trailing-blank",
        detail: `${pendingBlanks[0]!.index + 1}행부터 ${pendingBlanks.length}행이 비어 있다 (서식만 남은 행)`,
      })
    }

    yield flush(true)
  }

  return {
    chunks: generate(),
    getSummary: () => ({
      sheet: sheet!,
      header,
      columnKinds: kinds,
      dataRowCount,
      excluded,
    }),
  }
}
