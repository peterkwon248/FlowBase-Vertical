/**
 * 비용 화면 배선 — **손익 3층의 마지막 줄이 화면에 선다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 목업이 이 화면을 이미 그려 뒀다 ★
 *
 * `fixRows`·`opsRows`·`layerRows`가 전부 목업에 있었고 시드가 채우고 있었다.
 * `src/app`에서 참조는 **0건**이었다 — 그려 놓고 아무도 안 켠 화면이다.
 *
 * ★ 그런데 목업의 고정비 표가 두 가지를 못 한다 ★
 *
 * ```
 * ① 적용일이 없다      금액 칸만 있다. 「3월부터 임대료 인상」을 표현할 수 없다
 * ② 항목을 못 더한다    시드 4개가 고정이다. 사람마다 항목이 다른데
 * ```
 *
 * ①이 무겁다. 적용일 없이 저장하면 오늘 값이 **과거 전체에 소급**되고, 지난달
 * 순이익이 이번 달에 임대료를 고칠 때마다 바뀐다 — `product.ts`가 원가 칸에서
 * 만난 것과 **같은 문제**이고 처방도 같다.
 *
 * ★ 그래도 목업 표를 치우지 않는다 ★
 * 표는 「금액을 고친다」를 정확히 그렸다. 못 하는 것은 그 **옆**에 없는 것들이라,
 * 표를 갈아엎는 대신 아래에 제어부 한 블록을 신설한다(`data-s21="cost-fixed-save"`).
 * 수술 면적이 작을수록 목업과 어긋난 자리를 세기 쉽다.
 * ─────────────────────────────────────────────────────────────
 *
 * 계산도 조회도 여기 없다. 이 파일은 **모양만 만든다**.
 */

import type { Pnl } from "@core/profit/index.js"
import { proratedSpan } from "@core/profit/index.js"
import type { OverheadStance } from "@core/profit/snapshot.js"
import type { TemplateVals } from "./generated/vals.js"
import { won, signed, pct } from "./format.js"

const DIM = "var(--fg-4)"
const G = "var(--pnl-pos)"
const NEG = "var(--pnl-neg)"

/** 화면이 아는 한 항목. `history`는 「이 값이 몇 번 바뀌었나」를 말하는 데 쓴다. */
export interface OverheadItem {
  readonly label: string
  readonly basis: "MONTH" | "ORDER" | "UNIT"
  readonly amount: number
  readonly effectiveFrom: string
  readonly historyCount: number
}

export interface CostsView {
  readonly fixed: readonly OverheadItem[]
  readonly ops: readonly OverheadItem[]
  readonly stance: { readonly fixed: OverheadStance | null }
}

/**
 * 사람이 치고 있는 값들. **저장 전까지 DB에 안 간다** — 한 글자마다 쓰면
 * 이력 표에 쓰레기 행이 쌓인다(적용일이 같으면 덮으니 행은 안 늘지만, 매
 * 키 입력이 트랜잭션이 된다).
 */
export interface CostsDraft {
  /** 항목 이름 → 금액 초안. 비어 있으면 «안 건드렸다»이지 «0원»이 아니다. */
  readonly amounts: ReadonlyMap<string, string>
  /** 이 저장이 **언제부터** 적용되나. 표 전체에 하나다 — 아래 주석 참조. */
  readonly effectiveFrom: string
  readonly newLabel: string
  readonly newAmount: string
}

export const emptyCostsDraft = (today: string): CostsDraft => ({
  amounts: new Map(),
  effectiveFrom: today,
  newLabel: "",
  newAmount: "",
})

export interface CostsActions {
  readonly setAmount: (label: string, value: string) => void
  readonly setEffectiveFrom: (date: string) => void
  readonly setNewLabel: (v: string) => void
  readonly setNewAmount: (v: string) => void
  /** 고친 값들을 **한 번에** 저장한다. 적용일 하나가 전부에 붙는다. */
  readonly save: () => void
  readonly add: () => void
  /** 「고정비를 두지 않습니다」 켜고 끄기. 끄면 다시 «미선언»이다. */
  readonly toggleNone: () => void
  readonly setNoneReason: (reason: string) => void
}

