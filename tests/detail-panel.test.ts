/**
 * §21-2 **L2 근거 패널** — 다섯 표의 행이 갈 곳이 생겼다 (조사 1.7).
 *
 * ★ 이 시험이 잡는 것 ★
 * ① `<aside className="detail-side">`가 **실제로 렌더된다** — 지금까지 한 번도
 *    렌더된 적이 없었다(`hasDetail`에 대입하는 코드가 0곳이었다). 마크업이
 *    살아 있는지는 U-6이 문지만, **켜지는지**는 여기서만 본다
 * ② 패널이 **스냅샷이 아니라 주소**를 든다 — 같은 대상으로 데이터가 바뀌면
 *    패널 숫자도 따라 바뀐다. 이게 깨지면 표와 패널이 다른 말을 한다
 * ③ 대상이 기간 밖으로 나가면 **안 뜬다** (닫힌다)
 * ④ 부재를 0으로 그리지 않는다 (§22) — 미배분 항목 · 원가 미입력 · 정산 미연결
 * ⑤ 내부 키가 화면에 안 나온다 (헌장 C-4)
 */

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { Template } from "../src/app/generated/Template.js"
import { emptyVals, type TemplateVals } from "../src/app/generated/vals.js"
import {
  detailVals,
  orderKey,
  productKey,
  settlementDetailKey,
  skuKey,
  type DetailData,
  type DetailTarget,
} from "../src/app/detail.js"
import type { ChannelRow, ProfitRow } from "../src/core/profit/rows.js"
import type { OrderRow } from "../src/core/order/rows.js"
import type { SettlementRow } from "../src/core/settlement/rows.js"
import type { ProductSkuRow } from "../src/core/product/rows.js"

/**
 * ⚠ 금액 기대값은 `format.ts`의 `signed()` 표기를 따른다 — **양수에 `+`를 안 붙이고
 * 음수는 ASCII `-`다** (목업과 같은 표기). 줄 왼쪽 연산자 칸의 «−»는 U+2212 글리프라
 * 서로 다른 문자다. 여기서 예쁘게 고치면 화면과 시험이 갈린다.
 */
const PERIOD = { from: "2026-07-01", to: "2026-07-31" }

const PRODUCT: ProfitRow = {
  skuId: "sku-1",
  name: "무선충전거치대 F5",
  code: "SKU-0001",
  qty: 12,
  revenue: 240_000,
  discount: 10_000,
  cogs: 90_000,
  noCostQty: 0,
}

const CHANNEL: ChannelRow = {
  connectionId: "conn-1",
  name: "쿠팡 본계정",
  revenue: 500_000,
  orderCount: 30,
  claims: 20_000,
  cogs: 200_000,
  fee: 50_000,
}

const ORDER: OrderRow = {
  kind: "order",
  at: "2026-07-13 14:02",
  channel: "쿠팡 본계정",
  status: "배송완료",
  amount: 32_000,
  claimType: null,
  claimAmount: 0,
  dateEstimated: false,
  claimDateEstimated: false,
  items: { title: "무선충전거치대 F5", count: 1, quantity: 2 },
}

const SETTLEMENT: SettlementRow = {
  settledOn: "2026-07-20",
  connectionId: "conn-1",
  channel: "쿠팡 본계정",
  count: 41,
  gross: 1_000_000,
  fee: 90_000,
  vat: 9_000,
  shipping: 11_000,
  net: 890_000,
  linked: 41,
  payOutOn: "2026-07-27",
  adjSum: 0,
  adjustments: [],
}

const SKU: ProductSkuRow = {
  skuId: "sku-1",
  code: "SKU-0001",
  name: "무선충전거치대 F5",
  productName: "거치대",
  status: "ACTIVE",
  cost: 7_500,
  costFrom: "2026-07-01",
  costEntries: 2,
  channels: ["쿠팡"],
  listingCount: 3,
  soldQty: 12,
}

function data(over: Partial<DetailData> = {}): DetailData {
  return {
    period: PERIOD,
    products: [PRODUCT],
    channels: [CHANNEL],
    orders: [ORDER],
    settlements: [SETTLEMENT],
    skus: [SKU],
    ...over,
  }
}

const NO_ACT = { close: (): void => {}, go: (): void => {} }

function open(target: DetailTarget, d: DetailData = data()): TemplateVals {
  const vals = emptyVals()
  detailVals(vals, target, d, NO_ACT)
  return vals
}

/** 패널이 실제로 화면에 서는지 — 값 객체만 보고 넘어가지 않는다. */
function html(vals: TemplateVals): string {
  return renderToString(createElement(Template, { vals }))
}

