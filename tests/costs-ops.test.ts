/**
 * 운영비 제어부 — **넣는 문이 열렸는가.**
 *
 * ─────────────────────────────────────────────────────────────
 * 저장(`overhead` 010)과 조회(`repo.overheads`)는 처음부터 `kind`가 `FIXED|OPS`
 * 둘이었다. 없던 것은 **화면뿐**이고, 그래서 손익 3층의 「− 운영비」가 영영 0이었다.
 *
 * 고정비 블록과 한 칸 다르다 — **부담 기준**. 010이 `FIXED`는 `MONTH`만 쓴다고
 * 못박았으므로 고정비에는 고를 것이 없지만, 운영비는 `ORDER`(주문당)와
 * `UNIT`(개당)로 갈리고 그 선택이 손익을 바꾼다.
 * ─────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from "vitest"
import {
  addGuard,
  costsVals,
  emptyCostsDraft,
  saveGuard,
  type CostsDraft,
  type CostsView,
} from "../src/app/costs.js"
import { emptyVals } from "../src/app/generated/vals.js"
import type { Pnl } from "@core/profit/index.js"

const pnlOf = (o: Partial<Pnl> = {}): Pnl =>
  ({
    period: { from: "2026-07-01", to: "2026-07-31" },
    revenue: 8_285_200,
    discount: 0,
    fee: 0,
    vat: 0,
    shipping: 0,
    claims: 388_700,
    cogs: 1_140_500,
    adDirect: 0,
    ops: 0,
    productContribution: 6_756_000,
    adUnallocated: 0,
    channelContribution: 6_756_000,
    fixed: 0,
    netProfit: 6_756_000,
    ...o,
  }) as unknown as Pnl

const view = (o: Partial<CostsView> = {}): CostsView => ({
  fixed: [],
  ops: [],
  stance: { fixed: null, ops: null },
  ...o,
})

const OPS = [
  {
    label: "택배비",
    basis: "ORDER" as const,
    amount: 3000,
    effectiveFrom: "2026-01-01",
    historyCount: 1,
  },
  {
    label: "포장재",
    basis: "UNIT" as const,
    amount: 400,
    effectiveFrom: "2026-03-01",
    historyCount: 2,
  },
]

const render = (v: CostsView, p: Pnl = pnlOf(), d: CostsDraft = emptyCostsDraft("2026-07-31")) => {
  const vals = emptyVals()
  costsVals(vals, v, p, d)
  return vals
}

describe("운영비 제어부 — 넣는 문", () => {
  it("★ 운영비 행의 금액 칸이 살아 있다 — 죽은 컨트롤이 아니다 ★", () => {
    const v = render(view({ ops: OPS }))
    expect(v.opsRows).toHaveLength(2)
    // 예전에는 `set: () => {}`이라 쳐도 아무 일이 없었다.
    expect(typeof (v.opsRows[0] as { set: unknown }).set).toBe("function")
  })

  it("적용일과 이력 건수를 행에 적는다 — 값이 몇 번 바뀌었는지 보인다", () => {
    const v = render(view({ ops: OPS }))
    const names = v.opsRows.map((r) => (r as { name: string }).name)
    expect(names[0]).toContain("2026-01부터")
    expect(names[1]).toContain("이력 2")
  })

  it("★ 부담 기준을 사람이 고른다 — 앱이 고를 수 없는 값이다 ★", () => {
    const v = render(view())
    expect(v.opsBasisOptions.map((b) => b.value)).toEqual(["ORDER", "UNIT"])
    expect(v.opsBasisOptions.map((b) => b.label)).toEqual(["주문당", "개당"])
    // 기본은 주문당 — 실물에서 가장 흔한 운영비가 택배비다.
    expect(v.opsBasis).toBe("ORDER")
  })

  it("초안은 고정비와 **따로** 든다 — 남의 날짜로 저장되면 안 된다", () => {
    const d: CostsDraft = {
      ...emptyCostsDraft("2026-07-31"),
      effectiveFrom: "2026-01-01",
      opsEffectiveFrom: "2026-08-01",
    }
    const v = render(view(), pnlOf(), d)
    expect(v.fixDate).toBe("2026-01-01")
    expect(v.opsDate).toBe("2026-08-01")
  })

  it("★ 못 누르면 사유를 함께 낸다 (§21-1) ★", () => {
    const bad: CostsDraft = {
      ...emptyCostsDraft("2026-07-31"),
      opsAmounts: new Map([["택배비", "삼천원"]]),
    }
    const v = render(view({ ops: OPS }), pnlOf(), bad)
    expect(v.opsCanSave).toBe(false)
    expect(v.opsSaveWhy).toContain("숫자만")
    // 파란 primary 버튼이 그대로 파랗면 눌리는 줄 알고 누른다.
    expect(v.opsSaveOpacity).toBe("0.45")
  })

  it("같은 이름은 두 번 못 더한다", () => {
    const d = {
      newLabel: "택배비",
      newAmount: "3000",
      effectiveFrom: "2026-07-31",
    }
    expect(addGuard(d, ["택배비"]).can).toBe(false)
    expect(addGuard(d, ["택배비"]).why).toContain("이미 있습니다")
    expect(addGuard(d, []).can).toBe(true)
  })

  it("가드는 고정비와 **같은 판단**이다 — 두 벌이 아니다", () => {
    const amounts = new Map([["x", "1000"]])
    expect(saveGuard({ amounts, effectiveFrom: "2026-07-31" }).can).toBe(true)
    expect(saveGuard({ amounts, effectiveFrom: "" }).why).toContain("적용 시작일")
  })

  it("★ 「0원」과 「아직 안 넣었다」를 가른다 (§22) ★", () => {
    const empty = render(view())
    expect(empty.opsNone).toBe(false)
    expect(empty.opsNoneNote).toContain("아직 안 넣어서")

    const some = render(view({ ops: OPS }))
    // 넣은 것이 있으면 잔소리하지 않는다.
    expect(some.opsNoneNote).toBe("")
  })

  it("★ 「두지 않습니다」를 선언하면 문장이 바뀐다 — 미선언과 다르다 ★", () => {
    const v = render(view({ stance: { fixed: null, ops: { stance: "none", reason: "not-applicable" } } }))
    expect(v.opsNone).toBe(true)
    expect(v.opsNoneBg).toBe("var(--accent)")
    expect(v.opsNoneNote).toContain("두지 않기로 하셨습니다")
    expect(v.opsNoneNote).not.toContain("아직 안 넣어서")
  })

  it("★ 「원가에 포함」이면 **이중 차감**을 미리 경고한다 ★", () => {
    const v = render(view({ stance: { fixed: null, ops: { stance: "none", reason: "in-cogs" } } }))
    expect(v.opsNoneNote).toContain("두 번 빠집니다")
  })

  it("고정비와 운영비의 선언은 서로를 건드리지 않는다", () => {
    const v = render(view({ stance: { fixed: { stance: "none", reason: "in-cogs" }, ops: null } }))
    expect(v.fixNone).toBe(true)
    expect(v.opsNone).toBe(false)
  })
})
