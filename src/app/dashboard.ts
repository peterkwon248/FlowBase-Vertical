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
import type { TemplateVals } from "./generated/vals.js"
import { compact, pct, signed, won } from "./format.js"

/** 목업 L4201~4208의 팔레트. 색은 표기이므로 그대로 옮긴다. */
const MIX_COLORS = {
  cogs: "#4C8DFF",
  fee: "#EB5757",
  ad: "#BB6BD9",
  shipping: "#F2994A",
  claims: "#E879B9",
  discount: "#F2C94C",
  contribution: "#4CB782",
} as const

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
    { label: "광고비", v: p.adDirect + p.adUnallocated, color: MIX_COLORS.ad },
    { label: "배송비", v: p.shipping, color: MIX_COLORS.shipping },
    { label: "클레임", v: p.claims, color: MIX_COLORS.claims },
    { label: "할인", v: p.discount, color: MIX_COLORS.discount },
    { label: "기여이익", v: Math.max(0, p.productContribution), color: MIX_COLORS.contribution },
  ].filter((m) => m.v !== 0)
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
export function dashboardVals(vals: TemplateVals, snap: PnlSnapshot, period: Period): void {
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

  // ★ 헤더 부제는 **보고 있는 기간**이다 ★
  //
  // `TITLES.dash`(shell.ts)가 목업 L3667에서 온 상수 `"2026년 8월"`이라, 7월
  // 데이터를 띄워도 헤더에는 8월이라고 적혀 있었다. 빈 값보다 나쁘다 —
  // **틀린 값은 사용자가 믿는다.** 히어로는 이미 기간에서 파생시키고 있었으므로
  // 한 화면에 7월과 8월이 동시에 적혀 있던 셈이다.
  vals.subtitle = periodLabel(period)

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
  vals.costMix = mix.map((m) => ({
    label: m.label,
    color: m.color,
    pct: `${((m.v / den) * 100).toFixed(1)}%`,
    amount: `${won(m.v)}원`,
    // 도넛 조각(clip)은 채우지 않는다. §21이 이 차트를 **가로 막대로** 바꾸므로
    // 도넛 기하를 배선했다가 지우는 이중 작업이 된다. 막대는 §21 패치에서 그린다.
    clip: "",
    op: "1",
    align: "center",
    rows: [
      { label: "금액", value: `${won(m.v)}원` },
      { label: "매출 대비", value: `${((m.v / den) * 100).toFixed(1)}%` },
    ],
  }))

  // ★ 이 숫자가 담지 못한 것 ★
  //
  // CLI(`tools/harness/pnl.ts`)는 손익 5줄 밑에 **무엇이 빠졌는지**를 늘 함께
  // 출력해왔다. 숫자만 화면으로 옮기고 이 단서를 두고 오면 A-5 후퇴다 —
  // 사용자는 순이익을 완성된 숫자로 읽지만, 지금 그것은 한 연결의 광고비를 다른
  // 연결의 매출에서 뺀 미완성 합성이다. **단서 없는 표시가 조용히 틀린 숫자다.**
  //
  // 판정은 `pnlGaps` 하나뿐이라 CLI와 화면이 갈라질 수 없다. 여기서 하는 일은
  // 그 결과를 카드 행 세 칸(이름·상태·수치)에 놓는 것뿐이다.
  vals.freshness = pnlGaps(snap).map((g) => ({
    name: g.label,
    state: g.state,
    last: g.note,
    color: g.tone === "warn" ? WARN : "var(--fg-4)",
    dot: g.tone === "warn" ? WARN : "var(--fg-4)",
  }))

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
      sub: `주문 ${won(snap.orderCount)}건`,
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
    // 전월 대비 — 비교 대상이 없다. 빈 구조로 두면 화면이 아무것도 그리지 않는다.
    d: { text: "", color: "var(--fg-4)", bg: "transparent", icon: "" },
    // 스파크라인 — §21이 전 폭에서 제거하라고 한 요소다. 빈 배열이면 안 그려진다.
    spark: [],
    qColor: "var(--fg-4)",
  }))

  vals.scopeLine = `${period.from} ~ ${period.to} · 전 채널`
}
