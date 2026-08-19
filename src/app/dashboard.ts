/**
 * 대시보드 배선 1단 — **손익 3층이 화면에 뜬다.**
 *
 * ★ 배선 규율 ★
 * 화면은 `loadPnlSnapshot`의 **소비자**다. 여기서 리포지토리를 직접 조회하지
 * 않는다 — 그러면 CLI와 화면이 다른 답을 낼 경로가 생긴다 (작업-상태 "배선 규율").
 * 이 파일이 하는 일은 스냅샷을 **포맷**하는 것뿐이다.
 *
 * ★ 산수를 하지 않는다 ★
 * `pnl.fee + pnl.vat`처럼 **이미 계산된 값을 나란히 놓는 것**은 표기이지
 * 계산이 아니다. 하지만 여기서 비율을 다시 재거나 항목을 빼고 더해 새 지표를
 * 만들면 그 순간 계산기가 둘이 된다 (단일 계산기 LOCK).
 *
 * 1단 범위: 히어로 KPI + 비용 구성. 조건 3의 게이트가 이것이다 —
 * 총매출·클레임·광고비가 3b-0 CLI와 **원 단위로 같아야** 한다.
 */

import type { PnlSnapshot } from "@core/profit/snapshot.js"
import type { Period } from "@core/profit/index.js"
import { pnlGaps } from "@core/profit/gaps.js"
import type { ConnectionCoverage } from "@core/coverage/load.js"
import type { ChannelRow, DailySeries, ProfitRow } from "@core/profit/rows.js"
import type { TemplateVals } from "./generated/vals.js"
import { compact, pct, signed, won } from "./format.js"
import { EXCLUSION_LABEL } from "./import.js"

/** 목업 L4201~4208의 팔레트. 색은 표기이므로 그대로 옮긴다. */
const MIX_COLORS = {
  cogs: "#4C8DFF",
  fee: "#EB5757",
  ad: "#BB6BD9",
  shipping: "#F2994A",
  claims: "#E879B9",
  discount: "#F2C94C",
  /** 목업 범례의 「운영비」 회색. 우리 목록에 그 항이 빠져 있었다 (아래 `costMix`). */
  ops: "#828282",
  contribution: "#4CB782",
} as const

/** 채널 줄의 색 점. 의미색이 아니라 **구분색**이라 순서대로 돌린다 (§21-4). */
const CH_COLORS = ["#4C8DFF", "#4CB782", "#BB6BD9", "#F2994A", "#E879B9", "#F2C94C"] as const

const GREEN = "var(--pnl-pos, #4CB782)"
const RED = "var(--pnl-neg, #EB5757)"
/** 단서의 경고 톤. 목업 `ORG`와 같은 값이고 DS 토큰으로 참조한다. */
const WARN = "var(--label-orange, #F2994A)"

/**
 * 비용 구성. 목업 `mix`(L4201)와 같은 자리이고 **클레임 한 줄이 늘었다.**
 *
 * 목업 시드에는 클레임이 없어 항목이 없었지만 실데이터에는 있다(388,700원).
 * 발생한 비용이 화면에서 사라지면 그건 화면이 조용히 거짓말하는 것이다
 * (헌장 A-5). `sc-for`가 그리는 목록이라 항목이 늘어도 마크업은 그대로다.
 */
function costMix(snap: PnlSnapshot): { label: string; v: number; color: string }[] {
  const p = snap.pnl
  return [
    { label: "매출원가", v: p.cogs, color: MIX_COLORS.cogs },
    { label: "수수료", v: p.fee + p.vat, color: MIX_COLORS.fee },
    { label: "직접 광고비", v: p.adDirect, color: MIX_COLORS.ad },
    { label: "배송비", v: p.shipping, color: MIX_COLORS.shipping },
    { label: "클레임", v: p.claims, color: MIX_COLORS.claims },
    { label: "할인", v: p.discount, color: MIX_COLORS.discount },
    { label: "운영비", v: p.ops, color: MIX_COLORS.ops },
    { label: "기여이익", v: Math.max(0, p.productContribution), color: MIX_COLORS.contribution },
  ].filter((m) => m.v !== 0)
}

