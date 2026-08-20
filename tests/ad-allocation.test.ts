/**
 * 광고비 배분 — **1층과 2층의 경계** (014 · ADR-022 · 감사 A-1-1).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 무엇이 틀려 있었나 ★
 *
 * `snapshot.ts`가 `adDirect: 0`을 **리터럴로** 넣었다. 게으름이 아니라
 * `fact_ad_spend`가 캠페인 단위 표라 「이 광고비가 어느 상품 것인가」를 담을 칸이
 * 없었기 때문이다. 그래서 광고비 전액이 2층(미배분)으로 갔고,
 * **「이 상품이 남는가」의 답이 통째로 틀렸다.**
 *
 * 3층(회사 순이익)은 합이라 맞다 — 총액만 보면 아무 이상이 없어 보인다.
 * 그게 이 결함이 오래 산 이유다. 그래서 이 시험은 **3층이 안 변한다**는 것까지 건다.
 *
 * ★ 「없음」과 「모름」을 가른다 (§22 · LOCK 6) ★
 * 미배분은 한 가지가 아니다 — 파일이 상품을 안 말했나(`noKey`), 그 옵션의 주문
 * 파일이 아직 없나(`noListing`), 리스팅은 있는데 SKU 연결이 안 됐나(`noLink`).
 * 셋을 따로 세지 않으면 화면이 «미배분 1,570만원»만 말하고 사용자는 **할 수 있는
 * 일이 무엇인지 모른다.**
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { listingIdFor, Repository } from "../src/core/store/repository.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import type { Period } from "../src/core/profit/index.js"

const LIB = "lib-1"
const NOW = "2026-07-01T00:00:00.000Z"
const PERIOD: Period = { from: "2026-07-01", to: "2026-07-31" }
const CONN = "conn-x"

type Db = ReturnType<typeof openNodeDriver>

async function seed(db: Db): Promise<void> {
  await migrate(db)
  const repo = new Repository(db)
  await repo.ensureLibrary(LIB, "기본", NOW)
  await repo.ensureConnection(
    { id: CONN, libraryId: LIB, packId: "p", marketplaceKey: "x", displayName: "테스트" },
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
      `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes, container_format,
                          mapping_version, started_at, committed_at, status, row_count)
       VALUES ('b-1',?,?,'광고.xlsx',0,'xlsx','x/ad@1',?,?,'committed',1)`,
    )
    .run(LIB, CONN, NOW, NOW)
}

/** 리스팅 한 줄. `skuId`가 null이면 **연결 안 된** 리스팅이다. */
async function addListing(db: Db, key: string, skuId: string | null): Promise<void> {
  await db
    .prepare(
      `INSERT INTO marketplace_listing
         (id, library_id, connection_id, listing_key, title, grain, sku_id, link_state, linked_at, linked_by, updated_at)
       VALUES (?,?,?,?,?,'option',?,?,?,'user',?)`,
    )
    .run(
      listingIdFor(CONN, key), LIB, CONN, key, key, skuId,
      skuId === null ? "unlinked" : "linked", NOW, NOW,
    )
}

/** 광고 한 줄. `listingKey`가 null이면 파일이 상품을 안 말한 것이다. */
async function addAd(db: Db, id: string, spend: number, listingKey: string | null): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fact_ad_spend (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                                  source_key, campaign_key, spent_on, spend_amount, listing_key)
       VALUES (?,?, 'b-1', ?,?,'x/ad@1',?,?, '2026-07-10', ?, ?)`,
    )
    .run(id, CONN, LIB, NOW, id, `cmp-${id}`, spend, listingKey)
}

async function open(): Promise<Db> {
  const db = openNodeDriver(":memory:")
  await seed(db)
  return db
}

describe("광고비 배분 — 1층과 2층", () => {
  it("★★ 연결된 리스팅을 가리키는 광고비는 **직접 광고비**다 ★★", async () => {
    const db = await open()
    try {
      await addListing(db, "OPT-1", "sku-1")
      await addAd(db, "a-1", 10_000, "OPT-1")
      const { pnl } = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(pnl.adDirect, "리터럴 0으로 되돌아갔다").toBe(10_000)
      expect(pnl.adUnallocated).toBe(0)
    } finally {
      await db.close()
    }
  })

  it("★ 미배분 세 갈래를 **따로 센다** — 사용자가 할 일이 다르다 ★", async () => {
    const db = await open()
    try {
      await addListing(db, "OPT-LINKED", "sku-1")
      await addListing(db, "OPT-TODO", null) // 리스팅은 있는데 SKU 미연결(unlinked)
      await addAd(db, "a-1", 10_000, "OPT-LINKED") // 직접
      await addAd(db, "a-2", 2_000, null) // 파일이 상품을 안 말했다
      await addAd(db, "a-3", 3_000, "OPT-없음") // 그 옵션의 주문 파일이 아직 없다
      await addAd(db, "a-4", 5_000, "OPT-TODO") // 연결하면 붙는다

      const { pnl, adSplit } = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(pnl.adDirect).toBe(10_000)
      expect(pnl.adUnallocated).toBe(10_000)
      expect(adSplit.noKey, "파일이 상품을 안 말한 몫").toBe(2_000)
      expect(adSplit.noListing, "주문 파일이 아직 없는 몫").toBe(3_000)
      expect(adSplit.noLink, "연결만 하면 붙는 몫").toBe(5_000)

      /**
       * ★ 세 갈래는 미배분을 **빠짐없이 덮는다** ★
       * 하나라도 새면 화면이 «미배분 1,000만원인데 이유는 700만원어치만 있다»가
       * 되고, 사용자는 나머지 300만원을 영영 못 쫓는다.
       */
      expect(
        adSplit.noKey + adSplit.noListing + adSplit.noLink,
        "미배분의 이유가 미배분 총액을 못 덮는다 — 설명되지 않는 광고비가 생겼다",
      ).toBe(adSplit.unallocated)
    } finally {
      await db.close()
    }
  })

  /**
   * ★ 총액은 **한 푼도 안 변한다** ★
   * 배분은 «어느 층에 놓나»의 문제이지 «얼마인가»의 문제가 아니다. 이 줄이 깨지면
   * 배분이 광고비를 만들거나 없앤 것이다 — 회계가 아니라 사고다.
   */
  it("★★ 직접 + 미배분 = 총 광고비 · 회사 순이익은 안 변한다 ★★", async () => {
    const db = await open()
    try {
      await addListing(db, "OPT-1", "sku-1")
      await addAd(db, "a-1", 10_000, "OPT-1")
      await addAd(db, "a-2", 7_000, null)
      const { pnl, adSplit } = await loadPnlSnapshot(db, LIB, PERIOD)

      expect(pnl.adDirect + pnl.adUnallocated, "배분이 광고비를 만들거나 없앴다").toBe(17_000)
      expect(adSplit.direct + adSplit.unallocated).toBe(17_000)
      // 3층은 합이라 배분과 무관하다 — 매출 0이므로 정확히 −17,000
      expect(pnl.netProfit).toBe(-17_000)
      // 1층은 직접 광고비만 진다
      expect(pnl.productContribution).toBe(-10_000)
      // 2층에서 미배분이 빠진다
      expect(pnl.channelContribution).toBe(-17_000)
    } finally {
      await db.close()
    }
  })

  it("listing_key가 하나도 없으면 예전과 같다 — 전액 미배분", async () => {
    const db = await open()
    try {
      await addAd(db, "a-1", 9_000, null)
      const { pnl } = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(pnl.adDirect).toBe(0)
      expect(pnl.adUnallocated).toBe(9_000)
    } finally {
      await db.close()
    }
  })
})
