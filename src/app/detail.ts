/**
 * §21-2 **L2 근거 패널** — 표의 숫자에서 그 숫자가 어떻게 나왔는지로 내려간다.
 *
 * ★ 새 마크업이 없다 ★
 * 목업이 `<aside className="detail-side">`를 이미 그려 뒀고(`Template.tsx`), 타입도
 * `vals.detail`로 있었다. **없던 것은 배선뿐이다** — 다섯 표가 전부
 * `click: () => {}`였고 `hasDetail`에 대입하는 코드가 0곳이라 이 패널은
 * **한 번도 렌더된 적이 없다.** CSS(`vector-app.css:971` · 좁은 화면 분기까지)도
 * 처음부터 있었다. 그래서 이 파일은 「짓기」가 아니라 「잇기」다 (조사 1.7).
 *
 * ★ 왜 지금인가 ★
 * §21-5가 「derived 값은 **근거 경로 없이 렌더되지 않는다**」고 못박았는데 전 화면이
 * 그 반대였다. `tests/user-invariants.test.ts`의 U-6이 그 어긋남을 «갚을 빚»으로
 * 세고 있었고, 이 파일이 그 빚을 0으로 만든다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★★ 스냅샷이 아니라 **키**를 든다 ★★
 *
 * 열린 패널은 「그때 본 숫자」를 복사해 두지 않는다. `DetailTarget`은 **어느 행인가**
 * 만 들고, 값은 매 렌더마다 화면이 그리는 것과 **같은 배열**에서 다시 찾는다.
 *
 * 복사해 두면 가져오기·되돌리기·조정 뒤에 **표와 패널이 다른 숫자를 말한다.** 이
 * 저장소가 이미 두 번 겪은 실패다(주문 화면 품목 «—» · 할인 3단). 근거를 보여주는
 * 자리가 근거와 어긋나면 그 자리는 없느니만 못하다.
 *
 * 대상이 사라지면(기간을 옮겼다 · 되돌렸다) **패널이 안 뜬다.** 그것은 LOCK 6이 말하는
 * 「조용한 실패」가 아니다 — 읽지 못한 데이터가 아니라 **주제가 화면 밖으로 나간 것**이고,
 * 표에서도 그 행이 함께 사라져 있다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 안 만든 것과 그 이유 ★
 * §21-2가 L2에 적은 것 중 **「이번 달 달라진 것 4종」(신선도 · 대사 잔액 · 조정 건수 ·
 * 매핑 버전 변경)과 「다음/이전 연속 이동」은 넣지 않았다.** 동결 마크업에 그 슬롯이
 * 없고(§21은 목업을 이기지만 그 예외는 §21이 **명시한 목록**에만 열린다 — 여기서
 * 새 요소를 지어내면 E-1 위반이다), 넷 중 셋은 화면이 든 뷰 타입에 아직 없는 값이다.
 * L1(호버 정의) · L3(계보)는 마크업 자체가 없어 **별건**이다 (조사 3.3).
 */

import type { ChannelRow, ProfitRow } from "@core/profit/rows.js"
import type { OrderRow } from "@core/order/rows.js"
import type { SettlementRow } from "@core/settlement/rows.js"
import { adjustmentKey } from "@core/settlement/rows.js"
import type { ProductSkuRow } from "@core/product/rows.js"
import type { Period } from "@core/profit/index.js"
import type { TemplateVals } from "./generated/vals.js"
import { signed, won } from "./format.js"

const DIM = "var(--fg-4)"
const FG = "var(--fg)"
const FG2 = "var(--fg-2)"
const FG3 = "var(--fg-3)"
const GREEN = "var(--pnl-pos, #4CB782)"
const RED = "var(--pnl-neg, #EB5757)"
const WARN = "var(--label-orange, #F2994A)"

/** 합계 줄 위에 긋는 선. 나머지 줄은 선이 없다. */
const RULE = "1px solid var(--border)"

/** 열려 있는 근거 패널이 가리키는 행. **값이 아니라 주소다** (위 주석). */
export type DetailTarget =
  | { readonly kind: "product"; readonly key: string }
  | { readonly kind: "channel"; readonly key: string }
  | { readonly kind: "order"; readonly key: string }
  | { readonly kind: "settlement"; readonly key: string }
  | { readonly kind: "sku"; readonly key: string }

/**
 * 상품별 손익 행의 주소. `skuId`가 `null`인 행(«SKU에 연결되지 않은 판매»)은
 * `loadProfitRows`가 `GROUP BY ml.sku_id`로 **하나로 접으므로** 기간 안에 최대
 * 한 줄이다 — 빈 문자열이 그 한 줄의 주소가 된다.
 */
