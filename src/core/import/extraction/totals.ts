/**
 * 합계·소계 행 제거.
 *
 * 헌장 B-9 — "합계/소계 행 **위치 무관** 제거."
 *
 * 위치를 못 박을 수 없다는 게 요점이다. 픽스처 #1·#2는 합계가 **2행**(헤더 바로
 * 아래)에 있고, 대행사 리포트는 보통 맨 아래에 붙인다. 행 번호로 자르면 둘 중
 * 하나는 반드시 틀린다.
 *
 * 제거된 행은 버리지 않고 사유와 함께 남긴다 — 헌장 C-5의 "제외 행 삭선+카운트"가
 * 그 목록을 그대로 화면에 쓴다.
 */

import type { ExcludedRow, RawRow } from "../types.js"
import { cellText, filledCount, isBlankCell, looksNumeric } from "./rows.js"

/**
 * 합계 라벨. 정확히 일치하거나 접두로 붙는 경우만 잡는다.
 *
 * "계"를 단독 부분일치로 넣지 않는 이유: 상품명에 흔히 들어간다("계량컵",
 * "시계"). 라벨 셀 전체가 그 단어일 때만 합계로 본다.
 */
const DEFAULT_TOTAL_LABELS: readonly string[] = [
  "합계",
  "총계",
  "소계",
  "누계",
  "전체",
  "계",
  // 픽스처 #12는 날짜마다 pc·mobile·수기주문 아래에 "총액" 행을 붙인다.
  "총액",
  "총합",
  "총합계",
  "total",
  "subtotal",
  "sum",
  "grand total",
]

export interface TotalsOptions {
  /** 기본 목록을 대체한다. 팩이 마켓별 표기를 얹을 수 있다. */
  readonly labels?: readonly string[]
  /**
   * 라벨 없는 집계 행 탐지를 끈다. 기본 켜짐.
   *
   * 끌 수 있게 둔 이유: 이 판정은 "식별자 없는 행은 데이터가 아니다"라는 가정에
   * 기댄다. 식별자가 비어도 유효한 표(예: 날짜가 병합돼 첫 행에만 있는 표)에서는
   * 정상 행을 지울 수 있다. 그런 프로파일은 이 옵션으로 끈다.
   */
  readonly detectUnlabeledAggregates?: boolean
}

function normalizeLabel(s: string): string {
  // "합 계" · "[합계]" · "합계:" 같은 변형을 흡수한다.
  return s
    .replace(/[\s[\]():：*]/g, "")
    .trim()
    .toLowerCase()
}

/**
 * 이 행이 합계 행인가.
 *
 * 두 조건을 함께 본다:
 *   1. 앞쪽 라벨 칸 중 하나가 합계 단어와 정확히 일치
 *   2. 나머지가 대체로 숫자 — 라벨만 있고 숫자가 없으면 소제목이지 합계가 아니다
 */
export function isTotalRow(row: RawRow | undefined, labels = DEFAULT_TOTAL_LABELS): boolean {
  if (!row || filledCount(row) === 0) return false

  const norm = labels.map(normalizeLabel)
  // 라벨은 통상 앞쪽에 있다. 뒤쪽 데이터 셀에 우연히 "계"가 있는 걸 잡지 않도록 제한한다.
  const labelZone = Math.min(row.length, 3)
  let labelIndex = -1
  for (let c = 0; c < labelZone; c++) {
    const cell = row[c]
    if (typeof cell !== "string") continue
    if (norm.includes(normalizeLabel(cell))) {
      labelIndex = c
      break
    }
  }
  if (labelIndex < 0) return false

  // 라벨 칸 **하나만** 뺀 나머지를 본다. 라벨 존 전체를 건너뛰면 3열짜리 좁은
  // 표에서 검사할 값이 남지 않아 합계를 영영 못 잡는다.
  const values = row.filter((c, i) => i !== labelIndex && !isBlankCell(c))
  if (values.length === 0) return false
  const numeric = values.filter(looksNumeric).length
  return numeric / values.length >= 0.6
}

