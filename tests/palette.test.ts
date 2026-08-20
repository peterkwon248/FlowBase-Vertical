/**
 * ⌘K 명령 팔레트 — **적혀 있으면 동작해야 한다** (U-3 · 감사 A-2-3).
 *
 * ─────────────────────────────────────────────────────────────
 * 마크업은 처음부터 통째로 있었다 — 입력칸·목록·빈 상태·`esc`까지. 그런데
 * `cmdOpen`을 켜는 코드가 0이고 키 리스너도 0이었다. 헤더에는 **「⌘K」라고 적혀
 * 있다.** 적어 놓고 안 되는 것이 U-3이 금지하는 바로 그것이다.
 *
 * 좁은 화면에서는 두 번째 통로이기도 하다 — 768px 미만에서 헤더가 접히는데(A-3)
 * 「더보기」와 ⌘K가 **둘 다** 죽어 있으면 되찾을 길이 하나도 없었다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { emptyVals } from "../src/app/generated/vals.js"
import { paletteVals } from "../src/app/palette.js"
import { NAV, TITLES, UNBUILT, shellVals, shellStateFor } from "../src/app/shell.js"

/** 셸 배선만 보는 시험이라 행동은 필요 없다. */
const SHELL_NOOP = {
  go: () => {},
  toggleNav: () => {},
  closeNav: () => {},
  openNav: () => {},
  goImport: () => {},
  toggleTheme: () => {},
}
import type { ProfitRow } from "../src/core/profit/rows.js"

type Item = { icon: string; label: string; sub: string; run: () => void }

const PRODUCTS = [
  { skuId: "s1", code: "SKU-0001", name: "머레이 냉감패드", qty: 1, revenue: 1, discount: 0, cogs: 0, noCostQty: 0 },
] as unknown as readonly ProfitRow[]

function build(query: string, opts: { products?: readonly ProfitRow[] } = {}) {
  const vals = emptyVals()
  const went: string[] = []
  let closed = false
  let opened = false
  paletteVals(
    vals,
    true,
    query,
    { products: opts.products ?? [], linking: null },
    {
      close: () => { closed = true },
      open: () => { opened = true },
      setQuery: () => {},
      go: (v) => went.push(v),
      goImport: () => went.push("import!"),
    },
  )
  return {
    vals,
    items: vals.cmdItems as readonly Item[],
    went,
    closed: () => closed,
    opened: () => opened,
  }
}

describe("⌘K — 이동", () => {
  it("★ 만든 화면 전부가 목록에 있다 ★", () => {
    const { items } = build("")
    const labels = items.map((i) => i.label)
    for (const key of NAV) {
      if (UNBUILT.includes(key)) continue
      expect(labels, `${key} 화면으로 갈 길이 없다`).toContain(TITLES[key][0])
    }
  })

  /**
   * ★ 안 만든 화면은 **넣지 않는다** ★
   * 골라서 갔는데 「준비 중」이 뜨면 팔레트가 거짓말한 것이다 (LOCK 6).
   */
  it("★ 미구현 화면은 목록에 없다 ★", () => {
    const labels = build("").items.map((i) => i.label)
    for (const key of UNBUILT) {
      expect(labels, `${key}는 아직 못 만든 화면인데 팔레트가 안내한다`).not.toContain(TITLES[key][0])
    }
  })

  it("고르면 그 화면으로 가고 팔레트가 닫힌다", () => {
    const b = build("")
    const settle = b.items.find((i) => i.label === TITLES.settlement[0])!
    settle.run()
    expect(b.went).toEqual(["settlement"])
    expect(b.closed(), "고르고도 팔레트가 남아 있다").toBe(true)
  })

  it("검색이 목록을 좁힌다", () => {
    const all = build("").items.length
    const some = build("정산").items
    expect(some.length).toBeLessThan(all)
    expect(some.map((i) => i.label)).toContain("정산")
  })

  /**
   * 부제는 «이동»·«실행»처럼 **행위**여야 한다. `TITLES`의 부제는
   * «Order · OrderItem»처럼 내부 어휘라 그대로 보이면 U-5에 걸린다.
   */
  it("★ 내부 어휘가 부제로 새지 않는다 (U-5) ★", () => {
    const subs = build("").items.map((i) => i.sub)
    for (const s of subs) {
      expect(s, `부제에 내부 어휘가 샜다: ${s}`).not.toMatch(/Order|Marketplace|Canonical|Cost ·/)
    }
  })
})

describe("⌘K — 가져오기 · 검색", () => {
  it("가져오기가 목록에 있다 — placeholder가 약속한 것이다", () => {
    const b = build("")
    const imp = b.items.find((i) => i.label === "파일 가져오기")
    expect(imp, "placeholder는 «이동 · 가져오기 · SKU 검색»이라고 적혀 있다").toBeDefined()
    imp!.run()
    expect(b.went).toEqual(["import!"])
  })

  it("★ 상품은 **글자를 넣었을 때만** 나온다 ★", () => {
    const empty = build("", { products: PRODUCTS }).items
    expect(empty.some((i) => i.label === "머레이 냉감패드"), "빈 질의에 상품을 쏟으면 이동이 밀려난다")
      .toBe(false)
    const found = build("냉감", { products: PRODUCTS }).items
    expect(found.some((i) => i.label === "머레이 냉감패드")).toBe(true)
  })

  it("상품코드로도 찾힌다", () => {
    expect(build("sku-0001", { products: PRODUCTS }).items.some((i) => i.sub.includes("SKU-0001")))
      .toBe(true)
  })

  it("「결과 없음」은 찾아봤을 때만 뜬다", () => {
    expect(build("").vals.cmdEmpty).toBe(false)
    expect(build("zzz없는것").vals.cmdEmpty).toBe(true)
  })

  it("esc가 닫는다 — 팝오버에 «esc»라고 적혀 있다", () => {
    const b = build("")
    ;(b.vals.onCmdKey as (e: { key: string }) => void)({ key: "Escape" })
    expect(b.closed()).toBe(true)
  })
})

