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
import { NAV, TITLES, UNBUILT } from "../src/app/shell.js"
import type { ProfitRow } from "../src/core/profit/rows.js"

type Item = { icon: string; label: string; sub: string; run: () => void }

const PRODUCTS = [
  { skuId: "s1", code: "SKU-0001", name: "머레이 냉감패드", qty: 1, revenue: 1, discount: 0, cogs: 0, noCostQty: 0 },
] as unknown as readonly ProfitRow[]

function build(query: string, opts: { products?: readonly ProfitRow[] } = {}) {
  const vals = emptyVals()
  const went: string[] = []
  let closed = false
  paletteVals(
    vals,
    true,
    query,
    { products: opts.products ?? [], linking: null },
    {
      close: () => { closed = true },
      setQuery: () => {},
      go: (v) => went.push(v),
      goImport: () => went.push("import!"),
    },
  )
  return { vals, items: vals.cmdItems as readonly Item[], went, closed: () => closed }
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
