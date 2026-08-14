/**
 * 상품 화면 배선 — **사슬 ③, 원가가 앱에 들어오는 문.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 목업의 원가 입력이 세 가지를 못 한다 ★
 *
 * ```
 * ① 초안이 화면에 하나뿐이다   costDraft 하나를 61행이 공유 → 한 칸에 치면 61칸에 뜬다
 * ② 적용일이 없다             원가는 시계열인데 «언제부터»를 물을 자리가 없다
 * ③ 채운 뒤엔 못 고친다        costFilled 분기가 읽기 전용 텍스트다
 * ```
 *
 * ②가 특히 무겁다. 목업의 `costQuick`은 SKU당 숫자 하나라 «8월부터 원가가 올랐다»를
 * 표현할 수 없고, 그 모델대로 저장하면 **과거 주문에 새 원가가 소급 적용된다** —
 * 7월 손익이 8월에 원가를 고칠 때마다 바뀐다. 001의 `cost_history`는 처음부터
 * `effective_from`을 갖고 있었으므로, 여기서 목업을 따라가면 스키마가 이미 답을
 * 아는 문제를 화면이 되묻게 만드는 꼴이다.
 *
 * 그래서 매입원가 칸을 **구간째 갈아끼운다** (`data-s21="cost-input"`).
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 원가는 조정이 아니다 (§15와 갈리는 자리) ★
 * Fact 행 인라인 편집은 금지지만(LOCK 9) 원가는 Fact가 아니라 **기준 데이터**다.
 * 기준 데이터의 정상 경로가 «수동 편집 + 변경 이력»이고, 이 화면이 그 «수동 편집»,
 * `cost_history`가 그 «변경 이력»이다. 조정 레이어를 태우지 않는 이유는
 * `core/cost/index.ts` 머리말에 있다.
 */

import type { ProductSkuRow, ProductView } from "@core/product/rows.js"
import { COST_PROBLEM_TEXT, parseCostDraft } from "@core/cost/index.js"
import type { TemplateVals } from "./generated/vals.js"
import { won } from "./format.js"

const DIM = "var(--fg-4)"
const WARN = "var(--pnl-warn, #F2994A)"

/** 목업 L4864의 두 탭. `list`는 판매중(ACTIVE), `draft`는 판매 대기(DRAFT). */
export type ProdTab = "list" | "draft"

/** 한 행의 입력 초안. **SKU마다 따로다** — 목업의 결함 ①이 여기서 닫힌다. */
export interface CostDraftState {
  readonly amount: string
  readonly effectiveFrom: string
}

export interface ProductActions {
  readonly pickTab: (t: ProdTab) => void
  readonly setDraft: (skuId: string, patch: Partial<CostDraftState>) => void
  /** 저장. 같은 날짜가 이미 있으면 **묻고 나서** 덮는 것은 App이 한다. */
  readonly save: (row: ProductSkuRow) => void
}

const NOOP: ProductActions = { pickTab: () => {}, setDraft: () => {}, save: () => {} }

/**
 * 초안의 기본값 — **금액은 비우고 날짜는 오늘.**
 *
 * 날짜에 기본값을 두는 이유는, 대부분의 입력이 «지금부터 이 원가»이기 때문이다.
 * 그렇다고 숨기지 않는다(상시 노출) — 기본값을 숨기면 사용자는 자기가 **오늘부터**를
 * 선택했다는 사실을 모른 채 저장하고, 7월 주문에 원가가 안 붙은 이유를 영영 모른다.
 */
export const emptyDraft = (today: string): CostDraftState => ({ amount: "", effectiveFrom: today })

/** `2026-08-14` → `8/1부터`. 원가가 «언제부터»인지 한 칸에 넣기 위한 축약. */
export function fromLabel(d: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(d)
  return m ? `${Number(m[1])}/${Number(m[2])}부터` : `${d}부터`
}

/**
 * 저장 버튼을 누를 수 있나, 없으면 왜.
 *
 * §21-1대로 **누를 수 없으면 사유를 함께** 낸다. 아무 말 없이 회색인 버튼은
 * «고장»으로 읽힌다 — 가져오기 위저드의 막힌 후보에서 세운 규율과 같다.
 */
