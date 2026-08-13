/**
 * 셸 배선 — `renderVals`의 **화면 껍데기 부분**을 React 상태로 옮긴 것이다.
 *
 * 분해 규칙(작업-상태)에 따르면 여기 있는 것은 전부 마지막 갈래다:
 *
 * ```
 * 데이터 접근  →  리포지토리로      (여기 없음 — 셸은 DB를 읽지 않는다)
 * 계산        →  computePnl로      (여기 없음 — 셸은 산수를 하지 않는다)
 * 남는 것     →  표시용 포맷팅뿐   ← 이 파일
 * ```
 *
 * 그래서 이 파일은 목업의 해당 줄을 **그대로** 옮긴다. 원본 위치를 값마다
 * 적어뒀다 — 나중에 "왜 이 숫자인가"를 물을 때 목업으로 돌아갈 수 있어야 한다.
 *
 * 데이터가 필요한 값(배지 개수·목록·손익)은 손대지 않고 `emptyVals()`가 준
 * 빈 값 그대로 둔다. 그것들은 드라이버가 생긴 뒤 화면별 배선에서 채운다.
 */

import { emptyVals, type TemplateVals } from "./generated/vals.js"

/** 목업 L3666. 사이드바 순서이자 화면 키다. */
export const NAV = [
  "dash", "settlement", "products", "diag", "costs", "orders", "connect",
  "import", "sync", "linking", "fieldmap", "myfields", "design", "settings",
] as const

export type NavKey = (typeof NAV)[number]

/** 목업 L3667. 헤더의 제목과 부제. */
export const TITLES: Record<NavKey, readonly [string, string]> = {
  dash: ["손익 대시보드", "2026년 8월"],
  settlement: ["정산", "Settlement · 마켓 정산서 대사"],
  products: ["상품", "Product → SKU → MarketplaceListing"],
  diag: ["진단", "무엇을 할지 — 포지셔닝 · 광고 효율 · 신규 상품"],
  costs: ["비용", "Cost · 회사가 주인인 데이터"],
  orders: ["주문", "Order · OrderItem"],
  connect: ["채널", "MarketplaceConnection · 누구한테서 받나"],
  import: ["가져오기", "파일 · URL · 직접 입력 — 어떻게 넣나"],
  sync: ["가져오기 기록", "ImportBatch · 뭐가 들어왔나"],
  linking: ["상품 연결", "MarketplaceListing → SKU · 개체 매핑"],
  fieldmap: ["필드 매핑", "양식(마켓 × 문서) → Canonical 필드"],
  myfields: ["내 필드", "회사 전용 확장 필드 · Canonical 격리"],
  design: ["데이터 구조", "Canonical Commerce Schema"],
  settings: ["설정", "Credential · Adjustment"],
}

/**
 * 온보딩 3단계 — 목업 L5695~5704 그대로.
 *
 * **시드 데이터가 아니라 제품 카피다.** DB에서 오지 않고, 가져온 파일이 0건일
 * 때 무엇을 하면 되는지 알려주는 고정 문장이다. 그래서 `emptyVals()`의 빈
 * 배열을 여기서 덮어쓴다 — 비워두면 첫 화면에서 안내가 통째로 사라진다.
 *
 * 색을 여기서 정하는 것도 원본 그대로다. JSX에서 삼항으로 고르면 표시 규칙이
 * 뷰로 새어 들어간다 (첫 시험에서 실제로 그렇게 어긋났다).
 */
const ONBOARD_STEPS = [
  {
    n: "1",
    title: "정산서 넣기",
    desc: "쿠팡 Wing에서 내려받은 정산 파일을 여기에 끌어다 놓으세요. CSV·XLSX 모두 됩니다.",
    state: "now",
  },
  {
    n: "2",
    title: "양식 확인",
    desc: "컬럼을 자동으로 알아봅니다. 못 알아본 것만 골라주시면 다음부터는 기억합니다.",
    state: "next",
  },
  {
    n: "3",
    title: "원가 넣기",
    desc: "매입원가는 마켓이 주지 않습니다. SKU별로 넣으면 그때부터 순이익이 나옵니다.",
    state: "next",
  },
] as const

const ONBOARD = ONBOARD_STEPS.map((s) => ({
  n: s.n,
  title: s.title,
  desc: s.desc,
  bg: s.state === "now" ? "var(--accent)" : "var(--bg-elevated-2)",
  fg: s.state === "now" ? "var(--fg-on-accent)" : "var(--fg-4)",
  border: s.state === "now" ? "var(--accent)" : "var(--border)",
}))

export interface ShellState {
  view: NavKey
  navCollapsed: boolean
  theme: "dark" | "light"
  /** 좁은 화면인가. 목업 L3908의 `matchMedia("(max-width: 1023px)")`. */
  isNarrow: boolean
  firstRun: boolean
}

export const INITIAL_SHELL: ShellState = {
  view: "dash",
  navCollapsed: false,
  theme: "dark",
  isNarrow: false,
  firstRun: true,
}

export interface ShellActions {
  /** 목업 L3709 `nav(v, extra)` — 화면을 바꾸고 선택을 푼다. */
  go: (view: NavKey) => void
  toggleNav: () => void
  toggleTheme: () => void
}

function byNav<T>(make: (k: NavKey) => T): Record<NavKey, T> {
  const out = {} as Record<NavKey, T>
  for (const k of NAV) out[k] = make(k)
  return out
}

/**
 * 빈 값 위에 셸 부분만 덮어쓴다.
 *
 * `emptyVals()`를 바탕으로 삼는 것이 요점이다 — 아직 배선하지 않은 350여 개
 * 값이 **빈 채로 정직하게** 남고, 채운 것과 안 채운 것이 이 함수의 diff로
 * 한눈에 보인다.
 */
export function shellVals(state: ShellState, actions: ShellActions): TemplateVals {
  const vals = emptyVals()
  const { view, navCollapsed, theme, isNarrow, firstRun } = state

  // 목업 L3915~3917
  vals.v = byNav((k) => k === view)
  vals.nav = byNav((k) => (k === view ? "active" : ""))
  vals.go = byNav((k) => () => actions.go(k))

  // 목업 L5348~5353. 좁은 화면에서는 접힘 상태를 무시하고 항상 편다 —
  // 좁을 때 사이드바는 겹쳐 뜨는 서랍이라 폭이 0이면 열 수가 없다.
  const wide = isNarrow || !navCollapsed
  const navOpen = !navCollapsed
  vals.navW = wide ? "232px" : "0px"
  vals.navPad = wide ? "10px 8px" : "10px 0"
  vals.navBorder = wide ? "1px" : "0"
  vals.navOpenAttr = navOpen ? "true" : "false"
  vals.navClosed = !navOpen
  vals.appNavClass = navOpen ? "nav-open" : ""
  vals.toggleNav = actions.toggleNav

  // 목업 L5272
  const [title, subtitle] = TITLES[view]
  vals.title = title
  vals.subtitle = subtitle

  // 목업 L5342
  vals.themeIcon = theme === "dark" ? "sun" : "moon"
  vals.toggleTheme = actions.toggleTheme

  // 첫 실행. 지금은 늘 참이다 — 가져온 batch가 0건이기 때문이고, 그게 사실이다.
  // 드라이버가 붙으면 "batch 수 > 0"으로 판정한다.
  vals.firstRun = firstRun
  vals.notFirstRun = !firstRun
  vals.onboard = ONBOARD

  return vals
}
