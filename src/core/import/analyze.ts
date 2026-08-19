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
import { describeColumns, type ColumnSighting } from "./columns.js"
import { buildAliasIndex, judgeColumns, type JudgeResult } from "./judge.js"
import { sha1Bytes } from "./mapping/sha1.js"

/** 지문은 사람이 보고 대조할 수 있어야 한다 — 16진 문자열로 남긴다. */
const hex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
import type {
  ContainerFormat,
  ExcludedRow,
  FormatCandidate,
  HeaderDetection,
  RawRow,
  SheetInfo,
} from "./types.js"

/**
 * 시트 하나를 프로파일 전부에 물어본 결과.
 *
 * **후보가 0개인 시트도 남긴다.** 「19시트를 다 봤고 그중 둘이 맞았다」와
 * 「둘만 봤다」는 완전히 다른 말인데, 맞은 것만 남기면 그 둘을 구별할 수 없다.
 */
export interface SheetMatch {
  readonly sheetIndex: number
  readonly sheetName: string
  /** confidence 내림차순. **막힌 후보(`blockedBy`)도 후보다** — 양식은 알아본 것이다. */
  readonly profiles: readonly ProfileMatch[]
  readonly header: HeaderDetection
  /** 이 시트가 가진 열 서술 (마이그레이션 009). 맞는 양식이 없어도 채워진다. */
  readonly columns: readonly ColumnSighting[]
}

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
  /**
   * 이 시트가 가진 열을 **있는 그대로** 서술한 것 (마이그레이션 009).
   *
   * ★ `profiles`가 비어 있어도 이건 채워진다 — 그게 요점이다 ★
   * 「맞는 양식이 없다」로 끝나던 파일도 열 이름·표본·추정 종류는 알고 있었다.
   * 지금까지 그걸 아무데도 남기지 않아서 같은 파일을 매달 처음 보는 것처럼 굴었다.
   *
   * 여기서는 **만들기만 한다.** 저장은 부르는 쪽이다 — 이 함수는 DB를 건드리지
   * 않는다는 계약이 위저드의 «시트 바꿔 다시 보기»를 싸게 만든다.
   */
  readonly columns: readonly ColumnSighting[]
  /**
   * 열 판정 4단 (계획 A · ADR-017) — 별칭 색인은 **프로파일에서 라이브로 유도**한다.
   *
   * ★ v1은 화면 주석일 뿐 적재를 바꾸지 않는다 ★ 적재는 프로파일이 정한다.
   * 후보(candidate)는 자동으로 쓰이지 않는다 — 확정 UI가 B 세션이다.
   */
  readonly judge: JudgeResult
  /**
   * ★ **모든 시트**를 프로파일에 물어본 결과 ★
   *
   * ─────────────────────────────────────────────────────────────
   * 이게 없던 시절, 앱은 시트 하나(기본 0번)만 보고 «맞는 매핑 프로파일이
   * 없습니다 — 이 **파일**은 넣을 수 없습니다»라고 말했다. **그 문장은 거짓이다.**
   * 앱이 아는 것은 「이 **시트**에서 못 찾았다」뿐이었다.
   *
   * 실측 (사용자 실파일 2장):
   * ```
   * ESM_11st_B2B 계산기 (19시트)   시트 0 → 후보 0개
   *   시트  5 매출정리 raw  → esm/order          100%
   *   시트 11 11_매출정리   → 11st/settlement    100%
   * 머레이 매출정리 (12시트)        시트 0 → 후보 0개
   *   시트  3 E매출r       → esm/order          100%
   *   시트  7 11매출r      → 11st/settlement    100%
   * ```
   * 확신도가 100%다. 애매해서 못 고른 게 아니라 **안 본 것**이다.
   * ─────────────────────────────────────────────────────────────
   *
   * 이 값이 있어야 「어느 시트에서도 못 찾았다」는 말을 **근거를 갖고** 할 수 있다.
   */
  readonly sheetMatches: readonly SheetMatch[]
  /**
   * 고른 시트에 후보가 없을 때 **대신 권할 시트**. 없으면 null.
   *
   * 「없다」로 끝내지 않고 「저기 있다」로 잇는 자리다. 고른 시트가 이미 맞으면
   * null이다 — 잘 고른 사람에게 다른 데를 가리키지 않는다.
   */
  readonly suggestedSheetIndex: number | null
  /** 파서가 남긴 말. 오늘까지 아무 호출부도 이걸 보지 않았다. */
  readonly warnings: readonly string[]
  /**
   * 파일 바이트의 지문 (SHA-1 hex).
   *
   * **같은 바이트·다른 이름**을 잡는다. 파일명이 키에 들어가는 양식(기간 집계)은
   * 이름만 바꿔 다시 넣으면 `source_key`가 갈라져 **같은 매출이 두 번 쌓인다.**
   * 다이제스트의 «신규 147»은 사후 단서일 뿐 방어가 아니므로, 넣기 전에 말한다.
   *
   * 실측: 10.1MB에 158~168ms. 판정 단계에 붙여도 되는 비용이다.
   */
  readonly contentHash: string
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
/**
 * 훑어볼 시트 수의 상한.
 *
 * 시트마다 첫 청크를 흘리므로 비용이 시트 수에 비례한다. 실제 워크북은 열몇 장
 * 수준이지만(실측: 19 · 12), 수백 장짜리를 만난 날 판정 단계가 통째로 멈추는 것은
 * 막아야 한다. 넘으면 **조용히 자르지 않고 말한다** (LOCK 6).
 */