export function saveGuard(d: CostDraftState): { can: boolean; why: string } {
  // 아직 아무것도 안 친 칸은 «틀렸다»가 아니다. 61행이 전부 빨개지면 화면이
  // 사용자를 나무라는 꼴이 된다 (§22의 «숙제 검사 금지»와 같은 감각).
  if (d.amount.trim() === "") return { can: false, why: "" }
  const p = parseCostDraft(d)
  if (p.ok) return { can: true, why: "" }
  return { can: false, why: p.problems.map((x) => COST_PROBLEM_TEXT[x]).join(" · ") }
}

/** `2026-07-01`~`2026-07-31` → `2026-07`. 한 달 안이 아니면 양끝을 그대로 보인다. */
export function periodLabel(p: { from: string; to: string }): string {
  const a = p.from.slice(0, 7)
  return a === p.to.slice(0, 7) ? a : `${p.from} ~ ${p.to}`
}

export function productVals(
  vals: TemplateVals,
  view: ProductView,
  tab: ProdTab,
  drafts: ReadonlyMap<string, CostDraftState>,
  today: string,
  act: ProductActions = NOOP,
  /**
   * 판매 수량 칸이 **어느 기간**인지. 목업은 머리글에 «8월»을 박아 뒀는데 그건
   * 시드의 달이라 데이터가 7월이 되는 순간 거짓이 된다 (결함 61 · 47 계열).
   * 머리글에서 달을 빼고 **여기서 데이터로 말한다.**
   */
  period?: { from: string; to: string },
): void {
  const rows = view.rows.filter((r) => (tab === "draft" ? r.status === "DRAFT" : r.status === "ACTIVE"))

  vals.prodTabs = [
    { label: "판매중", count: view.rows.filter((r) => r.status === "ACTIVE").length },
    { label: "판매 대기", count: view.rows.filter((r) => r.status === "DRAFT").length },
  ].map((t, i) => {
    const id: ProdTab = i === 0 ? "list" : "draft"
    return { label: t.label, count: t.count, on: tab === id ? "active" : "", pick: () => act.pickTab(id) }
  })

  vals.prodListTab = true
  vals.isDraftTab = tab === "draft"

  /**
   * ★ 게이지의 분모는 **SKU 수**다 ★
   * 원가는 «하나라도»가 아니라 «전부»여야 열린다(§22). 품목 수나 주문 수로 세면
   * 많이 팔린 SKU 하나만 넣어도 게이지가 꽉 차 보이고, 그건 «거의 다 됐다»는
   * 거짓 신호가 된다.
   */
  // 기간은 판매 수량 칸에만 걸린다 — 원가·연결은 «기준»이라 기간과 무관하다.
  const span = period === undefined ? "" : `${periodLabel(period)} 판매 · `
  vals.prodHint =
    tab === "draft"
      ? "판매 대기 SKU는 손익 집계에서 제외됩니다 — 원가는 미리 넣어 둘 수 있습니다."
      : `${span}원가 ${won(view.costed)}/${won(view.total)} SKU`

  vals.costGauge = {
    costed: view.costed,
    total: view.total,
    // 0으로 나누지 않는다. SKU가 없으면 게이지가 «0%»가 아니라 «없음»이다.
    pctWidth: view.total === 0 ? "0%" : `${Math.round((view.costed / view.total) * 100)}%`,
    text:
      view.total === 0
        ? "연결된 SKU가 아직 없습니다"
        : view.costed === view.total
          ? `원가 ${won(view.total)}/${won(view.total)} — 전부 입력됐습니다`
          : `원가 ${won(view.costed)}/${won(view.total)} — ${won(view.total - view.costed)}개가 남았습니다`,
    color: view.total > 0 && view.costed === view.total ? "var(--pnl-pos, #4CB782)" : WARN,
    /**
     * ★ 게이지가 꽉 차도 손익은 안 움직인다는 사실을 여기서 말한다 ★
     * 커버리지는 «존재»를, gaps는 «온전함»을 맡는다(§22-3-b). 이 줄은 후자다 —
     * 원가를 다 넣은 사용자가 대시보드에서 매입원가 0원을 보고 «저장이 안 됐나»
     * 하는 것을 막는 자리이고, 품목 적재가 생기면 **스스로 사라진다.**
     */
    note:
      view.ordersWithoutItems === 0
        ? ""
        : `이 기간 주문 ${won(view.ordersWithoutItems)}건에는 품목이 붙어 있지 않아, ` +
          `원가를 넣어도 그 주문의 손익에는 반영되지 않습니다 — 그 파일을 다시 넣으면 붙습니다.`,
  }

  vals.skuRows = rows.map((r) => {
    const d = drafts.get(r.skuId) ?? emptyDraft(today)
    const g = saveGuard(d)
    return {
      sellerSku: r.code,
      name: r.name,

      // ── 목업 분기의 재해석 ──
      // `costEmpty`는 이제 «입력칸을 그린다»이고 늘 참이다. 원가가 있는 행도
      // 고칠 수 있어야 하기 때문이다(목업 결함 ③). 값의 유무는 `costFilled`가 진다.
      costEmpty: true,
      costFilled: r.cost !== null,
      cost: r.cost === null ? "" : `${won(r.cost)}원 · ${fromLabel(r.costFrom ?? "")}`,

      // ── 새 구간(`data-s21="cost-input"`)이 읽는 값 ──
      costDraft: d.amount,
      dateDraft: d.effectiveFrom,
      setCost: (e: { target?: { value?: string } }) =>
        act.setDraft(r.skuId, { amount: e?.target?.value ?? "" }),
      setDate: (e: { target?: { value?: string } }) =>
        act.setDraft(r.skuId, { effectiveFrom: e?.target?.value ?? "" }),
      saveCost: (e?: { stopPropagation?: () => void }) => {
        e?.stopPropagation?.()
        if (!g.can) return
        act.save(r)
      },
      canSave: g.can,
      saveWhy: g.why,
      saveOpacity: g.can ? "1" : "0.45",
      // 이력이 둘 이상이면 그 사실을 말한다. «지금 값»만 보이면 사용자는 자기가
      // 과거 원가를 덮은 줄 알고, 실제로는 새 줄이 쌓인 것이라 오해가 반대로 생긴다.
      histNote: r.costEntries > 1 ? `이력 ${won(r.costEntries)}건` : "",

      // ── 아직 데이터가 없는 칸은 «—»다. 지어내지 않는다 ──
      // 기준 판매가는 어느 파일에도 없다(마켓 리스팅의 판매가를 적재하지 않는다).
      // 마진율은 그 판매가가 있어야 나오는 파생값이라 함께 «—»가 된다.
      price: "—",
      margin: "—",
      marginColor: DIM,
      chips: r.channels.map((c) => ({ label: c, color: DIM })),
      qty: r.soldQty === null ? "—" : won(r.soldQty),
      net: r.status === "DRAFT" ? "손익 제외" : "—",
      netColor: DIM,
      // 상세 패널은 아직 없다. 어포던스를 그리지 않는다 (§21-1)
      click: () => {},
    }
  })
}

/**
 * 같은 적용일이 이미 있을 때의 확인 문구 (§21-1 «되돌릴 수 없는 일은 묻는다»).
 *
 * **덮이는 값을 숫자로 보여준다.** «정정할까요?»만 물으면 사용자는 무엇이 사라지는지
 * 모른 채 예를 누르고, 그 값은 `row_shadow`가 없어(Fact가 아니다) 되찾을 수 없다.
 */
export function replaceConfirmRows(
  row: ProductSkuRow,
  previous: number,
  next: number,
  effectiveFrom: string,
): { readonly k: string; readonly v: string }[] {
  return [
    { k: "SKU", v: `${row.code} · ${row.name}` },
    { k: "적용 시작일", v: effectiveFrom },
    { k: "지금 값", v: `${won(previous)}원` },
    { k: "바꿀 값", v: `${won(next)}원` },
  ]
}
