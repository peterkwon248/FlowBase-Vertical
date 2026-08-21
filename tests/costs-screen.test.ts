/**
 * 비용 화면 — **고정비를 넣는 자리가 실제로 열려 있는가.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 파일이 지키는 것 ★
 *
 * 저장 계층(마이그레이션 010)과 계산(`loadPnlSnapshot`)은 `overhead.test.ts`가
 * 잰다. 여기는 **화면이 그 사실을 옳게 말하는가**를 잰다. 둘 사이가 끊기면
 * 고정비를 넣어도 화면이 그대로이거나, 넣지 않았는데 넣은 것처럼 보인다.
 *
 * 가장 무거운 단언은 **3층 표가 자기모순이 아닌가**다 — 「매출 − 항목들」이
 * 화면에 적힌 기여이익과 맞아야 한다. 목업 표에 클레임 줄이 없어서 그 합이
 * 안 맞았고, 그건 화면이 스스로를 반박하는 상태다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { computePnl, proratedSpan, type Pnl } from "../src/core/profit/index.js"
import {
  addGuard,
  costsVals,
  emptyCostsDraft,
  layerNote,
  layerRows,
  parseAmount,
  saveGuard,
  type AdCampaign,
  type CostsDraft,
  type CostsView,
} from "../src/app/costs.js"
import { emptyVals } from "../src/app/generated/vals.js"

const PERIOD = { from: "2026-07-01", to: "2026-07-31" }

const pnlOf = (o: Partial<Parameters<typeof computePnl>[0]> = {}): Pnl =>
  computePnl({
    period: PERIOD,
    revenue: 10_000_000,
    fee: 0,
    vat: 0,
    shipping: 0,
    claims: [],
    cogs: 2_000_000,
    adDirect: 0,
    adUnallocated: 0,
    ops: 0,
    fixed: 0,
    ...o,
  })

const view = (o: Partial<CostsView> = {}): CostsView => ({
  fixed: [],
  ops: [],
  ads: [],
  stance: { fixed: null, ops: null },
  ...o,
})

const item = (label: string, amount: number, from = "2026-01-01", historyCount = 1) => ({
  label,
  basis: "MONTH" as const,
  amount,
  effectiveFrom: from,
  historyCount,
})

const render = (v: CostsView, p: Pnl, d: CostsDraft = emptyCostsDraft("2026-07-31")) => {
  const vals = emptyVals()
  costsVals(vals, v, p, d)
  return vals
}

describe("고정비 표 — 목업이 못 하던 것들", () => {
  it("항목마다 **언제부터**를 함께 보인다 — 금액만 있으면 소급이 안 보인다", () => {
    const v = render(view({ fixed: [item("임대료", 1_800_000, "2026-03-01")] }), pnlOf())
    expect(String((v.fixRows[0] as { name: string }).name)).toContain("2026-03부터")
  })

  it("이력이 쌓이면 몇 번 바뀌었는지 말한다", () => {
    const v = render(view({ fixed: [item("임대료", 2_200_000, "2026-03-01", 3)] }), pnlOf())
    expect(String((v.fixRows[0] as { name: string }).name)).toContain("이력 3")
  })

  it("★ 금액에 천 단위를 넣는다 — `1800000`은 자릿수를 못 센다 ★", () => {
    const v = render(view({ fixed: [item("임대료", 1_800_000)] }), pnlOf())
    expect((v.fixRows[0] as { amount: string }).amount).toBe("1,800,000")
  })

  it("★ 사람이 친 글자는 **그대로** 보인다 — 포맷하면 커서가 튄다 ★", () => {
    const d = { ...emptyCostsDraft("2026-07-31"), amounts: new Map([["임대료", "18000"]]) }
    const v = render(view({ fixed: [item("임대료", 1_800_000)] }), pnlOf(), d)
    expect((v.fixRows[0] as { amount: string }).amount).toBe("18000")
  })

  it("★ 「이 기간 몫」의 분수를 **지어내지 않는다** ★", () => {
    // 목업은 「8일 / 31일」을 박아 뒀다 — 시드 기간의 값이라 7월 전체를 봐도 그대로였다.
    expect(render(view(), pnlOf()).fixDays.trim()).toBe("31일 / 31일")
    // 달을 걸치면 하나의 분수로 말할 수 없다 (7/20~8/10 = 12/31 + 10/31)
    const cross = pnlOf({ period: { from: "2026-07-20", to: "2026-08-10" } })
    expect(render(view(), cross).fixDays).toBe("")
    expect(proratedSpan({ from: "2026-07-20", to: "2026-08-10" })).toBeNull()
  })
})

describe("저장 가드 — 못 누르면 **왜인지** 말한다 (§21-1)", () => {
  const base = emptyCostsDraft("2026-07-31")

  it("아무것도 안 친 상태는 «틀렸다»가 아니다 — 사유가 비어 있다", () => {
    const g = saveGuard(base)
    expect(g.can).toBe(false)
    expect(g.why, "안 건드린 화면이 사용자를 나무란다").toBe("")
  })

  it("숫자가 아니면 **어느 항목인지** 짚는다", () => {
    const g = saveGuard({ ...base, amounts: new Map([["임대료", "백팔십만"]]) })
    expect(g.can).toBe(false)
    expect(g.why).toContain("임대료")
  })

  it("적용일이 없으면 못 누른다 — 조용히 오늘로 채우지 않는다", () => {
    const g = saveGuard({ ...base, amounts: new Map([["임대료", "1800000"]]), effectiveFrom: "" })
    expect(g.can).toBe(false)
    expect(g.why).toContain("적용 시작일")
  })

  it("쉼표·「원」을 걷어낸다 — 화면에 보인 그대로 저장돼야 한다", () => {
    expect(parseAmount(" 1,800,000원 ")).toBe(1_800_000)
    expect(parseAmount("")).toBeNull()
    expect(parseAmount("-100")).toBeNull()
  })

  it("★ 같은 이름을 두 번 더할 수 없다 — 조용히 덮으면 이력이 엉킨다 ★", () => {
    const d = { ...base, newLabel: "임대료", newAmount: "100" }
    expect(addGuard(d, ["임대료"]).can).toBe(false)
    expect(addGuard(d, ["임대료"]).why).toContain("이미 있습니다")
    expect(addGuard(d, []).can).toBe(true)
  })

  it("이름 없이 금액만 치면 이름을 달라고 한다", () => {
    expect(addGuard({ ...base, newAmount: "100" }, []).why).toContain("항목 이름")
  })

  it("비활성 버튼은 **흐리게** 보인다 — 파란 채로 두면 눌리는 줄 안다", () => {
    expect(render(view(), pnlOf()).fixSaveOpacity).toBe("0.45")
    const d = { ...emptyCostsDraft("2026-07-31"), amounts: new Map([["임대료", "1800000"]]) }
    expect(render(view({ fixed: [item("임대료", 0)] }), pnlOf(), d).fixSaveOpacity).toBe("1")
  })
})

describe("★ 「두지 않습니다」 — 안 넣는 것도 입력이다 (§22) ★", () => {
  it("미선언 + 항목 0개면 **두 줄이 같은 이유**를 말한다", () => {
    const v = render(view(), pnlOf())
    expect(v.fixNone).toBe(false)
    expect(v.fixNoneNote).toContain("아직 안 넣어서")
  })

  it("«원가에 포함»을 선언하면 **이중 차감**을 미리 경고한다", () => {
    const v = render(view({ stance: { fixed: { stance: "none", reason: "in-cogs" }, ops: null } }), pnlOf())
    expect(v.fixNone).toBe(true)
    expect(v.fixNoneNote).toContain("두 번 빠집니다")
  })

  it("항목을 넣은 뒤에는 잔소리하지 않는다", () => {
    const v = render(view({ fixed: [item("임대료", 1_800_000)] }), pnlOf({ fixed: 1_800_000 }))
    expect(v.fixNoneNote).toBe("")
  })
})

describe("손익 3층 표 — 화면이 스스로를 반박하지 않는다", () => {
  it("★★ 적힌 항목을 매출에서 다 빼면 적힌 기여이익이 나온다 ★★", () => {
    // 목업 표에는 **클레임 줄이 없었다.** `computePnl`은 빼는데 표에는 안 보이니
    // 「매출 − 보이는 항목들 ≠ 기여이익」이 된다 — 화면이 자기모순인 상태다.
    const p = pnlOf({
      fee: 300_000,
      vat: 100_000,
      claims: [{ type: "REFUND", amount: 388_700 }],
      ops: 50_000,
      fixed: 1_000_000,
      adUnallocated: 200_000,
    })
    const rows = layerRows(p)
    const num = (label: string): number => {
      const r = rows.find((x) => x.label === label)
      if (r === undefined) throw new Error(`줄이 없다: ${label}`)
      return Number(r.value.replace(/[−,]/g, ""))
    }
    const shown =
      num("매출") -
      num("− 할인 · 수수료 · VAT · 배송") -
      num("− 클레임 (취소·반품)") -
      num("− 매입원가") -
      num("− 직접 광고비") -
      num("− 운영비")
    expect(shown, "표의 항목을 다 빼도 적힌 기여이익이 안 나온다").toBe(p.productContribution)
    expect(num("상품 기여이익") - num("− 미배분 광고비 (전사)")).toBe(p.channelContribution)
    expect(num("채널 기여이익") - num("− 고정비")).toBe(p.netProfit)
  })

  it("★ 0원은 `−0`이 아니다 — 「마이너스 영」이라는 수는 없다 ★", () => {
    const rows = layerRows(pnlOf())
    expect(rows.find((r) => r.label === "− 운영비")?.value).toBe("0")
    expect(rows.find((r) => r.label === "− 고정비")?.value).toBe("0")
  })

  it("적자면 빨갛다 — 세 층 각각", () => {
    const p = pnlOf({ cogs: 20_000_000, fixed: 1_000_000 })
    const rows = layerRows(p)
    expect(rows.find((r) => r.label === "회사 순이익")?.numColor).toBe("var(--pnl-neg)")
  })

  it("★ 차이가 0일 때 «차이는 0원과 0원입니다»라고 하지 않는다 ★", () => {
    const note = layerNote(pnlOf())
    expect(note).not.toContain("차이는")
    // 사용자가 그때 궁금한 것은 «왜 두 줄이 같은가»다. 거기에 답한다.
    expect(note).toContain("둘 다 0원")
    expect(note).toContain("고정비를 넣으면")
  })

  it("차이가 있으면 무엇 때문인지 짚는다 — 0인 쪽은 안 부른다", () => {
    const note = layerNote(pnlOf({ fixed: 1_000_000 }))
    expect(note).toContain("고정비 1,000,000원")
    expect(note, "0원인 광고비를 굳이 부른다").not.toContain("전사 광고비")
  })
})

describe("탭 — 없는 것을 그리지 않는다", () => {
  const labels = (v: { costTabs: readonly unknown[] }): string[] =>
    v.costTabs.map((t) => (t as { label: string }).label)

  /**
   * ★ 규칙은 「하나만」이 아니라 「**배선된 것만**」이다 (2026-08-21) ★
   *
   * 이 시험은 원래 `toHaveLength(1)`이었다. 그때는 배선된 탭이 정말 하나였기
   * 때문인데, 광고비 탭이 서면서 그 숫자가 **규칙이 아니라 그날의 사실**이었음이
   * 드러났다. 숫자를 2로 고치면 다음에 또 낡으므로, 무는 자리를 옮긴다:
   * **원가 탭은 여전히 없어야 한다**(상품 화면이 가져갔다).
   */
  it("★ 배선된 탭만 둔다 — 눌러서 빈 화면이 나오는 것보다 낫다 ★", () => {
    const v = render(view(), pnlOf())
    expect(labels(v)).toEqual(["광고비", "운영·고정비"])
    expect(labels(v), "원가는 상품 화면이 가져갔다 — 여기 그리면 빈 탭이다").not.toContain("원가")
    expect(v.ctCogs, "그리지 않는 탭의 몸체가 켜져 있으면 안 된다").toBe(false)
  })

  it("기본은 운영·고정비다 — 광고를 안 하는 셀러에게 광고비가 첫 화면이면 안 된다", () => {
    const v = render(view(), pnlOf())
    expect(v.ctOps).toBe(true)
    expect(v.ctAd).toBe(false)
  })

  it("★ 몸체는 언제나 정확히 하나만 켜진다 — 둘이 켜지면 화면이 겹친다 ★", () => {
    for (const tab of ["ad", "ops"] as const) {
      const v = render(view({ ads: [] }), pnlOf(), { ...emptyCostsDraft("2026-07-31"), tab })
      const on = [v.ctCogs, v.ctAd, v.ctOps].filter(Boolean).length
      expect(on, `tab=${tab}에서 켜진 몸체가 ${on}개다`).toBe(1)
    }
  })
})