export const MAX_SCAN_SHEETS = 50

/** 시트 하나를 첫 청크만 읽어 헤더·표본을 얻는다. 전 시트 훑기와 본 판정이 같은 눈을 쓴다. */
async function peekSheet(
  src: Awaited<ReturnType<ReturnType<typeof parserFor>["open"]>>,
  index: number,
  sampleRows: number,
): Promise<{
  header: HeaderDetection
  sample: RawRow[]
  excluded: readonly ExcludedRow[]
  /**
   * 표본 범위 **모든 칸**의 텍스트. 헤더 행이 없는 양식(카드 레이아웃)은 이걸로만
   * 알아볼 수 있다 — 라벨이 값 옆에 적혀 있지 헤더 행에 있지 않다.
   */
  cellTexts: readonly string[]
}> {
  const { chunks, getSummary } = streamSheet(src, index, { chunkSize: sampleRows })

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
  const cellTexts = new Set<string>()
  for (const row of sample) {
    for (const c of row) {
      if (c === null || c === undefined) continue
      const t = String(c).trim()
      // 라벨은 짧다. 긴 문장까지 모으면 집합이 수천 개가 되고 판정이 무뎌진다.
      if (t !== "" && t.length <= 24) cellTexts.add(t)
    }
  }
  return { header: sum.header, sample, excluded: sum.excluded, cellTexts: [...cellTexts] }
}

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

    /**
     * ★ **모든 시트**에 「너는 무엇이냐」를 묻는다 (2026-08-18) ★
     *
     * 예전에는 고른 시트 하나만 물었고, 답이 없으면 «이 파일은 넣을 수 없습니다»로
     * 끝났다. 사용자의 실파일 두 장이 바로 그렇게 막혀 있었는데 — 정작 그 안의
     * 시트 5·11(그리고 3·7)은 **확신도 100%로 맞는다.** 애매해서 못 고른 게 아니라
     * 안 본 것이다.
     *
     * ★ 비용을 재고 넣었다 — 훑기는 사실상 공짜다 (실측) ★
     * ```
     * 19시트 2.2MB   열기 3317ms · 시트0 5ms · 나머지 18장 전부  55ms
     * 12시트         열기  437ms · 시트0 1ms · 나머지 11장 전부  16ms
     * 19시트 (픽스처) 열기 2281ms · 시트0 1ms · 나머지 18장 전부  48ms
     * ```
     * 시간의 98%는 `open()`이 워크북을 통째로 읽는 데 쓰이고 **그건 이 변경 전에도
     * 있던 비용**이다. 첫 청크(20행)만 흘리므로 시트당 3ms 남짓이다. 이걸 아끼려고
     * «필요할 때만 훑기»로 미루면, 아끼는 것은 1.5%이고 잃는 것은 **파일이 통째로
     * 증발하는 것**이다. 단일 시트 파일(마켓 원본 대부분)은 애초에 추가 비용이 0이다.
     */
    const scanCount = Math.min(src.sheets.length, MAX_SCAN_SHEETS)
    const sheetMatches: SheetMatch[] = []
    const scanWarnings: string[] = []
    if (src.sheets.length > MAX_SCAN_SHEETS) {
      // 조용히 자르지 않는다 — 못 본 시트가 있다는 사실을 말한다 (LOCK 6).
      scanWarnings.push(
        `시트가 ${src.sheets.length}장이라 앞 ${MAX_SCAN_SHEETS}장만 훑었습니다 — ` +
          `나머지는 시트를 직접 골라 확인해야 합니다`,
      )
    }

    let picked: Awaited<ReturnType<typeof peekSheet>> | null =
      null

    for (let i = 0; i < scanCount; i++) {
      let peek
      try {
        peek = await peekSheet(src, i, sampleRows)
      } catch (e) {
        // 한 시트가 읽히지 않아도 나머지 판정을 포기하지 않는다. 다만 말한다.
        scanWarnings.push(`시트 ${i} 「${src.sheets[i]?.name ?? ""}」를 읽지 못했습니다: ${
          e instanceof Error ? e.message : String(e)
        }`)
        continue
      }
      if (i === sheetIndex) picked = peek

      // 후보 **전부**를 상대로 판정한다. 하나를 박아 넣던 시절에는 이 질문 자체가
      // 없었다 — 「이 파일이 무엇인가」를 묻는 것이 여기서 처음 일어난다.
      sheetMatches.push({
        sheetIndex: i,
        sheetName: src.sheets[i]?.name ?? "",
        profiles: matchProfiles(profiles, {
          containerFormat: top.format,
          headers: [...peek.header.columns],
          fileName,
          cellTexts: peek.cellTexts,
        }),
        header: peek.header,
        columns: describeColumns(peek.header.columns, peek.sample),
      })
    }

    // 고른 시트가 상한 밖이면 훑기에 안 들어갔다 — 그 시트만 따로 읽는다.
    // 사람이 명시적으로 고른 것을 「상한 때문에」 못 보여줄 수는 없다.
    const sum = picked ?? (await peekSheet(src, sheetIndex, sampleRows))
    const sample = sum.sample

    const mine = sheetMatches.find((m) => m.sheetIndex === sheetIndex)
    const matched = mine
      ? mine.profiles
      : matchProfiles(profiles, {
          containerFormat: top.format,
          headers: [...sum.header.columns],
          fileName,
          cellTexts: sum.cellTexts,
        })

    /**
     * 고른 시트가 비었을 때만 **다른 시트를 권한다.**
     *
     * 「넣을 수 없다」를 「저기 있다」로 바꾸는 자리다. 막힌 후보(`blockedBy`)는
     * 권하지 않는다 — 그 시트로 옮겨도 못 넣는 것은 같고, 사용자가 할 일은
     * 파일명을 되돌리는 것이라 완전히 다른 안내가 필요하다.
     */
    const suggestedSheetIndex =
      matched.length > 0
        ? null
        : (sheetMatches.find((m) => m.profiles.some((p) => p.blockedBy === undefined))
            ?.sheetIndex ?? null)

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
      columns: mine?.columns ?? describeColumns(sum.header.columns, sample),
      judge: judgeColumns(
        mine?.columns ?? describeColumns(sum.header.columns, sample),
        buildAliasIndex(profiles),
      ),
      sheetMatches,
      suggestedSheetIndex,
      warnings: [...src.warnings, ...scanWarnings],
      contentHash: hex(sha1Bytes(bytes)),
    }
  } finally {
    src.close()
  }
}
