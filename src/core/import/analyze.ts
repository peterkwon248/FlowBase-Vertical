/**
 * 가져오기 **판정 단계** — 넣기 전에 사람에게 보여줄 것을 전부 모은다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 함수의 존재 이유는 «되돌릴 수 없는 일 앞에서 멈추는 것»이다 ★
 *
 * `runImport`는 파일을 DB에 넣는다. 되돌릴 수는 있지만(batch 되돌리기) 되돌리는
 * 것과 애초에 안 넣는 것은 다르다. 그래서 **넣기 전에** 무엇이 들어갈지 보여주고
 * 사람이 확정한다 — 헌장 C-5의 «판정 후보 복수 + 일치도 + 사람 확정» 그대로다.
 *
 * 여기서 나오는 값은 전부 **화면에 보일 것**이고, 하나같이 지금까지 만들어지기만
 * 하고 아무도 보지 않던 것들이다:
 *
 * ```
 * rec.candidates       포맷 판정 후보 + confidence + 근거   ← 아무도 안 봤다
 * rec.identityNotes    확장자와 내용의 어긋남                ← 아무도 안 봤다
 * src.warnings         SheetJS 경고 · fast path 거절 사유    ← 아무도 안 봤다
 * SheetInfo.role/reason/formulaRatio   시트 판정 근거        ← §18-A/B/C가 요구
 * HeaderDetection.evidence             헤더를 왜 그 줄로 봤나
 * ExcludedRow                          왜 뺐나              ← LOCK 6
 * ```
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 미리보기는 첫 청크까지만 본다 ★
 * 제외 목록과 행 수는 **끝까지 흘려야** 완성되므로, 여기서 나오는 것은
 * «미리보기 범위에서 본 것»이다. 그 사실을 이름(`sampleExcluded`)에 담았다 —
 * 전체 수인 척하면 사용자가 "제외 2건이구나" 하고 넘어간다.
 *
 * ★ 실행환경 중립 (ADR-011) ★ `node:`를 import하지 않는다. 바이트는 받는다.
 */

import { sniff } from "./recognition/sniff.js"
import { parserFor } from "./parsers/index.js"
import { streamSheet } from "./pipeline.js"
import { matchProfiles, type MappingProfile, type ProfileMatch } from "./mapping/index.js"
import type {
  ContainerFormat,
  ExcludedRow,
  FormatCandidate,
  HeaderDetection,
  RawRow,
  SheetInfo,
} from "./types.js"

export interface ImportAnalysis {
  readonly fileName: string
  readonly byteLength: number
  /** 1순위 후보의 포맷. 매직 바이트가 정한다 — 확장자는 힌트일 뿐이다. */
  readonly format: ContainerFormat
  /** **복수로 준다** (헌장 B-9). 화면이 «왜 이렇게 봤는지»를 보일 수 있어야 한다. */
  readonly formatCandidates: readonly FormatCandidate[]
  /** 확장자와 내용이 어긋남 — 픽스처 #12(.xls인데 HTML 표)가 여기 걸린다. */
  readonly identityNotes: readonly string[]
  /** 이 파일의 시트 전부. §18-A/B/C가 요구하는 역할·사유·수식비율이 들어 있다. */
  readonly sheets: readonly SheetInfo[]
  /** 사람이 고른(또는 기본으로 고른) 시트. */
  readonly sheetIndex: number
  /** 프로파일 후보 — confidence 내림차순. **비어 있으면 넣을 수 없다.** */
  readonly profiles: readonly ProfileMatch[]
  readonly header: HeaderDetection
  /** 미리보기 행. 헤더 아래 실데이터다. */
  readonly sample: readonly RawRow[]
  /** ⚠ **미리보기 범위에서** 제외된 행. 전체 수가 아니다. */
  readonly sampleExcluded: readonly ExcludedRow[]
  /** 파서가 남긴 말. 오늘까지 아무 호출부도 이걸 보지 않았다. */
  readonly warnings: readonly string[]
}

export interface AnalyzeOptions {
  /** 사람이 시트를 고른 뒤 다시 부를 때 쓴다. 기본은 0. */
  readonly sheetIndex?: number
  readonly sampleRows?: number
}

/**
 * 파일 하나를 **읽어보기만** 한다. DB를 건드리지 않는다.
 *
 * 시트를 바꿔 다시 보고 싶으면 `sheetIndex`를 주고 다시 부른다 — 상태를 들고
 * 있지 않으므로 몇 번을 불러도 같은 답이 나온다.
 */
export async function analyzeImport(
  bytes: Uint8Array,
  fileName: string,
  profiles: readonly MappingProfile[],
  opts: AnalyzeOptions = {},
): Promise<ImportAnalysis> {
  const sampleRows = opts.sampleRows ?? 20

  const rec = sniff(bytes, fileName)
  const top = rec.candidates[0]
  if (!top) throw new Error("컨테이너 포맷을 판정하지 못했다")

  const src = await parserFor(top.format).open(bytes, {
    chunkSize: sampleRows,
    ...(top.encoding === undefined ? {} : { encoding: top.encoding }),
    ...(top.delimiter === undefined ? {} : { delimiter: top.delimiter }),
  })

  try {
    const sheetIndex = opts.sheetIndex ?? 0
    if (!src.sheets[sheetIndex]) throw new Error(`시트 ${sheetIndex}는 없다`)

    const { chunks, getSummary } = streamSheet(src, sheetIndex, { chunkSize: sampleRows })

    // ★ 첫 청크만 본다 ★ 판정에 필요한 것(헤더·표본)은 앞에서 다 나오고,
    // 8만 행짜리를 끝까지 흘려서 사용자를 기다리게 할 이유가 없다.
    const sample: RawRow[] = []
    for await (const chunk of chunks) {
      for (let i = 0; i < chunk.rowCount; i++) {
        const base = i * chunk.width
        sample.push(chunk.raws.slice(base, base + chunk.width))
      }
      break
    }

    const sum = getSummary()
    const headers = [...sum.header.columns]

    // 후보 **전부**를 상대로 판정한다. 하나를 박아 넣던 시절에는 이 질문 자체가
    // 없었다 — 「이 파일이 무엇인가」를 묻는 것이 여기서 처음 일어난다.
    const matched = matchProfiles(profiles, {
      containerFormat: top.format,
      headers,
      fileName,
    })

    return {
      fileName,
      byteLength: bytes.length,
      format: top.format,
      formatCandidates: rec.candidates,
      identityNotes: rec.identityNotes,
      sheets: src.sheets,
      sheetIndex,
      profiles: matched,
      header: sum.header,
      sample,
      sampleExcluded: sum.excluded,
      warnings: [...src.warnings],
    }
  } finally {
    src.close()
  }
}
