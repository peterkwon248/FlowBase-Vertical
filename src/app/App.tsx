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
import { INITIAL_SHELL, shellVals, type NavKey, type ShellState } from "./shell.js"

/** 목업 L3908과 같은 기준. 사이드바가 서랍이 되는 폭이다. */
const NARROW = "(max-width: 1023px)"

export function App(): React.JSX.Element {
  const [state, setState] = useState<ShellState>(INITIAL_SHELL)

  // 목업은 렌더 시점에 matchMedia를 한 번 읽고 끝이라 창을 줄여도 반응하지
  // 않는다. React에서는 상태로 들고 구독해야 같은 화면이 나오므로 그렇게 한다 —
  // 목업의 결함을 옮기지 않는 쪽이고, §21 "좁은 화면" 항목과도 어긋나지 않는다.
  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const sync = (): void => setState((s) => ({ ...s, isNarrow: mq.matches }))
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme)
  }, [state.theme])

  const go = useCallback((view: NavKey) => setState((s) => ({ ...s, view })), [])
  const toggleNav = useCallback(
    () => setState((s) => ({ ...s, navCollapsed: !s.navCollapsed })),
    [],
  )
  const toggleTheme = useCallback(
    () => setState((s) => ({ ...s, theme: s.theme === "dark" ? "light" : "dark" })),
    [],
  )

  return <Template vals={shellVals(state, { go, toggleNav, toggleTheme })} />
}
