/**
 * 포맷 스니퍼 — 헌장 B-9 Recognition.
 *
 *   "매직 바이트 스니핑이 1순위 (FF FE→UTF-16 TSV, <meta/<html→HTML 표,
 *    PK→xlsx, D0 CF→BIFF xls). 확장자는 힌트."
 *
 * 확장자는 **후보 순위를 흔들지 않는다.** 어긋나면 `extensionMismatch`로 표시할
 * 뿐이다 (헌장 C-5 "파일 정체 고지"). 픽스처 15개 중 3개가 확장자를 속인다:
 *   #1·#2  `.csv`  → 실제 UTF-16 LE TAB 구분
 *   #12    `.xls`  → 실제 HTML 표
 */

import type {
  ContainerFormat,
  FormatCandidate,
  RecognitionResult,
} from "../types.js"
import { detectEncoding, decodeText } from "./encoding.js"
import { detectDelimiter } from "./delimiter.js"

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] // "PK\x03\x04"
const OLE2_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

/** 텍스트로 디코드해 살펴볼 선두 크기. 전체를 읽지 않는다 (헌장 B-9). */
const TEXT_PROBE_BYTES = 64 * 1024

function startsWith(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false
  return prefix.every((b, i) => bytes[i] === b)
}

/** 바이트 안에서 ASCII 문자열을 찾는다 (컨테이너 내부 표지 확인용). */
function containsAscii(bytes: Uint8Array, needle: string, limit = 4096): boolean {
  const hay = bytes.subarray(0, limit)
  const pat = [...needle].map((c) => c.charCodeAt(0))
  outer: for (let i = 0; i + pat.length <= hay.length; i++) {
    for (let j = 0; j < pat.length; j++) {
      if (hay[i + j] !== pat[j]) continue outer
    }
    return true
  }
  return false
}

/** OLE2 디렉터리 항목 이름은 UTF-16LE다. "Workbook"/"Book"이 있으면 Excel BIFF. */
function containsUtf16(bytes: Uint8Array, needle: string, limit = 16384): boolean {
  const hay = bytes.subarray(0, limit)
  const pat: number[] = []
  for (const c of needle) {
    pat.push(c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8)
  }
  outer: for (let i = 0; i + pat.length <= hay.length; i++) {
    for (let j = 0; j < pat.length; j++) {
      if (hay[i + j] !== pat[j]) continue outer
    }
    return true
  }
  return false
}

const HTML_MARKERS: readonly { re: RegExp; label: string; weight: number }[] = [
  { re: /<\s*table[\s>]/i, label: "<table>", weight: 0.45 },
  { re: /<\s*tr[\s>]/i, label: "<tr>", weight: 0.3 },
  { re: /<\s*meta[\s>]/i, label: "<meta>", weight: 0.15 },
  { re: /<\s*html[\s>]/i, label: "<html>", weight: 0.15 },
  { re: /<!DOCTYPE\s+html/i, label: "<!DOCTYPE html>", weight: 0.15 },
]

function extensionOf(fileName: string | null): string | null {
  if (!fileName) return null
  const dot = fileName.lastIndexOf(".")
  return dot < 0 ? null : fileName.slice(dot + 1).toLowerCase()
}

/** 확장자가 암시하는 포맷. 판정이 아니라 대조용이다. */
function formatFromExtension(ext: string | null): ContainerFormat | null {
  switch (ext) {
    case "xlsx":
    case "xlsm":
      return "xlsx"
    case "xls":
      return "biff"
    case "csv":
    case "tsv":
    case "txt":
      return "delimited"
    case "html":
    case "htm":
      return "html-table"
    default:
      return null
  }
}

