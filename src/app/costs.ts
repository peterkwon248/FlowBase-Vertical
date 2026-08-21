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

/**
 * 광고 캠페인 한 줄. 금액은 **원 단위 수**로 온다 — 포맷은 이 파일이 한다.
 *
 * `direct`·`noKey`·`noListing`·`noLink`는 ADR-022의 배분 3갈래(+직접)이고
 * 넷의 합이 `spend`와 같다. 「배분 규칙」 칸이 이 넷을 문장으로 바꾼다.
 */
export interface AdCampaign {
  readonly channel: string
  readonly name: string
  readonly type: string
  readonly spend: number
  readonly clicks: number
  readonly convRev: number
  readonly direct: number
  readonly noKey: number
  readonly noListing: number
  readonly noLink: number
}

export interface CostsView {
  readonly fixed: readonly OverheadItem[]
  readonly ops: readonly OverheadItem[]
  /** 이 기간의 광고 캠페인. **빈 배열과 «광고를 안 한다»는 다르다** (§22). */
  readonly ads: readonly AdCampaign[]
  /**
   * 「두지 않습니다」 선언. **행이 없으면 미선언**이고, 그때만 앱이 묻는다 —
   * `null`과 `{stance:"none"}`은 다른 것이다 (§22 «부재는 boolean이 아니다»).
   */
  readonly stance: {
    readonly fixed: OverheadStance | null
    readonly ops: OverheadStance | null
  }
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

  /**
   * ★ 운영비는 초안을 따로 든다 ★
   *
   * 고정비와 한 벌을 쓰면 «고정비 적용일을 고르고 운영비를 저장»했을 때 운영비가
   * 조용히 남의 날짜로 들어간다. 두 블록은 화면에서도 떨어져 있고 저장 버튼도
   * 둘이라, 초안도 둘이어야 «내가 고른 날짜»가 참이 된다.
   */
  readonly opsAmounts: ReadonlyMap<string, string>
  readonly opsEffectiveFrom: string
  readonly opsNewLabel: string
  readonly opsNewAmount: string
  /**
   * 새 운영비의 **부담 기준**. 고정비에는 이 칸이 없다 — 010 스키마가
   * `FIXED`는 `MONTH`만 쓴다고 못박았기 때문이다(「얼마를 팔든」이 정의다).
   * 운영비는 사람이 골라야 한다: 택배비는 주문당, 포장재는 개당이다.
   */
  readonly opsNewBasis: "ORDER" | "UNIT"

  /**
   * 지금 보고 있는 탭. **초안에 둔다** — 화면 상태이지 저장할 값이 아니고,
   * 달을 바꿔도(=view가 새로 와도) 보던 탭이 유지돼야 하기 때문이다.
   */
  readonly tab: "ad" | "ops"
}

