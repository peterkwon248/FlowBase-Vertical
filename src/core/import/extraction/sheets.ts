/**
 * 시트 분류 — 데이터 후보인가 요약인가.
 *
 * 헌장 B-9 "시트 분류(데이터 후보/요약)". 대행사 리포트 한 파일에 18개 시트가
 * 들어 있고(픽스처 #4) 그중 절반은 사람이 보는 요약이다. 요약을 사실 데이터로
 * 적재하면 숫자가 두 번 더해진다.
 *
 * ★ 시트명에만 기대지 않는다 ★
 * 대조표 함정 #1 — 픽스처 #9·#10의 시트명은 `order_list_all1763693998.5244`처럼
 * 타임스탬프가 붙은 export 이름이다. 이름 규칙으로 매칭하면 파일마다 달라진다.
 * 그래서 이름은 **보조 신호**고, 주 신호는 구조다.
 */

import type { RawRow, SheetRole } from "../types.js"
import { filledCount, isBlankRow } from "./rows.js"
import { detectHeader } from "./header.js"

/**
 * 요약 시트를 암시하는 이름 조각. 마켓 이름이 아니라 **문서 종류를 가리키는
 * 일반 어휘**다 — 헌장 B-8이 금지한 것은 마켓 이름(쿠팡·네이버 등)이다.
 * 팩이 목록을 대체할 수 있다.
 */
const DEFAULT_SUMMARY_HINTS: readonly string[] = [
  "요약",
  "종합",
  "비교",
  "대시보드",
  "분석",
  "차트",
  "그래프",
  // 사용자가 손으로 만든 통합 시트의 관문 역할 (픽스처 #3의 "메인 A"·"메인 B").
  "메인",
  "pivot",
  "summary",
  "dashboard",
  "chart",
  "overview",
  "main",
]

export interface SheetClassifyOptions {
  readonly summaryHints?: readonly string[]
  /** 데이터 시트로 인정할 최소 데이터 행 수. */
  readonly minDataRows?: number
}

export interface SheetClassification {
  readonly role: SheetRole
  readonly reason: string
  readonly confidence: number
}

/**
 * 표가 직사각형인 정도.
 *
 * 데이터 시트는 행마다 채워진 칸 수가 비슷하다. 요약 시트는 작은 표 여러 개를
 * 쌓아 만들어서 들쭉날쭉하다 — 시트명을 못 믿을 때 이게 주 신호가 된다.
 */
function rectangularity(rows: readonly RawRow[], sampleFrom: number): number {
  const sample = rows.slice(sampleFrom, sampleFrom + 50).filter((r) => !isBlankRow(r))
  if (sample.length < 3) return 0
  const counts = sample.map(filledCount)
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length
  if (mean === 0) return 0
  const variance = counts.reduce((a, c) => a + (c - mean) ** 2, 0) / counts.length
  const cv = Math.sqrt(variance) / mean
  // 변동계수 0 → 완전 직사각형. 0.5 이상이면 들쭉날쭉.
  return Math.max(0, 1 - cv * 2)
}

export function classifySheet(
  name: string,
  rows: readonly RawRow[],
  width: number,
  opts: SheetClassifyOptions = {},
): SheetClassification {
  const hints = opts.summaryHints ?? DEFAULT_SUMMARY_HINTS
  const minRows = opts.minDataRows ?? 2

  const contentRows = rows.filter((r) => !isBlankRow(r))
  if (contentRows.length === 0) {
    return { role: "empty", reason: "내용이 있는 행이 없다", confidence: 1 }
  }

  const header = detectHeader(rows, width)
  const nameHit = hints.find((h) => name.toLowerCase().includes(h.toLowerCase()))
  const dataStart = header.rowIndex === null ? 0 : header.rowIndex + 1
  const rect = rectangularity(rows, dataStart)
  const dataRows = contentRows.length - (header.rowIndex === null ? 0 : header.rowIndex + 1)

  // 구조 점수 — 높을수록 데이터답다.
  const structural = header.confidence * 0.5 + rect * 0.5

  const parts: string[] = [
    `헤더 확신 ${header.confidence.toFixed(2)}`,
    `직사각형도 ${rect.toFixed(2)}`,
    `데이터 행 ${Math.max(0, dataRows)}`,
  ]

  if (dataRows < minRows) {
    return {
      role: "summary",
      reason: `데이터 행이 ${Math.max(0, dataRows)}개뿐 — 표로 보기 어렵다 (${parts.join(", ")})`,
      confidence: 0.7,
    }
  }

  if (nameHit) {
    // 이름이 요약을 가리키면 요약이다. 구조로 뒤집지 않는다.
    //
    // 처음엔 "구조가 반듯하면 데이터로 본다"는 예외를 뒀는데, 잘 만든 분석
    // 시트일수록 표가 반듯해서 예외가 거의 항상 발동했다. 픽스처 #3의
    // `통합_상품분석`(헤더 확신 0.97)이 그렇게 데이터로 분류됐다.
    //
    // 구조는 "표인가"를 말할 뿐 "원본인가"를 말하지 못한다. 사용자가 시트에
    // "분석"·"요약"이라고 적었다면 그건 파생물이라는 본인의 선언이고, 그 판단이
    // 우리 휴리스틱보다 정확하다. 파생물을 사실로 적재하면 숫자가 두 번 더해진다.
    return {
      role: "summary",
      reason: `시트명에 "${nameHit}" — 파생 시트로 본다 (${parts.join(", ")})`,
      confidence: 0.85,
    }
  }

  if (structural < 0.4) {
    return {
      role: "summary",
      reason: `구조 점수 ${structural.toFixed(2)} — 일정한 표가 아니다 (${parts.join(", ")})`,
      confidence: 0.6,
    }
  }

  return { role: "data", reason: parts.join(", "), confidence: structural }
}

export { DEFAULT_SUMMARY_HINTS }