const labels = (vals: TemplateVals): string[] =>
  vals.detail.lines.map((l) => (l as { label: string }).label)

const lineOf = (vals: TemplateVals, label: string): { label: string; value: string } => {
  const found = vals.detail.lines.find((l) => (l as { label: string }).label === label)
  expect(found, `«${label}» 줄이 없다 — 있는 줄: ${labels(vals).join(" / ")}`).toBeDefined()
  return found as { label: string; value: string }
}

const provOf = (vals: TemplateVals, label: string): string => {
  const found = vals.detail.prov.find((p) => (p as { label: string }).label === label)
  expect(found, `출처 «${label}»이 없다`).toBeDefined()
  return (found as { value: string }).value
}

describe("§21-2 L2 근거 패널 — 표의 숫자에서 근거로 내려간다", () => {
  it("★ 패널이 실제로 렌더된다 — 이 마크업은 한 번도 서 본 적이 없었다 ★", () => {
    const shut = html(emptyVals())
    expect(shut, "대상이 없는데 패널이 떴다").not.toContain("detail-side")

    const out = html(open({ kind: "product", key: "sku-1" }))
    expect(out, "detail-side가 안 떴다").toContain("detail-side")
    expect(out).toContain("무선충전거치대 F5")
    expect(out).toContain("손익 계산")
    expect(out).toContain("데이터 출처")
  })

  it("대상이 없으면 아무것도 안 붙인다 — `null`이든 못 찾든", () => {
    const none = emptyVals()
    detailVals(none, null, data(), NO_ACT)
    expect(none.hasDetail).toBe(false)

    // 기간을 옮겨 그 행이 사라진 경우. 조용한 실패가 아니라 «주제가 화면 밖으로
    // 나간 것»이고 표에서도 그 행이 함께 사라져 있다.
    const gone = open({ kind: "product", key: "sku-1" }, data({ products: [] }))
    expect(gone.hasDetail).toBe(false)
  })

  it("★★ 값이 아니라 **주소**를 든다 — 데이터가 바뀌면 패널도 따라 바뀐다 ★★", () => {
    const before = open({ kind: "product", key: "sku-1" })
    expect(lineOf(before, "매출").value).toBe("240,000원")

    // 같은 주소, 다른 데이터 (가져오기가 더 들어왔다).
    const after = open(
      { kind: "product", key: "sku-1" },
      data({ products: [{ ...PRODUCT, revenue: 999_000 }] }),
    )
    expect(
      lineOf(after, "매출").value,
      "패널이 옛 숫자를 들고 있다 — 표와 다른 말을 하게 된다",
    ).toBe("999,000원")
  })

  it("닫기 버튼은 대상이 없어도 배선된다 — 못 닫는 패널을 만들지 않는다", () => {
    let closed = false
    const vals = emptyVals()
    detailVals(vals, null, data(), { close: () => (closed = true), go: () => {} })
    ;(vals.closeDetail as () => void)()
    expect(closed).toBe(true)
  })
})

describe("상품별 손익 — 표의 열 이름과 같은 말을 쓴다", () => {
  it("항 분해가 표의 계산과 같다 (매출 − 할인 − 매입원가)", () => {
    const v = open({ kind: "product", key: productKey(PRODUCT) })
    expect(lineOf(v, "매출").value).toBe("240,000원")
    expect(lineOf(v, "할인").value).toBe("10,000원")
    expect(lineOf(v, "매입원가").value).toBe("90,000원")
    // 240,000 − 10,000 − 90,000 = 140,000
    expect(lineOf(v, "기여이익(부분)").value).toBe("140,000원")
  })

  it("★ 배분하지 않은 항목은 «—»다 — 0으로 그리면 «안 나갔다»로 읽힌다 (§22) ★", () => {
    const v = open({ kind: "product", key: "sku-1" })
    const un = lineOf(v, "수수료·배송비·광고비 (상품에 배분하지 않음)")
    expect(un.value, "0원으로 그리면 이 상품이 수수료를 안 낸 것처럼 보인다").toBe("—")
  })

  it("★ 이름을 「순이익」이라 부르지 않는다 — 위 줄이 빠져 있다 ★", () => {
    const v = open({ kind: "product", key: "sku-1" })
    expect(labels(v)).toContain("기여이익(부분)")
    expect(labels(v).join(" ")).not.toContain("순이익")
  })

  it("원가 미입력분이 있으면 **이익 줄 위에서** 말한다", () => {
    const v = open(
      { kind: "product", key: "sku-1" },
      data({ products: [{ ...PRODUCT, cogs: 0, noCostQty: 12 }] }),
    )
    expect(lineOf(v, "매입원가 (일부 미입력)").value).toBe("미입력")
    expect(provOf(v, "원가")).toContain("12개는 원가 미입력")
  })

  it("SKU에 안 붙은 행은 표와 **같은 이름**으로 부른다", () => {
    const v = open(
      { kind: "product", key: "" },
      data({ products: [{ ...PRODUCT, skuId: null, name: "쿠팡 리스팅 원본명" }] }),
    )
    expect(v.detail.title).toBe("SKU에 연결되지 않은 판매")
    expect(provOf(v, "SKU 연결")).toBe("연결되지 않음")
  })
})