export function sniff(bytes: Uint8Array, fileName: string | null = null): RecognitionResult {
  const ext = extensionOf(fileName)
  const candidates: FormatCandidate[] = []

  // ── 1순위: 바이너리 컨테이너 매직 바이트 ──────────────────────

  if (startsWith(bytes, ZIP_MAGIC)) {
    // zip이라고 전부 xlsx는 아니다. OOXML 표지가 있으면 확신한다.
    const ooxml = containsAscii(bytes, "[Content_Types].xml")
    candidates.push({
      format: "xlsx",
      confidence: ooxml ? 0.99 : 0.75,
      evidence: [
        "매직 바이트 50 4B 03 04 (PK) → zip 컨테이너",
        ooxml
          ? "[Content_Types].xml 발견 → OOXML 확정"
          : "OOXML 표지 미발견 — zip이지만 xlsx가 아닐 수 있다",
      ],
    })
  } else if (startsWith(bytes, OLE2_MAGIC)) {
    // OLE2는 .doc/.ppt도 쓴다. Workbook 스트림이 있어야 Excel이다.
    const workbook = containsUtf16(bytes, "Workbook") || containsUtf16(bytes, "Book")
    candidates.push({
      format: "biff",
      confidence: workbook ? 0.97 : 0.6,
      evidence: [
        "매직 바이트 D0 CF 11 E0 A1 B1 1A E1 → OLE2 복합 문서",
        workbook
          ? "Workbook 스트림 발견 → Excel BIFF 확정"
          : "Workbook 스트림 미발견 — OLE2지만 Excel이 아닐 수 있다",
      ],
    })
  } else {
    // ── 텍스트 계열: 인코딩을 먼저 풀어야 내용을 볼 수 있다 ──────
    const enc = detectEncoding(bytes)
    const probe = decodeText(bytes.subarray(0, TEXT_PROBE_BYTES), enc)

    let htmlScore = 0
    const htmlHits: string[] = []
    for (const marker of HTML_MARKERS) {
      if (marker.re.test(probe)) {
        htmlScore += marker.weight
        htmlHits.push(marker.label)
      }
    }

    if (htmlScore > 0) {
      candidates.push({
        format: "html-table",
        confidence: Math.min(0.98, htmlScore),
        evidence: [
          `HTML 마커 ${htmlHits.join(" ")} 발견`,
          ...enc.evidence,
          // #12가 여기 걸린다 — 확장자는 .xls인데 내용은 HTML 표다.
          ...(ext === "xls" || ext === "xlsx"
            ? [`확장자 .${ext}지만 내용은 HTML 표 — 엑셀 내보내기 위장`]
            : []),
        ],
        encoding: enc.encoding,
      })
    }

    const delim = detectDelimiter(probe)
    if (delim.confidence > 0) {
      candidates.push({
        format: "delimited",
        // HTML이 강하게 잡히면 구분자 신호는 태그 안의 문자일 뿐이다.
        confidence: htmlScore > 0.5 ? delim.confidence * 0.2 : delim.confidence,
        evidence: [...enc.evidence, ...delim.evidence],
        encoding: enc.encoding,
        delimiter: delim.delimiter,
      })
    }

    if (candidates.length === 0) {
      candidates.push({
        format: "delimited",
        confidence: 0.2,
        evidence: [...enc.evidence, "구분자·마크업 신호 없음 — 단일 컬럼 텍스트로 취급"],
        encoding: enc.encoding,
        delimiter: "\t",
      })
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence)

  const top = candidates[0]
  const expected = formatFromExtension(ext)
  // 확장자 힌트가 없으면 어긋남을 주장하지 않는다.
  const extensionMismatch = expected !== null && top !== undefined && expected !== top.format

  return {
    candidates,
    extensionHint: ext,
    extensionMismatch,
    identityNotes: buildIdentityNotes(ext, expected, top),
  }
}

const DELIMITER_NAMES: Readonly<Record<string, string>> = {
  "\t": "TAB",
  ",": "콤마",
  ";": "세미콜론",
  "|": "파이프",
}

function nameOfDelimiter(d: string): string {
  return DELIMITER_NAMES[d] ?? JSON.stringify(d)
}

/**
 * "이 파일은 이름과 다릅니다"를 사람 말로. 다를 게 없으면 빈 배열이다 —
 * 정상 파일에까지 경고를 붙이면 경고가 무의미해진다.
 */
function buildIdentityNotes(
  ext: string | null,
  expected: ContainerFormat | null,
  top: FormatCandidate | undefined,
): string[] {
  if (!top) return []
  const notes: string[] = []

  if (expected !== null && expected !== top.format) {
    const label: Record<ContainerFormat, string> = {
      xlsx: "엑셀 통합 문서(xlsx)",
      biff: "구형 엑셀 파일(BIFF xls)",
      "html-table": "HTML 표",
      delimited: "구분자 텍스트",
    }
    notes.push(`확장자는 .${ext}지만 실제 내용은 ${label[top.format]}입니다.`)
  }

  if (top.format === "delimited" && top.delimiter) {
    // .csv라는 이름은 콤마를 약속한다. TAB이면 그 약속이 깨진 것이고,
    // 사용자가 다른 도구로 열었을 때 한 컬럼으로 뭉개지는 이유가 된다.
    if (ext === "csv" && top.delimiter !== ",") {
      notes.push(
        `확장자는 .csv지만 구분자는 콤마가 아니라 ${nameOfDelimiter(top.delimiter)}입니다.`,
      )
    } else if (ext === "tsv" && top.delimiter !== "\t") {
      notes.push(
        `확장자는 .tsv지만 구분자는 TAB이 아니라 ${nameOfDelimiter(top.delimiter)}입니다.`,
      )
    }
  }

  // UTF-16은 대부분의 도구가 기본으로 가정하지 않는다 — 알려줄 값어치가 있다.
  if (top.encoding === "utf-16le" || top.encoding === "utf-16be") {
    notes.push(`인코딩이 ${top.encoding.toUpperCase()}입니다 (UTF-8이 아닙니다).`)
  }

  return notes
}
