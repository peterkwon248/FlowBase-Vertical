/**
 * 인코딩 감지 (헌장 B-9 Normalization: "cp949/utf-8/utf-16 인코딩 감지").
 *
 * `TextDecoder`만 쓴다. WHATWG Encoding 라벨은 Node와 브라우저 Worker에서 이름이
 * 같으므로 iconv 계열 의존성이 필요 없다 — 의존성 하나가 곧 공급망 리스크 하나다.
 *
 * 한국 마켓 파일에서 실제로 만나는 것은 세 가지다:
 *   - UTF-16 LE (11번가 보고서 — BOM `FF FE`)
 *   - UTF-8 (요즘 내보내기 대부분)
 *   - EUC-KR/CP949 (구형 내보내기. WHATWG 라벨 `euc-kr`이 CP949 확장을 포함한다)
 */

import type { EncodingLabel } from "../types.js"

export interface EncodingGuess {
  readonly encoding: EncodingLabel
  readonly confidence: number
  readonly evidence: readonly string[]
  /** BOM 바이트 수. 디코드한 문자열에서 U+FEFF를 따로 떼야 할 때 쓴다. */
  readonly bomLength: number
}

const BOMS: readonly { bytes: readonly number[]; encoding: EncodingLabel }[] = [
  { bytes: [0xff, 0xfe], encoding: "utf-16le" },
  { bytes: [0xfe, 0xff], encoding: "utf-16be" },
  { bytes: [0xef, 0xbb, 0xbf], encoding: "utf-8" },
]

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false
  return prefix.every((b, i) => bytes[i] === b)
}

/** UTF-8로 디코드했을 때 U+FFFD(대체 문자)가 나오는지. 나오면 UTF-8이 아니다. */
function decodesCleanAsUtf8(bytes: Uint8Array): boolean {
  // fatal 모드는 잘못된 시퀀스에서 throw한다 — 대체 문자를 세는 것보다 확실하다.
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    return true
  } catch {
    return false
  }
}

/**
 * BOM 없는 UTF-16 LE 판별.
 *
 * ASCII 위주 텍스트가 UTF-16 LE로 저장되면 홀수 바이트가 대부분 0이 된다.
 * 한글 위주면 이 신호가 약해지므로 확신도를 낮춘다.
 */
function looksLikeBomlessUtf16le(bytes: Uint8Array): number {
  const n = Math.min(bytes.length, 4096)
  if (n < 4) return 0
  let oddZero = 0
  let odd = 0
  for (let i = 1; i < n; i += 2) {
    odd++
    if (bytes[i] === 0) oddZero++
  }
  return odd === 0 ? 0 : oddZero / odd
}

export function detectEncoding(bytes: Uint8Array): EncodingGuess {
  for (const bom of BOMS) {
    if (startsWith(bytes, bom.bytes)) {
      const hex = bom.bytes.map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")
      return {
        encoding: bom.encoding,
        confidence: 1,
        evidence: [`BOM ${hex} → ${bom.encoding}`],
        bomLength: bom.bytes.length,
      }
    }
  }

  const utf16Ratio = looksLikeBomlessUtf16le(bytes)
  if (utf16Ratio > 0.7) {
    return {
      encoding: "utf-16le",
      confidence: Math.min(0.85, utf16Ratio),
      evidence: [`BOM 없음. 홀수 바이트의 ${(utf16Ratio * 100).toFixed(0)}%가 0 → UTF-16 LE 추정`],
      bomLength: 0,
    }
  }

  if (decodesCleanAsUtf8(bytes)) {
    // 순수 ASCII면 어느 인코딩으로 읽어도 같다. UTF-8로 처리해도 안전하다.
    const ascii = bytes.every((b) => b < 0x80)
    return {
      encoding: "utf-8",
      confidence: ascii ? 0.7 : 0.95,
      evidence: [ascii ? "전부 ASCII — UTF-8로 읽어도 동일" : "UTF-8로 오류 없이 디코드됨"],
      bomLength: 0,
    }
  }

  // UTF-8이 아니면서 한국어 파일이면 사실상 EUC-KR/CP949다.
  return {
    encoding: "euc-kr",
    confidence: 0.8,
    evidence: ["UTF-8 디코드 실패 → EUC-KR/CP949 (WHATWG `euc-kr`이 CP949 확장 포함)"],
    bomLength: 0,
  }
}

/** 감지한 인코딩으로 디코드하고 남은 BOM 문자를 제거한다. */
export function decodeText(bytes: Uint8Array, guess: EncodingGuess): string {
  const body = guess.bomLength > 0 ? bytes.subarray(guess.bomLength) : bytes
  const text = new TextDecoder(guess.encoding).decode(body)
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}
