/**
 * 원가 다리 (D2) — **품명이 상품에 닿고, 확정하면 손익이 움직인다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 파일이 지키는 것 ★
 *
 * 실파일 실측: 대기 175행 중 147행이 후보를 얻었고(목표 129), 그중 94건은
 * **모델 코드 일치**가 1순위였다. 이 파일은 그 판정 규칙과, 확정 한 번이
 * 손익까지 통과하는 사슬을 고정한다.
 *
 * 가장 무거운 단언: ① 모델 일치가 이름 유사도를 이긴다 ② 확정은 사람만 한다
 * (clear여도 자동으로 안 붙는다) ③ 확정 → cost_history → 손익 이동.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { listingIdFor, Repository } from "../src/core/store/repository.js"
import { loadPendingCostView } from "../src/core/linking/pending-cost.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { prepareCostBridge, type BridgeListing } from "../src/packs/kr-marketplace/listing-match.js"
import { krCostBridgeMatcher } from "../src/packs/kr-marketplace/linking-matcher.js"

const L = (id: string, title: string, skuId: string | null = null): BridgeListing => ({
  id,
  title,
  grain: "product",
  skuId,
})

describe("prepareCostBridge — 모델 정확 일치가 이름 유사도를 이긴다", () => {
  it("★ 제목이 전혀 달라도 모델 코드가 맞으면 clear다 ★", () => {
    // 실측 계보: 「이름 유사도로 못 잡는 것을 코드 일치가 잡는다」 (cost-card 메모)
    const bridge = prepareCostBridge([
      L("l1", "머레이 미니 선풍기 화이트 NS-19"),
      L("l2", "머레이 보조배터리 5000mAh MDK-5"),
    ])
    const s = bridge.suggest({ title: "탁상용 소형 팬", model: "NS-19" })
    expect(s.kind).toBe("clear")
    expect(s.candidates[0]!.via).toBe("model")
    expect(s.candidates[0]!.title).toContain("선풍기")
  })

  it("같은 코드가 두 군집에 있으면 contested — 사람이 가른다", () => {
    const bridge = prepareCostBridge([
      L("l1", "미니 선풍기 NS-19 화이트"),
      L("l2", "탁상 선풍기 NS-19 블랙 리뉴얼"),
    ])
    const s = bridge.suggest({ title: "소형 팬", model: "NS-19" })
    expect(s.kind).toBe("contested")
    expect(s.candidates.length).toBe(2)
  })

  it("병기 모델(A / B)은 어느 한쪽이 맞으면 일치다", () => {
    const bridge = prepareCostBridge([L("l1", "무선마우스 MK-100 그레이")])
    const s = bridge.suggest({ title: "2.4GHZ무선마우스", model: "BM-330 / MK-100" })
    expect(s.kind).toBe("clear")
    expect(s.candidates[0]!.via).toBe("model")
  })

  it("모델이 없으면 이름 유사도로 물러난다 — 절단점은 실측 상수 그대로", () => {
    const bridge = prepareCostBridge([
      L("l1", "머레이 1080도 회전 수도꼭지 워터탭"),
      L("l2", "머레이 캠핑의자 신형"),
    ])
    const s = bridge.suggest({ title: "1080도 회전 수도꼭지 워터탭 고급형", model: null })
    expect(s.kind).not.toBe("none")
    expect(s.candidates[0]!.via).toBe("name")
    expect(s.candidates[0]!.title).toContain("수도꼭지")
  })

  it("브랜드 하나 겹친 것은 후보가 아니다 — 잡음 규칙 유지", () => {
    const bridge = prepareCostBridge([L("l1", "머레이 캠핑의자 신형 CH-M")])
    const s = bridge.suggest({ title: "머레이 노트북 거치대", model: null })
    expect(s.kind).toBe("none")
  })

  it("★ 군집이 목적지다 — 옵션 리스팅 여럿이 후보 하나로 접힌다 ★", () => {
    const bridge = prepareCostBridge([
      { id: "l1", title: "미니 선풍기 NS-19 · 색상:블랙", grain: "option", skuId: null },
      { id: "l2", title: "미니 선풍기 NS-19 · 색상:화이트", grain: "option", skuId: null },
    ])
    const s = bridge.suggest({ title: "탁상 팬", model: "NS-19" })
    expect(s.kind).toBe("clear")
    expect(s.candidates[0]!.listingIds).toEqual(["l1", "l2"])
  })

  it("군집의 리스팅이 이미 SKU에 이어져 있으면 그 SKU가 목적지다", () => {
    const bridge = prepareCostBridge([
      { id: "l1", title: "미니 선풍기 NS-19 · 블랙", grain: "option", skuId: "sku-9" },
      { id: "l2", title: "미니 선풍기 NS-19 · 화이트", grain: "option", skuId: "sku-9" },
    ])
    const s = bridge.suggest({ title: "팬", model: "NS-19" })
    expect(s.candidates[0]!.skuId).toBe("sku-9")
  })
})

describe("원가 대기 화면 조회 + 확정 사슬", () => {
  let db: Driver
  let repo: Repository
  const LIB = "lib-1"
  const NOW = "2026-08-19T00:00:00"

  beforeEach(async () => {
    db = openNodeDriver()
    await migrate(db)
    repo = new Repository(db)
    await repo.ensureLibrary(LIB, "기본", NOW)
    await repo.ensureConnection(
      { id: "conn-x", libraryId: LIB, packId: "p", marketplaceKey: "x", displayName: "테스트" },
      NOW,
    )
    // 주문에서 온 리스팅 하나 (SKU 없음) + 7월 판매 1건
    await db
      .prepare(
        `INSERT INTO marketplace_listing
           (id, library_id, connection_id, listing_key, title, grain, sku_id, link_state, updated_at)
         VALUES (?,?,'conn-x','K-1','미니 선풍기 NS-19','product', NULL, 'unlinked', ?)`,
      )
      .run(listingIdFor("conn-x", "K-1"), LIB, NOW)
    await db
      .prepare(
        `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes, container_format,
                            mapping_version, started_at, committed_at, status, row_count)
         VALUES ('b1',?,'conn-x','x',0,'xlsx','x/order/line@1',?,?,'committed',1)`,
      )
      .run(LIB, NOW, NOW)
    await db
      .prepare(
        `INSERT INTO fact_order (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                                 source_key, ordered_at, status, total_amount)
         VALUES ('o1','conn-x','b1',?,?,'x/order/line@1','o1','2026-07-10','PAID',100000)`,
      )
      .run(LIB, NOW)
    await db
      .prepare(
        `INSERT INTO fact_order_item (id, connection_id, batch_id, library_id, updated_at,
                                      mapping_version, source_key, order_id, listing_id, quantity, gross_amount)
         VALUES ('o1-i','conn-x','b1',?,?,'x/order/line@1','o1-i','o1',?,2,100000)`,
      )
      .run(LIB, NOW, listingIdFor("conn-x", "K-1"))
    // 원가 대기 행 — 카드 단가표에서 온 모양 그대로
    await repo.stashPendingCosts([
      {
        libraryId: LIB,
        sourceKey: "탁상용 소형 팬",
        kind: "COGS",
        title: "탁상용 소형 팬",
        modelCode: "NS-19",
        amount: 4_700,
        effectiveFrom: "2026-01-01",
        sourceHash: "h",
        sourceName: "단가표.xlsx",
        profileVersion: "seller/cost/product-card@1",
        now: NOW,
      },
    ])
  })

  it("조회가 후보를 들고 온다 — 모델 일치, SKU 없는 군집", async () => {
    const v = await loadPendingCostView(db, LIB, krCostBridgeMatcher)
    expect(v.pending).toHaveLength(1)
    const card = v.pending[0]!
    expect(card.kind).toBe("clear")
    expect(card.candidates[0]!.via).toBe("model")
    expect(card.candidates[0]!.skuId).toBeNull()
  })

  it("★ clear여도 자동으로 붙지 않는다 — 조회는 읽기 전용이다 ★", async () => {
    await loadPendingCostView(db, LIB, krCostBridgeMatcher)
    const c = await db.prepare(`SELECT COUNT(*) n FROM cost_history`).get()
    expect(Number(c?.["n"]), "조회가 원가를 넣었다").toBe(0)
    const p = await repo.pendingCosts(LIB, "pending")
    expect(p).toHaveLength(1)
  })

  it("★★ 확정 사슬 — SKU 생성 → 원가 → 손익이 움직인다 ★★", async () => {
    const before = await loadPnlSnapshot(db, LIB, { from: "2026-07-01", to: "2026-07-31" })
    expect(before.pnl.cogs).toBe(0)

    // App의 resolveCost가 하는 그 사슬을 그대로 — 군집에 SKU가 없으면 만든다
    const v = await loadPendingCostView(db, LIB, krCostBridgeMatcher)
    const card = v.pending[0]!
    const cand = card.candidates[0]!
    const made = await repo.createSkuForListings(LIB, [...cand.listingIds], cand.title, NOW)
    expect(made.skuId).not.toBeNull()
    await repo.resolvePendingCost({ id: card.id, skuId: made.skuId!, now: NOW })

    const after = await loadPnlSnapshot(db, LIB, { from: "2026-07-01", to: "2026-07-31" })
    // 7월에 2개 팔렸다 — 원가 4,700 × 2
    expect(after.pnl.cogs, "확정했는데 손익이 그대로다").toBe(9_400)
    expect(before.pnl.productContribution - after.pnl.productContribution).toBe(9_400)

    // 대기실에서는 resolved로 넘어가 화면에서 사라진다
    const v2 = await loadPendingCostView(db, LIB, krCostBridgeMatcher)
    expect(v2.pending).toHaveLength(0)
    expect(v2.resolvedCount).toBe(1)
  })

  it("무시 → dismissed 목록으로, 거두면 돌아온다", async () => {
    const v = await loadPendingCostView(db, LIB, krCostBridgeMatcher)
    await repo.dismissPendingCost(v.pending[0]!.id)
    const v2 = await loadPendingCostView(db, LIB, krCostBridgeMatcher)
    expect(v2.pending).toHaveLength(0)
    expect(v2.dismissed).toHaveLength(1)
    await repo.undoDismissPendingCost(v2.dismissed[0]!.id)
    expect((await loadPendingCostView(db, LIB, krCostBridgeMatcher)).pending).toHaveLength(1)
  })
})
