/**
 * 셸 배선 — `renderVals`의 화면 껍데기 부분을 옮긴 것이 목업과 같은 값을 내는가.
 *
 * 여기서 보는 것은 **표시용 포맷팅**뿐이다. 데이터도 계산도 셸에는 없다
 * (분해 규칙: 데이터는 리포지토리, 계산은 `computePnl`).
 */

import { describe, expect, it } from "vitest"
import { NAV, TITLES, INITIAL_SHELL, shellVals, type NavKey } from "../src/app/shell.js"

const noop = { go: () => {}, toggleNav: () => {}, toggleTheme: () => {} }
const at = (over: Partial<typeof INITIAL_SHELL> = {}) =>
  shellVals({ ...INITIAL_SHELL, ...over }, noop)

describe("셸 — 화면 전환", () => {
  it("현재 화면만 v가 참이다", () => {
    const vals = at({ view: "settlement" })
    const on = NAV.filter((k) => vals.v[k])
    expect(on).toEqual(["settlement"])
  })

  it("현재 화면만 nav가 active다 (목업 L3916)", () => {
    const vals = at({ view: "costs" })
    expect(vals.nav.costs).toBe("active")
    expect(vals.nav.dash).toBe("")
  })

  it("go는 14개 화면 전부에 있다", () => {
    const vals = at()
    for (const k of NAV) expect(typeof vals.go[k], k).toBe("function")
  })

  it("헤더가 화면을 따라간다 (목업 L5272)", () => {
    for (const k of NAV) {
      const vals = at({ view: k })
      expect(vals.title, k).toBe(TITLES[k as NavKey][0])
      expect(vals.subtitle, k).toBe(TITLES[k as NavKey][1])
    }
  })
})

describe("셸 — 사이드바 (목업 L5348~5353)", () => {
  it("펼쳐져 있으면 232px", () => {
    const vals = at({ navCollapsed: false })
    expect(vals.navW).toBe("232px")
    expect(vals.navPad).toBe("10px 8px")
    expect(vals.navBorder).toBe("1px")
    expect(vals.navOpenAttr).toBe("true")
    expect(vals.navClosed).toBe(false)
    expect(vals.appNavClass).toBe("nav-open")
  })

  it("접으면 0px", () => {
    const vals = at({ navCollapsed: true })
    expect(vals.navW).toBe("0px")
    expect(vals.navBorder).toBe("0")
    expect(vals.navClosed).toBe(true)
    expect(vals.appNavClass).toBe("")
  })

  it("좁은 화면에서는 접힘을 무시하고 편다 — 폭이 0이면 열 수가 없다", () => {
    const vals = at({ navCollapsed: true, isNarrow: true })
    expect(vals.navW).toBe("232px")
  })
})

describe("셸 — 테마 (목업 L5342)", () => {
  it("어두우면 해, 밝으면 달", () => {
    expect(at({ theme: "dark" }).themeIcon).toBe("sun")
    expect(at({ theme: "light" }).themeIcon).toBe("moon")
  })
})

describe("셸 — 첫 실행", () => {
  it("온보딩 3단계는 카피라서 비어 있으면 안 된다", () => {
    const vals = at()
    expect(vals.onboard).toHaveLength(3)
    expect(vals.onboard[0]).toMatchObject({ n: "1", title: "정산서 넣기" })
  })

  it("첫 단계만 강조된다 — 색은 데이터가 준다 (뷰가 정하지 않는다)", () => {
    const [first, second] = at().onboard as { bg: string; fg: string }[]
    expect(first?.bg).toBe("var(--accent)")
    expect(second?.bg).toBe("var(--bg-elevated-2)")
  })

  it("firstRun과 notFirstRun은 서로 반대다", () => {
    expect(at({ firstRun: true }).notFirstRun).toBe(false)
    expect(at({ firstRun: false }).notFirstRun).toBe(true)
  })
})

describe("셸이 건드리지 않은 값은 비어 있다", () => {
  it("데이터가 필요한 값은 여전히 빈 채다 — 시드를 넣지 않는다", () => {
    const vals = at()
    expect(vals.setRows).toEqual([])
    expect(vals.pendingCount).toBe("")
    expect(vals.confirm).toBeNull()
  })
})
