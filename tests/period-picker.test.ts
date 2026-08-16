/**
 * 월 선택기 — **화면에 실제로 서는가, 그리고 서면 안 되는 곳에 안 서는가.**
 *
 * `tests/month-switch.test.ts`가 조회 층(«두 달이 안 섞인다»)을 쟀다면, 여기는
 * 그 위의 한 겹이다: 사용자가 **고를 수 있는가**. 둘 다 참이어야 MVP의 셋째
 * 동작(대시보드 확인)이 다음 달에도 성립한다.
 *
 * ★ 실측이 설계를 고쳤다 (2026-08-16) ★
 * 실기기 DB에서 달 목록을 뽑았더니 **«2026-08»이 있었다.** 8월 장사가 아니라
 * 7월 11번가 정산 파일의 **지급일이 8월 초**로 찍힌 22건이다. 「기본 = 가장 최근
 * 달」로 만들었으면 사용자가 앱을 켜자마자 매출 0원인 8월을 봤다.
 */

import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { Template } from "../src/app/generated/Template.js"
import { emptyVals, type TemplateVals } from "../src/app/generated/vals.js"
import { periodVals, PERIOD_VIEWS } from "../src/app/period.js"
import { defaultMonth, loadAvailableMonths, monthLabel, monthPeriod, type MonthRow } from "../src/core/profit/months.js"
import { NAV, type NavKey } from "../src/app/shell.js"
import { DEV_SNAPSHOT } from "./dev-db.js"

const m = (ym: string, orders: number, settlements = 0, claims = 0, ads = 0): MonthRow => ({
  ym,
  orders,
  settlements,
  claims,
  ads,
})

/** 두 달 다 평범한 달(주문이 있다)이다. 정산만 있는 달은 아래에서 따로 다룬다. */
const MONTHS = [m("2026-08", 12), m("2026-07", 443)]

function vals(view: NavKey, months: readonly MonthRow[], month: string, open = false): TemplateVals {
  const v = emptyVals()
  v.subtitle = "부제가 여기 있었다"
  periodVals(v, view, month, months, open, { toggle: () => {}, pick: () => {} })
  return v
}

const html = (v: TemplateVals): string => renderToString(createElement(Template, { vals: v }))

describe("월 선택기 — 헤더에서 달을 고른다", () => {
  it("★ 기간이 걸리는 화면에서는 지금 보는 달이 헤더에 뜬다 ★", () => {
    for (const view of PERIOD_VIEWS) {
      const v = vals(view, MONTHS, "2026-07")
      expect(v.periodPick, `${view}에 선택기가 없다`).not.toBeNull()
      expect(html(v)).toContain("2026년 7월")
    }
  })

  it("기간이 안 걸리는 화면에는 **붙지 않는다** — 눌러도 아무것도 안 바뀌는 컨트롤을 만들지 않는다", () => {
    const others = NAV.filter((k) => !PERIOD_VIEWS.includes(k))
    // 연결·기록·채널·가져오기가 여기 있어야 한다 (data.ts가 기간을 안 넘기는 조회들).
    expect(others).toContain("linking")
    expect(others).toContain("sync")
    expect(others).toContain("connect")
    for (const view of others) {
      expect(vals(view, MONTHS, "2026-07").periodPick, `${view}에 선택기가 붙었다`).toBeNull()
    }
  })

  it("★ 부제를 대신한다 — 같은 달이 헤더에 두 번 서지 않는다 ★", () => {
    const on = vals("dash", MONTHS, "2026-07")
    expect(on.subtitle).toBe("")
    // 선택기가 안 붙는 화면의 부제는 살아 있어야 한다 (화면을 설명하는 문장이다).
    expect(vals("linking", MONTHS, "2026-07").subtitle).toBe("부제가 여기 있었다")
  })

  it("펼치면 **데이터가 있는 달만** 나온다 — 달력이 아니다", () => {
    const open = html(vals("dash", MONTHS, "2026-07", true))
    expect(open).toContain("2026년 8월")
    expect(open).toContain("2026년 7월")
    expect(open).toContain("가져온 파일이 있는 달만 나옵니다")
    // 접혀 있으면 목록이 없다.
    expect(html(vals("dash", MONTHS, "2026-07", false))).not.toContain("가져온 파일이 있는 달만")
  })

  it("달이 하나뿐이면 **왜 하나뿐인지** 말한다 (§22 — 부재를 설명한다)", () => {
    const one = html(vals("dash", [m("2026-07", 443)], "2026-07", true))
    expect(one).toContain("다른 달 파일을 넣으면 여기에 나타납니다")
  })

  it("데이터가 없으면 선택기 자체가 없다 — 고를 수 없는 것을 그리지 않는다", () => {
    expect(vals("dash", [], "2026-07").periodPick).toBeNull()
  })

  it("고른 달을 누르면 그 달이 전달된다", () => {
    const v = emptyVals()
    const picked: string[] = []
    periodVals(v, "dash", "2026-07", MONTHS, true, { toggle: () => {}, pick: (ym) => picked.push(ym) })
    v.periodPick?.items[0]?.pick()
    expect(picked).toEqual(["2026-08"])
  })

  it("지금 보는 달은 목록에서 표가 난다", () => {
    const v = vals("dash", MONTHS, "2026-07", true)
    const items = v.periodPick?.items ?? []
    expect(items.find((i) => i.label === monthLabel("2026-07"))?.bg).toBe("var(--bg-active)")
    expect(items.find((i) => i.label === monthLabel("2026-08"))?.bg).toBe("transparent")
  })
})