export const productKey = (r: ProfitRow): string => r.skuId ?? ""

export const channelKey = (r: ChannelRow): string => r.connectionId

export const skuKey = (r: ProductSkuRow): string => r.skuId

export const settlementDetailKey = (r: SettlementRow): string =>
  adjustmentKey(r.settledOn, r.connectionId)

/**
 * 주문 행의 주소.
 *
 * ⚠ **`OrderRow`에는 id가 없다.** 표가 그리는 것은 조회가 접어 만든 행이지 저장된
 * 행 하나가 아니라서다(주문 + 딸린 클레임). 그래서 **보이는 값들로 자연키를 만든다** —
 * 인덱스를 쓰면 재조회로 순서가 바뀌는 순간 패널이 **엉뚱한 주문**을 설명한다.
 *
 * 완전히 같은 (종류 · 시각 · 채널 · 상태 · 금액 · 클레임금액) 행이 둘이면 앞엣것을 잡는다.
 * 그 둘은 화면에서도 **글자 하나 다르지 않은 두 줄**이라 사용자가 겪는 차이가 없다.
 */
export const orderKey = (r: OrderRow): string =>
  [r.kind, r.at, r.channel, r.status, r.amount, r.claimAmount].join("|")

/** 패널이 재료로 쓰는, 지금 화면이 든 것 전부. */
export interface DetailData {
  readonly period: Period
  readonly products: readonly ProfitRow[]
  readonly channels: readonly ChannelRow[]
  readonly orders: readonly OrderRow[]
  readonly settlements: readonly SettlementRow[]
  readonly skus: readonly ProductSkuRow[]
}

export interface DetailActions {
  readonly close: () => void
  /** 「…에서 열기」 — 근거를 더 보려면 그 화면으로 간다. L3가 아니라 **가로 이동**이다. */
  readonly go: (view: "products" | "linking" | "settlement" | "orders") => void
}

interface Line {
  readonly rule: string
  readonly op: string
  readonly opColor: string
  readonly label: string
  readonly labColor: string
  readonly value: string
  readonly font: string
  readonly color: string
}

interface Prov {
  readonly label: string
  readonly value: string
  readonly color: string
}

const line = (op: string, label: string, value: string, color = FG2): Line => ({
  rule: "",
  op,
  opColor: op === "" ? "transparent" : DIM,
  label,
  labColor: FG3,
  value,
  font: "var(--fw-medium) 11px",
  color,
})

/** 합계 줄 — 위에 선을 긋고 한 단계 굵게 쓴다. */
const total = (label: string, value: string, color: string): Line => ({
  rule: RULE,
  op: "=",
  opColor: FG3,
  label,
  labColor: FG2,
  value,
  font: "var(--fw-semi) 12px",
  color,
})

/**
 * **배분하지 않은 항목** 줄. 0원이 아니라 «—»다 (§22 — 부재는 0이 아니다).
 *
 * 0으로 그리면 「이 상품은 수수료가 안 나갔다」로 읽힌다. 실제로는 나갔고 우리가
 * 상품까지 나누지 않았을 뿐이다 — 표의 `fee` · `ship` · `ad` 칸이 이미 «—»인 것과
 * 같은 판단이고, 패널이 표와 다른 말을 하면 안 된다.
 */
const unallocated = (label: string): Line => ({
  rule: "",
  op: "",
  opColor: "transparent",
  label,
  labColor: DIM,
  value: "—",
  font: "var(--fw-medium) 11px",
  color: DIM,
})

const prov = (label: string, value: string, color = FG3): Prov => ({ label, value, color })

const periodLine = (p: Period): Prov => prov("기간", `${p.from} ~ ${p.to}`)

const money = (n: number): string => `${won(n)}원`

interface Panel {
  readonly title: string
  readonly sub: string
  readonly lines: readonly Line[]
  readonly prov: readonly Prov[]
  readonly adj?: readonly { readonly head: string; readonly body: string }[]
  readonly actions?: readonly { readonly label: string; readonly run: () => void }[]
}

// ── 상품별 손익 (대시보드) ────────────────────────────────────────────

