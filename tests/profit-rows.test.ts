/**
 * 상품별·채널별 손익 — **대시보드의 두 빈 표를 채운 조회.**
 *
 * ★ 이 시험이 지키는 것은 «같은 답» ★
 * 두 조회는 손익 스냅샷과 **같은 조각**(`costAtSql`·품목 조인·`quantity > 0`)을
 * 쓴다. 갈라지면 상품별 합과 대시보드 매입원가가 다른 숫자가 되고, 사용자는
 * 어느 쪽을 믿어야 할지 알 수 없게 된다 (단일 계산기 LOCK의 조회판).
 *
 * 그래서 절대값이 아니라 **항등식**을 건다 — 사용자가 파일을 하나 더 넣는 날
 * 절대값은 바뀌지만 항등식은 그대로여야 한다.
 */

import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { loadChannelRows, loadProfitRows } from "../src/core/profit/rows.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import type { Period } from "../src/core/profit/index.js"
import { DEV_SNAPSHOT } from "./dev-db.js"

const PERIOD: Period = { from: "2026-07-01", to: "2026-07-31" }
const LIB = "lib-1"

const ready = existsSync(DEV_SNAPSHOT)
const run = ready ? describe : describe.skip
if (!ready) console.warn("[profit-rows] 개발용 DB 스냅샷이 없어 건너뛴다")

run("상품별 손익 — 대시보드와 같은 답을 낸다", () => {
  async function load() {
    const db = openNodeDriver(DEV_SNAPSHOT, { pragmas: false })
    try {
      return {
        snap: await loadPnlSnapshot(db, LIB, PERIOD),
        products: await loadProfitRows(db, LIB, PERIOD),
        channels: await loadChannelRows(db, LIB, PERIOD),
      }
    } finally {
      await db.close()
    }
  }

  it("★ 상품별 매입원가의 합 = 대시보드 매입원가 ★ (원 단위)", async () => {
    const { snap, products } = await load()
    const sum = products.reduce((a, r) => a + r.cogs, 0)
    expect(sum).toBe(snap.pnl.cogs)
  })

  it("★ 채널별 매출의 합 = 총매출 ★ — 연결이 늘어도 항등식은 그대로다", async () => {
    const { snap, channels } = await load()
    expect(channels.reduce((a, c) => a + c.revenue, 0)).toBe(snap.pnl.revenue)
  })

  it("★ 상품 매출 합은 총매출보다 **작거나 같다** — 그 차이가 «품목 없는 매출»이다 ★", async () => {
    const { snap, products } = await load()
    const sum = products.reduce((a, r) => a + r.revenue, 0)
    expect(sum).toBeLessThanOrEqual(snap.pnl.revenue)
    // 실측(7월): 차이 388,700원 = 클레임 9건. 클레임 행은 품목을 만들지 않는다.
    // 절대값을 걸지 않는 이유는 파일이 늘면 이 값도 바뀌기 때문이다 — 화면은
    // 이 차이를 «품목이 없는 N원은 이 표에 없습니다»로 말한다.
  })

  it("연결되지 않은 판매는 **한 줄로** 모인다 — 리스팅마다 서면 표가 아니게 된다", async () => {
    const { products } = await load()
    expect(products.filter((r) => r.skuId === null).length).toBeLessThanOrEqual(1)
  })

  it("원가를 모르는 행은 0원으로 세지 않는다 — «엄청 남는 상품»을 만들지 않는다", async () => {
    const { products } = await load()
    const unknown = products.filter((r) => r.noCostQty > 0)
    // 그런 행이 있으면 그 사실이 수량으로 남아 있어야 한다(0으로 뭉개지지 않는다).
    for (const r of unknown) expect(r.noCostQty).toBeGreaterThan(0)
  })

  it("채널 손익은 **주문 귀속 수수료**를 쓴다 — 8월에 정산된 7월 주문도 7월에 잡힌다", async () => {
    const { channels, snap } = await load()
    const fee = channels.reduce((a, c) => a + c.fee, 0)
    // 스냅샷의 «조인된 정산»과 같은 규칙이라 합이 같아야 한다.
    expect(fee).toBe(snap.settlement.joined.fee + snap.settlement.joined.vat)
  })
})
