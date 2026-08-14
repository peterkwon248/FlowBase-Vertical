/**
 * 가져오기 위저드 배선 — **파일이 앱으로 들어오는 유일한 문.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 화면이 서기 전까지 앱은 CLI가 만든 DB만 읽었다 ★
 * 파이프라인은 완성돼 있었고 e2e·스모크로 증명됐지만, 사용자가 파일을 고르는
 * 경로가 없었다. 제품 약속인 *"정산서 던지면 손익 나온다"*에서 **'던지면'**이
 * 없던 것이다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 두 단계로 갈린다 — 보여주기와 넣기 ★
 *
 * ```
 * analyzeImport   DB를 건드리지 않는다. 무엇이 들어갈지 보여준다
 *      ↓ 사람이 확정
 * runImport       넣는다. 되돌릴 수 있지만 되돌리는 것과 안 넣는 것은 다르다
 *      ↓
 * batchDigest     무엇이 들어갔고 **무엇이 빠졌는지** (LOCK 6)
 * ```
 *
 * 계산도 조회도 여기 없다. 이 파일은 **모양만 만든다**.
 */

import type { ImportAnalysis } from "@core/import/analyze.js"
import type { BatchDigest } from "@core/store/repository.js"
import type { TemplateVals } from "./generated/vals.js"
import { won } from "./format.js"

const DIM = "var(--fg-4)"
const G = "var(--pnl-pos)"
const WARN = "var(--pnl-warn)"
const NEG = "var(--pnl-neg)"

/**
 * ★ 이 크기를 넘으면 «잠시 멈출 수 있다»고 미리 말한다 ★
 *
 * 위저드 v1은 파이프라인을 **메인 스레드**에서 돌린다 (ADR-001 조건 2 위반 —
 * 인지된 부채이고 작업-상태에 적혀 있다). 쿠팡 광고 8만 행(약 10MB)이면 스모크
 * 실측으로 9.5~10.4초 동안 화면이 멈춘다.
 *
 * **고지 없는 10초 프리즈는 강제 종료를 부른다.** 사용자의 자연스러운 반응이
 * "죽었나?"이기 때문이다. 같은 10초라도 미리 말하면 "크니까 그렇구나"가 된다.
 * 고칠 수 없는 것을 숨기지 않는 것이 지금 할 수 있는 정직이다 (LOCK 6 계열).
 *
 * 기준은 바이트다 — 행 수는 파일을 열어봐야 아는데, 이 경고는 **열기 전에**
 * 해야 하기 때문이다. 4MB는 실측 픽스처 중 #13(쿠팡 광고)만 넘는 값이다.
 */
export const BIG_FILE_BYTES = 4 * 1024 * 1024

export interface ImportWizardState {
  /** 고른 파일의 분석 결과. `null`이면 아직 아무것도 안 골랐다. */
  readonly analysis: ImportAnalysis | null
  /** 사람이 고른 프로파일 (분석의 `profiles` 인덱스). */
  readonly profileIndex: number
  /** 적재가 끝난 batch의 요약. */
  readonly digest: BatchDigest | null
  /** 실행 중. 화면이 멈춰 보이는 동안 사용자에게 말할 것이 필요하다. */
  readonly busy: boolean
  /** 실패 사유. 숨기지 않는다 (LOCK 6). */
  readonly error: string | null
  /** 고른 파일이 큰가 — 열기 전에 판정한다. */
  readonly bigFile: boolean
}

export const EMPTY_WIZARD: ImportWizardState = {
  analysis: null,
  profileIndex: 0,
  digest: null,
  busy: false,
  error: null,
  bigFile: false,
}

export interface ImportActions {
  pickFile: (file: File) => void
  pickProfile: (index: number) => void
  pickSheet: (index: number) => void
  confirm: () => void
  reset: () => void
}

export const NOOP_IMPORT_ACTIONS: ImportActions = {
  pickFile: () => {},
  pickProfile: () => {},
  pickSheet: () => {},
  confirm: () => {},
  reset: () => {},
}