/**
 * 라벨 없는 집계 행.
 *
 * 광고 리포트가 헤더 바로 아래에 총계를 끼워 넣는데 **라벨을 안 붙이는** 경우가
 * 있다. 픽스처 #4 `G_상품별`의 6행이 그렇다:
 *
 *     사이트 코드 | 상품ID    | 노출   | 클릭 | 총비용 …   ← 헤더
 *     (빈칸)     | (빈칸)    | 236612 | 843  | 533291 …   ← 집계 (라벨 없음)
 *     G마켓      | 477833846 | 42466  | 221  | 133408 …   ← 데이터
 *
 * 단서는 "식별자 칸이 비었는데 측정값 칸은 찼다"이다. 상품ID 없는 상품 행은
 * 존재할 수 없으므로, 이건 행이 아니라 열의 요약이다.
 *
 * 식별자 칸을 이름으로 찾지 않는다 — 본문에서 **문자열이 주로 오는 열**을
 * 식별자 열로 본다. 마켓·언어에 기대지 않기 위해서다 (헌장 B-8).
 */
function labelColumns(body: readonly RawRow[], width: number): number[] {
  const sample = body.slice(0, 50).filter((r) => filledCount(r) > 0)
  if (sample.length < 3) return []
  const cols: number[] = []
  for (let c = 0; c < width; c++) {
    const values = sample.map((r) => r[c]).filter((v) => !isBlankCell(v))
    if (values.length < sample.length * 0.8) continue // 대부분 비어 있으면 판단 보류
    const textish = values.filter((v) => typeof v === "string" && !looksNumeric(v)).length
    if (textish / values.length >= 0.8) cols.push(c)
  }
  return cols
}

function isUnlabeledAggregate(row: RawRow, labelCols: readonly number[]): boolean {
  if (labelCols.length === 0) return false
  // 식별자 칸이 하나라도 차 있으면 평범한 데이터 행이다.
  if (labelCols.some((c) => !isBlankCell(row[c]))) return false

  const rest = row.filter((c, i) => !labelCols.includes(i) && !isBlankCell(c))
  // 측정값이 충분히 있어야 한다 — 그냥 빈 행과 구분한다.
  if (rest.length < 3) return false
  return rest.filter(looksNumeric).length / rest.length >= 0.8
}

export interface TotalsResult {
  readonly rows: readonly RawRow[]
  readonly excluded: readonly ExcludedRow[]
}

/**
 * 합계 행을 걷어낸다.
 *
 * `startRow`는 데이터 영역의 시작 절대 인덱스다. `ExcludedRow.rowIndex`도
 * 절대 인덱스로 남긴다 — 사용자에게 "3행이 제외됐습니다"라고 말할 때 그 3행이
 * 파일을 열었을 때의 3행이어야 한다.
 */
export function stripTotals(
  rows: readonly RawRow[],
  startRow: number,
  opts: TotalsOptions = {},
): TotalsResult {
  const labels = opts.labels ?? DEFAULT_TOTAL_LABELS
  const width = Math.max(0, ...rows.map((r) => r.length))
  const labelCols = opts.detectUnlabeledAggregates === false ? [] : labelColumns(rows, width)

  const kept: RawRow[] = []
  const excluded: ExcludedRow[] = []

  for (const [i, row] of rows.entries()) {
    if (row && isTotalRow(row, labels)) {
      excluded.push({
        rowIndex: startRow + i,
        reason: "total",
        detail: `합계 행 — 라벨 "${cellText(row[0]) || cellText(row[1])}"`,
      })
      continue
    }
    if (row && isUnlabeledAggregate(row, labelCols)) {
      excluded.push({
        rowIndex: startRow + i,
        reason: "total",
        detail:
          `라벨 없는 집계 행 — 식별자 열(${labelCols.map((c) => c + 1).join("·")}열)이 비었는데 ` +
          `측정값은 채워져 있다`,
      })
      continue
    }
    kept.push(row)
  }

  return { rows: kept, excluded }
}

export { DEFAULT_TOTAL_LABELS }
