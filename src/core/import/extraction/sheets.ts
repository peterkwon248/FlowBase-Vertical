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
  /**
   * 이름 힌트를 끈다. 구조만으로 어떤 결론이 나오는지 확인할 때 쓴다 —
   * 이름 판정이 구조 판정과 어긋나지 않는지 검증하는 용도다.
   */
  readonly ignoreNameHints?: boolean
}

export interface SheetClassification {
  readonly role: SheetRole
  readonly reason: string
  readonly confidence: number
}

/**
 * 기계가 붙인 이름인가 — 그렇다면 이름에서 아무 뜻도 읽지 않는다.
 *
 * 대조표 함정 #1이 가리키는 것이 이것이다. `order_list_all1763693998.5244`나
 * `Sheet1`은 사람이 고른 말이 아니라 export 도구가 찍은 문자열이라, 여기서
 * 의미를 읽으면 파일마다 결론이 달라진다.
 *
 * 뒤집어 말하면 **사람이 붙인 이름은 뜻을 담는다.** `통합_상품분석`이라고
 * 적은 사람은 그 시트가 파생물이라고 선언한 것이고, 그 선언은 우리가 셀에서
 * 읽어낼 수 없는 정보다.
 */
export function looksMachineGenerated(name: string): boolean {
  const n = name.trim()
  // Sheet1 · sheet · 시트2 · Worksheet 3 — 도구의 기본 이름
  if (/^(sheet|worksheet|시트|表|表\d*)\s*\d*$/i.test(n)) return true
  // 8자리 이상 연속 숫자 — 타임스탬프·일련번호
  if (/\d{8,}/.test(n)) return true
  return false
}

/**
 * 표가 직사각형인 정도. 표본이 모자라면 `null` — **0이 아니다.**
 *
 * 데이터 시트는 행마다 채워진 칸 수가 비슷하다. 요약 시트는 작은 표 여러 개를
 * 쌓아 만들어서 들쭉날쭉하다 — 시트명을 못 믿을 때 이게 주 신호가 된다.
 *
 * 표본 부족을 0으로 돌려주면 "내용이 적다"가 "구조가 나쁘다"로 둔갑한다.
 * 판단할 근거가 없으면 없다고 해야 헤더 확신이 그 자리를 대신할 수 있다.
 */
function rectangularity(rows: readonly RawRow[], sampleFrom: number): number | null {
  const sample = rows.slice(sampleFrom, sampleFrom + 50).filter((r) => !isBlankRow(r))
  if (sample.length < 3) return null
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

  const contentRows = rows.filter((r) => !isBlankRow(r))
  if (contentRows.length === 0) {
    return { role: "empty", reason: "내용이 있는 행이 없다", confidence: 1 }
  }

  const header = detectHeader(rows, width)
  // 기계가 붙인 이름에서는 뜻을 읽지 않는다 (대조표 함정 #1).
  const nameIsMeaningful = !looksMachineGenerated(name)
  const nameHit =
    opts.ignoreNameHints || !nameIsMeaningful
      ? undefined
      : hints.find((h) => name.toLowerCase().includes(h.toLowerCase()))
  const dataStart = header.rowIndex === null ? 0 : header.rowIndex + 1
  const rect = rectangularity(rows, dataStart)
  const dataRows = contentRows.length - dataStart

  // 구조 점수 — 높을수록 데이터답다. 직사각형도를 못 재면 헤더 확신만 본다.
  const structural = rect === null ? header.confidence : header.confidence * 0.5 + rect * 0.5

  const parts: string[] = [
    `헤더 확신 ${header.confidence.toFixed(2)}`,
    `직사각형도 ${rect === null ? "측정불가(표본부족)" : rect.toFixed(2)}`,
    `데이터 행 ${Math.max(0, dataRows)}`,
  ]

  // ★ 행 수로 역할을 정하지 않는다 ★
  //
  // 구조가 표인데 이번 달 내용이 비었을 뿐인 시트가 있다 (#4의 카테고리 —
  // 헤더 확신 0.95인데 데이터 0행). 이걸 "요약"으로 강등하면 다음 달 파일에
  // 데이터가 들어와도 같은 시트가 제외된다.
  //
  // 원칙: **역할은 구조로, 행 수는 내용으로.** 데이터 후보이면서 0행일 수 있다.

  if (nameHit) {
    // 사람이 붙인 이름이 파생을 가리키면 요약이다. 구조로 뒤집지 않는다.
    //
    // 처음엔 "구조가 반듯하면 데이터로 본다"는 예외를 뒀는데, 잘 만든 분석
    // 시트일수록 표가 반듯해서 예외가 거의 항상 발동했다.
    //
    // 구조는 "표인가"를 말할 뿐 "원본인가"를 말하지 못한다 — 실측으로 확인했다.
    // 픽스처 #3에서 이름 힌트를 끄면 19시트가 전부 `data`로 나오고, 수식 비율도
    // 파생/원본을 가르지 못한다(원본으로 분류한 `이베이`가 96% 수식이다).
    // 근거는 `docs/세션1-교차대조.md` M-6에 있다.
    //
    // 따라서 이 판정은 **사람이 시트에 적어 넣은 선언**에 기댄다. 셀에서 읽어낼
    // 수 없는 정보이고, 틀렸을 때의 교정 지점은 가져오기 위저드의 시트 선택
    // 단계다(헌장 C-5) — 조용히 넘어가지 않는다.
    return {
      role: "summary",
      reason: `시트명에 "${nameHit}" — 사람이 붙인 파생 선언으로 본다 (${parts.join(", ")})`,
      confidence: 0.85,
    }
  }

  if (header.rowIndex === null) {
    return {
      role: "summary",
      reason: `헤더를 찾지 못했다 — 단일 표가 아니다 (${parts.join(", ")})`,
      confidence: 0.75,
    }
  }

  if (structural < 0.4) {
    return {
      role: "summary",
      reason: `구조 점수 ${structural.toFixed(2)} — 일정한 표가 아니다 (${parts.join(", ")})`,
      confidence: 0.6,
    }
  }

  return {
    role: "data",
    reason: dataRows <= 0 ? `구조는 표이나 이번 파일에 내용이 없다 (${parts.join(", ")})` : parts.join(", "),
    confidence: structural,
  }
}

export { DEFAULT_SUMMARY_HINTS }
