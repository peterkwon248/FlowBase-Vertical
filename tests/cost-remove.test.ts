/**
 * 원가를 **지우는 경로** — 잘못 들어간 한 줄을 되돌린다 (`Repository.removeCost`).
 *
 * ★ 왜 필요했나 ★
 * 실기기에 시험 삼아 넣은 원가(SKU-0001·0002 · 1,234원 · 8/16부터)가 남아 **8월
 * 손익이 틀린 값을 그리고 있다.** 7월은 멀쩡하다 — `costAt`이 적용일 이전만 보므로
 * 그 행은 8/16부터의 판매에만 붙는다. 그런데 앱에는 지울 길이 없다: 넣기(`addCost`)와
 * 같은 날짜 정정(`replace`)뿐이다.
 *
 * ★ 이 파일이 지키는 성질 ★
 * ```
 * ① 자연키로만 연다        id는 AUTOINCREMENT라 기기마다 다르다 — 엉뚱한 행을 지운다
 * ② 지운 것을 돌려준다      row_shadow가 없으므로 복구 재료는 반환값이 전부다
 * ③ 지운 뒤가 보인다        남는 이력이 없으면 «0원»이 아니라 «미상»이다
 * ④ 손익이 실제로 움직인다   ← 사용자가 겪는 사실. 나머지 셋은 이걸 위한 것이다
 * ```
 */

import { describe, expect, it } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { listingIdFor, Repository } from "../src/core/store/repository.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { pnlGaps } from "../src/core/profit/gaps.js"

const LIB = "lib-1"
const NOW = "2026-08-20T00:00:00"
const AUG = { from: "2026-08-01", to: "2026-08-31" }
const JUL = { from: "2026-07-01", to: "2026-07-31" }

/** 실기기와 같은 모양 — SKU 둘, 리스팅으로 이어진 품목. */
async function seed(db: ReturnType<typeof openNodeDriver>): Promise<void> {
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
  for (const [id, code] of [["sku-1", "SKU-0001"], ["sku-2", "SKU-0002"]] as const) {
    await db
      .prepare(
        `INSERT INTO sku (id, library_id, product_id, code, name, status, created_at, updated_at)
         VALUES (?,?,?,?,?,'ACTIVE',?,?)`,
      )
      .run(id, LIB, "prd-1", code, code, NOW, NOW)
    await db
      .prepare(
        `INSERT INTO marketplace_listing
           (id, library_id, connection_id, listing_key, title, grain, sku_id, link_state, linked_at, linked_by, updated_at)
         VALUES (?,?,'conn-x',?,?,'option',?, 'linked', ?, 'user', ?)`,
      )
      .run(listingIdFor("conn-x", id), LIB, id, code, id, NOW, NOW)
  }
  await db
    .prepare(
      `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes, container_format,
                          mapping_version, started_at, committed_at, status, row_count)
       VALUES ('b1',?,'conn-x','손으로 세운 것',0,'xlsx','x/order/line@1',?,?,'committed',1)`,
    )
    .run(LIB, NOW, NOW)
}

