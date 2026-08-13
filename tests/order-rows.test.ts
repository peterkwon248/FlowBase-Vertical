/**
 * 주문 화면 배선의 게이트 — **행 수·합계가 CLI/스냅샷과 같다.**
 *
 * ★ 클레임이 왜 별도 행인가 ★
 * 붙이고 싶어도 붙지 않는다. ESM 프로파일에서 주문의 `source_key`는
 * `주문번호 + 상품번호`(자연키)인데 클레임의 `order_source_key`는 **주문번호뿐**이라
 * 두 값의 모양이 다르다. 억지로 접두 매칭하면 상품이 여럿인 주문에서 조용히 잘못
 * 붙는다 — 그래서 §14-1대로 성격이 보이게 따로 세운다.
 *
 * 155행(주문 146 + 클레임 9)은 **적재된 행 수와 정확히 같다.** 목록이 무엇을
 * 빠뜨리지도 겹쳐 세지도 않는다는 뜻이다.
 */

import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { loadOrderRows } from "../src/core/order/rows.js"
import { loadSettlementRows } from "../src/core/settlement/rows.js"
import type { Period } from "../src/core/profit/index.js"
import { orderVals } from "../src/app/order.js"
import { settlementVals } from "../src/app/settlement.js"
import { Template } from "../src/app/generated/Template.js"
import { shellVals, shellStateFor } from "../src/app/shell.js"

const DB = ".tmp/pnl.sqlite"
const PERIOD: Period = { from: "2026-07-01", to: "2026-07-31" }
const LIB = "lib-1"

const ready = existsSync(DB)
const run = ready ? describe : describe.skip

if (!ready) {
  console.warn(`[order-rows] ${DB}가 없어 건너뛴다 — npx tsx tools/harness/pnl.ts 로 만든다`)
}

function emptyActions() {
  const noop = (): void => {}
  return { go: noop, toggleNav: noop, closeNav: noop, openNav: noop, goImport: noop, toggleTheme: noop }
}

run("주문 화면 — 화면 숫자 = CLI 숫자", () => {
  async function load() {
    const db = openNodeDriver(DB, { pragmas: false })
    try {
      return {
        snap: await loadPnlSnapshot(db, LIB, PERIOD),
        rows: await loadOrderRows(db, LIB, PERIOD),
        settlement: await loadSettlementRows(db, LIB, PERIOD),
      }
    } finally {
      await db.close()
    }
  }

  it("행 수가 적재된 행 수와 같다 — 주문 146 · 클레임 9", async () => {
    const { snap, rows } = await load()
    const orders = rows.filter((r) => r.kind === "order")
    const claims = rows.filter((r) => r.kind === "claim")

    expect(orders.length, "주문").toBe(146)
    expect(claims.length, "클레임").toBe(9)
    expect(rows.length, "합계 — 겹쳐 세지도 빠뜨리지도 않는다").toBe(155)
    // 스냅샷이 센 주문 건수와 같아야 한다. 다르면 기간 필터가 갈린 것이다
    expect(orders.length, "스냅샷의 orderCount와 같다").toBe(snap.orderCount)
  })

  it("합계가 손익과 원 단위로 같다 — 총매출 7,896,500 · 클레임 388,700", async () => {
    const { snap, rows } = await load()
    const sum = (k: string): number =>
      rows.filter((r) => r.kind === k).reduce((a, r) => a + r.amount, 0)

    expect(sum("order"), "총매출").toBe(7_896_500)
    expect(sum("order"), "손익의 revenue와 같다").toBe(snap.pnl.revenue)
    // 부호는 화면이 붙이지 않는다 — 빼는 것은 계산기의 몫이다
    expect(sum("claim"), "클레임 원금액").toBe(388_700)
    expect(sum("claim"), "손익의 claims와 같다").toBe(snap.pnl.claims)
  })

  /**
   * ★ 미분화의 단언 (작업 리듬 10번) ★
   * 클레임 9건 전부가 날짜 추정이라는 것이 오늘의 사실이고, 대시보드 단서 카드가
   * 세는 그 9건과 **같은 집합**이다. 두 곳이 갈리는 날 여기서 먼저 깨진다.
   */
  it("날짜 추정 클레임 수가 단서 카드와 같다", async () => {
    const { snap, rows } = await load()
    const est = rows.filter((r) => r.kind === "claim" && r.dateEstimated).length
    expect(est, "목록이 센 추정 건수").toBe(snap.proxyDatedClaims)
    expect(est, "오늘은 9건 전부가 추정이다").toBe(9)
  })

  it("표가 화면에 그려진다 — 클레임이 성격이 보이게 선다", async () => {
    const { rows } = await load()
    const vals = shellVals(shellStateFor(false), emptyActions() as never)
    orderVals(vals, rows, PERIOD)
    vals.firstRun = false
    vals.notFirstRun = true
    vals.v.orders = true

    const html = renderToString(createElement(Template, { vals }))

    expect(html, "빈 상태가 떠 있다").not.toContain("주문이 없습니다")
    expect(html, "범위 줄이 없다").toContain("주문 146건")
    expect(html, "클레임 건수가 없다").toContain("클레임 9건")
    // 클레임 행이 자기 성격을 말한다
    expect(html, "클레임 유형 표기가 없다").toMatch(/취소|반품|환불|교환/)
    // 날짜가 추정인 것을 숨기지 않는다
    expect(html, "추정 표기가 없다").toContain("(추정)")
  })

  it("사실 화면이므로 편집 어포던스를 그리지 않는다 (§21-1 · 헌장 규칙 9)", async () => {
    const { rows } = await load()
    const vals = shellVals(shellStateFor(false), emptyActions() as never)
    orderVals(vals, rows, PERIOD)
    for (const r of vals.orderRows as { unlinked: boolean }[]) {
      expect(r.unlinked, "연결하기 버튼을 그리면 안 된다").toBe(false)
    }
  })
})