const NOOP: CostsActions = {
  setAmount: () => {},
  setEffectiveFrom: () => {},
  setNewLabel: () => {},
  setNewAmount: () => {},
  save: () => {},
  add: () => {},
  toggleNone: () => {},
  setNoneReason: () => {},
}

/** 쉼표·공백·「원」을 걷어낸다. `parseCostDraft`와 같은 관용이다. */
export function parseAmount(raw: string): number | null {
  const t = raw.replace(/[,\s원]/g, "")
  if (t === "") return null
  if (!/^\d+$/.test(t)) return null
  return Number(t)
}

const isDate = (d: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(d)

/**
 * 저장 버튼을 누를 수 있나, 없으면 왜.
 *
 * §21-1대로 **누를 수 없으면 사유를 함께** 낸다. 아무 말 없이 회색인 버튼은
 * «고장»으로 읽힌다.
 */
export function saveGuard(d: CostsDraft): { can: boolean; why: string } {
  const touched = [...d.amounts.entries()].filter(([, v]) => v.trim() !== "")
  if (touched.length === 0) return { can: false, why: "" }
  const bad = touched.filter(([, v]) => parseAmount(v) === null).map(([k]) => k)
  if (bad.length > 0) return { can: false, why: `숫자만 넣어 주세요 — ${bad.join(" · ")}` }
  if (!isDate(d.effectiveFrom)) return { can: false, why: "적용 시작일이 필요합니다" }
  return { can: true, why: "" }
}

export function addGuard(d: CostsDraft, existing: readonly string[]): { can: boolean; why: string } {
  const name = d.newLabel.trim()
  if (name === "" && d.newAmount.trim() === "") return { can: false, why: "" }
  if (name === "") return { can: false, why: "항목 이름이 필요합니다" }
  if (existing.includes(name)) return { can: false, why: `「${name}」은 이미 있습니다` }
  if (parseAmount(d.newAmount) === null) return { can: false, why: "금액은 숫자만 넣어 주세요" }
  if (!isDate(d.effectiveFrom)) return { can: false, why: "적용 시작일이 필요합니다" }
  return { can: true, why: "" }
}

/** `MONTH|ORDER|UNIT` → 사람 말. 운영비 표의 「주문당」 칸이 이걸 쓴다. */
const BASIS_NOTE: Record<string, string> = { MONTH: "월", ORDER: "주문당", UNIT: "개당" }

/** 「두지 않는다」의 이유 코드 → 화면 문장. core의 코드값을 그대로 내보내지 않는다. */
export const NONE_REASON_LABEL: Record<string, string> = {
  "in-cogs": "원가에 이미 포함돼 있습니다",
  "not-applicable": "해당 없습니다",
}

export function costsVals(
  vals: TemplateVals,
  view: CostsView,
  pnl: Pnl,
  draft: CostsDraft,
  act: CostsActions = NOOP,
): void {
  /**
   * ★ 탭이 하나다 ★
   * 목업은 셋(원가·광고비·운영·고정비)을 그렸지만 배선된 것은 하나다. 없는 탭을
   * 그려 놓고 누르면 빈 화면이 나오는 것보다 **하나만 두는 편이 정직하다** —
   * 가져오기 위저드의 출처 탭(파일·URL·직접 입력 → 파일 하나)에서 세운 규율 그대로다.
   * 원가는 상품 화면에, 광고비는 아직 화면이 없다.
   */
  vals.costTabs = [{ label: "운영·고정비", on: "active", pick: () => {} }]
  vals.ctCogs = false
  vals.ctAd = false
  vals.ctOps = true

  // ── 고정비 표 (목업 그대로) ──────────────────────────────────────
  vals.fixRows = view.fixed.map((f) => ({
    name:
      f.historyCount > 1
        ? // 「몇 번 바뀌었나」를 말하면 사용자가 이력이 쌓이고 있다는 것을 안다.
          `${f.label}  ·  ${f.effectiveFrom.slice(0, 7)}부터 (이력 ${f.historyCount})`
        : `${f.label}  ·  ${f.effectiveFrom.slice(0, 7)}부터`,
    // 초안이 있으면 **그대로** 보인다 — 사람이 친 글자를 포맷하면 커서가 튄다.
    // 초안이 없을 때만 천 단위를 넣는다: `1800000`은 사람이 자릿수를 못 센다.
    // `parseAmount`가 쉼표를 걷어내므로 이대로 저장해도 된다.
    amount: draft.amounts.get(f.label) ?? won(f.amount),
    set: (e: { target?: { value?: string } } | undefined) =>
      act.setAmount(f.label, e?.target?.value ?? ""),
  }))

  /**
   * ★ 「이 기간 몫」의 분수를 **지어내지 않는다** ★
   * 목업은 「8일 / 31일」을 박아 뒀다 — 시드 기간의 값이다. 달을 걸치는 기간은
   * 하나의 분수로 말할 수 없으므로(7/20~8/10 = 12/31 + 10/31) 그때는 분수를 뺀다.
   */
  const span = proratedSpan(pnl.period)
  // 앞의 공백은 오타가 아니다 — 목업이 `이 기간 몫 <span>8일 / 31일</span>`이었는데
  // JSX 변환에서 그 사이 공백이 사라져 「이 기간 몫31일」로 붙어 나온다(렌더해서 봤다).
  // 템플릿에 `{" "}`를 넣으면 보존 게이트가 세는 텍스트가 하나 늘어나므로 값으로 낸다.
  vals.fixDays = span === null ? "" : ` ${span.covered}일 / ${span.inMonth}일`
  vals.fixTotal = `${won(pnl.fixed)}원`

  /**
   * ── 운영비 표 — **읽기 전용이다** ──────────────────────────────
   *
   * 저장 계층과 계산은 서 있지만(마이그레이션 010) **넣는 화면이 아직 없다.**
   * 요율의 기준(주문당 / 개당)을 고르는 자리가 필요한데 목업에 그 칸이 없어서,
   * 고정비와 같은 크기의 §21 신설이 한 번 더 든다 — 이번 세션에서 자른 범위다.
   *
   * ★ 화면이 그 사실을 여기서 말하지는 않는다 ★
   * 처음엔 §21-7 안내를 넣으려 했는데, 그러려면 또 마크업이 든다. 대신 이미 서
   * 있는 장치가 말한다 — 진단의 `ops-missing`이 「운영비 · 미입력 · 0원」과 함께
   * 「원가에 포함시켜 두셨다면 두지 않는다를 선언하세요」까지 낸다(§22). 같은
   * 사실을 두 곳에서 말하는 것보다 한 곳이 정확히 말하는 편이 낫다.
   *
   * 행의 `set`이 아무것도 안 하는 것은 **오늘 행이 0개라** 죽은 컨트롤이 화면에
   * 나오지 않기 때문이다. 넣는 화면이 생기는 순간 여기도 함께 살아야 한다.
   */
  vals.opsRows = view.ops.map((o) => ({
    name: o.label,
    note: BASIS_NOTE[o.basis] ?? "",
    amount: String(o.amount),
    set: () => {},
  }))
  vals.opsTotal = `${won(pnl.ops)}원`

  // ── 신설: 적용일 · 저장 · 항목 추가 · 「두지 않습니다」 ───────────
  const existing = view.fixed.map((f) => f.label)
  const s = saveGuard(draft)
  const a = addGuard(draft, existing)
  const none = view.stance.fixed?.stance === "none"

  vals.fixDate = draft.effectiveFrom
  vals.setFixDate = (e: { target?: { value?: string } } | undefined) =>
    act.setEffectiveFrom(e?.target?.value ?? "")
  vals.fixSave = act.save
  vals.fixCanSave = s.can
  // `disabled`만으로는 파란 primary 버튼이 그대로 파랗다 — 눌리는 줄 알고 누른다.
  // `product.ts`의 `saveOpacity`와 같은 처방이고, 같은 이유로 값으로 낸다.
  vals.fixSaveOpacity = s.can ? "1" : "0.45"
  vals.fixSaveWhy = s.why
  vals.fixNewName = draft.newLabel
  vals.setFixNewName = (e: { target?: { value?: string } } | undefined) =>
    act.setNewLabel(e?.target?.value ?? "")
  vals.fixNewAmount = draft.newAmount
  vals.setFixNewAmount = (e: { target?: { value?: string } } | undefined) =>
    act.setNewAmount(e?.target?.value ?? "")
  vals.fixAdd = act.add
  vals.fixCanAdd = a.can
  vals.fixAddOpacity = a.can ? "1" : "0.45"
  vals.fixAddWhy = a.why

  /**
   * ★ 「두지 않습니다」 — 안 넣는 것도 입력이다 (§22) ★
   *
   * 이 체크가 없으면 일부러 고정비를 두지 않는 사용자에게 진단이 영영
   * 「미입력」이라고 말한다. 지워지지 않는 경고 하나가 화면 전체를 안 보게 만들고,
   * **경고 하나가 죽으면 옆의 진짜 경고도 같이 죽는다.**
   */
  vals.fixNone = none
  vals.fixNoneBg = none ? "var(--accent)" : "transparent"
  vals.toggleFixNone = act.toggleNone
  vals.fixNoneReason = view.stance.fixed?.reason ?? "in-cogs"
  vals.setFixNoneReason = (e: { target?: { value?: string } } | undefined) =>
    act.setNoneReason(e?.target?.value ?? "in-cogs")
  vals.fixNoneNote = none
    ? // 원가에 포함이라고 한 사람에게는 **이중 차감**을 미리 경고한다.
      view.stance.fixed?.reason === "in-cogs"
      ? "원가에 이미 들어 있다고 하셨습니다 — 여기 임대료·인건비를 또 넣으면 두 번 빠집니다."
      : "고정비를 두지 않기로 하셨습니다. 회사 순이익이 채널 기여이익과 같습니다."
    : view.fixed.length === 0
      ? "고정비가 없으면 회사 순이익이 채널 기여이익과 같습니다 — 두 줄이 같은 수인 것은 고정비가 없어서가 아니라 아직 안 넣어서입니다."
      : ""

  // ── 손익 3층 ────────────────────────────────────────────────────
  vals.layerRows = layerRows(pnl)
  vals.layerNote = layerNote(pnl)
}

/**
 * 손익 3층 표 — **목업의 `rowL`을 그대로 옮겼다.**
 *
 * 산수를 여기서 하지 않는다. `pnl`이 이미 세 층을 다 갖고 있고(단일 계산기),
 * 이 함수는 **줄과 색만** 만든다. 목업이 여기서 `T.disc + T.fee + …`를 더하고
 * 있던 것을 옮겨오면 그 순간 계산기가 둘이 된다.
 */
export function layerRows(p: Pnl): {
  label: string
  value: string
  pct: string
  pad: string
  rule: string
  indent: string
  font: string
  fg: string
  numFont: string
  numColor: string
}[] {
  /**
   * 차감 줄의 값. **0원은 `−0`이 아니다** — 라벨이 이미 「− 운영비」라 값에 또
   * 음수 부호가 붙으면 «마이너스 영»이라는 없는 수가 된다. 렌더해서 보고 잡았다.
   */
  const minus = (n: number): string => (n === 0 ? "0" : `−${won(n)}`)
  const row = (
    label: string,
    n: number,
    value: string,
    o: Partial<{ indent: string; font: string; fg: string; numFont: string; numColor: string; pad: string; rule: string }> = {},
  ) => ({
    label,
    value,
    pct: pct(Math.abs(n), p.revenue),
    pad: "5px 0",
    rule: "none",
    indent: "10px",
    font: "var(--fw-regular) 12px var(--font-sans)",
    fg: "var(--fg-3)",
    numFont: "var(--fw-medium) 12px var(--font-sans)",
    numColor: "var(--fg-3)",
    ...o,
  })
  const strong = (n: number) => ({
    pad: "9px 0",
    rule: "1px solid var(--border)",
    indent: "0",
    font: "var(--fw-semi) 13px var(--font-sans)",
    fg: "var(--fg)",
    numFont: "var(--fw-semi) 14px var(--font-sans)",
    numColor: n >= 0 ? G : NEG,
  })
  const deductions = p.discount + p.fee + p.vat + p.shipping
  return [
    row("매출", p.revenue, won(p.revenue), {
      indent: "0",
      font: "var(--fw-medium) 12px var(--font-sans)",
      fg: "var(--fg-2)",
      numColor: "var(--fg-2)",
    }),
    row("− 할인 · 수수료 · VAT · 배송", deductions, minus(deductions)),
    // 목업에는 없던 줄이다 — 클레임은 `computePnl`이 빼는데 3층 표에 안 보이면
    // 「매출 − 항목들 = 기여이익」이 안 맞는다. 화면이 자기모순이 된다.
    row("− 클레임 (취소·반품)", p.claims, minus(p.claims)),
    row("− 매입원가", p.cogs, minus(p.cogs)),
    row("− 직접 광고비", p.adDirect, minus(p.adDirect)),
    row("− 운영비", p.ops, minus(p.ops)),
    row("상품 기여이익", p.productContribution, signed(p.productContribution), strong(p.productContribution)),
    row("− 미배분 광고비 (전사)", p.adUnallocated, minus(p.adUnallocated)),
    row("채널 기여이익", p.channelContribution, signed(p.channelContribution), strong(p.channelContribution)),
    row("− 고정비", p.fixed, minus(p.fixed)),
    row("회사 순이익", p.netProfit, signed(p.netProfit), {
      ...strong(p.netProfit),
      rule: "2px solid var(--border)",
    }),
  ]
}

/**
 * 3층 표 아래 한 문장 — **왜 두 수가 다른지.**
 *
 * ★ 차이가 0일 때 다른 말을 한다 ★
 * 목업 문장은 「차이는 A원과 B원입니다」인데 둘이 0이면 «차이는 0원과 0원입니다»가
 * 된다. 그건 문장이 아니고, 사용자는 그때 **왜 두 줄이 같은지**를 궁금해한다 —
 * 그 질문에 답하는 것이 이 자리의 일이다.
 */
export function layerNote(p: Pnl): string {
  const gap = p.adUnallocated + p.fixed
  if (gap === 0) {
    return (
      `상품별 손익을 다 더하면 ${won(p.productContribution)}원이고 회사 순이익도 같습니다 — ` +
      `상품에 배분하지 않은 전사 광고비와 고정비가 둘 다 0원이기 때문입니다. ` +
      `고정비를 넣으면 두 줄이 갈라집니다.`
    )
  }
  const parts = [
    p.adUnallocated > 0 ? `전사 광고비 ${won(p.adUnallocated)}원` : "",
    p.fixed > 0 ? `고정비 ${won(p.fixed)}원` : "",
  ].filter((x) => x !== "")
  return (
    `상품별 손익을 다 더하면 ${won(p.productContribution)}원이지만 회사 순이익은 ` +
    `${won(p.netProfit)}원입니다. 차이는 상품에 배분하지 않은 ${parts.join("과 ")}입니다.`
  )
}

/** 눈에 띄지 않게 두는 색 — 위 표가 쓰는 것과 같은 토큰. */
export const COSTS_DIM = DIM
