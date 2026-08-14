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
import type { Period } from "../src/core/profit/index.js"
import { orderVals } from "../src/app/order.js"
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
      }
    } finally {
      await db.close()
    }
  }

  /**
   * ★ 절대값을 박지 않는다 (2026-08-14) ★
   * 「주문 146 · 155행」은 «CLI가 만든 DB» 한 상태의 사진이었다. 위저드가 서고
   * 사용자가 실제로 파일을 넣자(쿠팡 매출 2종) 숫자가 늘었고 게이트가 빨개졌다 —
   * **회귀가 아니라 데이터가 는 것**이다. 이 테스트가 지켜야 할 것은 특정 숫자가
   * 아니라 «목록이 센 것 = 스냅샷이 센 것»이다.
   */
  it("행 수가 적재된 행 수와 같다 — 목록과 스냅샷이 갈리지 않는다", async () => {
    const { snap, rows } = await load()
    const orders = rows.filter((r) => r.kind === "order")
    const claims = rows.filter((r) => r.kind === "claim")

    expect(rows.length, "겹쳐 세지도 빠뜨리지도 않는다").toBe(orders.length + claims.length)
    // 스냅샷이 센 주문 건수와 같아야 한다. 다르면 기간 필터가 갈린 것이다
    expect(orders.length, "스냅샷의 orderCount와 같다").toBe(snap.orderCount)
    expect(orders.length, "주문이 0이면 이 게이트는 무의미하다").toBeGreaterThan(0)
  })

  it("합계가 손익과 원 단위로 같다", async () => {
    const { snap, rows } = await load()
    const sum = (k: string): number =>
      rows.filter((r) => r.kind === k).reduce((a, r) => a + r.amount, 0)

    expect(sum("order"), "손익의 revenue와 같다").toBe(snap.pnl.revenue)
    // 부호는 화면이 붙이지 않는다 — 빼는 것은 계산기의 몫이다
    expect(sum("claim"), "손익의 claims와 같다").toBe(snap.pnl.claims)
  })

  /**
   * 손으로 검산한 정답지 — **연결 단위로만 유효하다.**
   * 라이브러리 합계는 파일이 들어올 때마다 바뀌지만, 「ESM 주문 146건 =
   * 7,896,500원 · 클레임 9건 388,700원」은 그 batch가 살아 있는 한 참이다.
   */
  it("ESM 정답지가 그대로 살아 있다", async () => {
    const { rows } = await load()
    const esm = rows.filter((r) => r.channel === "ESM (G마켓·옥션)")
    const orders = esm.filter((r) => r.kind === "order")
    const claims = esm.filter((r) => r.kind === "claim")

    expect(orders.length, "ESM 주문 건수").toBe(146)
    expect(orders.reduce((a, r) => a + r.amount, 0), "ESM 매출").toBe(7_896_500)
    expect(claims.length, "ESM 클레임 건수").toBe(9)
    expect(claims.reduce((a, r) => a + r.amount, 0), "ESM 클레임 금액").toBe(388_700)
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
    // 클레임은 ESM에서만 오고 전부 프록시 일자다 — 다른 클레임 양식이 생기면 바뀐다
    expect(est, "오늘은 클레임 전부가 추정이다").toBe(
      rows.filter((r) => r.kind === "claim").length,
    )
  })

  it("표가 화면에 그려진다 — 클레임이 성격이 보이게 선다", async () => {
    const { rows } = await load()
    const nOrder = rows.filter((r) => r.kind === "order").length
    const nClaim = rows.filter((r) => r.kind === "claim").length
    const vals = shellVals(shellStateFor(false), emptyActions() as never)
    orderVals(vals, rows, PERIOD)
    vals.firstRun = false
    vals.notFirstRun = true
    vals.v.orders = true

    const html = renderToString(createElement(Template, { vals }))

    expect(html, "빈 상태가 떠 있다").not.toContain("주문이 없습니다")
    expect(html, "범위 줄이 없다").toContain(`주문 ${nOrder.toLocaleString("ko-KR")}건`)
    expect(html, "클레임 건수가 없다").toContain(`클레임 ${nClaim.toLocaleString("ko-KR")}건`)
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
 * ★ «내부 키가 화면에 새지 않는다»는 여기 있었다 → `tests/screen-safety.test.ts` ★
 *
 * 정산·주문 둘을 한 번에 지키려고 이 파일에 뒀던 것인데, 그 이유가 **다음 화면에서도
 * 같은 실수가 나오기 때문**이었다. 실제로 상품 연결에서 났고(합성 키의 U+0001),
 * 그때 파일 이름이 `order-rows`에 묶여 있는 것이 오히려 «공용»이라는 목적을 가렸다.
 *
 * 내용은 한 곳 그대로다 — 옮긴 것은 이름뿐이다.
 */
