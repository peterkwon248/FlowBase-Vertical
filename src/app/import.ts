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
import type { RawCell } from "@core/import/types.js"
import type { ReferenceRunResult } from "@core/import/run-reference.js"
import { columnRoles, type ColumnRole } from "@core/import/mapping/index.js"
import type { BatchDigest } from "@core/store/repository.js"
import type { TemplateVals } from "./generated/vals.js"
import { won } from "./format.js"

/**
 * 0-기준 열 번호 → **엑셀 열 문자** (0→A · 25→Z · 26→AA).
 *
 * 화면에 «3번째 열»이라고 적으면 사용자가 엑셀에서 못 찾는다 — 파일을 여는
 * 도구의 좌표로 말한다. 행 번호를 1-기준으로 보이는 것(`errRows`)과 같은 이유다.
 */
function colRef(index: number): string {
  let n = index
  let out = ""
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/**
 * 제외 사유를 사람 말로. **새 실패 상태를 발명하지 않는다** (LOCK 6) — 파이프라인이
 * 이미 가진 네 종(`ExcludedRow.reason`)을 옮기기만 한다.
 */
const EXCL_WORD: Record<string, string> = {
  total: "합계 행 — 제외",
  subtitle: "제목·부제 행 — 제외",
  blank: "빈 행",
}

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

/**
 * 맞는 양식이 없을 때 **앱이 아는 만큼만** 말한다 (2026-08-18).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 자리에 있던 문장은 거짓이었다 ★
 *
 *   "맞는 매핑 프로파일이 없습니다 — 이 **파일**은 넣을 수 없습니다"
 *
 * 앱이 아는 것은 「이 **시트**에서 못 찾았다」뿐이었는데 파일 전체를 단정했다.
 * 사용자의 실파일 두 장이 그 문장 때문에 막혀 있었고 — 그 안의 시트 5·11은
 * **확신도 100%로 맞았다.** 데이터가 틀리게 저장되는 게 아니라 **말이 틀렸고**,
 * 그 말 때문에 되는 일을 안 된다고 믿게 만들었다 (LOCK 6 계열).
 *
 * 이제 판정이 전 시트를 훑으므로(`analyze.ts`) 세 경우가 갈린다:
 *
 *   ① 다른 시트에 답이 있다   → **어느 시트인지 말한다**. 이게 대부분이다
 *   ② 어느 시트에서도 못 찾았다 → 그제서야 «이 파일은»이라고 말해도 참이다
 *   ③ 시트가 하나뿐이다       → 「시트」를 말하는 게 오히려 헷갈린다
 * ─────────────────────────────────────────────────────────────
 */
export function noMatchLine(a: ImportAnalysis): string {
  const hit =
    a.suggestedSheetIndex === null
      ? undefined
      : a.sheetMatches.find((m) => m.sheetIndex === a.suggestedSheetIndex)
  const best = hit?.profiles.find((p) => p.blockedBy === undefined)

  if (hit !== undefined && best !== undefined) {
    return (
      `이 시트에서는 맞는 양식을 찾지 못했습니다 — ` +
      // `displayName`과 `label`을 나란히 쓰면 마켓 이름이 두 번 나온다
      // ("ESM (G마켓·옥션) · ESM 주문통합검색 (G마켓·옥션)"). 문서 이름 하나면 충분하다.
      `「${hit.sheetName}」 시트가 ${best.profile.label}와 ` +
      `${Math.round(best.confidence * 100)}% 일치합니다. 아래에서 그 시트를 고르세요`
    )
  }
  // 시트가 하나뿐이면 「이 시트에서는」이 군더더기다 — 파일과 시트가 같은 말이다.
  if (a.sheets.length <= 1) return "맞는 매핑 프로파일이 없습니다 — 이 파일은 넣을 수 없습니다"
  // ★ 여기서만 «파일 전체»를 말한다. 실제로 전부 봤기 때문이다.
  return `${a.sheetMatches.length}개 시트를 모두 살펴봤지만 맞는 양식이 없습니다 — 이 파일은 넣을 수 없습니다`
}

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
  /**
   * ★ 기준 데이터의 **적용 시작일** — 파일에 없어서 사람이 정한다 ★
   *
   * 원가표에는 «언제부터 이 원가인가»가 없다. 지어내면 과거 주문에 새 원가가
   * 소급되고 지난달 손익이 이번 달에 바뀐다 (`product.ts`의 목업 결함 ②와 같은
   * 문제). 기본값은 오늘이지만 **숨기지 않는다** — 기본값을 숨기면 사용자는
   * 자기가 「오늘부터」를 골랐다는 사실을 모른 채 저장하고, 7월 주문에 원가가
   * 안 붙은 이유를 영영 모른다.
   */
  readonly effectiveFrom: string
  /** 기준 데이터 적재 결과. 사실 경로의 `digest`와 **다른 모양**이라 따로 둔다. */
  readonly refResult: ReferenceRunResult | null
  /**
   * ★ 「일치한 시트 전부 넣기」 토글 (ADR-019 B4) ★
   *
   * 기본이 참인 이유: §18-B가 요구하는 것이 «자동 판정 결과를 **체크 상태의
   * 초안**으로 제시하고, 확정은 사람이 누른다»이기 때문이다. 파일·시트를 바꾸면
   * 참으로 되돌아간다 — 초안은 매 판정마다 새로 서는 것이지 지난 파일의 선택이
   * 아니다. 기준(reference) 경로에서 같은 양식으로 매칭된 시트가 여럿일 때만
   * 화면에 나타난다.
   */
  readonly allSheets: boolean
}

