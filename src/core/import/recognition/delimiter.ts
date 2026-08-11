/**
 * 구분자 추론.
 *
 * 판정 기준은 "가장 많이 나온 문자"가 아니라 **행마다 개수가 일정한 문자**다.
 * 콤마는 금액("1,200")·상품명에 자주 섞이므로 빈도만 보면 오판한다. 반면 진짜
 * 구분자는 모든 행에서 같은 횟수로 나타난다.
 *
 * 픽스처 #1·#2가 정확히 이 함정이다 — 확장자가 `.csv`인데 실제 구분자는 TAB이고,
 * 셀 안에는 콤마가 들어 있다.
 */

const CANDIDATES: readonly { char: string; name: string }[] = [
  { char: "\t", name: "TAB" },
  { char: ",", name: "콤마" },
  { char: ";", name: "세미콜론" },
  { char: "|", name: "파이프" },
]

export interface DelimiterGuess {
  readonly delimiter: string
  readonly confidence: number
  readonly evidence: readonly string[]
}

/** 따옴표 밖에 있는 문자만 센다 — 셀 안의 구분자에 속지 않기 위해. */
function countOutsideQuotes(line: string, ch: string): number {
  let count = 0
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      // "" 는 이스케이프된 따옴표다 — 상태를 뒤집지 않는다.
      if (inQuotes && line[i + 1] === '"') {
        i++
        continue
      }
      inQuotes = !inQuotes
    } else if (c === ch && !inQuotes) {
      count++
    }
  }
  return count
}

export function detectDelimiter(text: string, sampleLines = 20): DelimiterGuess {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0)
    .slice(0, sampleLines)

  if (lines.length === 0) {
    return { delimiter: ",", confidence: 0, evidence: ["빈 파일 — 기본값 콤마"] }
  }

  let best: DelimiterGuess = {
    delimiter: ",",
    confidence: 0,
    evidence: ["구분자 신호 없음 — 단일 컬럼일 수 있다"],
  }

  for (const cand of CANDIDATES) {
    const counts = lines.map((l) => countOutsideQuotes(l, cand.char))
    if (counts.every((c) => c === 0)) continue

    const first = counts[0] ?? 0
    const consistent = counts.filter((c) => c === first).length
    const ratio = consistent / counts.length

    // 일관성이 주 신호, 컬럼 수는 동점일 때의 보조 신호.
    const confidence = ratio * (first > 0 ? 1 : 0) * Math.min(1, 0.6 + first / 20)

    if (confidence > best.confidence) {
      best = {
        delimiter: cand.char,
        confidence,
        evidence: [
          `${cand.name}: ${lines.length}행 중 ${consistent}행이 동일하게 ${first}개 ` +
            `(일관성 ${(ratio * 100).toFixed(0)}%, 컬럼 ${first + 1}개)`,
        ],
      }
    }
  }

  return best
}