function productPanel(r: ProfitRow, d: DetailData, act: DetailActions): Panel {
  const linked = r.skuId !== null
  const net = r.revenue - r.discount - r.cogs
  return {
    // 표와 **같은 이름**을 쓴다. 표에서 «SKU에 연결되지 않은 판매»를 누른 사람에게
    // 패널이 원본 상품명을 띄우면 다른 행을 연 것처럼 보인다.
    title: linked ? r.name : "SKU에 연결되지 않은 판매",
    sub: linked
      ? `SKU ${r.code} · ${r.qty.toLocaleString()}개 판매`
      : `${r.qty.toLocaleString()}개 판매 · 리스팅이 아직 SKU에 붙지 않았습니다`,
    lines: [
      line("+", "매출", money(r.revenue)),
      line("−", "할인", r.discount === 0 ? "—" : money(r.discount), r.discount === 0 ? DIM : FG2),
      // 원가를 모르는 수량이 있으면 그 사실을 **이 줄에서** 말한다. 아래 출처에만
      // 적으면 사용자는 이익 숫자를 먼저 믿는다.
      line(
        "−",
        r.noCostQty > 0 ? "매입원가 (일부 미입력)" : "매입원가",
        r.cogs === 0 && r.noCostQty > 0 ? "미입력" : money(r.cogs),
        r.noCostQty > 0 ? WARN : FG2,
      ),
      unallocated("수수료·배송비·광고비 (상품에 배분하지 않음)"),
      // 표의 열 이름과 **같은 말**이다 — 「기여이익(부분)」(`dashboard.ts`의 sortCols).
      // 「순이익」이 아닌 이유는 위 줄이 빠져 있기 때문이고, 이름이 그 사실을 진다.
      total("기여이익(부분)", `${signed(net)}원`, net >= 0 ? GREEN : RED),
    ],
    prov: [
      periodLine(d.period),
      prov("판매 수량", `${r.qty.toLocaleString()}개`),
      prov(
        "원가",
        r.noCostQty === 0
          ? "전 수량에 반영됨"
          : `${r.noCostQty.toLocaleString()}개는 원가 미입력 — 이익이 실제보다 큽니다`,
        r.noCostQty === 0 ? FG3 : WARN,
      ),
      prov("SKU 연결", linked ? "연결됨" : "연결되지 않음", linked ? FG3 : WARN),
    ],
    actions: linked
      ? [{ label: "상품 화면에서 열기", run: () => act.go("products") }]
      : [{ label: "상품 연결 화면으로", run: () => act.go("linking") }],
  }
}

// ── 채널별 손익 (대시보드) ────────────────────────────────────────────

function channelPanel(r: ChannelRow, d: DetailData, act: DetailActions): Panel {
  const net = r.revenue - r.cogs - r.claims - r.fee
  // `fee === 0`은 «수수료가 없다»가 아니라 대개 «이 채널 정산 파일이 아직 안
  // 이어졌다»이다 (`ChannelRow.fee` 주석). 0을 말없이 그리면 그 채널이 제일
  // 남는 채널로 보인다 — 말한다 (LOCK 6).
  const noFee = r.fee === 0
  return {
    title: r.name,
    sub: `주문 ${r.orderCount.toLocaleString()}건`,
    lines: [
      line("+", "매출", money(r.revenue)),
      line("−", "매입원가", money(r.cogs)),
      line("−", "클레임", r.claims === 0 ? "—" : money(r.claims), r.claims === 0 ? DIM : FG2),
      line(
        "−",
        noFee ? "마켓 수수료 (정산 미연결)" : "마켓 수수료",
        noFee ? "—" : money(r.fee),
        noFee ? WARN : FG2,
      ),
      unallocated("광고비·운영비 (채널에 배분하지 않음)"),
      total("기여이익(부분)", `${signed(net)}원`, net >= 0 ? GREEN : RED),
    ],
    prov: [
      periodLine(d.period),
      prov("주문", `${r.orderCount.toLocaleString()}건`),
      prov(
        "수수료 출처",
        noFee
          ? "이 채널 주문에 이어진 정산 행이 없습니다 — 0이 아니라 «모름»입니다"
          : "이 기간 주문에 이어진 정산 행",
        noFee ? WARN : FG3,
      ),
    ],
    actions: [{ label: "정산 화면에서 열기", run: () => act.go("settlement") }],
  }
}

// ── 주문 한 줄 ────────────────────────────────────────────────────