describe("채널별 손익 — 수수료 0은 «없다»가 아니라 «모른다»다", () => {
  it("항 분해 (매출 − 매입원가 − 클레임 − 수수료)", () => {
    const v = open({ kind: "channel", key: "conn-1" })
    // 500,000 − 200,000 − 20,000 − 50,000 = 230,000
    expect(lineOf(v, "기여이익(부분)").value).toBe("230,000원")
  })

  it("★ 정산이 안 이어진 채널의 0을 그대로 그리지 않는다 (LOCK 6) ★", () => {
    const v = open({ kind: "channel", key: "conn-1" }, data({ channels: [{ ...CHANNEL, fee: 0 }] }))
    expect(lineOf(v, "마켓 수수료 (정산 미연결)").value).toBe("—")
    expect(provOf(v, "수수료 출처")).toContain("모름")
  })
})

describe("주문 — 통합 행과 홀로 선 클레임을 다른 식으로 센다", () => {
  it("통합 행은 결제금액에서 딸린 클레임을 뺀다", () => {
    const v = open({ kind: "order", key: orderKey(ORDER) })
    expect(lineOf(v, "결제 금액").value).toBe("32,000원")
    expect(lineOf(v, "손익 반영").value).toBe("32,000원")
  })

  it("★ 홀로 선 클레임은 그 자체가 차감이다 — 한 식으로 쓰면 두 번 빠진다 ★", () => {
    const claim: OrderRow = {
      ...ORDER,
      kind: "claim",
      status: "반품완료",
      claimType: "RETURN",
      amount: 32_000,
      claimAmount: 32_000,
      items: null,
    }
    const v = open({ kind: "order", key: orderKey(claim) }, data({ orders: [claim] }))
    expect(v.detail.title).toBe("클레임")
    expect(lineOf(v, "손익 반영").value, "결제금액을 더하면 안 된다").toBe("-32,000원")
  })

  it("품목이 없는 것과 이름을 모르는 것을 구분해 말한다 (§22)", () => {
    const none = open({ kind: "order", key: orderKey({ ...ORDER, items: null }) }, data({
      orders: [{ ...ORDER, items: null }],
    }))
    expect(provOf(none, "품목")).toContain("붙어 있지 않습니다")

    const nameless: OrderRow = { ...ORDER, items: { title: null, count: 3, quantity: 5 } }
    const v = open({ kind: "order", key: orderKey(nameless) }, data({ orders: [nameless] }))
    expect(provOf(v, "품목")).toContain("리스팅이 아직 안 붙었습니다")
  })

  it("주소는 인덱스가 아니다 — 순서가 뒤집혀도 같은 행을 연다", () => {
    const other: OrderRow = { ...ORDER, at: "2026-07-02 09:00", amount: 11_000 }
    const key = orderKey(ORDER)
    const a = open({ kind: "order", key }, data({ orders: [ORDER, other] }))
    const b = open({ kind: "order", key }, data({ orders: [other, ORDER] }))
    expect(lineOf(a, "결제 금액").value).toBe(lineOf(b, "결제 금액").value)
    expect(lineOf(b, "결제 금액").value).toBe("32,000원")
  })
})

