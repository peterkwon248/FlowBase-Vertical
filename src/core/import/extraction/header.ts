/**
 * 헤더 행 탐지.
 *
 * 헌장 B-9 — "상위 ~10행 스캔, 고정 행 번호는 프로파일 힌트일 뿐."
 *
 * 픽스처가 요구하는 범위:
 *   #1·#2·#8~#15   헤더가 1행
 *   #4·#5·#6       1~5행이 제목·기간이고 헤더는 6행
 *   #12            `!ref`가 A2부터라 헤더가 0-기준 1행 (게다가 2단 병합 헤더)
 *
 * 그래서 "N행이 헤더"라는 고정값을 쓸 수 없다. 행을 점수화해서 고른다.
 */

import type { HeaderDetection, RawRow } from "../types.js"
import { cellText, filledCount, isBlankCell, looksNumeric } from "./rows.js"

export interface HeaderOptions {
  /** 몇 행까지 볼 것인가. */
  readonly scanRows?: number
  /** 프로파일이 알려준 힌트(0-기준). 동점일 때만 쓴다 — 판정을 덮어쓰지 않는다. */
  readonly hintRow?: number
}

const DEFAULT_SCAN = 10

interface RowScore {
  readonly row: number
  readonly score: number
  readonly reasons: string[]
}

/**
 * 한 행의 "헤더다움" 점수.
 *
 * 헤더의 성질: 채워진 칸이 많고 · 대부분 문자열이고 · 값이 서로 다르고 ·
 * 짧고 · **아래 행들과 타입이 다르다.** 마지막 항목이 제목 행과 헤더를 가르는
 * 결정적 신호다 — 제목 행 아래도 문자열이지만, 헤더 아래는 숫자가 나온다.
 */
function scoreRow(rows: readonly RawRow[], r: number, width: number): RowScore {
  const row = rows[r]
  const reasons: string[] = []
  const filled = filledCount(row)
  if (!row || filled === 0) return { row: r, score: 0, reasons: ["빈 행"] }

  // 1) 폭 — 헤더는 시트 전체 폭을 거의 채운다.
  //
  //    단, 2단 병합 헤더의 윗단은 혼자서는 듬성듬성하다. 픽스처 #12의 윗단은
  //    14칸 중 4칸만 찼고(`날짜|구분|매출금액|판매금액`), 나머지는 아랫단이
  //    채운다. 윗단만 보고 점수를 매기면 아랫단이 헤더로 뽑혀 상위 컬럼 이름이
  //    통째로 사라진다 — 그래서 아랫단과 합친 폭도 함께 본다.
  const own = width > 0 ? filled / width : 0
  const fillRatio = Math.max(own, combinedFillRatio(rows, r, width))
  // 제목 행은 한두 칸만 찬다 (#4·#5·#6의 1~5행).
  if (filled <= 2 && width > 4) {
    return { row: r, score: 0.05, reasons: [`채워진 칸 ${filled}/${width} — 제목 행으로 보인다`] }
  }

  // 2) 문자열 비율 — 헤더는 라벨이다.
  const values = row.filter((c) => !isBlankCell(c))
  const strings = values.filter((c) => typeof c === "string" && !looksNumeric(c))
  const stringRatio = values.length > 0 ? strings.length / values.length : 0

  // 3) 중복 없음 — 같은 이름의 컬럼은 드물다.
  const texts = strings.map(cellText)
  const distinctRatio = texts.length > 0 ? new Set(texts).size / texts.length : 0

  // 4) 짧음 — 라벨이지 문장이 아니다.
  const shortRatio = texts.length > 0 ? texts.filter((t) => t.length <= 40).length / texts.length : 0

  // 5) 아래 행과의 타입 이질성 — 여기가 핵심.
  //
  //    2단 헤더면 **두 단을 한 헤더로 묶어** 채점한다. 윗단만 놓고 재면 비교할
  //    컬럼이 서너 개뿐이라 이질성이 희석되고, 컬럼을 꽉 채운 아랫단이 이겨서
  //    아랫단이 헤더로 뽑힌다. 그러면 윗단의 이름(#12의 `날짜`·`구분`·`매출금액`)이
  //    통째로 사라지고 `(1열)` 같은 자리표시로 대체된다.
  const twoTier = isTwoTierTop(rows, r, width)
  const headerEnd = r + (twoTier ? 2 : 1)
  const next = rows[r + 1] ?? []

  let divergence = 0
  const below = rows.slice(headerEnd, headerEnd + 5).filter((x) => filledCount(x) > 0)
  if (below.length > 0) {
    let diverged = 0
    let compared = 0
    for (let c = 0; c < width; c++) {
      // 두 단 중 어느 쪽이든 이름이 있으면 그 컬럼은 헤더가 덮고 있다.
      const head = !isBlankCell(row[c]) ? row[c] : twoTier ? next[c] : null
      if (isBlankCell(head) || looksNumeric(head)) continue
      const belowNumeric = below.filter((b) => looksNumeric(b[c])).length
      compared++
      if (belowNumeric > below.length / 2) diverged++
    }
    divergence = compared > 0 ? diverged / compared : 0
  }

  const score =
    fillRatio * 0.25 + stringRatio * 0.25 + distinctRatio * 0.15 + shortRatio * 0.1 + divergence * 0.25

  reasons.push(
    `채움 ${filled}/${width}`,
    `문자열 ${(stringRatio * 100).toFixed(0)}%`,
    `고유 ${(distinctRatio * 100).toFixed(0)}%`,
    `아래 행과 타입 상이 ${(divergence * 100).toFixed(0)}%`,
  )
  if (twoTier) reasons.push("2단 헤더의 윗단")
  return { row: r, score, reasons }
}