async function addOrderItem(
  db: ReturnType<typeof openNodeDriver>,
  o: { id: string; on: string; amount: number; sku: string; qty: number },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fact_order (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                               source_key, ordered_at, status, total_amount, date_precision, period_end)
       VALUES (?,'conn-x','b1',?,?,'x/order/line@1',?,?,'PAID',?,NULL,NULL)`,
    )
    .run(o.id, LIB, NOW, o.id, o.on, o.amount)
  await db
    .prepare(
      `INSERT INTO fact_order_item (id, connection_id, batch_id, library_id, updated_at,
                                    mapping_version, source_key, order_id, listing_id, quantity, gross_amount)
       VALUES (?,'conn-x','b1',?,?,'x/order/line@1',?,?,?,?,?)`,
    )
    .run(`${o.id}-i`, LIB, NOW, `${o.id}-i`, o.id, listingIdFor("conn-x", o.sku), o.qty, o.amount)
}

const add = (repo: Repository, skuId: string, amount: number, from: string, kind = "COGS") =>
  repo.addCost({ libraryId: LIB, skuId, kind, amount, effectiveFrom: from, now: NOW })

describe("removeCost — 자연키로만 연다", () => {
  it("★ 그 (SKU·종류·적용일) 한 줄만 지운다 — 이웃은 그대로다 ★", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      await add(repo, "sku-1", 12_000, "2026-07-01")
      await add(repo, "sku-1", 1_234, "2026-08-16")
      await add(repo, "sku-1", 500, "2026-08-16", "PACKAGING") // 같은 날짜, 다른 종류
      await add(repo, "sku-2", 1_234, "2026-08-16") // 같은 날짜·금액, 다른 SKU

      const r = await repo.removeCost({
        libraryId: LIB, skuId: "sku-1", kind: "COGS", effectiveFrom: "2026-08-16",
      })

      expect(r.removed, "지운 행을 돌려줘야 복구 재료가 남는다").not.toBeNull()
      expect(Number(r.removed?.["amount"])).toBe(1_234)
      expect(String(r.removed?.["entered_by"])).toBe("user")

      const left = await repo.costHistory(LIB)
      expect(left.length, "셋만 남는다").toBe(3)
      expect(
        left.some((x) => x["sku_id"] === "sku-1" && x["kind"] === "COGS" && x["amount"] === 12_000),
        "7월 원가는 그대로",
      ).toBe(true)
      expect(
        left.some((x) => x["kind"] === "PACKAGING"),
        "같은 날짜라도 종류가 다르면 남는다",
      ).toBe(true)
      expect(
        left.some((x) => x["sku_id"] === "sku-2"),
        "같은 날짜·같은 금액이라도 다른 SKU는 남는다",
      ).toBe(true)
    } finally {
      await db.close()
    }
  })

  it("없는 줄을 지우라고 하면 조용히 «했다»고 하지 않는다 (LOCK 6)", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      const r = await repo.removeCost({
        libraryId: LIB, skuId: "sku-1", kind: "COGS", effectiveFrom: "2026-08-16",
      })
      expect(r.removed, "없으면 null — 부르는 쪽이 «없었다»를 말할 수 있다").toBeNull()
      expect(r.remaining).toEqual([])
    } finally {
      await db.close()
    }
  })
})

describe("removeCost — 지운 뒤가 보인다", () => {
  it("남는 이력이 있으면 **이전 원가로 되돌아간다**", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      await add(repo, "sku-1", 12_000, "2026-07-01")
      await add(repo, "sku-1", 1_234, "2026-08-16")

      const r = await repo.removeCost({
        libraryId: LIB, skuId: "sku-1", kind: "COGS", effectiveFrom: "2026-08-16",
      })
      expect(r.remaining.length).toBe(1)
      expect(Number(r.remaining[0]?.["amount"]), "가장 늦은 것이 먼저 온다").toBe(12_000)
    } finally {
      await db.close()
    }
  })

  it("★ 남는 이력이 없으면 «0원»이 아니라 «미상»이다 — 그 사실이 반환값에 있다 ★", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      await add(repo, "sku-2", 1_234, "2026-08-16") // 이것 하나뿐

      const r = await repo.removeCost({
        libraryId: LIB, skuId: "sku-2", kind: "COGS", effectiveFrom: "2026-08-16",
      })
      // 빈 배열이 «0원»으로 읽히면 손익이 조용히 부풀어 오른다 — 부르는 쪽이
      // «미상»을 말할 수 있게 «남은 것이 없다»를 명시적으로 준다
      expect(r.remaining).toEqual([])
    } finally {
      await db.close()
    }
  })

  it("⚠ 다리 사전에 걸려 있으면 알려준다 — 지운 것이 되살아날 수 있다 (ADR-016)", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      await add(repo, "sku-1", 1_234, "2026-08-16")
      await db
        .prepare(
          `INSERT INTO pending_cost
             (library_id, source_key, kind, title, model_code, amount, effective_from,
              source_hash, source_name, profile_version, state, resolved_sku_id, resolved_at,
              first_seen_at, last_seen_at)
           VALUES (?,?,'COGS','시험 품명',NULL,1234,'2026-08-16','h','단가표.xlsx','v1',
                   'resolved','sku-1',?,?,?)`,
        )
        .run(LIB, "sk-1", NOW, NOW, NOW)

      const r = await repo.removeCost({
        libraryId: LIB, skuId: "sku-1", kind: "COGS", effectiveFrom: "2026-08-16",
      })
      expect(r.bridge.length, "resolved 행은 지우지 않는다 — 대신 말한다").toBe(1)
      expect(String(r.bridge[0]?.["title"])).toBe("시험 품명")

      const still = await db.prepare(`SELECT COUNT(*) AS n FROM pending_cost`).get()
      expect(Number(still?.["n"]), "다리 사전을 건드리지 않았다").toBe(1)
    } finally {
      await db.close()
    }
  })
})

describe("★★ 손익이 실제로 움직인다 — 사용자가 겪는 사실 ★★", () => {
  it("시험용 원가를 지우면 8월이 제 값으로 돌아오고 7월은 애초에 안 움직인다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      // 실기기와 같은 모양: 진짜 원가 + 8/16부터의 시험값
      await add(repo, "sku-1", 12_000, "2026-07-01")
      await add(repo, "sku-1", 1_234, "2026-08-16")
      await add(repo, "sku-2", 1_234, "2026-08-16")

      await addOrderItem(db, { id: "j1", on: "2026-07-05", amount: 30_000, sku: "sku-1", qty: 1 })
      await addOrderItem(db, { id: "a1", on: "2026-08-20", amount: 30_000, sku: "sku-1", qty: 1 })
      await addOrderItem(db, { id: "a2", on: "2026-08-20", amount: 9_000, sku: "sku-2", qty: 2 })

      const julBefore = await loadPnlSnapshot(db, LIB, JUL)
      const augBefore = await loadPnlSnapshot(db, LIB, AUG)
      expect(julBefore.pnl.cogs, "7월은 8/16 원가를 안 본다").toBe(12_000)
      expect(augBefore.pnl.cogs, "8월만 시험값을 쓴다 — 1,234 + 1,234×2").toBe(3_702)

      for (const skuId of ["sku-1", "sku-2"]) {
        await repo.removeCost({ libraryId: LIB, skuId, kind: "COGS", effectiveFrom: "2026-08-16" })
      }

      const julAfter = await loadPnlSnapshot(db, LIB, JUL)
      const augAfter = await loadPnlSnapshot(db, LIB, AUG)

      expect(julAfter.pnl.cogs, "7월은 애초에 안 틀렸으므로 안 바뀐다").toBe(julBefore.pnl.cogs)
      expect(augAfter.pnl.cogs, "sku-1은 7월 원가로 되돌아가고 sku-2는 미상이 된다").toBe(12_000)

      // sku-2가 «0원»으로 세어지면 안 된다 — 빠지고, **빠졌다고 말해야** 한다
      expect(augAfter.cogsBasis.itemsWithoutCost).toBe(1)
      expect(augAfter.cogsBasis.qtyWithoutCost).toBe(2)
      const gap = pnlGaps(augAfter).find((g) => g.id === "cogs-missing")
      expect(gap?.state, "지운 자리가 «없는 것»으로 표면에 뜬다 (§22)").toBe("일부 미입력")
    } finally {
      await db.close()
    }
  })
})
