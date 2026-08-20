/**
 * 셸 배선 — `renderVals`의 화면 껍데기 부분을 옮긴 것이 목업과 같은 값을 내는가.
 *
 * 여기서 보는 것은 **표시용 포맷팅**뿐이다. 데이터도 계산도 셸에는 없다
 * (분해 규칙: 데이터는 리포지토리, 계산은 `computePnl`).
 */

import { describe, expect, it } from "vitest"
import { NAV, TITLES, INITIAL_SHELL, shellStateFor, shellVals, type NavKey } from "../src/app/shell.js"

const noop = { go: () => {}, toggleNav: () => {}, closeNav: () => {}, openNav: () => {}, goImport: () => {}, toggleTheme: () => {} }
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

describe("좁은 화면 — 서랍이 본문을 덮은 채 뜨면 안 된다 (§21)", () => {
  it("폭이 좁으면 접힌 채로 시작한다 (목업 L3690)", () => {
    expect(shellStateFor(true).navCollapsed).toBe(true)
    expect(shellStateFor(false).navCollapsed).toBe(false)
  })

  it("좁은 화면에서 열려 있으면 스크림이 뜬다 (목업 L5354)", () => {
    expect(at({ isNarrow: true, navCollapsed: false }).navScrim).toBe(true)
  })

  it("접혀 있으면 스크림은 없다 — 눌러서 닫을 것이 없다", () => {
    expect(at({ isNarrow: true, navCollapsed: true }).navScrim).toBe(false)
  })

  it("넓은 화면에서는 열려 있어도 스크림이 없다 — 겹치지 않으니까", () => {
    expect(at({ isNarrow: false, navCollapsed: false }).navScrim).toBe(false)
  })

  it("스크림을 닫는 손잡이가 배선돼 있다 (목업 L5355)", () => {
    expect(typeof at().closeNav).toBe("function")
  })
})

describe("하단 탭바 — §21의 \"4개+더보기\"", () => {
  it("항목이 4개다 (목업 L5678)", () => {
    const t = at().tabbar as { label: string }[]
    expect(t.map((x) => x.label)).toEqual(["대시보드", "정산", "진단", "더보기"])
  })

  it("현재 화면만 active다", () => {
    const t = at({ view: "settlement" }).tabbar as { label: string; on: string }[]
    expect(t.filter((x) => x.on === "active").map((x) => x.label)).toEqual(["정산"])
  })

  it("더보기는 active가 되지 않는다 — 화면이 아니라 손잡이다", () => {
    for (const v of NAV) {
      const t = at({ view: v }).tabbar as { label: string; on: string }[]
      expect(t[3]?.on, v).toBe("")
    }
  })

  it("★ 더보기가 사이드바를 연다 ★ — 목업은 여기서 동작하지 않았다", () => {
    let opened = false
    const vals = shellVals(INITIAL_SHELL, { ...noop, openNav: () => { opened = true } })
    const t = vals.tabbar as { pick: () => void }[]
    t[3]?.pick()
    expect(opened, "더보기를 눌러도 사이드바가 열리지 않는다 — S에서 11개 화면이 막힌다").toBe(true)
  })

  it("탭을 고르면 화면을 바꾸고 서랍을 닫는다", () => {
    const seen: string[] = []
    const vals = shellVals(INITIAL_SHELL, {
      ...noop,
      go: (v) => seen.push("go:" + v),
      closeNav: () => seen.push("close"),
    })
    const t = vals.tabbar as { pick: () => void }[]
    t[1]?.pick()
    expect(seen).toEqual(["go:settlement", "close"])
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

  it("빈 상태의 '정산 파일 가져오기'가 배선돼 있다 (목업 L5692)", () => {
    let called = false
    const vals = shellVals(INITIAL_SHELL, { ...noop, goImport: () => { called = true } })
    vals.goImport()
    expect(called, "누르면 아무 일도 일어나지 않는다").toBe(true)
  })

  /**
   * ★ 상태가 **셋**이다 — 모름 · 없음 · 있음 (2026-08-21) ★
   *
   * 예전 계약은 「`firstRun`과 `notFirstRun`은 서로 반대」였고, 그건 목업의
   * 이분법이었다. 실물은 조회가 비동기라 **답을 모르는 구간**이 있고, 그때
   * 이분법을 쓰면 앱이 뜨자마자 「데이터가 하나도 없습니다」를 그렸다가 조회가
   * 끝나면 갈아치운다 — 사용자가 «앱 열자마자 대시보드로 점프한다»고 물은 현상이다.
   *
   * 깜빡임보다 나쁜 것은 그 문장이 **거짓말**이라는 것이다: 그동안 앱은 「없다」고
   * 말하지만 실은 «아직 모른다»다 (§22 «부재는 boolean이 아니다»).
   */
  it("★ 조회 전에는 **둘 다 거짓**이다 — 「없다」도 「있다」도 아직 모른다 ★", () => {
    const v = at({ loading: true, firstRun: true })
    expect(v.appLoading).toBe(true)
    expect(v.firstRun, "모르는데 «없다»고 말한다").toBe(false)
    expect(v.notFirstRun, "모르는데 본문을 그린다 — 0원을 사실인 척한다").toBe(false)
  })

  it("조회가 끝나면 둘이 서로 반대가 된다", () => {
    expect(at({ loading: false, firstRun: true })).toMatchObject({
      appLoading: false,
      firstRun: true,
      notFirstRun: false,
    })
    expect(at({ loading: false, firstRun: false })).toMatchObject({
      appLoading: false,
      firstRun: false,
      notFirstRun: true,
    })
  })

  it("기본 상태는 「모름」이다 — 아무것도 안 물어봤으면 아무것도 모른다", () => {
    expect(INITIAL_SHELL.loading).toBe(true)
    expect(at().appLoading).toBe(true)
  })

  it("진단의 세 갈래도 「모름」이 밀어낸다 — 안내와 본문이 함께 뜨지 않는다", () => {
    const v = at({ loading: true })
    expect(v.diagOnboard).toBe(false)
    expect(v.diagReady).toBe(false)
    // 미구현 안내는 조회와 무관하다 — 그건 데이터가 아니라 우리가 안 만든 것이다.
    expect(v.diagUnbuilt).toBe(true)
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
