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

/**
 * 폭에 맞춘 초기 상태. **목업 L3690이 이걸 한다** —
 * `navCollapsed: matchMedia("(max-width: 1023px)").matches`
 *
 * 좁은 화면에서 사이드바는 겹쳐 뜨는 서랍이므로 **접힌 채로 시작해야** 한다.
 * 이 한 줄이 없으면 폰 폭에서 앱을 켜자마자 서랍이 본문을 덮은 채 뜬다.
 */
export function shellStateFor(isNarrow: boolean): ShellState {
  return { ...INITIAL_SHELL, isNarrow, navCollapsed: isNarrow }
}

export interface ShellActions {
  /** 목업 L3709 `nav(v, extra)` — 화면을 바꾸고 선택을 푼다. */
  go: (view: NavKey) => void
  toggleNav: () => void
  /** 목업 L5355. 좁은 화면에서 스크림을 눌러 드로어를 닫는다. */
  closeNav: () => void
  /** 하단 탭바의 "더보기"가 사이드바를 연다. */
  openNav: () => void
  /**
   * 목업 L5692 `goImport` — 가져오기 화면으로 가고 첫 실행 상태를 벗어난다.
   * 빈 상태 화면 3곳의 "정산 파일 가져오기"와 온보딩 드롭존이 전부 이걸 부른다.
   */
  goImport: () => void
  toggleTheme: () => void
}

/**
 * 좁은 화면(S)의 하단 탭바 — 목업 L5678~5689. §21이 요구하는 "4개+더보기"다.
 *
 * ★ 목업의 결함 하나를 고쳐서 옮긴다 ★
 * 원본의 `pick`은 `setState({ navOpen: true })`를 하는데, 렌더는
 * `navOpen = !this.state.navCollapsed`(L3909)를 본다. 즉 **"더보기"를 눌러도
 * 사이드바가 열리지 않는다** — 좁은 화면에서 나머지 11개 화면으로 가는 길이
 * 막힌다. §21의 "어떤 브레이크포인트에서도 기능 제거 ❌ · 모든 기능 최대 2탭
 * 도달"에 정면으로 걸리므로, 충돌 시 §21이 목업을 이긴다는 기준에 따라 고쳤다.
 * 핸드오프의 알려진 결함 목록에는 없던 것이다.
 */
const TABBAR = [
  { id: "dash", icon: "layout-dashboard", label: "대시보드" },
  { id: "settlement", icon: "receipt", label: "정산" },
  { id: "diag", icon: "target", label: "진단" },
  { id: "__more", icon: "menu", label: "더보기" },
] as const

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

  // 목업 L5348~5353. 좁은 화면에서 폭이 늘 232px인 것은 "항상 펴진다"는 뜻이
  // 아니라 **서랍의 폭**이다 — 좁을 때 사이드바는 `position: fixed`로 겹쳐
  // 뜨고, 보이고 말고는 `nav-open`/`data-open`이 정한다 (vector-app.css L35~39).
  const wide = isNarrow || !navCollapsed
  const navOpen = !navCollapsed
  vals.navW = wide ? "232px" : "0px"
  vals.navPad = wide ? "10px 8px" : "10px 0"
  vals.navBorder = wide ? "1px" : "0"
  vals.navOpenAttr = navOpen ? "true" : "false"
  vals.navClosed = !navOpen
  vals.appNavClass = navOpen ? "nav-open" : ""
  vals.toggleNav = actions.toggleNav

  // 목업 L5354~5355. 좁은 화면에서 서랍이 열려 있으면 뒤를 덮고, 그걸 눌러 닫는다.
  // 이 두 줄이 없으면 서랍이 본문 위에 걸린 채 빠져나올 길이 없다.
  vals.navScrim = isNarrow && navOpen
  vals.closeNav = actions.closeNav

  // 목업 L5678~5689. 탭을 고르면 화면을 바꾸고 서랍을 닫는다 — 원본의
  // `navOpen: false`가 노린 동작이다.
  vals.tabbar = TABBAR.map((t) => ({
    icon: t.icon,
    label: t.label,
    on: t.id !== "__more" && view === t.id ? "active" : "",
    pick:
      t.id === "__more"
        ? actions.openNav
        : () => {
            actions.go(t.id as NavKey)
            actions.closeNav()
          },
  }))

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
  vals.goImport = actions.goImport

  applyUnbuilt(vals, firstRun)
  return vals
}

/**
 * ★ §21-7 — 아직 만들지 않은 화면은 그렇게 말한다 ★
 *
 * ─────────────────────────────────────────────────────────────
 * 목업에는 화면 상태가 **둘뿐**이었다:
 *
 * ```
 * firstRun     앱에 데이터가 하나도 없다   → 온보딩 안내
 * notFirstRun  데이터가 있다               → 본문
 * ```
 *
 * 시드가 전 화면을 채웠으니 목업에서는 그걸로 충분했다. 실제로는 **세 번째 상태**가
 * 있다 — *«데이터는 있는데 이 화면을 아직 만들지 않았다»*. 대시보드가 데이터를 받는
 * 순간 `firstRun`이 전역으로 꺼지고, 배선 안 된 화면은 온보딩 안내마저 잃고 **아무 말도
 * 하지 않는 백지**가 된다. 실측: 진단 160바이트 · 설정 267 · 가져오기 366.
 *
 * 사용자가 2d에서 «가져오기»를 눌렀다가 이 백지를 만났고, 고장으로 읽었다.
 * 빈 화면이 침묵하면 «없다»가 아니라 «깨졌다»로 읽힌다 (LOCK 6의 화면판).
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 이 함수는 **임시물**이다 ★
 * 화면이 배선되는 날 그 키를 목록에서 지우고, 목록이 비면 함수째 지운다. 마크업 쪽
 * 안내 블록도 함께 지운다 — `convert-gate`의 구간 선언에 «배선 시 제거»로 표기해
 * §21 대장에서 추적한다. 남겨두면 배선이 끝난 화면이 계속 "준비 중"이라고 말한다.
 */
export const UNBUILT: readonly NavKey[] = ["diag"]

function applyUnbuilt(vals: TemplateVals, firstRun: boolean): void {
  const unbuilt = (key: NavKey): boolean => UNBUILT.includes(key)

  // 미구현이면 온보딩도 본문도 그리지 않는다. 셋 중 하나만 뜬다 —
  // 안내와 빈 껍데기가 함께 뜨면 "준비 중인데 왜 빈 탭바가 있지"가 된다.
  vals.diagUnbuilt = unbuilt("diag")
  vals.diagOnboard = firstRun && !vals.diagUnbuilt
  vals.diagReady = !firstRun && !vals.diagUnbuilt

  /**
   * ★ 상품 화면이 배선됐다 (③, 2026-08-14) ★
   *
   * 여기 있던 «아직 만들지 않았습니다» 안내가 지워진 자리다. 2d에서 사용자가
   * [새 SKU로 등록]을 16번 눌렀는데 이 화면이 백지라 **등록이 안 된 줄 알았던**
   * 그 화면이고, 이제 SKU가 목록으로 보이며 원가를 그 자리에서 넣는다.
   *
   * 임시물의 수명은 설계대로 관리됐다 — `UNBUILT`에서 «products»를 빼자
   * `convert-gate`의 «배선 시 제거» 단언이 먼저 깨졌고, 그것이 안내 마크업과
   * 구간 선언을 함께 지우라는 신호였다.
   */
  vals.prodUnbuilt = unbuilt("products")
  vals.prodReady = !vals.prodUnbuilt
}
