/**
 * 상품 화면 (③) — **목업이 못 하던 셋을 하는가, 그리고 없는 것을 지어내지 않는가.**
 *
 * ```
 * ① 초안이 SKU마다 따로다      목업은 costDraft 하나를 61행이 공유했다
 * ② 적용일이 있다               목업의 costQuick은 SKU당 숫자 하나였다
 * ③ 채운 뒤에도 고칠 수 있다    목업의 costFilled는 읽기 전용이었다
 * ```
 */

import { describe, expect, it } from "vitest"
import { renderToString } from "react-dom/server"
import { createElement } from "react"
import { Template } from "../src/app/generated/Template.js"
import { emptyVals } from "../src/app/generated/vals.js"
import { shellStateFor, shellVals } from "../src/app/shell.js"
import { emptyDraft, fromLabel, productVals, saveGuard, type CostDraftState } from "../src/app/product.js"
import type { ProductSkuRow, ProductView } from "../src/core/product/rows.js"

const TODAY = "2026-08-14"

const row = (o: Partial<ProductSkuRow> = {}): ProductSkuRow => ({
  skuId: "sku-1",
  code: "SKU-0001",
  name: "머그컵 · 블루",
  productName: "머그컵",
  status: "ACTIVE",
  cost: null,
  costFrom: null,
  costEntries: 0,
  channels: [],
  listingCount: 0,
  soldQty: null,
  ...o,
})

const view = (rows: readonly ProductSkuRow[], hasOrderItems = false): ProductView => ({
  rows,
  costed: rows.filter((r) => r.cost !== null).length,
  total: rows.length,
  hasOrderItems,
})

/**
 * 앱과 같은 순서로 값을 만든다 — `shellVals`가 먼저, 화면 배선이 나중.
 *
 * `emptyVals()`만 쓰면 `prodReady`가 거짓이라 화면이 통째로 안 그려진다. 그건
 * §21-7 게이트가 `shell.ts`에 있기 때문이고, **소유자를 늘리지 않으려고** 여기서도
 * 그 경로를 그대로 탄다 — 테스트가 화면 소유의 플래그를 직접 켜면 배선이 깨져도
 * 초록이 뜬다.
 */
const wire = (
  v: ProductView,
  drafts: ReadonlyMap<string, CostDraftState> = new Map(),
): ReturnType<typeof emptyVals> => {
  const noop = (): void => {}
  const vals = shellVals(shellStateFor(false), {
    go: noop, toggleNav: noop, closeNav: noop, openNav: noop, goImport: noop, toggleTheme: noop,
  })
  productVals(vals, v, "list", drafts, TODAY)
  return vals
}

/** 상품 화면만 켠 HTML. 다른 화면이 섞이면 «어느 자리의 문자열인가»가 흐려진다. */
const html = (vals: ReturnType<typeof emptyVals>): string =>
  renderToString(createElement(Template, { vals: { ...vals, v: { ...vals.v, products: true } } }))

describe("원가 입력칸", () => {
  it("★ 초안은 SKU마다 따로다 — 한 칸에 친 글자가 옆 행에 뜨지 않는다 ★", () => {
    const vals = wire(
      view([row(), row({ skuId: "sku-2", code: "SKU-0002" })]),
      new Map([["sku-1", { amount: "12000", effectiveFrom: TODAY }]]),
    )
    const rows = vals.skuRows as { costDraft: string }[]
    expect(rows[0]!.costDraft).toBe("12000")
    expect(rows[1]!.costDraft, "목업은 여기에도 12000이 떴다").toBe("")
  })

  it("적용일의 기본값은 오늘이고 **숨기지 않는다**", () => {
    const vals = wire(view([row()]))
    const r = (vals.skuRows as { dateDraft: string }[])[0]!
    expect(r.dateDraft).toBe(TODAY)
    // 상시 노출의 증거 — 마크업에 date 입력이 실제로 그려진다
    const out = html(vals)
    expect(out).toContain('type="date"')
    expect(out).toContain(`value="${TODAY}"`)
  })

  it("★ 원가가 있는 행에도 입력칸이 남는다 — 정정 경로가 있어야 한다 ★", () => {
    const vals = wire(view([row({ cost: 12_000, costFrom: "2026-08-01", costEntries: 1 })]))
    const r = (vals.skuRows as { costEmpty: boolean; costFilled: boolean; cost: string }[])[0]!
    expect(r.costEmpty, "«입력칸을 그린다»로 재해석했다").toBe(true)
    expect(r.costFilled).toBe(true)
    expect(r.cost, "지금 값과 **언제부터**를 함께 말한다").toBe("12,000원 · 8/1부터")
  })

  it("이력이 둘 이상이면 그 사실을 말한다 — 덮은 줄 알고 있으면 오해가 반대로 생긴다", () => {
    const vals = wire(view([row({ cost: 1000, costFrom: "2026-07-01", costEntries: 3 })]))
    expect((vals.skuRows as { histNote: string }[])[0]!.histNote).toBe("이력 3건")
  })

  it("아직 안 친 칸은 «틀렸다»가 아니다 — 61행이 전부 빨개지지 않는다", () => {
    expect(saveGuard(emptyDraft(TODAY))).toEqual({ can: false, why: "" })
  })

  it("못 누르면 **사유를 함께** 낸다 (§21-1)", () => {
    const g = saveGuard({ amount: "-1", effectiveFrom: TODAY })
    expect(g.can).toBe(false)
    expect(g.why).toContain("0보다 작을 수 없습니다")
  })

  it("제대로 쳤으면 누를 수 있다", () => {
    expect(saveGuard({ amount: "12,000", effectiveFrom: TODAY }).can).toBe(true)
  })

  it("`fromLabel`이 적용일을 한 칸에 넣는다", () => {
    expect(fromLabel("2026-08-01")).toBe("8/1부터")
    expect(fromLabel("2026-12-25")).toBe("12/25부터")
  })
})