const mb = (n: number): string =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`

/** 컨테이너 포맷 → 사람이 읽는 말. 마켓 지식이 아니라 파일 형식이다. */
const FORMAT_LABEL: Record<string, string> = {
  xlsx: "Excel (xlsx)",
  biff: "Excel 97-2003 (xls)",
  "html-table": "HTML 표",
  delimited: "구분자 텍스트",
}

/**
 * 5단 스테퍼. **목업이 5개다** — 파이프라인 6단계와 헷갈리기 쉽다
 * (그리고 파이프라인의 Validation은 아직 미구현이다).
 */
function steps(state: ImportWizardState) {
  const at = state.digest ? 4 : state.busy ? 3 : state.analysis ? 2 : 0
  const LABELS = [
    ["파일", "고르기"],
    ["판정", "형식과 프로파일"],
    ["확인", "무엇이 들어가나"],
    ["적재", "batch로 쌓기"],
    ["결과", "들어간 것과 빠진 것"],
  ]
  return LABELS.map(([label, sub], i) => {
    const done = i < at
    const now = i === at
    return {
      n: String(i + 1),
      label,
      sub,
      bg: now ? "var(--bg-subtle)" : "transparent",
      dot: done ? G : now ? "var(--accent)" : "var(--bg-elevated-2)",
      dotBorder: done || now ? "transparent" : "var(--border)",
      numColor: done || now ? "var(--bg-app)" : DIM,
      fg: now ? "var(--fg)" : done ? "var(--fg-2)" : DIM,
    }
  })
}

export function importVals(
  vals: TemplateVals,
  state: ImportWizardState,
  act: ImportActions = NOOP_IMPORT_ACTIONS,
): void {
  const a = state.analysis
  vals.impSteps = steps(state)

  // 출처는 **파일 하나뿐**이다. 목업은 파일·URL·직접 입력 셋을 그렸지만 우리가
  // 가진 것은 파일이다 — 없는 탭을 그려놓고 누르면 아무 일도 안 나는 것보다
  // 하나만 두는 편이 정직하다 (LOCK 10 계열: 실존하는 것만 말한다).
  vals.srcTabs = [{ label: "파일", on: "active", pick: () => {} }]
  vals.srcUrl = false
  vals.srcManual = false
  vals.urlImported = false
  vals.impChannelName = ""
  vals.srcWizard = a !== null

  vals.impBig = state.bigFile && state.digest === null
  vals.impBusy = state.busy
  vals.impError = state.error ?? ""
  vals.impHasError = state.error !== null

  if (!a) {
    vals.srcName = ""
    vals.srcMeta = ""
    vals.srcSwap = ""
    vals.profileTabs = []
    vals.profileMeta = ""
    vals.importCounts = []
    vals.colRows = []
    vals.errRows = []
    vals.impExcludedLabel = ""
    vals.impDupNote = ""
    vals.impSheets = []
    vals.impManySheets = false
    vals.impCanRun = false
    vals.impRunLabel = "확인하고 가져오기"
    vals.impDone = false
    vals.impDigest = []
    vals.impDigestTitle = ""
    vals.impPick = act.pickFile
    vals.impReset = act.reset
    return
  }

  const sheet = a.sheets[a.sheetIndex]
  const match = a.profiles[state.profileIndex]

  vals.srcName = a.fileName
  vals.srcMeta = [
    FORMAT_LABEL[a.format] ?? a.format,
    mb(a.byteLength),
    sheet ? `${won(sheet.physicalRowCount)}행 · ${won(sheet.columnCount)}열` : "",
    ...a.identityNotes,
  ]
    .filter((s) => s !== "")
    .join(" · ")
  vals.srcSwap = "다른 파일"
  vals.impPick = act.pickFile
  vals.impReset = act.reset

  // ── 판정: 프로파일 후보 ──────────────────────────────────────────
  // **복수로 준다** (헌장 B-9). 하나를 박아 넣던 시절에는 이 질문 자체가 없었다.
  vals.profileTabs = a.profiles.map((p, i) => ({
    label: `${p.profile.displayName} · ${p.profile.label}`,
    on: i === state.profileIndex ? "active" : "",
    pick: () => act.pickProfile(i),
  }))
  vals.profileMeta = match
    ? `일치도 ${Math.round(match.confidence * 100)}% · ${match.evidence.join(" · ")}`
    : "맞는 매핑 프로파일이 없습니다 — 이 파일은 넣을 수 없습니다"

  // ── §18 시트 선택 ────────────────────────────────────────────────
  // 시트가 여럿이면 사람이 고른다. 역할·사유·수식비율을 함께 보인다 —
  // 96%가 수식인 시트는 다른 시트에서 계산된 결과이고, 사실로 적재하면
  // 숫자가 두 번 더해진다.
  vals.impManySheets = a.sheets.length > 1
  vals.impSheets = a.sheets.map((s, i) => ({
    label: s.name,
    on: i === a.sheetIndex ? "active" : "",
    note: [
      s.reason,
      `${won(s.physicalRowCount)}행`,
      s.formulaRatio === null ? "" : `수식 ${Math.round(s.formulaRatio * 100)}%`,
    ]
      .filter((t) => t !== "")
      .join(" · "),
    // 수식 비율이 높으면 눈에 띄게 — 판단 재료지 결정이 아니다 (§18-A)
    color: s.formulaRatio !== null && s.formulaRatio > 0.5 ? WARN : DIM,
    pick: () => act.pickSheet(i),
  }))

  // ── 확인: 무엇이 들어가나 ────────────────────────────────────────
  const mapped = match ? match.profile.fieldMappings.filter((m) => m.source !== undefined) : []
  const present = new Set(a.header.columns.map((h) => h.trim()))
  const hit = mapped.filter((m) => present.has((m.source ?? "").trim()))

  // 표본 값은 첫 데이터 행에서 뽑는다 — 「이 컬럼이 뭔지」는 이름보다 값이 말한다.
  const first = a.sample[0]
  vals.colRows = a.header.columns.map((h, col) => {
    const m = mapped.find((x) => (x.source ?? "").trim() === h.trim())
    const raw = first?.[col]
    return {
      header: h,
      sample: raw === null || raw === undefined ? "—" : String(raw).slice(0, 24),
      // 매핑되지 않은 컬럼은 **저장되지 않는다.** 조용히 빠뜨리지 않는다 (헌장 A-5)
      field: m ? m.target : "저장 안 함",
      fieldColor: m ? "var(--fg-2)" : DIM,
      why: m
        ? m.required
          ? "프로파일이 선언 · 필수"
          : "프로파일이 선언"
        : "이 프로파일이 쓰지 않는 컬럼",
      // ★ 추정이 아니라 선언이다 ★ 컬럼 매핑은 프로파일 JSON이 정해둔 것이라
      // 확신도라는 개념이 없다. %를 지어내면 «추론했다»는 거짓이 된다.
      conf: m ? "선언" : "—",
      color: m ? G : DIM,
    }
  })

  vals.importCounts = state.digest
    ? [
        { label: "적재", value: won(state.digest.rowCount), color: G },
        { label: "제외", value: won(state.digest.excludedCount), color: state.digest.excludedCount > 0 ? WARN : DIM },
        { label: "시트", value: state.digest.sheetName ?? "—", color: "var(--fg-2)" },
        { label: "상태", value: state.digest.status === "committed" ? "완료" : state.digest.status, color: "var(--fg-2)" },
      ]
    : [
        { label: "시트 행", value: sheet ? won(sheet.physicalRowCount) : "—", color: "var(--fg)" },
        { label: "컬럼", value: won(a.header.columns.length), color: "var(--fg)" },
        { label: "매핑되는 컬럼", value: `${won(hit.length)}/${won(mapped.length)}`, color: hit.length === mapped.length ? G : WARN },
        { label: "미리보기 제외", value: won(a.sampleExcluded.length), color: a.sampleExcluded.length > 0 ? WARN : DIM },
      ]

  // ★ 목업은 «오류 3건»과 «중복 7건»을 **숫자째 박아** 뒀다 ★
  // 시드의 숫자를 사실인 척한 것이라 결함 47과 같은 계열이다. 데이터에서 뽑는다.
  vals.errRows = a.sampleExcluded.map((e) => ({
    // 사람이 엑셀에서 찾을 수 있게 **1-기준**으로 보인다. 내부는 0-기준이다
    row: `${won(e.rowIndex + 1)}행`,
    code: e.reason,
    msg: e.detail,
  }))
  vals.impExcludedLabel =
    a.sampleExcluded.length === 0
      ? "미리보기 범위에서 제외된 행이 없습니다"
      : `미리보기 범위에서 ${won(a.sampleExcluded.length)}건 제외 — 전체 수는 가져온 뒤에 나옵니다`
  // UPSERT 건수는 넣어봐야 안다. 모르는 것을 숫자로 말하지 않는다.
  vals.impDupNote = "같은 source_key가 이미 있으면 덮어쓰지 않고 갱신됩니다 (UPSERT)."

  vals.impCanRun = match !== undefined && !state.busy && state.digest === null
  vals.impRunLabel = state.busy ? "가져오는 중…" : "확인하고 가져오기"
  vals.impRun = act.confirm

  // ── 결과: 다이제스트 ─────────────────────────────────────────────
  // ★ `batch_exclusion`을 **사유별로** 읽는 첫 화면이다 ★
  // 지금까지 이 테이블은 넣기만 하고 아무도 읽지 않았다. 「128행 적재」만 말하고
  // 제외 2건을 두고 오면 그게 곧 조용한 실패다 (LOCK 6).
  const d = state.digest
  vals.impDone = d !== null
  vals.impDigestTitle = d
    ? `${d.sourceName} — ${won(d.rowCount)}행 적재${d.excludedCount > 0 ? ` · ${won(d.excludedCount)}행 제외` : ""}`
    : ""
  vals.impDigest = d
    ? d.exclusionsByReason.map((x) => ({
        label: EXCLUSION_LABEL[x.reason] ?? x.reason,
        value: `${won(x.count)}건`,
        color: x.reason === "error" ? NEG : WARN,
      }))
    : []
}

/** 제외 사유 → 사람이 읽는 말. 코드값을 그대로 보이면 사용자가 알 수 없다. */
const EXCLUSION_LABEL: Record<string, string> = {
  total: "합계 행",
  subtitle: "제목·설명 행",
  blank: "빈 행",
  "trailing-blank": "끝의 빈 행",
  error: "읽지 못한 행 — 필수 값이 비었거나 사전에 없는 값",
}
