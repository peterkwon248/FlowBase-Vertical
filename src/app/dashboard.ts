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

  // 히어로 블록 전체를 여는 스위치. 이게 꺼져 있으면 KPI도 비용 구성도
  // 통째로 안 그려진다 — 데이터가 있으니 켠다.
  vals.showHero = true

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