/**
 * ★ 내부 키는 화면에 나오지 않는다 (헌장 C-4) ★
 *
 * `connection_id`·`batch_id`·`source_key`는 우리 안에서만 뜻을 갖는 값이다.
 * 사용자에게 `conn-11st`나 `batch-esm`이 보이면 그건 우리가 이름을 안 붙였다는
 * 뜻이지 사용자가 알아야 할 사실이 아니다. 채널 이름의 출처는 프로파일이
 * 선언한 `displayName`이고 `connection.display_name`에 산다.
 *
 * 두 화면을 한 테스트로 묶는 이유는 **다음 화면에서도 같은 실수가 나오기 때문**이다.
 */
run("내부 키가 화면에 새지 않는다 (헌장 C-4)", () => {
  const LEAKS = ["conn-", "batch-", "source_key", "connection_id", "library_id"]

  it("정산 · 주문 화면 어디에도 내부 키가 없다", async () => {
    const db = openNodeDriver(DB, { pragmas: false })
    const settlement = await loadSettlementRows(db, LIB, PERIOD)
    const orders = await loadOrderRows(db, LIB, PERIOD)
    await db.close()

    // 화면마다 나오는 채널이 다르다 — 정산은 11번가, 주문은 ESM에서 왔다.
    // 그 자체가 "연결 3개가 섞여 있다"는 단서의 다른 표현이다.
    const views = [
      { key: "settlement", channel: "11번가", wire: (v: never) => settlementVals(v, settlement, PERIOD) },
      { key: "orders", channel: "ESM", wire: (v: never) => orderVals(v, orders, PERIOD) },
    ] as const

    for (const view of views) {
      const vals = shellVals(shellStateFor(false), emptyActions() as never)
      view.wire(vals as never)
      vals.firstRun = false
      vals.notFirstRun = true
      ;(vals.v as Record<string, boolean>)[view.key] = true

      const html = renderToString(createElement(Template, { vals }))
      for (const leak of LEAKS) {
        expect(html.includes(leak), `${view.key} 화면에 "${leak}"가 보인다`).toBe(false)
      }
      expect(html, `${view.key} 화면에 채널 이름이 없다`).toContain(view.channel)
    }
  })
})
