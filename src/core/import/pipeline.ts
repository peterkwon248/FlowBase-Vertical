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
  NormalizedValue,
  ParseOptions,
  ParsedSource,
  RawRow,
  SheetInfo,
} from "./types.js"
import { detectHeader, headerSpan, type HeaderOptions } from "./extraction/header.js"
import { isTotalRow, DEFAULT_TOTAL_LABELS } from "./extraction/totals.js"
import { isBlankRow } from "./extraction/rows.js"
import { inferColumnKind, type ColumnInference } from "./normalization/column.js"
import { normalizeValue } from "./normalization/value.js"

export interface StreamPipelineOptions extends ParseOptions, HeaderOptions {
  /** 헤더·컬럼 종류를 정하기 위해 앞에서 버퍼링할 행 수. */
  readonly prologueRows?: number
  readonly totalLabels?: readonly string[]
  /** 정규화를 건너뛰고 원시 행만 흘린다 — 적재 비용만 재고 싶을 때. */
  readonly skipNormalization?: boolean
}

export interface NormalizedChunk {
  readonly sheetIndex: number
  readonly startRow: number
  readonly rows: readonly (readonly NormalizedValue[])[]
  readonly isLast: boolean
}

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
    let out: (readonly NormalizedValue[])[] = []
    let outStart = 0

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

    const emit = (row: RawRow, index: number): void => {
      if (isTotalRow(row, totalLabels)) {
        excluded.push({ rowIndex: index, reason: "total", detail: "합계 행" })
        return
      }
      const padded =
        row.length >= width ? row : [...row, ...new Array<null>(width - row.length).fill(null)]
      const normalized = opts.skipNormalization
        ? (padded as unknown as readonly NormalizedValue[])
        : padded.map((cell, c) => {
            const k = kinds[c]?.kind
            return normalizeValue(cell, k && k !== "null" ? { kind: k } : {})
          })
      if (out.length === 0) outStart = index
      out.push(normalized)
      dataRowCount++
    }

    for await (const chunk of source.stream(sheetIndex, opts)) {
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
                emit(p, r)
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
        emit(row, index)

        if (out.length >= (opts.chunkSize ?? 5_000)) {
          yield { sheetIndex, startRow: outStart, rows: out, isLast: false }
          out = []
        }
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
          emit(p, r)
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

    yield { sheetIndex, startRow: outStart, rows: out, isLast: true }
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