describe("★ 광고비 탭 — 숫자는 014부터 있었고 보여주는 자리만 없었다 (2.6) ★", () => {
  const camp = (o: Partial<AdCampaign> = {}): AdCampaign => ({
    channel: "쿠팡",
    name: "맥세이프 셀카봉",
    type: "GROWTH",
    spend: 1_000_000,
    clicks: 1_000,
    convRev: 4_000_000,
    direct: 1_000_000,
    noKey: 0,
    noListing: 0,
    noLink: 0,
    ...o,
  })
  const ad = (ads: AdCampaign[], d = { ...emptyCostsDraft("2026-07-31"), tab: "ad" as const }) =>
    render(view({ ads }), pnlOf(), d)
  const row = (v: ReturnType<typeof ad>, i = 0) =>
    v.adRows[i] as Record<string, string>

  it("KPI는 표와 **같은 행 집합**에서 나온다 — 갈리면 어느 쪽이 참인지 알 수 없다", () => {
    const v = ad([camp({ spend: 700, direct: 500 }), camp({ spend: 300, direct: 0, noLink: 300 })])
    expect(v.adTotal).toBe("1,000원")
    expect(v.adCount).toBe("2")
    expect(v.adAlloc).toBe("500원")
    // 미배분은 **뺄셈**이다 — 세 갈래를 더해 만들면 하나를 빠뜨렸을 때 조용히 줄어든다
    expect(v.adUnalloc).toBe("500원")
  })

  it("★ 전환매출이 없는 캠페인은 ROAS 분모에서 빠진다 — 넣으면 조용히 낮아진다 ★", () => {
    const v = ad([
      camp({ spend: 1_000, convRev: 4_000 }),
      camp({ spend: 1_000, convRev: 0 }),
    ])
    // 4,000 / 1,000 = 4.00x. 분모에 전환매출 없는 1,000을 더하면 2.00x가 된다.
    expect(v.adRoas).toBe("4.00x")
    expect(row(v, 1).roas, "잴 수 없는 것을 0으로 그리면 안 된다 (LOCK 6)").toBe("—")
    expect(row(v, 1).convRev).toBe("—")
  })

  it("잴 수 있는 캠페인이 하나도 없으면 «—»다 — «ROAS 0»이라 말하지 않는다", () => {
    expect(ad([camp({ convRev: 0 })]).adRoas).toBe("—")
    expect(ad([]).adRoas).toBe("—")
  })

  it("★ 저장 코드를 화면에 그대로 쓰지 않는다 (U-5) ★", () => {
    expect(row(ad([camp()])).type).toBe("매출성장")
    // 모르는 코드는 **지어내지 않고 원문 그대로** — 「기타」로 뭉개면 파일에서 못 찾는다 (U-7)
    expect(row(ad([camp({ type: "NEW_KIND" })])).type).toBe("NEW_KIND")
  })

  it("★★ 「배분 규칙」 칸은 고르는 자리가 아니라 **할 일을 말하는 자리**다 (ADR-022) ★★", () => {
    // 갈래마다 사용자가 할 일이 완전히 다르다. 한 덩어리로 «미배분»만 보이면 할 일을 모른다.
    expect(row(ad([camp({ spend: 100, direct: 100 })])).rule).toContain("상품에 배분됨")
    expect(row(ad([camp({ spend: 100, direct: 0, noLink: 100 })])).rule).toContain("상품 연결하면 붙는다")
    expect(row(ad([camp({ spend: 100, direct: 0, noListing: 100 })])).rule).toContain("주문 파일이 없다")
    expect(row(ad([camp({ spend: 100, direct: 0, noKey: 100 })])).rule).toContain("파일이 상품을 안 말한다")
  })

  it("섞여 있으면 **가장 큰 갈래와 그 비율**을 말한다 — 네 갈래를 다 적으면 칸이 문단이 된다", () => {
    const r = row(ad([camp({ spend: 100, direct: 30, noLink: 70 })]))
    expect(r.rule).toContain("상품 연결하면 붙는다")
    expect(r.rule).toContain("70")
  })

  it("★ 광고가 없으면 광고비 탭을 **고를 수 없다** — 빈 탭을 그려 놓지 않는다 ★", () => {
    const v = render(view({ ads: [] }), pnlOf())
    expect(v.ctAd).toBe(false)
    expect(v.ctOps).toBe(true)
  })
})