/**
 * ★ 이 목록은 **매출을 나눈 것**이어야 한다 (2026-08-16) ★
 *
 * 손익 계산기가 정의한 분해가 곧 이 목록이다:
 *
 * ```
 * 기여이익 = 매출 − 할인 − 수수료 − VAT − 배송비 − 클레임 − 매입원가 − 직접광고비 − 운영비
 * ```
 *
 * 그래서 **일곱 항 + 기여이익 = 매출**이 항등식이다. 그런데 이식본은 두 곳에서
 * 그 항등식을 깨고 있었다:
 *
 * ```
 * 광고비에 미배분을 더했다   → 합이 매출을 **넘는다** (미배분은 기여이익 아래 칸이다)
 * 운영비를 빠뜨렸다          → 합이 매출에 **못 미친다**
 * ```
 *
 * 오늘 둘 다 0이라 우연히 안 틀리고 있었다. 막대는 합이 안 맞아도 티가 안 나지만
 * **도넛은 그 합을 원으로 정규화하므로 즉시 거짓말이 된다** — 도넛을 되살리는
 * 지금이 이 자리를 바로잡아야 하는 때다.
 *
 * 미배분 광고비가 이 그림에서 빠지는 것은 **누락이 아니라 층**이다. 히어로 문구가
 * *"기여이익에서 전사 광고비 N원과 고정비 M원을 뺀 값입니다"*로 이미 말한다.
 */
function partitionsRevenue(snap: PnlSnapshot, mixTotal: number): boolean {
  // 기여이익이 음수면 `max(0, …)`으로 잘리므로 합이 매출을 넘는다 — 그 상태가
  // 곧 «비용이 매출을 먹었다»이고, 도넛은 그것을 그릴 수 없다 (§21-4의 198.8%).
  return snap.pnl.productContribution >= 0 && mixTotal === snap.pnl.revenue
}

/** 기간 라벨. "2026년 7월"처럼 읽히게 한다. */
export function periodLabel(p: Period): string {
  const [y, m] = p.from.split("-")
  return `${y}년 ${Number(m)}월`
}

/**
 * 스냅샷을 대시보드 값으로. **빈 값 위에 덮어쓴다** — 아직 배선하지 않은
 * 값(브리지·무버스·비교)은 빈 채로 남고, 그게 지금의 사실이다.
 */
/**
 * 커버리지를 «담지 못한 것» 카드의 행으로 바꾼다 (§22-4).
 *
 * ★ 왜 지표 이름을 쓰나 ★ 행이 세 칸(이름·상태·수치)뿐이라 «주문 파일이 없다»보다
 * «매출이 잠겼다»가 **손해를 말한다.** 무엇을 넣어야 하는지는 채널 화면의 3절
 * 문장이 맡고, 대시보드는 소비 지점에서 «이 숫자에 무엇이 빠졌나»만 말한다.
 *
 * 마켓 사전을 쓰지 않으므로 팩을 import하지 않는다 — 지표 이름은 core가 안다.
 */
function coverageGapRows(
  list: readonly ConnectionCoverage[],
): { name: string; state: string; last: string; color: string; dot: string }[] {
  const rows: { name: string; state: string; last: string; color: string; dot: string }[] = []
  for (const cc of list) {
    for (const e of cc.coverage.entries) {
      // 대시보드가 그리는 숫자에 실제로 구멍을 내는 것만 — 매출과 수수료다.
      // 나머지(수량·광고비·원가·기여이익)는 채널 화면과 기존 gaps가 이미 말한다.
      if (e.open || (e.metric !== "revenue" && e.metric !== "fee")) continue
      rows.push({
        name: cc.channel,
        state: `${e.label} 잠김`,
        last: e.lockedValue === null ? "" : `${won(e.lockedValue)}원`,
        color: WARN,
        dot: WARN,
      })
    }
  }
  return rows
}