export const EMPTY_WIZARD: ImportWizardState = {
  analysis: null,
  profileIndex: 0,
  digest: null,
  busy: false,
  error: null,
  bigFile: false,
  priorSame: [],
  effectiveFrom: "",
  refResult: null,
  allSheets: true,
}

export interface ImportActions {
  /**
   * 파일 하나를 받는다. **입구가 둘이다** (2026-08-20 · 조사 1.3):
   *
   *   `<input type="file">`의 change 이벤트  →  `target.files[0]`
   *   끌어다 놓기(drop) 이벤트               →  `dataTransfer.files[0]`
   *
   * 담기는 자리만 다르고 그 뒤는 같은 `File`이라 **한 경로로 합쳤다** — 갈라 두면
   * 한쪽만 고쳐지는 날 두 입구가 다르게 동작한다.
   *
   * ★ 타입이 `File`이 아닌 이유 ★ 전에는 `(file: File) => void`였는데
   * **구현도 호출부도 이벤트를 넘기고 있었다** — 타입이 거짓이었고, TS는
   * 구현부가 `unknown`을 받아서 잡지 못했다. 지금은 계약을 사실로 맞춘다.
   */
  pickFile: (ev: unknown) => void
  pickProfile: (index: number) => void
  pickSheet: (index: number) => void
  /** 기준 데이터의 적용 시작일을 사람이 고친다 (`YYYY-MM-DD`). */
  setEffectiveFrom: (date: string) => void
  /**
   * «매핑 수정» — 필드 매핑 화면으로 간다 (B1 · §20 «전부 보기»의 이행).
   * 목업부터 있던 버튼인데 지금까지 아무 일도 안 했다 — 눌러도 조용한 버튼은
   * 고장으로 읽힌다. 지금 보던 양식이 선택된 채 열린다.
   */
  editMap: () => void
  /** 「일치한 시트 전부 넣기」 토글 (ADR-019 B4). */
  toggleAllSheets: () => void
  confirm: () => void
  reset: () => void
}

