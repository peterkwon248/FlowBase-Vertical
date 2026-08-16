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
import { columnRoles, type ColumnRole } from "@core/import/mapping/index.js"
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
  /**
   * **같은 바이트가 이미 들어온 적이 있나** — 파일명이 달라도 잡힌다.
   *
   * ★ 왜 이름이 아니라 지문인가 ★
   * 파일명이 키에 들어가는 양식(기간 집계)은 이름만 바꿔 다시 넣으면 `source_key`가
   * 갈라져 **같은 매출이 두 번 쌓인다.** 다이제스트의 «신규 147»은 넣고 나서야
   * 보이는 사후 단서라 방어가 못 된다.
   *
   * **막지 않는다.** 되돌린 뒤 재적재처럼 정당한 재가져오기가 있으므로 고지만 한다
   * (§22 «안내지 검문이 아니다»).
   */
  readonly priorSame: readonly {
    readonly sourceName: string
    readonly at: string
    readonly undone: boolean
  }[]
}

export const EMPTY_WIZARD: ImportWizardState = {
  analysis: null,
  profileIndex: 0,
  digest: null,
  busy: false,
  error: null,
  bigFile: false,
  priorSame: [],
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

/**
 * Canonical 필드가 없는 컬럼의 «저장되는 자리» 칸 — **하는 일**을 이름 대신 쓴다.
 *
 * 이 컬럼들은 Canonical 필드로 저장되지는 않지만 **읽히고 쓰인다.** 둘을 같은
 * «저장 안 함»으로 뭉뚱그린 것이 결함 53이었다.
 */
export function roleField(roles: readonly ColumnRole[]): string {
  if (roles.includes("source-key")) return "행 식별 키"
  if (roles.includes("listing-title")) return "리스팅 제목"
  if (roles.includes("listing-key")) return "리스팅 키"
  if (roles.includes("routing")) return "행 분류"
  return "저장 안 함"
}

/** 품목 필드는 «어느 표에 저장되는지»까지 말한다 — 주문 표에서는 안 보이기 때문이다. */
const itemLabel = (target: string | undefined): string =>
  target === undefined ? "품목" : `품목 · ${target}`

/** «왜» 칸 — 역할을 전부 말한다. 한 컬럼이 3역인 경우가 실재한다(ESM `진행상태`). */
export function roleWhy(roles: readonly ColumnRole[], required: boolean): string {
  const parts: string[] = []
  if (roles.includes("field")) parts.push(required ? "프로파일이 선언 · 필수" : "프로파일이 선언")
  // 품목은 «저장된다»인데 주문 표에는 안 보인다. 그 사실을 말하지 않으면 사용자가
  // 확인 화면과 주문 화면을 대조하다 «사라졌다»고 읽는다 (결함 53의 계보).
  if (roles.includes("item-field")) parts.push("품목으로 저장된다 — 수량·금액이 여기 산다")
  // `source_key`는 내부 키라 화면에 값을 내보내지 않지만(헌장 C-4), **이 컬럼이
  // 행 식별에 쓰인다는 사실**은 말해야 한다 — 빼면 사용자가 없어도 되는 열로 읽는다.
  if (roles.includes("source-key")) parts.push("행 식별에 쓰인다")
  if (roles.includes("listing-key")) parts.push("리스팅을 식별한다")
  if (roles.includes("listing-title")) parts.push("상품 연결에 뜨는 제목")
  if (roles.includes("routing")) parts.push("행이 갈 표를 정한다")
  return parts.join(" · ")
}

export function importVals(
  vals: TemplateVals,
  state: ImportWizardState,
  act: ImportActions = NOOP_IMPORT_ACTIONS,
  /**
   * 이 파일이 연 지표 이름들 (§22-4). 커버리지는 **적재 뒤 다시 조회한** 값에서
   * 나오므로 여기서 계산하지 않고 받아만 온다 — 다이제스트를 다시 읽는 것과
   * 같은 규율이다(화면이 말하는 것은 DB가 아는 것이어야 한다).
   */
  opened: readonly string[] = [],
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
  // ★ 캡처 실패는 «프로파일이 없다»와 전혀 다른 말이다 ★
  // 양식은 알아봤고 **파일명이 모자란 것**이라, 사용자가 할 일은 다른 파일을 찾는
  // 것이 아니라 원래 이름을 되돌리는 것이다. 조용한 폴백은 하지 않는다 —
  // 키가 갈라져 재가져오기가 중복을 쌓는다 (ADR-006 증축).
  const blocked = match?.blockedBy
  vals.profileMeta = blocked
    ? `파일명에서 이 양식이 필요로 하는 값을 읽지 못했습니다 — 마켓에서 받은 원래 파일명이 필요합니다` +
      (match.profile.recognitionRules.fileNameExample === undefined
        ? ""
        : ` (예: ${match.profile.recognitionRules.fileNameExample})`)
    : match
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
  //
  // ★ 결함 53 ★ 여기는 `fieldMappings`만 읽었다. 그래서 `주문번호`·`상품번호`·
  // `상품명`·`주문순번`이 «이 프로파일이 쓰지 않는 컬럼»으로 표시됐다 — 각각
  // **행 식별 키의 절반**, **리스팅의 키**, **상품 연결 화면에 뜨는 제목**인데도.
  //
  // 사용자가 리허설에서 화면을 보고 물어서 드러났다: *"진행상태·구매금액·결제일만
  // 데이터로 받겠다는 거냐?"* 실제로는 6개를 쓰고 있었다. 판정은 core의
  // `columnRoles` 하나로 모았고 **여기서는 문구만 만든다** (§22에서 배운 분업).
  const use = match ? columnRoles(match.profile) : null
  const present = new Set(a.header.columns.map((h) => h.trim()))
  const declared = use ? [...use.byColumn.keys()] : []
  const hit = declared.filter((c) => present.has(c))

  // 표본 값은 첫 데이터 행에서 뽑는다 — 「이 컬럼이 뭔지」는 이름보다 값이 말한다.
  const first = a.sample[0]
  vals.colRows = a.header.columns.map((h, col) => {
    const u = use?.byColumn.get(h.trim())
    const raw = first?.[col]
    const roles = u?.roles ?? []
    return {
      header: h,
      sample: raw === null || raw === undefined ? "—" : String(raw).slice(0, 24),
      // 저장되는 자리 — Canonical 필드가 있으면 그 이름, 없으면 **하는 일**을 말한다.
      // 매핑되지 않은 컬럼은 저장되지 않지만 **쓰이지 않는 것과는 다르다** (헌장 A-5)
      //
      // ★ 프로파일이 아예 없을 때는 «이 프로파일이 쓰지 않는다»가 할 말이 아니다 ★
      // 그런 프로파일이 없기 때문이다. 판정이 실패했다는 사실을 그대로 말한다.
      field:
        use === null
          ? "—"
          : u
            ? roles.includes("item-field") && !roles.includes("field")
              ? itemLabel(u.target)
              : (u.target ?? roleField(roles))
            : use.contentKeyed
              ? "행 식별에 참여"
              : "저장 안 함",
      fieldColor: u || use?.contentKeyed ? "var(--fg-2)" : DIM,
      why:
        use === null
          ? "맞는 프로파일이 없어 판정하지 못했다"
          : u
            ? roleWhy(roles, u.required === true)
            : use.contentKeyed
              ? "이 양식은 행 전체로 source_key를 만든다"
              : "이 프로파일이 쓰지 않는 컬럼",
      // ★ 추정이 아니라 선언이다 ★ 컬럼 매핑은 프로파일 JSON이 정해둔 것이라
      // 확신도라는 개념이 없다. %를 지어내면 «추론했다»는 거짓이 된다.
      conf: u ? "선언" : "—",
      color: u ? G : DIM,
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
        // 분모는 «프로파일이 선언한 컬럼 전부»다. 표와 같은 집합이어야 한다 —
        // 표는 6개를 쓴다고 말하는데 이 칸이 3/3이면 화면이 자기모순이다 (결함 53).
        // ★ 프로파일이 없으면 «0/0 초록»이 된다 — 넣을 수 없는 파일에 «다 좋다» 신호다 ★
        // 실기기에서 쿠팡 매출 파일로 드러났다. 판정이 없으면 숫자도 없다.
        use === null
          ? { label: "쓰는 컬럼", value: "—", color: DIM }
          : { label: "쓰는 컬럼", value: `${won(hit.length)}/${won(declared.length)}`, color: hit.length === declared.length ? G : WARN },
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
  //
  // ★ 같은 바이트가 이미 들어왔으면 그걸 먼저 말한다 ★
  // 이름만 다른 재가져오기는 UPSERT로 합쳐지지 않는다 — 파일명이 키에 들어가는
  // 양식에서는 **키가 갈라져 두 번 쌓인다.** 막지는 않되 알고 넣게 한다.
  const prior = state.priorSame
  vals.impDupNote =
    prior.length === 0
      ? "같은 source_key가 이미 있으면 덮어쓰지 않고 갱신됩니다 (UPSERT)."
      : `이 파일은 ${prior[0]!.at}에 「${prior[0]!.sourceName}」으로 이미 들어왔습니다` +
        (prior[0]!.sourceName === a.fileName ? "" : " — 내용은 같고 파일명만 다릅니다") +
        (prior[0]!.undone ? " (되돌려진 배치입니다)" : "") +
        ". 그래도 넣으면 새 batch로 쌓입니다."

  // 막힌 후보로는 넣을 수 없다. 버튼을 비활성으로 두고 이유는 위 판정 줄이 말한다.
  vals.impCanRun =
    match !== undefined && blocked === undefined && !state.busy && state.digest === null
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
  vals.impDigest = d === null ? [] : digestRows(d, opened)
}

/**
 * 다이제스트 목록 — 제외 사유들 + **이 파일로 열린 것** 한 줄 (§22-4).
 *
 * `importVals` 밖으로 뺀 이유는 시험 때문이다. `importVals`는 분석이 없으면 조기
 * 반환하는데(앱에서는 다이제스트가 늘 분석 뒤에 오므로 맞다), 그 탓에 이 조립만
 * 따로 확인할 길이 없었다. `settlementSummary`를 뺀 것과 같은 이유다.
 */
export function digestRows(
  d: BatchDigest,
  opened: readonly string[],
): { label: string; value: string; color: string }[] {
  return [
    ...d.exclusionsByReason.map((x) => ({
      label: EXCLUSION_LABEL[x.reason] ?? x.reason,
      value: `${won(x.count)}건`,
      color: x.reason === "error" ? NEG : WARN,
    })),
    /**
     * ★ 병합 — 「적재 + 제외 = 파일 행」이 겉으로만 맞던 자리 (마이그레이션 007) ★
     *
     * 같은 파일 안에서 두 행이 같은 `source_key`를 얻으면 UPSERT가 하나로 합친다.
     * 행은 버려지지 않았으므로 **제외가 아니고**, 그래서 지금까지 어느 숫자에도
     * 안 잡혔다. 이제 세고, **0이면 아무 말도 안 한다** — 007 이전 배치도 0이라
     * 「병합 0건」을 띄우면 «안 일어났다»와 «안 셌다»가 같은 얼굴이 된다.
     *
     * 갱신(이전 배치를 덮음 · 재가져오기의 정상)과 **나란히 두지 않는다.** 처방이
     * 다르기 때문이다 — 갱신은 할 일이 없고, 병합은 파일의 행 식별을 의심해야 한다.
     */
    ...(d.merged > 0
      ? [
          {
            label: "같은 키로 합쳐진 행",
            value: `${won(d.merged)}건 — 이 파일의 행 식별이 유일하지 않을 수 있습니다`,
            color: NEG,
          },
        ]
      : []),
    /**
     * ★ 적재됐지만 온전하지 않은 행 — 비치명 오류의 목적지 (마이그레이션 008) ★
     *
     * 제외와 **나란히 두되 섞지 않는다.** 제외는 «못 읽어서 빠진 행»이고 이쪽은
     * «들어갔는데 뭔가 빠진 행»이다. 처방이 다르다 — 전자는 파일을 보고, 후자는
     * 프로파일이 파일을 따라잡았는지를 본다.
     *
     * 사유가 하나면 그 줄의 수가 곧 총계라 합계 줄을 만들지 않는다. 둘 이상일 때만
     * 낸다 — 사유별 합은 **겹치는 행을 두 번 세므로** 총계가 되지 못하기 때문이다.
     * 조건을 데이터에서 판정한다 (ADR-009 ①-보완 3의 3번).
     */
    ...d.issuesByCode.map((x) => ({
      label: ISSUE_LABEL[x.code] ?? x.code,
      value: `${won(x.rows)}행`,
      color: WARN,
    })),
    ...(d.issuesByCode.length > 1
      ? [
          {
            label: "적재됐지만 온전하지 않은 행",
            value: `${won(d.incompleteRows)}행 — 한 행이 여러 사유를 겪을 수 있어 위 합과 다릅니다`,
            color: WARN,
          },
        ]
      : []),
    /**
     * 파일 전체에 걸친 사건은 **행 수가 없다.** 「컬럼이 없다」를 1행으로 세면
     * 실제로 전 행이 겪는 결손이 «거의 괜찮다»로 보인다 (008의 `scope`).
     */
    ...d.fileIssues.map((x) => ({
      label: ISSUE_LABEL[x.code] ?? x.code,
      value: x.detail,
      color: WARN,
    })),
    // ★ 가져오기가 곧 게이지 상승임을 그 자리에서 보여준다 (§22-4 · §20) ★
    // 제외 목록과 같은 모양의 줄 하나다 — 마크업을 새로 그리지 않았다.
    // 여는 것이 없으면 줄도 없다. 할 말이 없으면 안 한다.
    ...(opened.length > 0
      ? [{ label: "이 파일로 열린 것", value: opened.join(" · "), color: G }]
      : []),
  ]
}

/**
 * 사건 코드 → 사람이 읽는 말 (마이그레이션 008).
 *
 * ★ core가 아니라 여기 있다 ★ `ISSUE_KINDS`의 `what`은 개발자용 한 줄이다.
 * 사용자에게 할 말은 화면이 소유한다 — §22에서 `pnlGaps`와 달리 커버리지 판정
 * 모듈이 문장을 만들지 않기로 한 것과 같은 경계다.
 *
 * 문구는 전부 **처방을 품는다.** «알 수 없는 값 3건»만으로는 사용자가 무엇을 할지
 * 알 수 없고, 그러면 경고는 소음이 된다.
 */
const ISSUE_LABEL: Record<string, string> = {
  unknown_route: "사전에 없는 상태값 — 기본 경로로 적재됨(마켓에 새 상태가 생겼는지 확인)",
  orphan_item: "품목이 붙지 않은 주문 — 원가가 붙지 않습니다",
  missing_column: "파일에 없는 컬럼 — 이 값이 전 행에서 빕니다",
  item_key_missing: "품목을 만들지 못했습니다 — 리스팅 키 컬럼이 이 파일에 없습니다",
  /**
   * ★ 문구가 «그래서 뭘 해야 하는데»까지 답한다 (§22-3의 3절 문법) ★
   * 「음수 3건」만 말하면 사용자는 그게 문제인지 정상인지 모른다. 무슨 일이
   * 있었는지 · 지금 값이 무엇인지 · 무엇을 해야 하는지를 한 줄에 담는다.
   */
  sign_normalized:
    "음수를 절대값으로 바꿔 저장했습니다 — 프로파일의 부호 규칙(magnitude)대로입니다",
  sign_undeclared:
    "음수인데 이 양식의 부호 규칙이 선언되지 않아 값 그대로 적재했습니다 — " +
    "환불·차감이라면 프로파일에 부호 규칙이 필요합니다",
  // 조용히 치우지 않는다 — 무엇을 치웠는지 이 줄이 말한다 (대열 4 ③)
  stale_batch_aborted: "끝나지 않았던 이전 가져오기를 취소했습니다",
  stale_batch_blocked: "끝나지 않은 이전 가져오기가 남아 있습니다 — 치우지 못했습니다",
}

/** 제외 사유 → 사람이 읽는 말. 코드값을 그대로 보이면 사용자가 알 수 없다. */
const EXCLUSION_LABEL: Record<string, string> = {
  total: "합계 행",
  subtitle: "제목·설명 행",
  blank: "빈 행",
  "trailing-blank": "끝의 빈 행",
  error: "읽지 못한 행 — 필수 값이 비었거나 사전에 없는 값",
}