describe("게이지 — 분모는 SKU 수다", () => {
  it("절반만 넣었으면 절반으로 보인다", () => {
    const vals = wire(view([row({ cost: 1000 }), row({ skuId: "sku-2" })]))
    expect(vals.costGauge.costed).toBe(1)
    expect(vals.costGauge.total).toBe(2)
    expect(vals.costGauge.pctWidth).toBe("50%")
    expect(vals.costGauge.text).toContain("1개가 남았습니다")
  })

  it("SKU가 없으면 0%가 아니라 «없음»이다 — 0으로 나누지 않는다", () => {
    const vals = wire(view([]))
    expect(vals.costGauge.pctWidth).toBe("0%")
    expect(vals.costGauge.text).toBe("연결된 SKU가 아직 없습니다")
  })

  it("★ 게이지가 꽉 차도 손익이 안 움직인다는 사실을 여기서 말한다 ★", () => {
    // §22-3-b — 커버리지는 «존재», 이 줄은 «온전함»이다. 원가를 다 넣은 사용자가
    // 대시보드의 매입원가 0원을 보고 «저장이 안 됐나» 하는 것을 막는 자리다.
    const full = wire(view([row({ cost: 1000 })], false))
    expect(full.costGauge.text).toContain("전부 입력됐습니다")
    expect(full.costGauge.note).toContain("손익의 매입원가에는 반영되지 않습니다")

    // 품목이 들어오면 **스스로 사라진다** — 누가 끄러 오지 않아도 된다
    const wired = wire(view([row({ cost: 1000 })], true))
    expect(wired.costGauge.note).toBe("")
  })
})

describe("없는 것을 지어내지 않는다", () => {
  it("기준 판매가·마진율·기여이익은 «—»다", () => {
    const vals = wire(view([row({ cost: 1000 })]))
    const r = (vals.skuRows as { price: string; margin: string; net: string }[])[0]!
    // 마켓 리스팅의 판매가를 적재하지 않으므로 마진율은 계산할 수 없다.
    // 목업처럼 0으로 나눠 «100%»를 그리면 화면이 모르는 것을 아는 척한다 (헌장 A-5).
    expect(r.price).toBe("—")
    expect(r.margin).toBe("—")
    expect(r.net).toBe("—")
  })

  it("판매 수량은 품목이 없으면 «—», 있으면 숫자다", () => {
    expect((wire(view([row()])).skuRows as { qty: string }[])[0]!.qty).toBe("—")
    expect((wire(view([row({ soldQty: 12 })], true)).skuRows as { qty: string }[])[0]!.qty).toBe("12")
  })

  it("연결된 마켓은 있는 것만 칩으로 나온다", () => {
    const vals = wire(view([row({ channels: ["11번가", "ESM (G마켓·옥션)"], listingCount: 3 })]))
    const chips = (vals.skuRows as { chips: { label: string }[] }[])[0]!.chips
    expect(chips.map((c) => c.label)).toEqual(["11번가", "ESM (G마켓·옥션)"])
  })
})

describe("화면이 렌더된다 — «준비 중»이 아니라 목록이다", () => {
  it("SKU와 코드가 표에 그려진다", () => {
    const out = html(wire(view([row({ cost: 12_000, costFrom: "2026-08-01", channels: ["11번가"] })])))
    expect(out).toContain("SKU-0001")
    expect(out).toContain("머그컵 · 블루")
    expect(out).toContain("12,000원 · 8/1부터")
    // 임시물이 지워졌다는 증거 — 배선된 화면이 계속 «준비 중»이라고 말하면 안 된다
    expect(out).not.toContain("상품 화면은 아직 만들지 않았습니다")
  })
})