export const NOOP_IMPORT_ACTIONS: ImportActions = {
  pickFile: () => {},
  pickProfile: () => {},
  pickSheet: () => {},
  setEffectiveFrom: () => {},
  editMap: () => {},
  toggleAllSheets: () => {},
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
  const at =
    state.digest || state.refResult ? 4 : state.busy ? 3 : state.analysis ? 2 : 0
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
  // 기준 데이터의 금액은 `target`(「매입원가」)이 이미 채워지므로 여기 오지 않지만,
  // 순서상 앞에 둔다 — 원가표의 상품번호가 `listing-key`이기도 해서 뒤에 두면
  // «리스팅 키»로 덮인다.
  if (roles.includes("reference-amount")) return "기준 데이터"
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
  // 기준 데이터는 **batch에 안 실린다.** 되돌리기 목록에 안 나오는 이유가 여기 있고,
  // 말하지 않으면 사용자가 「가져오기 기록」에서 찾다가 «안 들어갔다»고 읽는다.
  if (roles.includes("reference-amount")) {
    parts.push("기준 데이터로 저장된다 — batch가 아니라 이력으로 쌓인다")
  }
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

  // ★ 결과가 나온 뒤에는 «멈출 수 있다» 경고를 내린다 ★ 기준 경로는 digest를
  // 끝내 안 채우고 refResult만 채운다 — digest만 보면 13MB 단가표의 결과 화면
  // 위에 프리즈 경고가 영영 남는다 (ADR-019에서 잡은 결함).
  vals.impBig = state.bigFile && state.digest === null && state.refResult === null
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
    vals.impSheetAutoNote = ""
    vals.impAllSheets = false
    vals.impAllSheetsLabel = ""
    vals.toggleImpAllSheets = act.toggleAllSheets
    vals.impCanRun = false
    vals.impRunLabel = "확인하고 가져오기"
    vals.impDone = false
    vals.impDigest = []
    vals.impDigestTitle = ""
    vals.impRefer = false
    vals.impReferDate = ""
    vals.impReferNote = ""
    vals.setImpReferDate = act.setEffectiveFrom
    vals.impPick = act.pickFile
    vals.impReset = act.reset
    vals.impGrid = false
    vals.impGridCols = []
    vals.impGridRows = []
    vals.impGridNote = ""
    return
  }

  const sheet = a.sheets[a.sheetIndex]
  const match = a.profiles[state.profileIndex]
  /** 기준 데이터 프로파일인가 — 이 한 값이 아래 네 자리의 문구를 가른다. */
  const ref = match?.profile.reference

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
      : `${noMatchLine(a)} · 열 판정: 확정 ${a.judge.tierCounts.alias} · 증명 ${a.judge.tierCounts.identity} · 후보 ${a.judge.tierCounts.candidate} · 모름 ${a.judge.tierCounts.unknown}`

  // ── §18 시트 선택 ────────────────────────────────────────────────
  // 시트가 여럿이면 사람이 고른다. 역할·사유·수식비율을 함께 보인다 —
  // 96%가 수식인 시트는 다른 시트에서 계산된 결과이고, 사실로 적재하면
  // 숫자가 두 번 더해진다.
  vals.impManySheets = a.sheets.length > 1
  vals.impSheets = a.sheets.map((s, i) => {
    /**
     * ★ 「이 시트가 무엇인지」를 목록에서 바로 말한다 ★
     *
     * 19장짜리 워크북에서 «시트를 골라 보세요»만 있으면 사용자는 열아홉 번을
     * 눌러 봐야 한다. 판정은 이미 전 시트에 대해 끝나 있으므로(`sheetMatches`),
     * 아는 것을 목록에 적는 것이 맞다 — 고르는 일이 **탐색이 아니라 확인**이 된다.
     */
    const m = a.sheetMatches.find((x) => x.sheetIndex === i)
    const hit = m?.profiles.find((p) => p.blockedBy === undefined)
    return {
      label: s.name,
      on: i === a.sheetIndex ? "active" : "",
      note: [
        hit === undefined
          ? ""
          : `★ ${hit.profile.label} ${Math.round(hit.confidence * 100)}%`,
        // ★ 결함 62 ★ `reason`이 «1000행»이라 그대로 쓰면 행 수가 두 번 찍힌다
        // ("1000행 · 1,000행"). 같은 사실이면 자릿수 구분이 있는 쪽만 남긴다.
        s.reason === `${s.physicalRowCount}행` ? "" : s.reason,
        `${won(s.physicalRowCount)}행`,
        s.formulaRatio === null ? "" : `수식 ${Math.round(s.formulaRatio * 100)}%`,
      ]
        .filter((t) => t !== "")
        .join(" · "),
      // 맞는 양식이 있는 시트는 초록으로 — 수식 경고보다 이 신호가 앞선다.
      // 수식 비율이 높으면 눈에 띄게 — 판단 재료지 결정이 아니다 (§18-A)
      color: hit !== undefined ? G : s.formulaRatio !== null && s.formulaRatio > 0.5 ? WARN : DIM,
      pick: () => act.pickSheet(i),
    }
  })

  /**
   * ★ 자동으로 옮겼으면 말한다 (ADR-019 · LOCK 6) ★
   *
   * 조용히 옮기면 사용자는 자기가 0번 시트를 본 적 없다는 걸 모른다. 어디서
   * 어디로, 무엇을 근거로 옮겼는지 문장으로 말한다 (§20 규칙 2 — %가 아니라
   * 근거 문장… 이되 일치도는 프로파일 판정의 어휘라 함께 둔다).
   *
   * `?? null` 가드 — 테스트 목업이 `as unknown as ImportAnalysis` 캐스트라
   * 이 필드가 없는 객체가 실제로 들어온다.
   */
  const auto = a.autoSelected ?? null
  const autoTo = auto === null ? undefined : a.sheets[auto.to]
  const autoNote =
    auto === null || autoTo === undefined
      ? ""
      : `「${a.sheets[auto.from]?.name ?? `시트 ${auto.from + 1}`}」 시트에는 맞는 양식이 없어 ` +
        `「${autoTo.name}」 시트를 열었습니다` +
        (match === undefined
          ? ""
          : ` — ${match.profile.label} ${Math.round(match.confidence * 100)}%`) +
        `. 다른 시트를 보려면 아래에서 고르세요.`

  /**
   * ★ 파서가 한 말을 화면이 받는다 (2026-08-20 · 조사 1.9 · LOCK 6) ★
   *
   * `analyze.ts`가 「시트가 14장이라 앞 8장만 훑었습니다」·「시트 3 「…」를 읽지
   * 못했습니다」를 **만들어 놓고 있었는데 소비처가 0곳이었다.** 만들어 두고 안
   * 보여주는 것은 조용한 실패다 — 사용자는 자기가 못 본 시트가 있다는 걸 모른다.
   *
   * 이 자리에 붙이는 이유: 둘 다 **시트에 관한 말**이고, 이 문단이 정확히 시트
   * 고르기 블록 안이다. 자동 이동 안내와 같은 곳에서 읽혀야 「그래서 내가 뭘
   * 골라야 하나」가 한 번에 이어진다.
   *
   * `sheetNotes`는 우리가 한국어로 쓴 문장이라 **그대로** 낸다.
   * `warnings`(SheetJS 원문)는 아래에서 **세기만** 한다 — U-5.
   */
  // `?? []` 가드 — 위 `autoSelected ?? null`과 같은 이유다. 시험 목업이
  // `as unknown as ImportAnalysis` 캐스트라 이 필드가 없는 객체가 실제로 들어온다.
  vals.impSheetAutoNote = [autoNote, ...(a.sheetNotes ?? [])].filter((s) => s !== "").join(" ")

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
  /**
   * ★ 프로파일이 없으면 판정 4단이 말한다 (ADR-017) ★
   * 예전 이 자리는 전 열이 «맞는 프로파일이 없어 판정하지 못했다»였다 — 참이지만
   * 앱이 아는 것보다 적게 말했다. 별칭·항등식이 아는 열은 그만큼 말한다.
   * 확신도 칸은 여전히 %가 아니다 — 선언/확정/증명/후보/모름 **낱말**이다.
   */
  const verdictAt = new Map(a.judge.verdicts.map((v) => [v.ordinal, v]))
  const TIER_WORD = { alias: "확정", identity: "증명", candidate: "후보", unknown: "모름" } as const
  vals.colRows = a.header.columns.map((h, col) => {
    const u = use?.byColumn.get(h.trim())
    const raw = first?.[col]
    const roles = u?.roles ?? []
    const v = verdictAt.get(col)
    return {
      header: h,
      sample: raw === null || raw === undefined ? "—" : String(raw).slice(0, 24),
      // 저장되는 자리 — Canonical 필드가 있으면 그 이름, 없으면 **하는 일**을 말한다.
      // 매핑되지 않은 컬럼은 저장되지 않지만 **쓰이지 않는 것과는 다르다** (헌장 A-5)
      field:
        use === null
          ? (v?.target ?? (v && v.candidates.length > 0 ? `${v.candidates.join(" / ")} ?` : "—"))
          : u
            ? roles.includes("item-field") && !roles.includes("field")
              ? itemLabel(u.target)
              : (u.target ?? roleField(roles))
            : use.contentKeyed
              ? "행 식별에 참여"
              : "저장 안 함",
      fieldColor: u || use?.contentKeyed || v?.target ? "var(--fg-2)" : DIM,
      why:
        use === null
          ? (v?.sentence ?? "맞는 프로파일이 없어 판정하지 못했다")
          : u
            ? roleWhy(roles, u.required === true)
            : use.contentKeyed
              ? "이 양식은 행 전체로 source_key를 만든다"
              : "이 프로파일이 쓰지 않는 컬럼",
      // ★ 추정이 아니라 선언이다 ★ 프로파일이 있으면 «선언», 없으면 판정 낱말.
      // %를 지어내면 «추론했다»는 거짓이 된다.
      conf: use === null ? (v ? TIER_WORD[v.tier] : "—") : u ? "선언" : "—",
      color:
        use === null
          ? v?.tier === "alias" || v?.tier === "identity"
            ? G
            : v?.tier === "candidate"
              ? WARN
              : DIM
          : u
            ? G
            : DIM,
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
  /**
   * ★ 원본 파일 격자 (§21 «import-grid» · 신설) ★
   *
   * ─────────────────────────────────────────────────────────────
   * 목업 위저드는 **열 목록만** 그렸다 — 「파일 헤더 | 샘플 값 | Canonical 필드 |
   * 추론 근거 | 확신도」가 열 하나에 한 줄씩. 그래서 사용자는 «이게 내 파일이
   * 맞나»를 **열 이름만 보고** 판단하고 있었다. 그 표는 «이 열이 무슨 뜻인가»에
   * 답하지 «파일이 어떻게 생겼나»에 답하지 않는다. 격자는 뒤쪽 질문의 자리이고,
   * 그래서 열 목록을 대체하지 않고 **나란히 선다**.
   *
   * ★★ 행 번호는 파일의 좌표다 — 표본의 순서가 아니다 ★★
   *
   * `a.sample`은 «파일이 생긴 것»이 아니라 «파이프라인이 본 것»이다. 헤더 위
   * 제목·헤더·합계·빈 행이 이미 빠져 있어서, i번째 표본이 파일의 몇 행인지는
   * `a.sampleRowIndices`로만 안다. 순서대로 1,2,3…을 그리면 **파일에 없는 좌표를
   * 지어내는 것**이고(LOCK 6), 그 거짓말이 실제로 큰 파일이 있다:
   *
   * ```
   * 「파워클릭 보고서」  표본 17행이 물리 6~65에 흩어져 있다
   *                     16~34행은 통째로 비어 있고, 35행부터 다른 표가 시작한다
   *                     → 순서로 그리면 «17행짜리 정상 표»로 보인다
   * ```
   *
   * 그래서 빠진 자리를 **접어서 그대로 남긴다** — 「합계 행 — 제외」가 제자리에
   * 있어야 헌장 C-5의 «제외 행 삭선 + 카운트»가 성립한다.
   *
   * ★ 편집 어포던스 0 ★ 원본 셀은 사실층이고, §21-1이 «못 누르는 버튼을 그려놓고
   * 막는 것이 아니라 아예 안 그린다»고 못박았다 (LOCK 9의 시각적 대응). 회색
   * 입력칸도 어포던스이므로 두지 않는다. 값을 고치는 자리는 조정 레이어다(ADR-020).
   * ─────────────────────────────────────────────────────────────
   */
  const hdrRow = a.header.rowIndex
  // 표본 행이 헤더보다 넓을 수 있다 — 헤더 폭으로만 그리면 그 칸이 조용히 사라진다.
  const gridWidth = a.sample.reduce((w, r) => Math.max(w, r.length), a.header.columns.length)
  vals.impGridCols = Array.from({ length: gridWidth }, (_, c) => ({
    ref: colRef(c),
    // 헤더에 이름이 없는 꼬리 칸은 «(헤더 없음)»이다. 빈칸으로 두면 안 센 것과 같다.
    name: a.header.columns[c] ?? "",
    extra: c >= a.header.columns.length,
  }))

  /** 물리 행 → 그 행에 대해 아는 것. 헤더·데이터·제외가 **한 좌표계**에 산다. */
  const rowAt = new Map<number, { kind: string; note: string; cells: readonly RawCell[] }>()
  // 헤더 행은 **자리만** 표시한다 — 이름은 격자 머리글에 상시 떠 있으므로 셀로
  // 또 그리면 같은 것을 두 번 말하는 꼴이다. 여기서 답할 질문은 «헤더가 몇 행인가»다
  // (「파워클릭 보고서」는 6행이고, 그 사실이 «이건 표가 아니라 리포트»를 말한다).
  if (hdrRow !== null) rowAt.set(hdrRow, { kind: "head", note: "헤더 행 — 위 열 이름이 여기서 나왔다", cells: [] })
  // ★ 표본을 돌되 **좌표가 있는 행만** 그린다 ★ 좌표가 없으면 그 행은 격자에
  // 서지 않는다 — 순서로 자리를 지어내느니 안 그리는 편이 참이다 (LOCK 6).
  a.sample.forEach((cells, i) => {
    const r = a.sampleRowIndices[i]
    if (r === undefined) return
    rowAt.set(r, { kind: "", note: "", cells })
  })
  for (const e of a.sampleExcluded) {
    // 제외된 행은 **내용이 남아 있지 않다** — 자리와 사유만 안다. 그걸 그대로 말한다.
    if (e.reason === "trailing-blank") {
      // 이 한 항목이 N행을 대표한다 (detail에 개수가 적혀 있다).
      rowAt.set(e.rowIndex, { kind: "excl", note: e.detail, cells: [] })
      continue
    }
    if (rowAt.has(e.rowIndex)) continue
    rowAt.set(e.rowIndex, { kind: "excl", note: EXCL_WORD[e.reason] ?? e.reason, cells: [] })
  }

  const seen = [...rowAt.keys()].sort((x, y) => x - y)
  // 격자는 **헤더 행부터** 그린다 — 그 위는 파이프라인이 보고 대상으로 삼지 않아
  // 「모르는 행」이 되고, 모르는 것을 격자에 그리면 아는 척이 된다.
  const from = hdrRow ?? seen[0] ?? 0
  const rows: TemplateVals["impGridRows"][number][] = []
  let blankRun: number[] = []
  const flushRun = (): void => {
    if (blankRun.length === 0) return
    const lo = blankRun[0]!
    const hi = blankRun[blankRun.length - 1]!
    rows.push({
      no: lo === hi ? `${lo + 1}` : `${lo + 1}–${hi + 1}`,
      kind: "skip",
      cells: [],
      note: `빈 행 ${won(blankRun.length)}개`,
    })
    blankRun = []
  }
  for (const r of seen) {
    if (r < from) continue
    const k = rowAt.get(r)!
    // 빈 행은 이어 붙여 한 줄로 접는다 — 19줄을 「빈 행」으로 채우면 격자가 안 읽힌다.
    if (k.kind === "excl" && k.note === "빈 행") {
      blankRun.push(r)
      continue
    }
    flushRun()
    rows.push({
      no: `${r + 1}`,
      kind: k.kind,
      cells: Array.from({ length: k.cells.length === 0 ? 0 : gridWidth }, (_, c) => {
        const v = k.cells[c]
        return {
          text: v === null || v === undefined ? "" : String(v).slice(0, 40),
          // 숫자는 우측 정렬 + tabular-nums (§21-4). 판정이 아니라 **생김새**다.
          num: typeof v === "number",
        }
      }),
      note: k.note,
    })
  }
  flushRun()
  vals.impGridRows = rows
  vals.impGrid = rows.length > 0

  /**
   * ★ 화면에 그린 것이 전부가 아니라는 사실을 **말한다** (LOCK 6) ★
   * 새 문구를 발명하지 않고 `impExcludedLabel`의 «전체 수는 가져온 뒤에 나옵니다»
   * 계열을 그대로 잇는다.
   */
  const above = hdrRow === null ? 0 : hdrRow
  vals.impGridNote = [
    `미리보기 ${won(a.sample.length)}행 — 파일의 ${won(from + 1)}행부터 봅니다`,
    above > 0 ? `이 위에 ${won(above)}행이 더 있습니다 (제목·안내 행)` : "",
    gridWidth > a.header.columns.length
      ? `헤더에 이름이 없는 칸이 ${won(gridWidth - a.header.columns.length)}개 있습니다`
      : "",
    "전체 행 수는 가져온 뒤에 나옵니다",
  ]
    .filter((t) => t !== "")
    .join(" · ")

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
  /**
   * ★ 기준 데이터에는 `source_key`도 UPSERT도 없다 ★
   *
   * 이 줄은 사실 경로의 규칙을 말한다 — 같은 키면 갱신, 다시 넣으면 새 batch.
   * 원가는 그 셋 중 어느 것도 아니다: 키가 (SKU · 종류 · 적용일)이고 같으면
   * **건너뛴다**. 사실 경로의 문장을 그대로 두면 사용자는 «다시 넣으면 갱신되겠지»
   * 하고 값을 고쳐 다시 넣는데, 적용일이 같으면 아무 일도 일어나지 않는다.
   * 화면을 렌더해서 이 줄이 그대로 떠 있는 것을 보고 잡았다 (2026-08-19).
   */
  vals.impDupNote =
    ref !== undefined
      ? "같은 적용일에 같은 값이 이미 있으면 건너뜁니다 — 원가를 고치려면 적용일을 다르게 두세요. " +
        "그러면 이전 값은 이력으로 남고 그 날짜부터 새 값이 붙습니다."
      : prior.length === 0
      ? "같은 source_key가 이미 있으면 덮어쓰지 않고 갱신됩니다 (UPSERT)."
      : `이 파일은 ${prior[0]!.at}에 「${prior[0]!.sourceName}」으로 이미 들어왔습니다` +
        (prior[0]!.sourceName === a.fileName ? "" : " — 내용은 같고 파일명만 다릅니다") +
        (prior[0]!.undone ? " (되돌려진 배치입니다)" : "") +
        ". 그래도 넣으면 새 batch로 쌓입니다."

  /**
   * ── 기준 데이터 — **적용일을 묻는다** ────────────────────────────
   *
   * ★ 이 물음이 없으면 넣을 수 없다 ★
   * 원가표에는 «언제부터 이 원가인가»가 없다(실측 7열 전부 확인). 사실 파일은
   * 행마다 날짜를 들고 오지만 기준 데이터는 **상태**라 날짜가 데이터 밖에 있다.
   * 지어내면 과거 손익이 소급으로 바뀌므로 사람에게 묻는 것 말고 답이 없다.
   *
   * `impRunLabel`도 갈아끼운다 — 「가져오기」는 batch를 만든다는 말인데 여기서는
   * 안 만든다. 되돌리기 목록에 안 나올 것을 「가져왔다」고 부르면 사용자가
   * 기록에서 찾다가 «안 들어갔다»로 읽는다 (LOCK 2와 LOCK 10 계열).
   */
  vals.impRefer = ref !== undefined && state.refResult === null
  vals.impReferDate = state.effectiveFrom
  vals.setImpReferDate = act.setEffectiveFrom
  vals.impReferNote =
    ref === undefined
      ? ""
      : `${REF_KIND_LABEL[ref.kind] ?? "기준 데이터"}는 «언제부터»가 파일에 없습니다 — ` +
        `이 날짜부터 적용되고, 이전 기간은 지금 값 그대로 남습니다. ` +
        `batch로 쌓이지 않아 「가져오기 기록」에는 나오지 않습니다.`

  // ── 「일치한 시트 전부 넣기」 — 기본 체크된 초안 (ADR-019 B4 · §18-B) ──
  //
  // 같은 양식으로 매칭된 시트가 여럿인 기준 파일에서만 나타난다. 결과가 나오면
  // 숨는다(적용일 입력과 같은 패턴) — 완료 화면에 살아 있는 토글이 남으면
  // 죽은 버튼 옆에서 눌리는 줄 안다.
  const refTargets =
    ref !== undefined && match !== undefined ? refTargetSheets(a, match.profile.id) : []
  const refBlocked =
    ref !== undefined && match !== undefined ? refBlockedSheetCount(a, match.profile.id) : 0
  const showAllSheets = ref !== undefined && state.refResult === null && refTargets.length > 1
  vals.impAllSheets = showAllSheets && state.allSheets
  vals.impAllSheetsLabel = !showAllSheets
    ? ""
    : `일치한 시트 ${won(refTargets.length)}개 전부 넣기 — 같은 양식으로 판정된 시트들입니다` +
      // blockedBy로 빠진 동일-양식 시트를 조용히 사라지게 두지 않는다 (ADR-010 계보)
      (refBlocked > 0 ? ` · 파일명 문제로 빠진 시트 ${won(refBlocked)}개는 넣지 않습니다` : "")
  vals.toggleImpAllSheets = act.toggleAllSheets

  // 막힌 후보로는 넣을 수 없다. 버튼을 비활성으로 두고 이유는 위 판정 줄이 말한다.
  //
  // ★ 기준 데이터는 **적용일이 비면 못 누른다** ★ 날짜 없이 넣을 방법이 없고,
  // 빈 채로 눌렀을 때 조용히 오늘로 채우면 그게 곧 «지어낸 값»이다.
  const dateOk = ref === undefined || /^\d{4}-\d{2}-\d{2}$/.test(state.effectiveFrom)
  vals.impCanRun =
    match !== undefined &&
    blocked === undefined &&
    dateOk &&
    !state.busy &&
    state.digest === null &&
    state.refResult === null
  // 몇 개 시트가 들어가는지 버튼이 말한다 — 「가져오기」라 부르지 않는 기존
  // 결정(batch를 만들지 않는다)은 그대로다. 접미만 는다.
  const multiRef = showAllSheets && state.allSheets
  vals.impRunLabel = state.busy
    ? ref === undefined
      ? "가져오는 중…"
      : "넣는 중…"
    : ref === undefined
      ? "확인하고 가져오기"
      : multiRef
        ? `확인하고 기준 데이터에 넣기 — ${won(refTargets.length)}개 시트`
        : "확인하고 기준 데이터에 넣기"
  vals.impRun = act.confirm
  vals.impEditMap = act.editMap

  // ── 결과: 다이제스트 ─────────────────────────────────────────────
  // ★ `batch_exclusion`을 **사유별로** 읽는 첫 화면이다 ★
  // 지금까지 이 테이블은 넣기만 하고 아무도 읽지 않았다. 「128행 적재」만 말하고
  // 제외 2건을 두고 오면 그게 곧 조용한 실패다 (LOCK 6).
  const d = state.digest
  const rr = state.refResult
  vals.impDone = d !== null || rr !== null
  vals.impDigestTitle = rr
    ? `${a.fileName} — ${REF_KIND_LABEL[rr.kind] ?? "기준 데이터"} ${won(rr.inserted)}건 반영` +
      (rr.perSheet.length > 1 ? ` · 시트 ${won(rr.perSheet.length)}개` : "") +
      (rr.unmatched > 0 ? ` · ${won(rr.unmatched)}건은 아직 판 적이 없어 못 붙였습니다` : "")
    : d
      ? `${d.sourceName} — ${won(d.rowCount)}행 적재${d.excludedCount > 0 ? ` · ${won(d.excludedCount)}행 제외` : ""}`
      : ""
  vals.impDigest = rr ? referenceRows(rr) : d === null ? [] : digestRows(d, opened)
}

/** 기준 데이터 종류 → 사람이 읽는 말. core의 코드값(`COGS`)을 화면에 내지 않는다. */
export const REF_KIND_LABEL: Record<string, string> = {
  COGS: "매입원가",
  PACKAGING: "포장비",
  LOGISTICS: "물류비",
  OTHER: "기타 원가",
}

/**
 * «전부 넣기»의 대상 시트 — 고른 시트 + **1순위 비차단 후보가 같은 프로파일인**
 * 다른 시트들, 시트 인덱스 오름차순 (ADR-019 B4).
 *
 * ★ 왜 1순위 조건인가 ★ 「같은 프로파일이 어딘가에 맞았다」로 거르면 다른
 * 프로파일이 더 높은 확신으로 맞은 시트까지 쓸려 들어간다 — 미지의 값을 기본
 * 경로로 흘리지 않는다는 ADR-010의 자매 규칙이다. 고른 시트는 사람이 확인
 * 표까지 본 시트라 조건 없이 든다.
 */
export function refTargetSheets(a: ImportAnalysis, profileId: string): number[] {
  const others = a.sheetMatches
    .filter((m) => m.sheetIndex !== a.sheetIndex)
    .filter((m) => {
      const top = m.profiles.find((p) => p.blockedBy === undefined)
      return top !== undefined && top.profile.id === profileId
    })
    .map((m) => m.sheetIndex)
  return [a.sheetIndex, ...others].sort((x, y) => x - y)
}

/** 같은 프로파일인데 파일명 캡처(blockedBy)로 빠진 시트 수 — 조용히 사라지게 두지 않는다. */
export function refBlockedSheetCount(a: ImportAnalysis, profileId: string): number {
  return a.sheetMatches.filter(
    (m) =>
      m.sheetIndex !== a.sheetIndex &&
      !m.profiles.some((p) => p.blockedBy === undefined && p.profile.id === profileId) &&
      m.profiles.some((p) => p.blockedBy !== undefined && p.profile.id === profileId),
  ).length
}

/**
 * 기준 데이터 적재 결과 — **행 하나하나가 어떻게 됐는지.**
 *
 * ★ 「못 찾음」이 여기서 가장 중요한 줄이다 ★
 * 253종짜리 원가표를 넣으면 대부분이 안 붙는 것이 **정상**이다 — 아직 안 판
 * 상품·단종된 상품이 섞여 있기 때문이다. 그 수를 빨갛게 칠하면 사용자는
 * «파일이 잘못됐다»로 읽고 멀쩡한 원가표를 고치려 든다. 그래서 색은 중립이고
 * 문장이 이유를 든다 — 세되 실패로 부르지 않는다 (LOCK 6은 «숨기지 마라»이지
 * «전부 빨갛게 칠하라»가 아니다).
 *
 * `importVals` 밖으로 뺀 이유는 `digestRows`와 같다 — 조기 반환 때문에 이 조립만
 * 따로 확인할 길이 없어진다.
 */
export function referenceRows(
  r: ReferenceRunResult,
): { label: string; value: string; color: string }[] {
  const rows = [
    {
      label: `${REF_KIND_LABEL[r.kind] ?? "기준 데이터"} 반영`,
      value: `${won(r.inserted)}건`,
      color: G,
    },
    /**
     * ★ 넣기 **전**에만 말하고 있었다 (2026-08-20) ★
     *
     * 같은 문장이 `impReferNote`에 있는데 조건이 `state.refResult === null`이라
     * **결과가 뜨는 순간 사라진다.** 그런데 사용자가 「기록에 없네?」를 겪는 시점은
     * 정확히 그 뒤다 — 넣고 나서 기록 화면에 가 본 때다.
     *
     * 실제로 그 순서로 당했다: 13MB 단가표를 넣고, 기록에 없어서, 안 들어간 줄 알았다.
     * 경고는 **찾으러 갈 사람이 보고 있는 자리**에 있어야 한다 (LOCK 6).
     *
     * 이 줄은 대기목록 8(파일 접수 장부)이 닫히면 **지운다.**
     */
    {
      label: "이 파일은 「가져오기 기록」에 남지 않습니다 — batch로 쌓이는 것은 주문·정산뿐입니다",
      value: "",
      color: DIM,
    },
  ]
  if (r.replaced > 0) {
    rows.push({ label: "같은 적용일을 덮어씀", value: `${won(r.replaced)}건`, color: WARN })
  }
  if (r.skipped > 0) {
    rows.push({ label: "이미 같은 값이 있어 그대로 둠", value: `${won(r.skipped)}건`, color: DIM })
  }
  if (r.createdSkus > 0) {
    // SKU를 **만들었다**는 것은 되돌리기가 안 되는 일이라 반드시 말한다.
    rows.push({
      label: "상품(SKU)을 새로 만들어 붙임",
      value: `${won(r.createdSkus)}개`,
      color: "var(--fg-2)",
    })
  }
  if (r.unmatched > 0) {
    /**
     * ★ 「팔리면 그때 붙습니다」였다 — **거짓이었다** (2026-08-20) ★
     *
     * 매출 파일을 나중에 넣어도 `src/core/import/run.ts`는 `pending_cost`를 다시
     * 훑지 않는다(참조 0건). 자동으로 붙는 것은 **이미 사람이 한 번 확정해 둔
     * 이름**뿐이다(`resolvedCostBridge` — 아래 「지난 판단으로 붙음」 줄).
     *
     * 그러니 화면이 「기다리면 된다」고 말하면 사용자는 **영영 안 오는 것을 기다린다.**
     * 200건짜리 단가표를 넣고 「0건 반영」을 본 사람에게 이 한 줄이 다음 동작을
     * 정하는데, 그 문장이 «아무것도 하지 마세요»였다 (LOCK 6 계열 — 조용한 거짓).
     */
    rows.push({
      label: "이 파일의 상품을 아직 못 찾음",
      value: `${won(r.unmatched)}건`,
      color: DIM,
    })
    if (r.bridged > 0) {
      rows.push({
        label: "전에 사람이 확정해 둔 이름이라 자동으로 붙음",
        value: `${won(r.bridged)}건`,
        color: "var(--fg-2)",
      })
    }
    if (r.stashed > 0) {
      // ★ 숫자만 주면 «176건»은 손댈 수 없는 수다 ★ 대기실은 **사람이 눌러야**
      // 비워지므로(ADR-016), 어느 화면 어느 탭인지까지 말한다. 시트가 하나뿐이면
      // 아래 「시트별」 절이 안 나와서 이 수가 화면에서 통째로 사라지고 있었다.
      rows.push({
        label: "대기실에 넣어 뒀습니다 — 「상품 연결 → 원가 대기」에서 이어 붙입니다",
        value: `${won(r.stashed)}건`,
        color: DIM,
      })
    }
    if (r.unmatchedSample.length > 0) {
      // 무엇이 안 붙었는지 말하지 않으면 «176건»은 사용자가 손댈 수 없는 숫자다.
      // 「상품번호」라고 부르지 않는다 — 카드형 단가표의 다리는 **품명**이라
      // 그 파일에는 상품번호 열이 아예 없다 (cost-card@1 `listingKeyColumn`).
      rows.push({
        label: "못 찾은 이름 (앞의 몇 개)",
        value: r.unmatchedSample.slice(0, 5).join(" · "),
        color: DIM,
      })
    }
  }
  if (r.badRows > 0) {
    // 이쪽은 진짜 결손이다 — 상품을 가리키는 칸이 비었거나 금액을 못 읽었다.
    // 여기도 「상품번호」로 부르지 않는다 — 위와 같은 이유다.
    rows.push({
      label: "상품을 가리키는 칸이 비었거나 금액을 못 읽음",
      value: `${won(r.badRows)}행`,
      color: NEG,
    })
  }
  if (r.excluded.length > 0) {
    rows.push({
      label: "파이프라인이 거른 행 (합계·빈 행)",
      value: `${won(r.excluded.length)}행`,
      color: WARN,
    })
  }

  /**
   * ★ 시트 간 금액 충돌 (ADR-019 B3) ★ 같은 대상에 다른 금액이 두 번 왔다.
   * 어느 값이 남았는지까지 말한다 — 「몇 건」만 말하면 사용자가 손댈 수 없는
   * 숫자다 (unmatchedSample과 같은 판단).
   */
  if (r.conflictCount > 0) {
    rows.push({
      label: "같은 품명에 다른 금액 — 시트끼리 어긋납니다",
      value: `${won(r.conflictCount)}건`,
      color: WARN,
    })
    rows.push({
      label: "어긋난 자리 (앞의 몇 개 · 남은 값 표시)",
      value: r.conflicts
        .slice(0, 3)
        .map((c) => `${c.key} ${won(c.prior)}→${won(c.next)} (${won(c.kept)}원 남음)`)
        .join(" · "),
      color: WARN,
    })
  }

  /**
   * ★ 시트별 결과 — 다중 시트일 때만 (ADR-019 B2) ★
   * 합산만 주면 «어느 시트가 몇 건»이 사라진다. 실패 시트는 **일급으로 빨갛게** —
   * warnings에 묻으면 아무도 못 본다는 것이 실측이다.
   */
  if (r.perSheet.length > 1 || r.perSheet.some((s) => s.failed !== null)) {
    for (const s of r.perSheet) {
      if (s.failed !== null) {
        rows.push({ label: `시트 「${s.sheetName}」 — 넣지 못함`, value: s.failed, color: NEG })
        continue
      }
      const parts = [
        s.inserted > 0 ? `반영 ${won(s.inserted)}` : "",
        s.bridged > 0 ? `지난 판단으로 ${won(s.bridged)}` : "",
        s.stashed > 0 ? `대기 ${won(s.stashed)}` : "",
        s.skipped > 0 ? `건너뜀 ${won(s.skipped)}` : "",
        s.badRows > 0 ? `못 읽음 ${won(s.badRows)}` : "",
      ].filter((t) => t !== "")
      rows.push({
        label: `시트 「${s.sheetName}」`,
        value: parts.length === 0 ? "0건" : parts.join(" · "),
        color: DIM,
      })
    }
  }
  return rows
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
  /**
   * ★ 「그래서 뭘 해야 하는데」까지 답한다 (조사 2.13) ★
   * 컬럼 이름과 금액은 `detail`이 싣는다 — 여기 라벨은 **무슨 일인가**만 말한다.
   * 사용자가 할 일은 「양식 확인」이지 파일을 다시 넣는 것이 아니다.
   */
  unmapped_money:
    "이 파일에 받지 않은 금액 컬럼이 있습니다 — 아래 금액은 손익에 들어가지 않았습니다",
  // 조용히 치우지 않는다 — 무엇을 치웠는지 이 줄이 말한다 (대열 4 ③)
  stale_batch_aborted: "끝나지 않았던 이전 가져오기를 취소했습니다",
  stale_batch_blocked: "끝나지 않은 이전 가져오기가 남아 있습니다 — 치우지 못했습니다",
}

/**
 * 제외 사유 → 사람이 읽는 말. 코드값을 그대로 보이면 사용자가 알 수 없다.
 *
 * **대시보드의 「일부 제외」 배너도 이걸 쓴다** — 같은 사유를 두 화면이 다른 말로
 * 부르면 사용자는 서로 다른 일이 일어난 줄 안다.
 */
export const EXCLUSION_LABEL: Record<string, string> = {
  total: "합계 행",
  subtitle: "제목·설명 행",
  blank: "빈 행",
  "trailing-blank": "끝의 빈 행",
  error: "읽지 못한 행 — 필수 값이 비었거나 사전에 없는 값",
}