/**
 * 이 행이 2단 헤더의 윗단인가.
 *
 * 조건: 아랫행이 윗행의 빈 칸을 둘 이상 메우고 · 아랫행에 숫자가 없다.
 * 아랫행에 숫자가 있으면 그건 데이터지 헤더의 아랫단이 아니다.
 */
function isTwoTierTop(rows: readonly RawRow[], r: number, width: number): boolean {
  const top = rows[r] ?? []
  const next = rows[r + 1] ?? []
  if (filledCount(next) === 0) return false
  let complements = 0
  for (let c = 0; c < width; c++) {
    if (!isBlankCell(next[c]) && looksNumeric(next[c])) return false
    if (isBlankCell(top[c]) && !isBlankCell(next[c])) complements++
  }
  return complements >= 2
}

export function detectHeader(
  rows: readonly RawRow[],
  width: number,
  opts: HeaderOptions = {},
): HeaderDetection {
  const scan = Math.min(opts.scanRows ?? DEFAULT_SCAN, rows.length)
  if (scan === 0) {
    return { rowIndex: null, columns: [], confidence: 0, evidence: ["행이 없다"] }
  }

  const scored: RowScore[] = []
  for (let r = 0; r < scan; r++) scored.push(scoreRow(rows, r, width))

  let best = scored[0]!
  for (const s of scored) {
    if (s.score > best.score) best = s
    // 동점이면 힌트가 가른다. 힌트는 여기서만 개입한다 (헌장 B-9).
    else if (opts.hintRow !== undefined && s.row === opts.hintRow && s.score === best.score) {
      best = s
    }
  }

  // 확신이 없으면 없다고 한다. 0행을 기본값으로 넘겨짚지 않는다 (헌장 A-5).
  if (best.score < 0.35) {
    return {
      rowIndex: null,
      columns: [],
      confidence: best.score,
      evidence: [
        `상위 ${scan}행 중 헤더로 볼 만한 행이 없다 (최고 점수 ${best.score.toFixed(2)}, ${best.row}행)`,
        ...best.reasons,
      ],
    }
  }

  const headerRow = rows[best.row] ?? []
  const columns = buildColumnNames(rows, best.row, width)

  const evidence = [`${best.row}행을 헤더로 판정 (점수 ${best.score.toFixed(2)})`, ...best.reasons]
  if (opts.hintRow !== undefined && opts.hintRow !== best.row) {
    // 힌트와 다르면 조용히 넘어가지 않는다.
    evidence.push(`프로파일 힌트는 ${opts.hintRow}행이었으나 내용 판정이 우선한다`)
  }
  if (headerRow.length < width) {
    evidence.push(`헤더가 ${headerRow.length}칸, 시트 폭은 ${width}칸`)
  }

  return { rowIndex: best.row, columns, confidence: Math.min(1, best.score), evidence }
}

/**
 * 2단 헤더일 때 두 단을 합친 채움 비율. 아니면 0.
 *
 * 윗단 혼자서는 듬성듬성해 보이지만 아랫단이 빈 자리를 메우고 있으면 둘이 한
 * 헤더이고, 그 폭으로 재야 공정하다.
 */
function combinedFillRatio(rows: readonly RawRow[], r: number, width: number): number {
  if (width === 0 || !isTwoTierTop(rows, r, width)) return 0
  const top = rows[r] ?? []
  const next = rows[r + 1] ?? []
  let union = 0
  for (let c = 0; c < width; c++) {
    if (!isBlankCell(top[c]) || !isBlankCell(next[c])) union++
  }
  return union / width
}

/**
 * 컬럼 이름 만들기.
 *
 * 2단 병합 헤더(#12: `날짜 | 구분 | 매출금액 | 판매금액[4칸 병합]` 위,
 * `상품판매가 | (-)상품할인 | 결제금액 | 배송비` 아래)를 다룬다. 헤더 행의
 * 빈 칸을 바로 아랫행이 채우고 있으면 두 이름을 합친다.
 *
 * 빈 칸은 이름을 지어내지 않고 `(1열)` 같은 위치 표기로 남긴다 — 없는 이름을
 * 만들어내면 매핑 단계에서 그게 진짜 이름인 줄 알게 된다.
 */
function buildColumnNames(rows: readonly RawRow[], headerRow: number, width: number): string[] {
  const top = rows[headerRow] ?? []
  const next = rows[headerRow + 1] ?? []
  const twoTier = isTwoTierTop(rows, headerRow, width)

  const out: string[] = []
  for (let c = 0; c < width; c++) {
    const t = cellText(top[c])
    const n = twoTier ? cellText(next[c]) : ""
    const name = t && n ? `${t} ${n}` : t || n
    out.push(name || `(${c + 1}열)`)
  }
  return out
}

/** 2단 헤더였다면 데이터 시작 행이 한 칸 더 밀린다. */
export function headerSpan(rows: readonly RawRow[], headerRow: number, width: number): number {
  return isTwoTierTop(rows, headerRow, width) ? 2 : 1
}
