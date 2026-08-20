/**
 * 할인 — **화면이 말하는데 파이프라인이 못 담던 항** (2026-08-20 감사 A-1-2).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 3단으로 죽어 있었다 ★
 *
 *   ① `mapping/targets.ts`에 `discount_amount`가 **없었다** → `validateProfiles`가
 *      미등록 target을 거부하므로 **어떤 프로파일도 매핑할 수 없었다**
 *   ② 그래서 컬럼은 늘 DEFAULT 0
 *   ③ `snapshot.ts`가 `computePnl`에 `discount` 키를 **안 넘겼다**
 *
 * 그런데 화면은 「할인」을 말한다 — 도넛 조각·상품별 열·비용 3층.
 *
 * ★ 이 시험이 잡는 진짜 위험은 ③이다 ★
 * `rows.ts`(상품별 손익)는 같은 컬럼을 `SUM(oi.discount_amount)`로 **빼고 있었다.**
 * 즉 값이 들어오는 순간 **두 화면이 서로 다른 답을 낸다.** 그리고 이 앱은
 * 「상품별 손익의 합은 회사 순이익이 아니다」를 **정상**이라고 설명하므로,
 * 그 설명이 진짜 어긋남을 통째로 흡수한다 — 눈으로는 영영 못 잡는다.
 *
 * ★ 왜 개발 DB가 아니라 합성 DB인가 ★
 * 실측하면 오늘 있는 파일의 라인 할인은 **전 행 0**이다(자사몰 #9·#10의 회원·쿠폰·
 * 모바일앱 할인 1,234행 전부 0 — 할인이 이미 `판매가`에 녹아 있다. 정가 13,900 →
 * 판매가 7,000). 그 DB로는 `0 === 0`이라 **게이트가 물지 않는다.** 그래서 할인이
 * 실린 DB를 직접 만든다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { listingIdFor, Repository } from "../src/core/store/repository.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { loadProfitRows } from "../src/core/profit/rows.js"
import { TARGETS } from "../src/core/import/mapping/targets.js"
import type { Period } from "../src/core/profit/index.js"

const LIB = "lib-1"
const NOW = "2026-07-01T00:00:00.000Z"
const PERIOD: Period = { from: "2026-07-01", to: "2026-07-31" }
const MV = "x/order/line@1"

type Db = ReturnType<typeof openNodeDriver>

async function seed(db: Db): Promise<void> {
  await migrate(db)
  const repo = new Repository(db)
  await repo.ensureLibrary(LIB, "기본", NOW)
  await repo.ensureConnection(
    { id: "conn-x", libraryId: LIB, packId: "p", marketplaceKey: "x", displayName: "테스트" },
    NOW,
  )
  await db
    .prepare(`INSERT INTO product (id, library_id, name, created_at, updated_at) VALUES (?,?,?,?,?)`)
    .run("prd-1", LIB, "상품", NOW, NOW)
  await db
    .prepare(
      `INSERT INTO sku (id, library_id, product_id, code, name, status, created_at, updated_at)
       VALUES ('sku-1',?,'prd-1','SKU-0001','상품','ACTIVE',?,?)`,
    )
    .run(LIB, NOW, NOW)
  await db
    .prepare(
      `INSERT INTO marketplace_listing
         (id, library_id, connection_id, listing_key, title, grain, sku_id, link_state, linked_at, linked_by, updated_at)
       VALUES (?,?,'conn-x','sku-1','SKU-0001','option','sku-1','linked',?,'user',?)`,
    )
    .run(listingIdFor("conn-x", "sku-1"), LIB, NOW, NOW)
  await db
    .prepare(
      `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes, container_format,
                          mapping_version, started_at, committed_at, status, row_count)
       VALUES ('b-1',?,'conn-x','주문.xlsx',0,'xlsx',?,?,?,'committed',1)`,
    )
    .run(LIB, MV, NOW, NOW)
}

/** 주문 한 건 + 품목 한 줄. **할인을 실어서** 넣는다. */
async function addOrder(db: Db, id: string, amount: number, discount: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fact_order (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                               source_key, ordered_at, status, total_amount)
       VALUES (?,'conn-x','b-1',?,?,?,?,'2026-07-10','PAID',?)`,
    )
    .run(id, LIB, NOW, MV, id, amount)
  await db
    .prepare(
      `INSERT INTO fact_order_item (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                                    source_key, order_id, listing_id, quantity, gross_amount, discount_amount)
       VALUES (?,'conn-x','b-1',?,?,?,?,?,?,1,?,?)`,
    )
    .run(`${id}-i`, LIB, NOW, MV, `${id}-i`, id, listingIdFor("conn-x", "sku-1"), amount, discount)
}

async function open(): Promise<Db> {
  const db = openNodeDriver(":memory:")
  await seed(db)
  return db
}

describe("할인 — 등록부·손익·두 화면", () => {
  it("★ 등록부에 `discount_amount`가 있다 — 없으면 매핑 자체가 불가능하다 ★", () => {
    const t = TARGETS.find((x) => x.name === "discount_amount")
    expect(t, "`validateProfiles`가 미등록 target을 거부한다 — 없으면 아무 프로파일도 못 담는다")
      .toBeDefined()
    expect(t?.kinds).toContain("number")
    expect(t?.tables).toContain("fact_order_item")
  })

  it("★★ 전사 손익이 할인을 뺀다 ★★", async () => {
    const db = await open()
    try {
      await addOrder(db, "o-1", 10_000, 1_500)
      await addOrder(db, "o-2", 20_000, 500)
      const snap = await loadPnlSnapshot(db, LIB, PERIOD)

      expect(snap.pnl.discount, "할인 2,000원이 손익에 안 들어왔다").toBe(2_000)
      // 기여이익 = 매출 − 할인 − … . 다른 항이 전부 0이므로 정확히 이 차다.
      expect(snap.pnl.productContribution).toBe(30_000 - 2_000)
    } finally {
      await db.close()
    }
  })

  /**
   * ★ 이 줄이 이 파일의 존재 이유다 ★
   * 두 조회가 **같은 컬럼을 같은 조각으로** 읽는지 본다. 갈라지면 사용자는
   * 어느 화면을 믿어야 할지 알 수 없고, 「상품별 합 ≠ 회사 순이익」이라는
   * 정상 설명이 그 어긋남을 덮는다.
   */
  it("★★ 상품별 할인의 합 = 전사 할인 ★★", async () => {
    const db = await open()
    try {
      await addOrder(db, "o-1", 10_000, 1_500)
      await addOrder(db, "o-2", 20_000, 500)
      const snap = await loadPnlSnapshot(db, LIB, PERIOD)
      const rows = await loadProfitRows(db, LIB, PERIOD)

      const sum = rows.reduce((a, r) => a + r.discount, 0)
      expect(sum, "상품별 표와 대시보드가 다른 할인을 말한다").toBe(snap.pnl.discount)
    } finally {
      await db.close()
    }
  })

  it("할인이 0이면 0이다 — 없는 것을 지어내지 않는다", async () => {
    const db = await open()
    try {
      await addOrder(db, "o-1", 10_000, 0)
      const snap = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(snap.pnl.discount).toBe(0)
      expect(snap.pnl.productContribution).toBe(10_000)
    } finally {
      await db.close()
    }
  })
})