function orderPanel(r: OrderRow, d: DetailData): Panel {
  // ★ 두 종류를 **다른 식으로** 센다 ★
  // 홀로 선 클레임은 그 자체가 차감이고(`amount === claimAmount`), 통합 행은
  // 결제금액에서 딸린 클레임을 뺀다. 한 식으로 쓰면 취소된 판매가 두 번 빠진다 —
  // 저장 계층에서 이미 닫은 그 버그의 화면판이다 (`OrderRow.claimAmount` 주석).
  const standalone = r.kind === "claim"
  const effect = standalone ? -r.claimAmount : r.amount - r.claimAmount
  const lines: Line[] = standalone
    ? [
        line("−", "클레임 금액", money(r.claimAmount)),
        total("손익 반영", `${signed(effect)}원`, effect >= 0 ? GREEN : RED),
      ]
    : [
        line("+", "결제 금액", money(r.amount)),
        line(
          "−",
          "딸린 클레임",
          r.claimAmount === 0 ? "—" : money(r.claimAmount),
          r.claimAmount === 0 ? DIM : WARN,
        ),
        total("손익 반영", `${signed(effect)}원`, effect >= 0 ? GREEN : RED),
      ]
  const items = r.items
  return {
    title: standalone ? "클레임" : "주문",
    // 마켓 주문번호는 아직 저장하지 않는다(`order.ts`) — 내부 키를 대신 내보내지
    // 않는다 (헌장 C-4). 사람이 알아보는 것은 시각과 채널이다.
    sub: `${r.at}${r.dateEstimated ? " (일자 추정)" : ""} · ${r.channel}`,
    lines,
    prov: [
      periodLine(d.period),
      prov("상태", r.status === "" ? "—" : r.status, r.status === "" ? DIM : FG3),
      prov(
        "품목",
        items === null
          ? "이 행에는 품목이 붙어 있지 않습니다"
          : items.title === null
            ? `${items.count.toLocaleString()}건 · 리스팅이 아직 안 붙었습니다`
            : `${items.title}${items.count > 1 ? ` 외 ${items.count - 1}건` : ""} · ${items.quantity.toLocaleString()}개`,
        items === null ? DIM : FG3,
      ),
      ...(r.claimDateEstimated
        ? [prov("클레임 일자", "양식에 클레임 일자가 없어 결제일로 갈음했습니다 (ADR-009)", WARN)]
        : []),
    ],
  }
}

// ── 정산 한 묶음 ──────────────────────────────────────────────────

function settlementPanel(r: SettlementRow, _d: DetailData, act: DetailActions): Panel {
  // 정산 항등식. `net`은 **마켓이 준 원본**이고 우리가 다시 계산하지 않는다
  // (헌장 B-3). 그래서 「= 지급액」이라 쓰지 않고 위 항의 합과 **대조**한다.
  const derived = r.gross - r.fee - r.vat - r.shipping
  const diff = r.net - derived
  const balanced = diff === 0
  const eff = r.net + r.adjSum
  return {
    title: `${r.settledOn} 정산`,
    sub: `${r.channel} · ${r.count.toLocaleString()}건`,
    lines: [
      line("+", "판매대금", money(r.gross)),
      line("−", "수수료", money(r.fee)),
      line("−", "VAT", money(r.vat)),
      line("−", "배송비", money(r.shipping)),
      total("항의 합", money(derived), FG2),
      // 원본 지급액을 **따로** 놓는다. 위 합과 다르면 그 차이가 곧 대사 결과다 —
      // 조정으로 메우지 않는다 (LOCK 3: 대사는 원본끼리만).
      line("", "마켓 지급액 (원본)", money(r.net), FG),
      line(
        "",
        balanced ? "차이 없음" : "차이",
        balanced ? "0원" : `${signed(diff)}원`,
        balanced ? GREEN : RED,
      ),
    ],
    prov: [
      prov("정산일", r.settledOn),
      prov("채널", r.channel),
      prov(
        "주문 연결",
        r.linked === 0 ? "이어진 주문 없음" : `${r.linked.toLocaleString()}건`,
        r.linked === 0 ? WARN : FG3,
      ),
      prov(
        "지급 예정일",
        r.payOutOn ?? "묶음 안에서 갈립니다 — 하나로 적지 않습니다",
        r.payOutOn === null ? DIM : FG3,
      ),
      // 조정이 있으면 «표시값»이 원본과 다르다는 사실을 출처에도 남긴다.
      ...(r.adjSum === 0 ? [] : [prov("조정 반영 후", money(eff), WARN)]),
    ],
    // 조정 스택은 **읽기로만** 둔다. 넣고 거두는 자리는 정산 표의 팝오버 하나뿐이다
    // (ADR-020). 두 자리를 만들면 어느 쪽이 참인지 모르게 된다 (U-3).
    adj: r.adjustments.map((a) => ({
      head: `${signed(a.delta)}원 · ${a.createdAt}`,
      body: a.reason,
    })),
    actions: [{ label: "주문 화면에서 열기", run: () => act.go("orders") }],
  }
}

// ── 상품(SKU) 한 줄 ───────────────────────────────────────────────

