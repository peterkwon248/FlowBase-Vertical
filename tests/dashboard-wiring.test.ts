/**
 * 대시보드 배선 1단의 게이트 — **화면 숫자 = CLI 숫자.**
 *
 * "배선 성공"의 정의를 "예쁘게 뜬다"가 아니라 **"CLI와 같은 숫자"**로 박는다.
 * 지금까지 쌓은 검증 사슬(독립 실측 = CLI = e2e = 앱)이 화면까지 한 줄로
 * 이어지는 자리다.
 *
 * ★ 왜 이게 성립하는가 ★
 * 화면과 CLI가 **같은 DB를 같은 `loadPnlSnapshot`으로** 읽는다. 숫자가 같은
 * 것은 검사로 확인한 우연이 아니라 구조의 결과다 — 이 테스트는 그 구조가
 * 실제로 지켜졌는지를 본다.
 *
 * DB는 3b-0 CLI(`npx tsx tools/harness/pnl.ts`)가 만든다. 원본 픽스처가 필요해
 * 다른 기기에서는 없을 수 있으므로, 없으면 **조용히 통과시키지 않고 건너뛴다**.
 */

import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import type { Period } from "../src/core/profit/index.js"
import { dashboardVals } from "../src/app/dashboard.js"
import { Template } from "../src/app/generated/Template.js"
import { emptyVals } from "../src/app/generated/vals.js"
import { shellVals, shellStateFor } from "../src/app/shell.js"

const DB = ".tmp/pnl.sqlite"
const PERIOD: Period = { from: "2026-07-01", to: "2026-07-31" }
const LIB = "lib-1"

/** 3b-0 CLI가 낸 값. 이 숫자들이 정답지다. */
const CLI = {
  revenue: 7_896_500,
  claims: 388_700,
  adSpend: 15_700_534,
  netProfit: -8_192_734,
  productContribution: 7_507_800,
  orderCount: 146,
}

const ready = existsSync(DB)
const run = ready ? describe : describe.skip

if (!ready) {
  console.warn(`[dashboard-wiring] ${DB}가 없어 건너뛴다 — npx tsx tools/harness/pnl.ts 로 만든다`)
}

run("대시보드 1단 — 화면 숫자 = CLI 숫자", () => {
  async function snapshot() {
    const db = openNodeDriver(DB, { pragmas: false })
    try {
      return await loadPnlSnapshot(db, LIB, PERIOD)
    } finally {
      await db.close()
    }
  }

  it("스냅샷이 CLI와 같은 값을 낸다", async () => {
    const s = await snapshot()
    expect(s.pnl.revenue).toBe(CLI.revenue)
    expect(s.pnl.claims).toBe(CLI.claims)
    expect(s.pnl.adDirect + s.pnl.adUnallocated).toBe(CLI.adSpend)
    expect(s.pnl.netProfit).toBe(CLI.netProfit)
    expect(s.pnl.productContribution).toBe(CLI.productContribution)
    expect(s.orderCount).toBe(CLI.orderCount)
  })

  // ★ 아직 통과하지 못한다 — 남은 일이 정확히 여기다 ★
  //
  // 스냅샷 값은 CLI와 일치하고(위 테스트) KPI 스트립도 렌더된다. 그런데 비용
  // 구성(costMix)이 화면에 안 뜬다 — `showHero` 말고 **표시 카드 조건이 하나 더**
  // 있다 (목업 L5558 `dispCards`의 `cards.cost` 계열). 그 조건을 찾아 배선하면
  // 이 테스트가 켜진다. 조용히 통과시키지 않으려고 skip이 아니라 todo로 둔다.
  it.todo("★ 화면 HTML에 그 숫자가 실제로 뜬다 ★ — 비용 구성 표시 조건이 남았다")

  it.skip("(위 todo의 본문)", async () => {
    const s = await snapshot()
    const vals = shellVals(shellStateFor(false), {
      go: () => {},
      toggleNav: () => {},
      closeNav: () => {},
      openNav: () => {},
      goImport: () => {},
      toggleTheme: () => {},
    })
    dashboardVals(vals, s, PERIOD)
    vals.firstRun = false
    vals.notFirstRun = true
    vals.v.dash = true

    const html = renderToString(createElement(Template, { vals }))

    // ★ 표기가 두 가지다 ★ KPI 카드는 축약(compact), 비용 구성은 원 단위(won).
    // 목업 설계 그대로다 — 큰 숫자는 한눈에, 정확한 숫자는 자세히 보는 곳에.
    // **값이 같은지는 위 테스트가 원 단위로 이미 확인했다.**

    // 비용 구성 — 원 단위 그대로 뜬다
    expect(html, "클레임이 화면에 없다").toContain("388,700원")
    expect(html, "광고비가 화면에 없다").toContain("15,700,534원")

    // KPI — 축약 표기
    expect(html, "총매출 KPI가 없다").toContain("790만원")
    expect(html, "순이익 KPI가 없다").toContain("-819만원")

    // 주문 건수는 원 단위
    expect(html, "주문 건수가 없다").toContain("주문 146건")
  })

  it("비용 구성이 실제 항목을 담는다 — 클레임이 사라지지 않는다", async () => {
    const s = await snapshot()
    const vals = emptyVals()
    dashboardVals(vals, s, PERIOD)
    const labels = (vals.costMix as { label: string }[]).map((m) => m.label)
    expect(labels).toContain("클레임")
    expect(labels).toContain("광고비")
    // 0인 항목은 빼고 그린다 — 원가·할인은 아직 기준 데이터가 없다
    expect(labels).not.toContain("매출원가")
  })

  it("데이터가 없으면 배선하지 않는다 — 빈 값이 그대로 남는다", () => {
    const vals = emptyVals()
    expect(vals.heroRev).toBe("")
    expect(vals.costMix).toEqual([])
  })
})