describe("정산 — 항의 합과 마켓 원본을 **따로** 놓는다", () => {
  it("맞아떨어지면 «차이 없음»", () => {
    const v = open({ kind: "settlement", key: settlementDetailKey(SETTLEMENT) })
    // 1,000,000 − 90,000 − 9,000 − 11,000 = 890,000
    expect(lineOf(v, "항의 합").value).toBe("890,000원")
    expect(lineOf(v, "마켓 지급액 (원본)").value).toBe("890,000원")
    expect(lineOf(v, "차이 없음").value).toBe("0원")
  })

  it("★ 안 맞으면 수를 말한다 — 조정으로 메우지 않는다 (LOCK 3) ★", () => {
    const off = { ...SETTLEMENT, net: 880_000 }
    const v = open({ kind: "settlement", key: settlementDetailKey(off) }, data({ settlements: [off] }))
    expect(lineOf(v, "차이").value).toBe("-10,000원")
    // 항의 합은 그대로다 — 원본을 고쳐 일치시키지 않는다.
    expect(lineOf(v, "항의 합").value).toBe("890,000원")
  })

  it("조정 스택은 읽기로만 보인다 — 넣고 거두는 자리는 정산 팝오버 하나뿐이다", () => {
    const adjusted: SettlementRow = {
      ...SETTLEMENT,
      adjSum: -5_000,
      adjustments: [{ id: 1, delta: -5_000, reason: "반품 누락분", createdAt: "2026-07-21" }],
    }
    const v = open({ kind: "settlement", key: settlementDetailKey(adjusted) }, data({
      settlements: [adjusted],
    }))
    expect(v.detail.hasAdj).toBe(true)
    expect(provOf(v, "조정 반영 후")).toBe("885,000원")
    // 「값 병합」 구간(조정 추가/제거 버튼)은 열지 않는다 — 쓰기 자리를 둘 만들지 않는다.
    expect(v.detail.hasMerge).toBe(false)
  })
})

describe("상품(SKU) — 모르는 값으로 곱을 만들지 않는다", () => {
  it("원가 × 수량 = 이 기간 매입원가", () => {
    const v = open({ kind: "sku", key: skuKey(SKU) })
    expect(lineOf(v, "이 기간 매입원가").value).toBe("90,000원")
  })

  it("★ 원가가 «미상»이면 곱하지 않는다 — `null`은 0이 아니다 ★", () => {
    const v = open(
      { kind: "sku", key: "sku-1" },
      data({ skus: [{ ...SKU, cost: null, costFrom: null }] }),
    )
    expect(lineOf(v, "개당 매입원가").value).toBe("미입력")
    expect(lineOf(v, "이 기간 매입원가").value).toBe("—")
  })

  it("★ 「ACTIVE」 같은 내부 코드값을 그리지 않는다 — 표와 같은 사람 말을 쓴다 ★", () => {
    const live = open({ kind: "sku", key: "sku-1" })
    const shown = live.detail.prov.map((p) => `${(p as { label: string }).label}`).join(" ")
    expect(shown, "판매중 SKU에는 상태 줄을 아예 안 그린다").not.toContain("상태")

    const draft = open({ kind: "sku", key: "sku-1" }, data({ skus: [{ ...SKU, status: "DRAFT" }] }))
    expect(provOf(draft, "판매 상태")).toBe("판매 대기 — 손익에서 제외됩니다")
  })

  it("상품명과 SKU명이 같으면 한 번만 쓴다", () => {
    const same = open({ kind: "sku", key: "sku-1" }, data({ skus: [{ ...SKU, productName: SKU.name }] }))
    expect(same.detail.sub).toBe("SKU SKU-0001")
    const diff = open({ kind: "sku", key: "sku-1" })
    expect(diff.detail.sub).toBe("SKU SKU-0001 · 거치대")
  })

  it("판매 수량이 «미상»이어도 곱하지 않는다", () => {
    const v = open({ kind: "sku", key: "sku-1" }, data({ skus: [{ ...SKU, soldQty: null }] }))
    expect(lineOf(v, "이 기간 판매 수량").value).toBe("품목 단위 데이터 없음")
    expect(lineOf(v, "이 기간 매입원가").value).toBe("—")
  })
})

describe("내부 키가 화면에 안 나온다 (헌장 C-4)", () => {
  const TARGETS: DetailTarget[] = [
    { kind: "product", key: "sku-1" },
    { kind: "channel", key: "conn-1" },
    { kind: "order", key: orderKey(ORDER) },
    { kind: "settlement", key: settlementDetailKey(SETTLEMENT) },
    { kind: "sku", key: "sku-1" },
  ]

  for (const t of TARGETS) {
    it(`${t.kind} 패널이 내부 id를 그리지 않는다`, () => {
      const v = open(t)
      const shown = [
        v.detail.title,
        v.detail.sub,
        ...v.detail.lines.map((l) => `${(l as { label: string }).label} ${(l as { value: string }).value}`),
        ...v.detail.prov.map((p) => `${(p as { label: string }).label} ${(p as { value: string }).value}`),
      ].join(" ")
      // `connectionId`·`skuId`는 주소로만 쓰이고 사람이 읽는 것은 이름이다.
      expect(shown, "내부 키가 화면에 샜다").not.toContain("conn-1")
      expect(shown, "내부 키가 화면에 샜다").not.toContain("sku-1")
    })
  }
})
