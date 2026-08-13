/**
 * 앱 셸 — 3a-b 이식.
 *
 * 목업 화면은 이제 **변환기 출력**(`generated/Template.tsx`)이 통째로 그린다.
 * 손으로 옮긴 온보딩은 여기 없다 — 첫 시험에서 손 이식이 목업과 어긋난 것이
 * 드러났고(카피 3개 누락·색 결정이 뷰로 이동·onClick 소실), 기계 변환본이
 * 그 자리를 받았다. 그 기록은 커밋 `7f2a805`에 있다.
 *
 * 이 파일이 하는 일은 **상태를 들고 있는 것**뿐이다:
 *
 * ```
 * 화면 전환 · 사이드바 접힘 · 테마   →  여기 (React 상태)
 * 값의 모양                          →  shell.ts (목업 renderVals의 표시 부분)
 * 마크업                             →  generated/Template.tsx (기계 변환)
 * 데이터                             →  아직 없다
 * ```
 *
 * ★ 데이터가 없다 ★
 * 웹뷰용 드라이버가 아직 없어(ADR-008의 Tauri 커맨드 미구현) 리포지토리에
 * 붙지 않았다. 배지·목록·손익은 `emptyVals()`가 준 빈 값 그대로다 —
 * **시드를 넣어 채워 보이지 않는다.** 화면이 비어 보이는 것이 지금의 사실이다.
 */

import { useCallback, useEffect, useState } from "react"
import { Template } from "./generated/Template.js"
import { dashboardVals } from "./dashboard.js"
import { settlementVals } from "./settlement.js"
import { DEV_PERIOD, loadDevSnapshot } from "./data.js"
import type { PnlSnapshot } from "@core/profit/snapshot.js"
import type { SettlementRow } from "@core/settlement/rows.js"
import { shellStateFor, shellVals, type NavKey, type ShellState } from "./shell.js"

/** 목업 L3908과 같은 기준. 사이드바가 서랍이 되는 폭이다. */
const NARROW = "(max-width: 1023px)"

export function App(): React.JSX.Element {
  // 첫 렌더부터 폭에 맞는 상태여야 한다. 좁은 화면에서 서랍이 열린 채로
  // 한 프레임이라도 뜨면 본문을 덮는다 (목업 L3690과 같은 판단).
  const [state, setState] = useState<ShellState>(() =>
    shellStateFor(typeof window !== "undefined" && window.matchMedia(NARROW).matches),
  )

  // 목업은 렌더 시점에 matchMedia를 한 번 읽고 끝이라 창을 줄여도 반응하지
  // 않는다. React에서는 상태로 들고 구독해야 같은 화면이 나오므로 그렇게 한다 —
  // 목업의 결함을 옮기지 않는 쪽이고, §21 "좁은 화면" 항목과도 어긋나지 않는다.
  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const sync = (): void =>
      setState((s) => {
        if (mq.matches === s.isNarrow) return s
        // 경계를 **넘을 때만** 접힘을 다시 정한다. 같은 모드 안에서는 사용자가
        // 직접 연 서랍을 리사이즈가 마음대로 닫지 않는다.
        return { ...s, isNarrow: mq.matches, navCollapsed: mq.matches }
      })
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme)
  }, [state.theme])

  // 3b-0 CLI가 만든 DB를 읽는다. 실제 배포 경로(사용자 데이터 디렉터리 +
  // 가져오기 화면)는 아직 없다 — 지금은 **화면 숫자 = CLI 숫자**를 증명하는
  // 것이 목적이고, 같은 DB를 같은 스냅샷 함수로 읽으므로 구조가 그걸 보장한다.
  const [snap, setSnap] = useState<PnlSnapshot | null>(null)
  const [setRows, setSetRows] = useState<readonly SettlementRow[]>([])
  useEffect(() => {
    void loadDevSnapshot().then((r) => {
      if (r.snapshot) setSnap(r.snapshot)
      else console.warn("[data] 스냅샷을 읽지 못했다 — 빈 화면이 지금의 사실이다:", r.error)
      setSetRows(r.settlement)
    })
  }, [])

  const go = useCallback((view: NavKey) => setState((s) => ({ ...s, view })), [])
  const toggleNav = useCallback(
    () => setState((s) => ({ ...s, navCollapsed: !s.navCollapsed })),
    [],
  )
  const closeNav = useCallback(() => setState((s) => ({ ...s, navCollapsed: true })), [])
  const openNav = useCallback(() => setState((s) => ({ ...s, navCollapsed: false })), [])
  // 목업 L5692. 첫 실행 안내를 벗어나면서 가져오기 화면으로 간다.
  const goImport = useCallback(
    () => setState((s) => ({ ...s, view: "import", firstRun: false })),
    [],
  )
  const toggleTheme = useCallback(
    () => setState((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" })),
    [],
  )

  const vals = shellVals(state, { go, toggleNav, closeNav, openNav, goImport, toggleTheme })
  // 데이터가 있으면 대시보드 값을 덮어쓴다. 없으면 빈 값 그대로 —
  // 시드를 넣어 채워 보이지 않는다 (헌장 C).
  if (snap) {
    dashboardVals(vals, snap, DEV_PERIOD)
    // 데이터가 들어왔으니 첫 실행 안내는 지나간다.
    vals.firstRun = false
    vals.notFirstRun = true
  }
  // 정산은 손익과 **다른 조회**라 따로 배선한다. 둘 다 같은 순간의 같은 DB를
  // 읽으므로(loadDevSnapshot이 연결을 한 번만 연다) 화면끼리 어긋나지 않는다.
  if (setRows.length > 0) settlementVals(vals, setRows, DEV_PERIOD)

  return <Template vals={vals} />
}