export const emptyCostsDraft = (today: string): CostsDraft => ({
  amounts: new Map(),
  effectiveFrom: today,
  newLabel: "",
  newAmount: "",
  opsAmounts: new Map(),
  opsEffectiveFrom: today,
  opsNewLabel: "",
  opsNewAmount: "",
  // 기본을 「주문당」으로 둔다 — 실물에서 가장 흔한 운영비가 택배비다.
  opsNewBasis: "ORDER",
  // 기본은 운영·고정비 — 광고를 안 하는 셀러에게 광고비가 첫 화면이면 안 된다.
  tab: "ops",
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

  // ── 운영비 (같은 모양, 다른 kind) ────────────────────────────────
  readonly setOpsAmount: (label: string, value: string) => void
  readonly setOpsEffectiveFrom: (date: string) => void
  readonly setOpsNewLabel: (v: string) => void
  readonly setOpsNewAmount: (v: string) => void
  readonly setOpsNewBasis: (v: string) => void
  readonly opsSave: () => void
  readonly opsAdd: () => void
  readonly toggleOpsNone: () => void
  /** 탭 전환. 읽기라 잠금을 묻지 않는다 — `pickMonth`와 같은 판단이다. */
  readonly pickTab: (t: "ad" | "ops") => void
  readonly setOpsNoneReason: (reason: string) => void
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
  setOpsAmount: () => {},
  setOpsEffectiveFrom: () => {},
  setOpsNewLabel: () => {},
  setOpsNewAmount: () => {},
  setOpsNewBasis: () => {},
  opsSave: () => {},
  opsAdd: () => {},
  toggleOpsNone: () => {},
  setOpsNoneReason: () => {},
  pickTab: () => {},
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
 *
 * ★ 인자가 `CostsDraft`가 아니라 **필요한 두 칸**이다 ★ 고정비와 운영비가 같은
 * 판단을 쓰되 초안은 따로 들기 때문이다. 판단을 복사하면 한쪽만 고쳐지는 날이
 * 오고, 그날 두 블록이 다른 규칙으로 막힌다.
 */
export function saveGuard(d: {
  readonly amounts: ReadonlyMap<string, string>
  readonly effectiveFrom: string
}): { can: boolean; why: string } {
  const touched = [...d.amounts.entries()].filter(([, v]) => v.trim() !== "")
  if (touched.length === 0) return { can: false, why: "" }
  const bad = touched.filter(([, v]) => parseAmount(v) === null).map(([k]) => k)
  if (bad.length > 0) return { can: false, why: `숫자만 넣어 주세요 — ${bad.join(" · ")}` }
  if (!isDate(d.effectiveFrom)) return { can: false, why: "적용 시작일이 필요합니다" }
  return { can: true, why: "" }
}

export function addGuard(
  d: { readonly newLabel: string; readonly newAmount: string; readonly effectiveFrom: string },
  existing: readonly string[],
): { can: boolean; why: string } {
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

/** 채널 줄의 색 점. **구분색이지 의미색이 아니라** 순서대로 돌린다 (§21-4 · dashboard와 같은 판) */
const CH_COLORS = ["#4C8DFF", "#4CB782", "#BB6BD9", "#F2994A", "#E879B9", "#F2C94C"] as const

/**
 * 저장 코드 → 화면 말. **`GROWTH`를 그대로 그리지 않는다** (U-5: 저장 분류가
 * 화면의 언어를 지배하면 안 된다). 모르는 코드는 지어내지 않고 **원문 그대로**
 * 보인다 — 「기타」로 뭉개면 사용자가 파일에서 그 캠페인을 다시 못 찾는다 (U-7).
 */
const AD_TYPE_LABEL: Record<string, string> = { GROWTH: "매출성장", MANUAL: "수동", AUTO: "자동" }

/**
 * ★ 「배분 규칙」 칸 — 고르는 자리가 아니라 **말하는 자리**다 ★
 *
 * 목업은 여기에 `<select>`를 그렸다. 그런데 ADR-022가 **「배분 규칙을 발명하지
 * 않는다」**로 닫았다 — 배분은 파일의 「광고집행 옵션ID」가 이미 말하고 있고,
 * 안분이나 전환매출 비율로 나누면 **비용의 임자가 바뀐다**(A 광고를 보고 B를
 * 샀다고 B가 A의 광고비를 지는 게 아니다).
 *
 * 고를 것이 없는 select는 «못 누르는데 그려진 것»이라 U-3 위반이다. 그래서 이
 * 칸은 **그 캠페인의 돈이 지금 어디 있는지와 무엇을 하면 상품에 붙는지**를
 * 말한다. ADR-022가 미배분을 세 갈래로 센 이유가 정확히 그것이다 — 갈래마다
 * 사용자가 할 일이 다르다.
 */
function ruleNote(a: AdCampaign): { text: string; tone: string } {
  if (a.spend === 0) return { text: "—", tone: DIM }
  // 섞여 있으면 **가장 큰 갈래**를 말한다. 한 캠페인이 여러 옵션을 파는 것이 정상이고,
  // 네 갈래를 다 적으면 칸이 문단이 된다.
  const parts = [
    { k: "direct", v: a.direct },
    { k: "noLink", v: a.noLink },
    { k: "noListing", v: a.noListing },
    { k: "noKey", v: a.noKey },
  ].sort((x, y) => y.v - x.v)
  const top = parts[0]!
  const mixed = a.spend - top.v > 0 ? ` (${pct(top.v, a.spend)})` : ""
  switch (top.k) {
    case "direct":
      return { text: `상품에 배분됨${mixed}`, tone: G }
    case "noLink":
      // 실측에서 이 갈래가 압도적이었다 — 「막힌 것」이 아니라 **한 동작 남은 것**이다.
      return { text: `상품 연결하면 붙는다${mixed}`, tone: "var(--label-orange, #F2994A)" }
    case "noListing":
      return { text: `그 기간 주문 파일이 없다${mixed}`, tone: DIM }
    default:
      return { text: `파일이 상품을 안 말한다${mixed}`, tone: DIM }
  }
}

/**
 * 광고비 탭의 값. **새 조회는 캠페인 표 하나뿐이다** — KPI 넷은 손익 스냅샷의
 * `adSplit`이 이미 세어 둔 것과 같은 규칙이라 여기서 다시 더한다.
 *
 * ★ 왜 `pnl`을 안 쓰고 `ads`에서 다시 더하나 ★ 표와 KPI가 **같은 행 집합**에서
 * 나와야 「합이 안 맞는다」가 안 생긴다. 스냅샷은 기간·범위가 같아도 다른
 * 경로로 오므로, 둘이 갈리는 날 사용자는 어느 쪽이 참인지 알 수 없다.
 */
function adVals(vals: TemplateVals, ads: readonly AdCampaign[]): void {
  const sum = (f: (a: AdCampaign) => number): number => ads.reduce((s, a) => s + f(a), 0)
  const total = sum((a) => a.spend)
  const alloc = sum((a) => a.direct)

  vals.adTotal = `${won(total)}원`
  vals.adCount = String(ads.length)
  vals.adAlloc = `${won(alloc)}원`
  vals.adUnalloc = `${won(total - alloc)}원`

  /**
   * ROAS는 **전환매출이 있는 캠페인만**으로 낸다. 목업 부제가 「신규구매 캠페인
   * 제외」인데, 판정을 캠페인 «유형»이 아니라 **데이터 유무**로 한다 — 유형
   * 이름은 마켓마다 다르지만 「전환매출이 안 왔다」는 어디서나 같다 (LOCK 4).
   * 전환매출 0인 캠페인의 광고비를 분모에 넣으면 ROAS가 조용히 낮아진다.
   */
  const conv = ads.filter((a) => a.convRev > 0)
  const convRev = conv.reduce((s, a) => s + a.convRev, 0)
  const convSpend = conv.reduce((s, a) => s + a.spend, 0)
  // 0을 그리지 않는다 — 「ROAS 0」과 「잴 수 없다」는 다르다 (LOCK 6 · U-7).
  vals.adRoas = convSpend > 0 ? `${(convRev / convSpend).toFixed(2)}x` : "—"

  const channels = [...new Set(ads.map((a) => a.channel))]
  vals.adRows = ads.map((a) => {
    const rule = ruleNote(a)
    return {
      name: a.name,
      ch: a.channel,
      color: CH_COLORS[channels.indexOf(a.channel) % CH_COLORS.length],
      type: AD_TYPE_LABEL[a.type] ?? a.type,
      typeColor: DIM,
      spend: `${won(a.spend)}원`,
      clicks: a.clicks.toLocaleString(),
      convRev: a.convRev > 0 ? `${won(a.convRev)}원` : "—",
      // 전환매출이 없으면 ROAS 칸도 «—»다. 목업 각주가 그렇게 약속했다.
      roas: a.convRev > 0 && a.spend > 0 ? `${(a.convRev / a.spend).toFixed(2)}x` : "—",
      roasColor: a.convRev > a.spend ? G : a.convRev > 0 ? "var(--fg-2)" : DIM,
      rule: rule.text,
      ruleColor: rule.tone,
    }
  })
}

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
   * ★ 탭이 둘이다 (2026-08-21) ★
   * 목업은 셋(원가·광고비·운영·고정비)을 그렸다. 원가는 상품 화면이 가져갔으므로
   * 여기 남는 것은 **광고비와 운영·고정비 둘**이다. 없는 탭을 그려 놓고 누르면 빈
   * 화면이 나오는 것보다 있는 것만 두는 편이 정직하다 (U-3).
   *
   * 광고비 탭이 여태 없던 사유는 「배분할 재료가 없다」였는데 **014가 그것을
   * 무효로 만들었다** — `listing_key`가 열려 광고비가 상품까지 내려간다(ADR-022).
   * `wiring.ts`가 그 사실을 스스로 적어 두고도 탭은 안 만든 상태로 남아 있었다.
   */
  const tab = view.ads.length > 0 || draft.tab === "ad" ? draft.tab : "ops"
  vals.costTabs = [
    { label: "광고비", on: tab === "ad" ? "active" : "", pick: () => act.pickTab("ad") },
    { label: "운영·고정비", on: tab === "ops" ? "active" : "", pick: () => act.pickTab("ops") },
  ]
  vals.ctCogs = false
  vals.ctAd = tab === "ad"
  vals.ctOps = tab === "ops"

  adVals(vals, view.ads)

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
    name:
      o.historyCount > 1
        ? `${o.label}  ·  ${o.effectiveFrom.slice(0, 7)}부터 (이력 ${o.historyCount})`
        : `${o.label}  ·  ${o.effectiveFrom.slice(0, 7)}부터`,
    note: BASIS_NOTE[o.basis] ?? "",
    // 고정비 표와 같은 규율 — 초안이 있으면 그대로, 없을 때만 천 단위를 넣는다.
    amount: draft.opsAmounts.get(o.label) ?? won(o.amount),
    set: (e: { target?: { value?: string } } | undefined) =>
      act.setOpsAmount(o.label, e?.target?.value ?? ""),
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

  /**
   * ★ 운영비 제어부 (§21 «cost-ops-save» · 신설) ★
   *
   * ─────────────────────────────────────────────────────────────
   * 목업은 운영비 표를 그렸지만 **넣는 문이 없었다.** 시드가 채운 표만 있고 항목을
   * 더할 자리도, 적용일도 없었다 — 고정비에서 만난 것과 같은 결함이라 처방도 같다
   * (`cost-fixed-save`). 이 파일의 `opsRows` 주석이 그 사실을 예고해 뒀다:
   * *「넣는 화면이 생기는 순간 여기도 함께 살아야 한다」*.
   *
   * ★ 고정비와 한 자리 다르다 — **부담 기준** ★
   * 010 스키마가 `FIXED`는 `MONTH`만 쓴다고 못박았으므로 고정비에는 고를 것이
   * 없다. 운영비는 `ORDER`(주문당)와 `UNIT`(개당)로 갈리고, 그 선택이 손익을
   * 바꾼다 — 택배비 3,000원을 «주문당»으로 두면 주문 수만큼, «개당»으로 두면
   * 품목 수만큼 빠진다. 앱이 고를 수 없어서 사람이 고른다.
   * ─────────────────────────────────────────────────────────────
   */
  const opsExisting = view.ops.map((o) => o.label)
  const os = saveGuard({ amounts: draft.opsAmounts, effectiveFrom: draft.opsEffectiveFrom })
  const oa = addGuard(
    {
      newLabel: draft.opsNewLabel,
      newAmount: draft.opsNewAmount,
      effectiveFrom: draft.opsEffectiveFrom,
    },
    opsExisting,
  )
  const opsNone = view.stance.ops?.stance === "none"

  vals.opsDate = draft.opsEffectiveFrom
  vals.setOpsDate = (e: { target?: { value?: string } } | undefined) =>
    act.setOpsEffectiveFrom(e?.target?.value ?? "")
  vals.opsSave = act.opsSave
  vals.opsCanSave = os.can
  vals.opsSaveOpacity = os.can ? "1" : "0.45"
  vals.opsSaveWhy = os.why
  vals.opsNewName = draft.opsNewLabel
  vals.setOpsNewName = (e: { target?: { value?: string } } | undefined) =>
    act.setOpsNewLabel(e?.target?.value ?? "")
  vals.opsNewAmount = draft.opsNewAmount
  vals.setOpsNewAmount = (e: { target?: { value?: string } } | undefined) =>
    act.setOpsNewAmount(e?.target?.value ?? "")
  vals.opsBasis = draft.opsNewBasis
  vals.setOpsBasis = (e: { target?: { value?: string } } | undefined) =>
    act.setOpsNewBasis(e?.target?.value ?? "ORDER")
  vals.opsBasisOptions = [
    { value: "ORDER", label: "주문당" },
    { value: "UNIT", label: "개당" },
  ]
  vals.opsAdd = act.opsAdd
  vals.opsCanAdd = oa.can
  vals.opsAddOpacity = oa.can ? "1" : "0.45"
  vals.opsAddWhy = oa.why

  vals.opsNone = opsNone
  vals.opsNoneBg = opsNone ? "var(--accent)" : "transparent"
  vals.toggleOpsNone = act.toggleOpsNone
  vals.opsNoneReason = view.stance.ops?.reason ?? "in-cogs"
  vals.setOpsNoneReason = (e: { target?: { value?: string } } | undefined) =>
    act.setOpsNoneReason(e?.target?.value ?? "in-cogs")
  /**
   * ★ 「0원」과 「아직 안 넣었다」를 가른다 (§22) ★
   * 운영비가 비어 있으면 상품 기여이익이 «운영비를 뺀 값»으로 보이는데 실은
   * 안 뺀 것이다. 그 사실을 말하지 않으면 화면이 조용히 낙관한다.
   */
  vals.opsNoneNote = opsNone
    ? view.stance.ops?.reason === "in-cogs"
      ? "원가에 이미 들어 있다고 하셨습니다 — 여기 택배비·포장재를 또 넣으면 두 번 빠집니다."
      : "운영비를 두지 않기로 하셨습니다. 상품 기여이익에서 빠지는 운영비가 0입니다."
    : view.ops.length === 0
      ? "운영비가 없으면 상품 기여이익에서 아무것도 빠지지 않습니다 — 0인 것은 운영비가 없어서가 아니라 아직 안 넣어서입니다."
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