function skuPanel(r: ProductSkuRow, d: DetailData, act: DetailActions): Panel {
  const qty = r.soldQty
  const cost = r.cost
  // 둘 중 하나라도 «모름»이면 곱을 만들지 않는다 — `null`은 0이 아니다.
  const known = cost !== null && qty !== null
  // 상품명과 SKU명이 같은 것이 흔하다(1:1로 만들어 붙인 SKU). 같으면 한 번만 쓴다 —
  // 같은 문장을 두 번 그리면 사용자는 둘이 다른 값인 줄 알고 차이를 찾는다.
  const sameName = r.productName === "" || r.productName === r.name
  return {
    title: r.name,
    sub: sameName ? `SKU ${r.code}` : `SKU ${r.code} · ${r.productName}`,
    lines: [
      line("", "개당 매입원가", cost === null ? "미입력" : money(cost), cost === null ? WARN : FG2),
      line(
        "×",
        "이 기간 판매 수량",
        qty === null ? "품목 단위 데이터 없음" : `${qty.toLocaleString()}개`,
        qty === null ? DIM : FG2,
      ),
      total("이 기간 매입원가", known ? money(cost * qty) : "—", known ? FG : DIM),
    ],
    prov: [
      periodLine(d.period),
      prov("원가 적용 시작", r.costFrom ?? "—", r.costFrom === null ? DIM : FG3),
      prov(
        "원가 이력",
        r.costEntries === 0 ? "없음" : `${r.costEntries.toLocaleString()}건`,
        r.costEntries === 0 ? DIM : FG3,
      ),
      prov(
        "연결된 리스팅",
        r.listingCount === 0 ? "없음" : `${r.listingCount.toLocaleString()}건`,
        r.listingCount === 0 ? WARN : FG3,
      ),
      prov("채널", r.channels.length === 0 ? "—" : r.channels.join(" · "), r.channels.length === 0 ? DIM : FG3),
      // ★ `status`를 그대로 안 그린다 — 「ACTIVE」는 내부 코드값이다 ★
      // 표의 손익 칸이 이미 「손익 제외」라는 **사람 말**로 같은 사실을 말하고 있다
      // (`product.ts`). 패널이 코드값을 흘리면 두 자리가 다른 어휘로 같은 것을
      // 말하게 되고, 그중 하나는 사용자에게 아무 뜻도 아니다.
      ...(r.status === "DRAFT"
        ? [prov("판매 상태", "판매 대기 — 손익에서 제외됩니다", WARN)]
        : []),
    ],
    actions:
      r.listingCount === 0 ? [{ label: "상품 연결 화면으로", run: () => act.go("linking") }] : [],
  }
}

// ── 조립 ──────────────────────────────────────────────────────────

function resolve(t: DetailTarget, d: DetailData, act: DetailActions): Panel | null {
  switch (t.kind) {
    case "product": {
      const r = d.products.find((x) => productKey(x) === t.key)
      return r ? productPanel(r, d, act) : null
    }
    case "channel": {
      const r = d.channels.find((x) => channelKey(x) === t.key)
      return r ? channelPanel(r, d, act) : null
    }
    case "order": {
      const r = d.orders.find((x) => orderKey(x) === t.key)
      return r ? orderPanel(r, d) : null
    }
    case "settlement": {
      const r = d.settlements.find((x) => settlementDetailKey(x) === t.key)
      return r ? settlementPanel(r, d, act) : null
    }
    case "sku": {
      const r = d.skus.find((x) => skuKey(x) === t.key)
      return r ? skuPanel(r, d, act) : null
    }
  }
}

/**
 * 근거 패널을 붙인다. **대상이 없거나 못 찾으면 아무것도 안 붙인다** —
 * `emptyVals()`의 `hasDetail: false`가 그대로 남고 `<aside>`는 렌더되지 않는다.
 */
export function detailVals(
  vals: TemplateVals,
  target: DetailTarget | null,
  data: DetailData,
  act: DetailActions,
): void {
  vals.closeDetail = act.close
  if (target === null) return
  const panel = resolve(target, data, act)
  if (panel === null) return

  const adj = panel.adj ?? []
  const actions = panel.actions ?? []
  vals.hasDetail = true
  vals.detail = {
    title: panel.title,
    sub: panel.sub,
    lines: panel.lines,
    prov: panel.prov,
    // 「값 병합」 구간은 조정 넣기/거두기 버튼이 달린 자리다. 그 쓰기 경로는 정산
    // 팝오버 하나뿐이므로(ADR-020) 여기서는 열지 않는다.
    hasMerge: false,
    merge: [],
    mergeNote: "",
    hasAdj: adj.length > 0,
    adj,
    hasActions: actions.length > 0,
    actions,
  }
}