export function dashboardVals(
  vals: TemplateVals,
  snap: PnlSnapshot,
  period: Period,
  coverage: readonly ConnectionCoverage[] = [],
  rows: {
    products: readonly ProfitRow[]
    channels: readonly ChannelRow[]
    daily?: DailySeries
    /** 지금 호버 중인 일자 index. -1이면 안 떠 있다 (화면 상태라 App이 갖는다). */
    trendIdx?: number
    onTrend?: (i: number) => void
    /** 파일에서 제외된 행 — 「일부 제외」 배너의 재료 (LOCK 6). */
    excluded?: { files: number; rows: number; reasons: readonly { reason: string; count: number }[] }
    /** 배너의 [양식 확인] — 「필드 매핑」 화면으로 간다. */
    goFieldmap?: () => void
  } = { products: [], channels: [] },
): void {
  const p = snap.pnl
  const mix = costMix(snap)
  const mixTotal = mix.reduce((s, m) => s + m.v, 0)
  const den = p.revenue > 0 ? p.revenue : mixTotal

  // ★ layout 파생 값 — 한 가족이 통째로 이식되지 않았다 ★
  //
  // 목업 L5489~5495는 `this.state.layout`("default"·"report"·"workbench") 하나에서
  // 표시 스위치 한 벌을 파생시킨다. 이식 때 이 가족이 따라오지 않아 `emptyVals()`의
  // `false`/`""`가 그대로 남았고, **값은 배선됐는데 화면이 안 그려지는** 상태가 됐다.
  // 화면에서는 "데이터가 없다"와 구분되지 않는다 — 조용한 실패다 (LOCK 6).
  //
  // 여기서는 기본 레이아웃("default")의 초기값을 복원한다. 조건을 지우거나
  // 우회하지 않는다 — `layout` 상태 자체의 배선(리포트·워크벤치 전환)은 남은 일이다.
  //
  // ★ 스위치는 그 데이터가 배선된 뒤에 켠다 ★
  // `showCal`(캘린더)은 목업 기본값이 `true`지만 켜지 않는다 — `calendar`가 비어
  // 있어 빈 달력이 그려진다. 빈 껍데기를 켜는 것은 복원이 아니라 새 결함이다.
  // 캘린더는 3단에서 데이터와 함께 켠다.
  vals.showHero = true // layout !== "workbench"
  vals.showSide = true // layout !== "workbench" — 사이드 카드 3장을 담는 그리드
  vals.sectionGap = "12px" // layout !== "report"
  vals.sectionPad = "0 14px 14px" // layout !== "report"

  // 사이드 카드 두 장 — 목업 L3689 `cards: { cost: true, fresh: true }`의 복원.
  // 이 토글은 §19에서 살아남은 정당한 기능이다(표시 설정 메뉴의 `dispCards`).
  // 토글 자체의 배선은 아직이므로 지금은 초기값 그대로 둘 다 켜져 있다.
  vals.showCost = true
  vals.showFresh = true

  // ★ 헤더 부제는 **보고 있는 기간**이었다 — 이제 선택기가 그 자리를 받는다 ★
  //
  // `TITLES.dash`(shell.ts)가 목업 L3667에서 온 상수 `"2026년 8월"`이라, 7월
  // 데이터를 띄워도 헤더에는 8월이라고 적혀 있었다. 빈 값보다 나쁘다 —
  // **틀린 값은 사용자가 믿는다.**
  //
  // 그 정정을 여기서 하지 않는 이유는 **범위가 틀렸기 때문**이다: 이 함수는
  // 화면과 무관하게 (데이터가 있으면) 늘 돌아서, 주문·연결 화면의 부제까지
  // «2026년 7월»로 덮고 있었다. 이제 `periodVals`가 **기간이 실제로 걸리는
  // 화면에서만** 부제를 비우고 선택기를 세운다 (`period.ts`).

  // 히어로 — 목업 L5543~5552
  vals.heroLabel = `${periodLabel(period)} 순이익`
  vals.heroNet = signed(p.netProfit)
  vals.heroRev = won(p.revenue)
  vals.heroBasis =
    `기여이익에서 전사 광고비 ${won(p.adUnallocated)}원과 ` +
    `고정비 ${won(p.fixed)}원을 뺀 값입니다.`
  vals.contribMargin = pct(p.productContribution, p.revenue)
  vals.contribColor = p.productContribution >= 0 ? GREEN : RED

  // 비용 구성 — 목업 L4242.
  // mixHead·mixFoot·mixRows는 renderVals가 만들지만 **마크업이 소비하지 않는다**
  // (변환기가 뽑은 홀 목록에 없다). 죽은 값이라 채우지 않는다.
  // ★ 막대 길이의 분모는 **가장 큰 항목**이다 (§21 패치) ★
  //
  // "매출 대비"(den)로 길이를 정하면 광고비가 198.8%라 트랙을 넘는다 — 이 기간의
  // 광고비가 매출보다 크다는 것이 사실이기 때문이다. 도넛이었을 때는 조각 합이
  // 항상 원을 채워 이 문제가 숨어 있었다.
  //
  // 가로 막대는 **크기 비교**가 본업이므로 최댓값을 100%로 잡는다. "매출 대비"는
  // 사라지지 않고 옆의 `pct`가 그대로 말한다 — 길이와 비율이 다른 질문에 답한다.
  const barDen = Math.max(...mix.map((m) => m.v), 1)

  vals.costMix = mix.map((m) => ({
    label: m.label,
    color: m.color,
    pct: `${((m.v / den) * 100).toFixed(1)}%`,
    amount: `${won(m.v)}원`,
    // 도넛 범례는 폭이 좁다(도넛 112px을 빼고 남는 자리). 원 단위 금액을 그대로
    // 넣으면 **라벨이 밀려 «클.»이 된다** — 실제로 그렇게 렌더됐다. 짧은 표기로
    // 자리를 만들고, 원 단위는 막대 판이 그대로 보여준다.
    short: `${compact(m.v)}원`,
    barW: `${((m.v / barDen) * 100).toFixed(1)}%`,
    clip: "",
    op: "1",
    align: "center",
    rows: [
      { label: "금액", value: `${won(m.v)}원` },
      { label: "매출 대비", value: `${((m.v / den) * 100).toFixed(1)}%` },
    ],
  }))

  /**
   * ★ 상품별 손익 — 표가 **처음으로 채워진다** (2026-08-16) ★
   *
   * 마크업은 처음부터 있었는데 채우는 코드가 0곳이라 늘 「합계」 한 줄만 그렸다.
   * 사용자가 그걸 보고 «상품이 없다»로 읽었다 — §22가 가르는 「부재 vs 미구현」이
   * 이 자리에서 안 갈리고 있었다.
   *
   * ★ 못 채우는 칸을 **0으로 채우지 않는다** ★
   * 수수료·배송비는 주문 단위, 광고비는 캠페인 단위라 품목에 붙는 근거가 오늘
   * 없다(`core/profit/rows.ts`). 0을 넣으면 «수수료가 0원인 상품»이라는 거짓이
   * 표에 앉으므로 «—»를 넣고, 아래 한 줄이 그 이유를 말한다. 그래서 이 표의
   * 이익 칸 이름도 「순이익」이 아니라 **「기여이익(부분)」**이다.
   */
  const prod = rows.products
  vals.sortCols = [
    { label: "상품", align: "flex-start", color: "var(--fg-3)", showArrow: false, arrow: "", pick: () => {} },
    ...["수량", "매출", "할인", "수수료", "배송비", "매입원가", "광고비", "기여이익(부분)", "마진"].map(
      (label) => ({
        label,
        align: "flex-end",
        color: "var(--fg-3)",
        showArrow: false,
        arrow: "",
        pick: () => {},
      }),
    ),
  ]
  /**
   * ★ 이 표의 합이 총매출과 다른 것은 **정상이다** — 그러니 그렇게 말한다 ★
   *
   * 실측(7월): 상품 합 86,909,220원 · 총매출 87,297,920원 · 차이 **388,700원**.
   * 그 차이는 클레임 9건이다 — 이중 기록으로 `fact_order`에는 섰지만 **품목을
   * 만들지 않으므로**(order-item 조건 ③) 상품으로 나뉠 수 없다.
   *
   * 말하지 않으면 사용자가 두 숫자를 나란히 보고 «어디서 새는 거지»를 겪는다.
   * 0이면 아무 말도 하지 않는다 (0이면 말하지 않는다의 그 규율).
   */
  const prodRev = prod.reduce((a, r) => a + r.revenue, 0)
  const outside = p.revenue - prodRev
  vals.sortNote =
    prod.length === 0
      ? ""
      : `매출 큰 순 · ${prod.length}개` +
        (outside > 0 ? ` · 품목이 없는 ${won(outside)}원은 이 표에 없습니다` : "") +
        " · 수수료·배송비·광고비는 상품에 배분되지 않습니다"
  vals.pnlRows = prod.map((r) => {
    const net = r.revenue - r.discount - r.cogs
    const linked = r.skuId !== null
    return {
      name: linked ? r.name : "SKU에 연결되지 않은 판매",
      sku: r.code,
      isSku: linked,
      isProduct: false,
      isOpen: false,
      isClosed: false,
      indent: "0px",
      nameFont: "var(--fw-medium) 12px",
      nameColor: linked ? "var(--fg-2)" : "var(--fg-4)",
      bg: "transparent",
      click: () => {},
      qty: `${r.qty.toLocaleString()}개`,
      rev: `${won(r.revenue)}원`,
      disc: r.discount === 0 ? "—" : `${won(r.discount)}원`,
      // 품목에 붙는 근거가 없는 칸 — 0이 아니라 «모른다»다 (§22).
      fee: "—",
      ship: "—",
      ad: "—",
      cogs: r.noCostQty > 0 && r.cogs === 0 ? "미입력" : `${won(r.cogs)}원`,
      net: `${signed(net)}원`,
      netColor: net >= 0 ? GREEN : RED,
      margin: pct(net, r.revenue),
      marginBar: `${Math.min(100, Math.max(0, (net / (r.revenue || 1)) * 100)).toFixed(1)}%`,
    }
  })
  vals.pnlEmpty = prod.length === 0

  /**
   * 합계 행. **표가 스크롤돼도 늘 보인다** — 아래쪽에 고정된다(`fb-total-row`).
   * 60행을 훑는 동안 합계가 화면 밖으로 사라지면 그 표가 답하는 질문이 반쪽이 된다.
   */
  const totQty = prod.reduce((a, r) => a + r.qty, 0)
  const totRev = prod.reduce((a, r) => a + r.revenue, 0)
  const totDisc = prod.reduce((a, r) => a + r.discount, 0)
  const totCogs = prod.reduce((a, r) => a + r.cogs, 0)
  const totNet = totRev - totDisc - totCogs
  vals.tot = {
    qty: `${totQty.toLocaleString()}개`,
    rev: `${won(totRev)}원`,
    disc: totDisc === 0 ? "—" : `${won(totDisc)}원`,
    fee: "—",
    ship: "—",
    ad: "—",
    cogs: `${won(totCogs)}원`,
    net: `${signed(totNet)}원`,
    margin: pct(totNet, totRev),
  }
  vals.emptyTitle = "이 기간에 팔린 품목이 없습니다"
  vals.emptyHint = "주문 파일을 넣으면 상품별로 나뉩니다."

  /**
   * ★ 채널별 손익 ★
   *
   * 막대는 **매출 크기**, 오른쪽 숫자는 기여이익이다. 한 줄이 두 질문에 답하지
   * 않게 길이와 숫자를 갈라 둔 것은 비용 구성 막대와 같은 규율이다 (§21-4).
   */
  const chDen = Math.max(...rows.channels.map((c) => c.revenue), 1)
  vals.chRows = rows.channels.map((c, i) => {
    const net = c.revenue - c.cogs - c.claims - c.fee
    return {
      name: c.name,
      srcLine: `주문 ${c.orderCount.toLocaleString()}건 · 매출 ${compact(c.revenue)}원`,
      net: `${signed(net)}원`,
      margin: pct(net, c.revenue),
      netColor: net >= 0 ? GREEN : RED,
      color: CH_COLORS[i % CH_COLORS.length],
      barW: `${((c.revenue / chDen) * 100).toFixed(1)}%`,
      barBg: "var(--bg-elevated-2)",
      rowBg: "transparent",
      click: () => {},
    }
  })

  /**
   * ★ 일별 매출 — **그릴 수 있는 것만 그리고, 못 그린 것을 말한다** (2026-08-16) ★
   *
   * 이 차트는 배선된 적이 없었다(`netTrend`를 채우는 코드가 0곳). 그런데 그냥
   * 채우면 안 되는 이유가 데이터에 있다: 쿠팡 제트는 **기간 집계**로만 와서
   * 날짜가 없다 — 실측 7월 총매출 87,297,920원 중 **73,740,340원(84%)**이 그렇다.
   *
   * ```
   * 기간집계를 넣으면   7월 1일 하나에 7,374만원이 솟는 **가짜 봉우리**
   * 그냥 빼면           일별 합이 월 숫자와 다른데 **아무도 이유를 모른다**
   * ```
   *
   * 그래서 빼되 **얼마를 뺐는지 제목 옆에 적는다.** 차트가 스스로 자기 한계를
   * 말하는 것이 §22가 요구하는 모양이고, 그 문구는 8월에 제트 파일이 안 들어오면
   * 스스로 사라진다.
   */
  const daily = rows.daily
  /**
   * ★ 카드가 「일별 기여이익 · 단위 백만원」이라고 말한다 — 그대로 그린다 ★
   *
   * 처음 배선했을 때 **매출을 원 단위로** 그려 놓고 제목은 기여이익이라고 적었다.
   * 모양은 그럴듯한데 라벨이 거짓말을 하는 상태였고, 사용자가 «호버도 안 되고
   * 날짜도 빼곡하다»고 짚어 준 자리를 파다 드러났다. 목업도 `net / 1,000,000`을
   * 그린다 — 단위 표기는 그때부터 백만원이었다.
   */
  vals.netTrend = (daily?.points ?? []).map((d) => ({
    // 축 라벨은 «7/3»처럼 짧게. 31칸이 서면 그래도 겹치므로 **솎는 것은 차트가**
    // 한다 (`ds/charts.tsx` — 기간 길이에서 자동으로 정한다).
    k: `${Number(d.day.slice(5, 7))}/${Number(d.day.slice(8, 10))}`,
    v: Number((d.contribution / 1_000_000).toFixed(2)),
  }))

  /**
   * ★ 호버 — **목업에 있던 것을 되살린다** ★
   *
   * 마크업은 처음부터 있었다(열 단위 투명 오버레이 + 툴팁). `trendCols`가 빈
   * 배열이라 잡을 것이 없었을 뿐이다. 툴팁은 그날의 분해를 원 단위로 준다 —
   * 차트가 백만원으로 반올림하므로, 정확한 값은 여기서만 읽힌다.
   */
  const hover = rows.trendIdx ?? -1
  vals.trendCols = (daily?.points ?? []).map((_, i) => ({
    enter: () => rows.onTrend?.(i),
    leave: () => rows.onTrend?.(-1),
    bg: hover === i ? "var(--bg-hover)" : "transparent",
  }))
  const hot = hover >= 0 ? daily?.points[hover] : undefined
  vals.trendTip =
    hot === undefined
      ? null
      : {
          head: `${hot.day} · 주문 ${hot.orderCount.toLocaleString()}건`,
          left: `clamp(0px, calc(${(((hover + 0.5) / Math.max(1, daily?.points.length ?? 1)) * 100).toFixed(2)}% - 90px), calc(100% - 180px))`,
          rows: [
            { name: "매출", val: `${won(hot.revenue)}원`, color: "var(--fg)" },
            { name: "매입원가", val: `${won(hot.cogs)}원`, color: "var(--fg-2)" },
            ...(hot.fee + hot.shipping > 0
              ? [{ name: "수수료·배송", val: `${won(hot.fee + hot.shipping)}원`, color: "var(--fg-2)" }]
              : []),
            ...(hot.claims > 0
              ? [{ name: "클레임", val: `${won(hot.claims)}원`, color: RED }]
              : []),
            {
              name: "기여이익",
              val: `${signed(hot.contribution)}원`,
              color: hot.contribution >= 0 ? GREEN : RED,
            },
          ],
        }
  vals.scopeLine =
    daily === undefined || daily.periodOnly === 0
      ? `${period.from} ~ ${period.to} · 전 채널`
      : `${period.from} ~ ${period.to} · 날짜가 없는 기간 집계 ${won(daily.periodOnly)}원은 빠졌습니다`

  /**
   * ★ 도넛이 돌아왔다 — 단, **거짓말하지 않을 때만** (2026-08-16) ★
   *
   * §21-4는 도넛을 폐기했고 그 근거는 실측이었다: 매출 7,896,500원에 광고비
   * 15,700,534원(**198.8%**)이던 순간, 도넛은 조각 합을 원으로 정규화하느라
   * «비용이 매출을 넘었다»를 그리지 못했다.
   *
   * 그 근거는 **지금도 유효하다.** 다만 그것이 참인 것은 «합이 매출을 넘을 때»뿐이고,
   * 그 조건은 **데이터에서 판정된다.** 그러니 도넛을 영구히 금지할 이유가 아니라
   * **조건으로 가를 이유**다:
   *
   * ```
   * 일곱 항 + 기여이익 = 매출   →  도넛 (구성을 한눈에)
   * 비용이 매출을 먹었다        →  가로 막대 + 「198.8%」를 숫자로
   * ```
   *
   * 사람이 다시 켤 일이 없다는 것이 요점이다 — 8월에 광고비가 매출을 넘는 날
   * 화면이 **스스로** 막대로 내려간다.
   *
   * 조각은 `conic-gradient` 한 줄로 만든다. 목업은 조각마다 `clip-path` 겹침을
   * 두어 호버 툴팁을 붙였는데, 그건 옮기지 않는다 — 금액을 범례에 **인라인으로**
   * 두면 호버 없이 읽히고(§9), 그러면 툴팁이 답할 질문이 남지 않는다.
   */
  vals.costDonutOk = partitionsRevenue(snap, mixTotal)
  let at = 0
  vals.costDonut = `conic-gradient(${mix
    .map((m) => {
      const from = (at / (mixTotal || 1)) * 100
      at += m.v
      const to = (at / (mixTotal || 1)) * 100
      return `${m.color} ${from.toFixed(2)}% ${to.toFixed(2)}%`
    })
    .join(", ")})`

  // ★ 이 숫자가 담지 못한 것 ★
  //
  // CLI(`tools/harness/pnl.ts`)는 손익 5줄 밑에 **무엇이 빠졌는지**를 늘 함께
  // 출력해왔다. 숫자만 화면으로 옮기고 이 단서를 두고 오면 A-5 후퇴다 —
  // 사용자는 순이익을 완성된 숫자로 읽지만, 지금 그것은 한 연결의 광고비를 다른
  // 연결의 매출에서 뺀 미완성 합성이다. **단서 없는 표시가 조용히 틀린 숫자다.**
  //
  // 판정은 `pnlGaps` 하나뿐이라 CLI와 화면이 갈라질 수 없다. 여기서 하는 일은
  // 그 결과를 카드 행 세 칸(이름·상태·수치)에 놓는 것뿐이다.
  //
  // ★ 커버리지가 여기 합류한다 (§22-4) ★
  // 새 카드를 만들지 않는다. 같은 질문(«이 숫자가 무엇을 담지 못했나»)에 대한
  // 다른 사유일 뿐이라, 사유가 늘 때마다 표면이 늘면 사용자는 세 군데를 봐야 한다.
  /**
   * ★ 「일부 제외」 배너 — **읽지 못한 행이 있으면 말한다** (LOCK 6) ★
   *
   * ─────────────────────────────────────────────────────────────
   * 파이프라인은 합계 행·소제목 행·빈 행을 걸러내고, 매핑이 버린 행도 있다.
   * 그 수는 `batch_exclusion`에 남아 있었지만 **대시보드는 한 번도 말하지 않았다** —
   * 「가져오기 기록」 화면까지 들어가야 보였다. 순이익을 보는 사람은 그 숫자가
   * 파일 전체에서 나온 줄 안다.
   *
   * ★ 아래 「이 숫자가 담지 못한 것」과 무엇이 다른가 ★
   * 그 카드는 **적재된 뒤** 생기는 결손(조인 실패·원가 미입력·추정 날짜)을 말한다.
   * 이 배너는 **적재 이전**, 파일에서 아예 빠진 행이다. 원인도 처방도 달라서
   * (전자는 파일을 더 넣기, 후자는 **양식 해석 확인**) 버튼이 필드 매핑으로 간다.
   *
   * ★ 달을 말하지 않는다 ★ 제외는 파일의 성질이라 한 파일의 행이 여러 달에
   * 걸친다. 「7월에 3행 제외」는 그 3이 무엇의 3인지 설명할 수 없는 문장이 된다.
   * ─────────────────────────────────────────────────────────────
   */
  const ex = rows.excluded
  vals.partial = ex !== undefined && ex.rows > 0
  if (ex !== undefined && ex.rows > 0) {
    vals.partialTitle = `파일에서 ${ex.rows.toLocaleString("ko-KR")}행이 제외됐습니다`
    // 사유를 그대로 보인다 — 「몇 행」만 말하면 사용자가 할 수 있는 일이 없다.
    // 합계·빈 행이면 정상이고, 오류가 섞여 있으면 양식 해석을 봐야 한다.
    const why = ex.reasons
      .map((r) => `${EXCLUSION_LABEL[r.reason] ?? r.reason} ${r.count.toLocaleString("ko-KR")}행`)
      .join(" · ")
    vals.partialBody =
      `파일 ${ex.files}개에서 걸러졌습니다${why === "" ? "" : ` — ${why}`}. ` +
      `합계·빈 행이면 정상이고, «읽지 못함»이 섞여 있으면 양식 해석을 확인해야 합니다.`
  }
  if (rows.goFieldmap !== undefined) vals.goFieldmap = rows.goFieldmap

  vals.freshness = [
    ...pnlGaps(snap).map((g) => ({
      name: g.label,
      state: g.state,
      last: g.note,
      color: g.tone === "warn" ? WARN : "var(--fg-4)",
      dot: g.tone === "warn" ? WARN : "var(--fg-4)",
    })),
    ...coverageGapRows(coverage),
  ]

  // KPI 스트립 — 목업 L4057~4073. 6장 중 값이 있는 것만.
  //
  // `d`(전월 대비)와 `spark`(스파크라인)는 비운다:
  //   · 전월 대비 — DB에 7월 한 달치뿐이라 **비교 대상이 없는 게 사실**이다.
  //     그럴듯하게 채우면 근거 없는 가짜 비교가 된다 (3단에서 빈 상태로 그린다)
  //   · 스파크라인 — §21이 전 폭에서 제거하라고 한 요소다. 그릴 이유가 없다
  vals.kpis = [
    {
      label: "총 매출",
      value: `${compact(p.revenue)}원`,
      // ★ 조건 (d) — 판매와 취소를 **짝으로** 쓴다 ★ 이중 기록 이후 판매 건수에는
      // 취소된 것도 들어 있다. 「주문 155건」만 쓰면 사용자가 옛 146과 대조하다
      // 9건이 어디서 왔는지 못 찾는다 — 그 차이를 숫자로 보인다.
      sub:
        snap.claimCount > 0
          ? `판매 ${won(snap.orderCount)}건 · 취소 ${won(snap.claimCount)}건`
          : `판매 ${won(snap.orderCount)}건`,
      color: "var(--fg)",
    },
    {
      label: "기여이익률",
      value: pct(p.productContribution, p.revenue),
      sub: "직접비만 뺀 이익",
      color: "var(--fg)",
    },
    {
      label: "순이익",
      value: `${compact(p.netProfit)}원`,
      sub: `전사 광고비·고정비 차감 · ${pct(p.netProfit, p.revenue)}`,
      color: p.netProfit >= 0 ? GREEN : RED,
    },
    {
      label: "마켓 수수료",
      value: `${compact(p.fee + p.vat)}원`,
      sub: `VAT 포함 · 매출의 ${pct(p.fee + p.vat, p.revenue)}`,
      color: "var(--fg)",
    },
    {
      label: "광고비",
      value: `${compact(p.adDirect + p.adUnallocated)}원`,
      sub: `매출의 ${pct(p.adDirect + p.adUnallocated, p.revenue)}`,
      color: "var(--fg)",
    },
    {
      label: "클레임",
      value: `${compact(p.claims)}원`,
      sub: `매출의 ${pct(p.claims, p.revenue)}`,
      color: "var(--fg)",
    },
  ].map((k) => ({
    ...k,
    // 전월 대비 — **문장의 존재 조건을 데이터에 묶는다** (§21 패치).
    // 값을 비우는 것만으로는 부족했다. 라벨("전월 대비")이 살아 있으면 화면은
    // 여전히 비교가 있는 것처럼 말한다. 8월 파일이 들어오면 스스로 살아난다.
    hasDelta: snap.hasPriorPeriod,
    delta: "",
    deltaColor: "var(--fg-4)",
    qColor: "var(--fg-4)",
  }))

  // ★ 비교가 성립하는가 — 화면의 비교 문장 전체가 여기 묶인다 (§21 패치) ★
  //
  // 히어로의 "vs 지난달" 줄 · 지표 스트립의 설명문 · KPI의 "전월 대비" 라벨.
  // 셋 다 값이 아니라 **문장**이라 비워도 사라지지 않았고, 그래서 화면이 없는
  // 비교를 있는 것처럼 말했다. 이제 데이터가 그 존재를 정한다.
  vals.hasCompare = snap.hasPriorPeriod

  // 스파크라인이 빠지면서(§21-4) KPI 카드가 한 줄 짧아진다. 비교가 없으면
  // "변화" 줄도 없으므로 한 줄 더 짧다 — 빈 칸을 남기지 않는다.
  vals.kpiRows = snap.hasPriorPeriod ? "15px 26px 15px 14px" : "15px 26px 14px"
}