describe("★ 정산은 다음 달에 지급된다 — 그 달이 «장사한 달»이 아니다 ★", () => {
  /**
   * 실기기 실측에서 나온 모양 그대로다: 7월 주문 443건 + 그 정산 106건,
   * 그리고 **같은 파일**에서 온 8월 지급분 22건.
   */
  const REAL = [m("2026-08", 0, 22), m("2026-07", 443, 106, 9)]

  it("기본 달은 «가장 최근»이 아니라 «주문이 있는 가장 최근»이다", () => {
    expect(defaultMonth(REAL)).toBe("2026-07")
  })

  it("주문이 있는 달이 여럿이면 그중 최신이다", () => {
    expect(defaultMonth([m("2026-09", 0, 5), m("2026-08", 12), m("2026-07", 443)])).toBe("2026-08")
  })

  it("주문이 하나도 없으면(정산 파일만 넣은 상태) 최신 달로 간다 — 그게 가진 전부다", () => {
    expect(defaultMonth([m("2026-08", 0, 22), m("2026-07", 0, 106)])).toBe("2026-08")
  })

  it("달이 하나도 없으면 null — 부르는 쪽이 오늘의 달로 간다", () => {
    expect(defaultMonth([])).toBeNull()
  })

  it("★ 주문 없는 달은 목록에서 **무엇만 있는지** 말한다 ★", () => {
    const v = vals("dash", REAL, "2026-07", true)
    const items = v.periodPick?.items ?? []
    expect(items.find((i) => i.label === "2026년 8월")?.sub).toBe("정산만")
    // 평범한 달에는 꼬리표를 달지 않는다 — 매달 붙으면 아무 말도 아니게 된다.
    expect(items.find((i) => i.label === "2026년 7월")?.sub).toBe("")
    expect(html(v)).toContain("정산만")
  })

  it("종류를 우리가 정하지 않고 행 수에서 뽑는다 — 광고만 있는 달도 제 이름으로 나온다", () => {
    const v = vals("dash", [m("2026-09", 0, 0, 0, 40), m("2026-07", 443)], "2026-07", true)
    expect(v.periodPick?.items[0]?.sub).toBe("광고만")
  })
})

describe("달의 범위 — 말일을 손으로 세지 않는다", () => {
  it("31일·30일·2월이 각각 맞는다", () => {
    expect(monthPeriod("2026-07")).toEqual({ from: "2026-07-01", to: "2026-07-31" })
    expect(monthPeriod("2026-06")).toEqual({ from: "2026-06-01", to: "2026-06-30" })
    expect(monthPeriod("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" })
    // 윤년. 손으로 표를 만들었으면 여기서 틀린다.
    expect(monthPeriod("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" })
  })

  it("라벨은 앞의 0을 떼고 읽는다", () => {
    expect(monthLabel("2026-07")).toBe("2026년 7월")
    expect(monthLabel("2026-12")).toBe("2026년 12월")
  })
})

const ready = existsSync(DEV_SNAPSHOT)
const run = ready ? describe : describe.skip
if (!ready) console.warn("[period-picker] 개발용 DB 스냅샷이 없어 실측을 건너뛴다")

run("실기기 실측 — 지금 이 DB에 있는 달", () => {
  it("데이터가 있는 달이 최신 순으로 나오고, 기본은 **주문이 있는** 달이다", async () => {
    const db = openNodeDriver(DEV_SNAPSHOT, { pragmas: false })
    try {
      const months = await loadAvailableMonths(db, "lib-1")
      // 절대값을 걸지 않는다 — 사용자가 8월 파일을 넣는 날 늘어나는 것이 정상이다.
      expect(months.length).toBeGreaterThan(0)
      expect(months.every((r) => /^\d{4}-\d{2}$/.test(r.ym))).toBe(true)
      const ys = months.map((r) => r.ym)
      expect([...ys]).toEqual([...ys].sort().reverse())

      // ★ 기본 달은 주문이 있어야 한다 ★ 정산만 있는 달이 기본이 되면 앱을 켜자마자
      // 매출 0원이 뜬다 — 실기기에서 실제로 그럴 뻔한 자리다.
      const def = defaultMonth(months)
      expect(def).not.toBeNull()
      expect(months.find((r) => r.ym === def)?.orders ?? 0).toBeGreaterThan(0)

      console.info(
        "[period-picker] 실측 — 달 목록:",
        months.map((r) => `${r.ym}(주문 ${r.orders}·정산 ${r.settlements})`).join(" · "),
        "→ 기본",
        def,
      )
    } finally {
      await db.close()
    }
  })
})