describe("여는 키가 실제로 걸려 있다", () => {
  /**
   * 팔레트 안의 `onKeyDown`은 **이미 열린 뒤에만** 듣는다. 여는 키는 문서 전역
   * 리스너라야 하고, 그게 없으면 화면의 「⌘K」가 다시 거짓말이 된다.
   */
  it("★ 문서 전역 ⌘K 리스너가 있다 ★", () => {
    const app = readFileSync("src/app/App.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    expect(app, "document에 keydown을 걸지 않는다").toMatch(/document\.addEventListener\("keydown"/)
    expect(app, "metaKey·ctrlKey를 안 본다 — 맥과 윈도 중 하나가 죽는다").toMatch(/metaKey.*ctrlKey|ctrlKey.*metaKey/)
    expect(app, "기본 동작을 안 막으면 주소창으로 포커스가 튄다").toMatch(/preventDefault\(\)/)
    expect(app, "리스너를 안 걷으면 화면을 옮길 때마다 쌓인다").toMatch(/removeEventListener\("keydown"/)
  })
})

describe("마우스로도 열린다 — 사이드바의 「검색 ⌘K」 상자", () => {
  /**
   * ★ 이 상자는 눌리는 척하고 있었다 (2026-08-20) ★
   * `Template.tsx:88`이 `cursor: "pointer"`와 `onClick={vals.openCmd}`를 달아 놨는데
   * `vals.ts:1251`의 `openCmd`가 `() => {}`였고 저장소 어디에도 대입이 없었다.
   * 키보드를 안 쓰는 사람에게는 팔레트가 **없는 것과 같았다.**
   *
   * U-3이 「못 누르는 것은 아예 안 그린다」이므로 답은 둘 중 하나였다 —
   * 배선하거나 상자를 지우거나. 「⌘K」라고 적힌 상자는 지울 것이 아니라 배선할 것이다.
   */
  it("★ openCmd가 빈 함수가 아니다 ★", () => {
    const b = build("")
    expect(typeof b.vals.openCmd, "openCmd가 함수가 아니다").toBe("function")
    ;(b.vals.openCmd as () => void)()
    expect(b.opened(), "사이드바 상자를 눌러도 팔레트가 안 열린다").toBe(true)
  })

  it("여는 것은 토글이 아니다 — 열려 있으면 그대로 열려 있다", () => {
    // 키보드 ⌘K는 토글이지만 상자를 누르는 사람은 「열어라」를 뜻한다.
    // 토글로 만들면 이미 열린 팔레트에서 상자를 누를 때 닫혀 버린다.
    const app = readFileSync("src/app/App.tsx", "utf8")
    expect(app, "open이 setCmdOpen(true)로 열지 않는다").toMatch(/open:\s*\(\)\s*=>\s*\{\s*setCmdOpen\(true\)/)
  })
})

describe("팝오버 안을 눌러도 안 닫힌다 — 앱 전체", () => {
  /**
   * ★ 앱 전체가 이것 하나로 반쯤 죽어 있었다 (2026-08-20) ★
   * `Template`이 `onClick={vals.stopEvt}`를 14곳, `vals.stop`을 2곳 달아 놨는데
   * 둘 다 `() => {}`였다. React 합성 이벤트는 버블하므로 안쪽 클릭이 바깥
   * 스크림에 닿아 **자기가 연 것을 자기가 닫는다.**
   *
   * 브라우저 실측: ⌘K를 열고 입력칸을 마우스로 누르면 그 자리에서 닫혔다 —
   * 마우스만 쓰는 사람은 검색어를 한 글자도 못 쳤다.
   *
   * 조정 팝오버·내보내기 메뉴·원가 입력칸·「언제부터」 select가 같은 배선을 쓴다.
   * 그래서 화면별이 아니라 **셸 한 자리**에서 준다.
   */
  it("★ stop·stopEvt가 실제로 버블을 막는다 ★", () => {
    const vals = shellVals(shellStateFor(false), SHELL_NOOP)
    for (const key of ["stop", "stopEvt"] as const) {
      let stopped = false
      const fn = vals[key] as (e: { stopPropagation: () => void }) => void
      expect(typeof fn, `${key}가 함수가 아니다`).toBe("function")
      fn({ stopPropagation: () => { stopped = true } })
      expect(stopped, `${key}가 버블을 안 막는다 — 팝오버가 자기를 닫는다`).toBe(true)
    }
  })

  it("인자 없이 불려도 안 터진다", () => {
    const vals = shellVals(shellStateFor(false), SHELL_NOOP)
    expect(() => (vals.stop as () => void)()).not.toThrow()
  })
})
