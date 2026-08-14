/**
 * 품목 적재 (`fact_order_item`) — **실파일로 조건 넷을 지킨다.**
 *
 * ```
 * ① 키·grain      부모 주문 source_key + 리스팅 키 · 재가져오기에 안정적
 * ② 기간 근사      option-period의 원가는 기간 시작일 기준 (→ tests/cost.test.ts)
 * ③ 클레임 정합    fact_claim으로 간 행은 품목을 만들지 않는다
 * ④ 완료 기준      원가 1건 → 순이익이 정확히 수량×원가만큼 감소
 * ```
 *
 * ①과 ③은 **실파일이 아니면 증명되지 않는다.** 합성 데이터로는 «클레임이 섞인
 * 파일»도 «같은 주문에 옵션 둘»도 만들어 낼 수 없고, 그 둘이 정확히 이 작업이
 * 틀릴 수 있는 자리다.
 */

import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { DELETE_ORDER, FACT_TABLES, Repository } from "../src/core/store/repository.js"
import { runImport } from "../src/core/import/run.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { pnlGaps } from "../src/core/profit/gaps.js"
import { KEY_SEP } from "../src/core/import/mapping/listing.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import type { Driver } from "../src/core/store/driver.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const LIB = "lib-1"
const NOW = "2026-08-14T00:00:00"
const PERIOD = { from: "2026-07-01", to: "2026-07-31" }
const PROFILE_DIR = "src/packs/kr-marketplace/profiles"

const CASES = [
  { fixture: 8, profile: "esm-order@1.json", conn: "conn-esm", orders: 146, items: 146, claims: 9 },
  { fixture: 14, profile: "coupang-order@1.json", conn: "conn-coupang", orders: 141, items: 141, claims: 0 },
  { fixture: 15, profile: "coupang-jet@1.json", conn: "conn-coupang", orders: 147, items: 147, claims: 0 },
] as const

const ready = CASES.every((c) => {
  const f = FIXTURES.find((x) => x.id === c.fixture)
  return f !== undefined && existsSync(fixturePath(f, CLEAN_DIR))
})
const run = ready ? describe : describe.skip
if (!ready) console.warn("[order-item] fixtures/clean이 없어 건너뛴다")

function load(c: (typeof CASES)[number]) {
  const f = FIXTURES.find((x) => x.id === c.fixture)!
  const profile = JSON.parse(readFileSync(`${PROFILE_DIR}/${c.profile}`, "utf-8")) as MappingProfile
  return { bytes: new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR))), fileName: f.file, profile }
}

async function fresh(): Promise<{ db: Driver; repo: Repository }> {
  const db = openNodeDriver(":memory:")
  await migrate(db)
  const repo = new Repository(db)
  await repo.ensureLibrary(LIB, "기본", NOW)
  return { db, repo }
}

async function importOnce(
  repo: Repository,
  c: (typeof CASES)[number],
  batchId: string,
): Promise<ReturnType<typeof runImport>> {
  const { bytes, fileName, profile } = load(c)
  await repo.ensureConnection(
    {
      id: c.conn,
      libraryId: LIB,
      packId: profile.packId,
      marketplaceKey: profile.marketplaceKey,
      displayName: profile.displayName,
    },
    NOW,
  )
  return runImport(repo, {
    bytes, fileName, profile, sheetIndex: 0,
    libraryId: LIB, connectionId: c.conn, batchId, now: NOW,
  })
}

const one = async (db: Driver, sql: string, ...args: unknown[]): Promise<number> =>
  Number((await db.prepare(sql).get(...(args as never[])))?.["n"] ?? 0)

run("① 키 — 품목은 «부모 주문 + 리스팅»이다", () => {
  for (const c of CASES) {
    it(`${c.profile} — 품목 ${c.items}행 · source_key 유일`, async () => {
      const { db, repo } = await fresh()
      try {
        const r = await importOnce(repo, c, "b1")
        expect(r.perTable.get("fact_order_item")).toBe(c.items)

        expect(await one(db, `SELECT COUNT(*) AS n FROM fact_order_item`)).toBe(c.items)
        expect(
          await one(db, `SELECT COUNT(DISTINCT source_key) AS n FROM fact_order_item`),
          "품목 키가 겹치면 UPSERT가 서로 다른 판매를 합친다",
        ).toBe(c.items)

        // 모든 품목이 실재하는 부모와 실재하는 리스팅을 가리킨다 (FK만으로는
        // NULL을 못 잡는다 — listing_id는 nullable이다)
        expect(
          await one(
            db,
            `SELECT COUNT(*) AS n FROM fact_order_item i
              WHERE NOT EXISTS (SELECT 1 FROM fact_order o WHERE o.id = i.order_id)`,
          ),
          "부모 없는 품목",
        ).toBe(0)
        expect(
          await one(
            db,
            `SELECT COUNT(*) AS n FROM fact_order_item i
              WHERE i.listing_id IS NULL
                 OR NOT EXISTS (SELECT 1 FROM marketplace_listing l WHERE l.id = i.listing_id)`,
          ),
          "리스팅 없는 품목 — 원가에 닿을 길이 없다",
        ).toBe(0)

        // 키의 **모양**도 못박는다: 부모 키로 시작하고 구분자가 하나 더 붙는다
        const row = await db
          .prepare(
            `SELECT i.source_key AS ik, o.source_key AS ok FROM fact_order_item i
               JOIN fact_order o ON o.id = i.order_id LIMIT 1`,
          )
          .get()
        expect(String(row!["ik"]).startsWith(`${String(row!["ok"])}${KEY_SEP}`)).toBe(true)
      } finally {
        await db.close()
      }
    })
  }

  /**
   * ★ 조건 1의 본체 — 재가져오기에서 정체성이 흔들리지 않는가 ★
   *
   * 같은 파일을 두 번 넣으면 품목은 **늘지 않고 갱신된다.** 여기가 흔들리면
   * 매달 같은 파일을 다시 넣을 때마다 품목이 배로 쌓이고 매입원가가 배가 된다.
   *
   * 그리고 `id`가 보존되는지도 본다 — 조정(`adjustment`)이 행을 가리키는 근거이고,
   * 품목이 부모를 가리키는 방식(저장된 id 조회)의 전제이기도 하다.
   */
  for (const c of CASES) {
    it(`${c.profile} — 두 번 넣어도 품목이 늘지 않는다 (UPSERT 정체성)`, async () => {
      const { db, repo } = await fresh()
      try {
        await importOnce(repo, c, "b1")
        const firstIds = await db
          .prepare(`SELECT id, source_key, order_id, quantity FROM fact_order_item ORDER BY source_key`)
          .all()

        await importOnce(repo, c, "b2")
        const secondIds = await db
          .prepare(`SELECT id, source_key, order_id, quantity FROM fact_order_item ORDER BY source_key`)
          .all()

        expect(secondIds.length, "행 수가 늘면 키가 갈린 것이다").toBe(c.items)
        expect(secondIds.map((r) => r["id"]), "id가 바뀌면 조정이 가리키던 행이 사라진다")
          .toEqual(firstIds.map((r) => r["id"]))
        expect(secondIds.map((r) => r["source_key"])).toEqual(firstIds.map((r) => r["source_key"]))
        expect(secondIds.map((r) => r["order_id"]), "부모 링크가 새 배치의 id로 끊기면 안 된다")
          .toEqual(firstIds.map((r) => r["order_id"]))
        expect(secondIds.map((r) => r["quantity"])).toEqual(firstIds.map((r) => r["quantity"]))

        // 갱신이지 삽입이 아니다 — version이 올랐다
        expect(
          await one(db, `SELECT COUNT(*) AS n FROM fact_order_item WHERE version = 2`),
        ).toBe(c.items)
      } finally {
        await db.close()
      }
    })
  }

  /**
   * ★ «적재 N행»이 파일 행 수와 대조 가능해야 한다 (적대적 검토가 잡은 자리) ★
   *
   * 품목도 `row_count`에 더하면 160행 파일이 「301행 적재」가 되고, 사용자가 파일과
   * 맞춰보는 산식(적재 + 제외 = 파일 행)이 헤드라인에서 깨진다. 품목은 파일의 새
   * 행이 아니라 **같은 행의 두 번째 표현**이다.
   */
  for (const c of CASES) {
    it(`${c.profile} — batch.row_count가 품목만큼 부풀지 않는다`, async () => {
      const { db, repo } = await fresh()
      try {
        await importOnce(repo, c, "b1")
        const digest = (await repo.batchDigest("b1"))!
        const fileRows = c.orders + c.claims
        expect(
          digest.rowCount,
          `품목을 더하면 ${fileRows + c.items}이 된다 — 파일과 대조가 안 된다`,
        ).toBe(fileRows)
        // 그래도 품목은 DB에 있다 — 세는 자리를 가른 것이지 안 넣은 게 아니다
        expect(await one(db, `SELECT COUNT(*) AS n FROM fact_order_item`)).toBe(c.items)
      } finally {
        await db.close()
      }
    })
  }
})

describe("삭제 순서 — 목록이 둘이라는 사실 자체를 지킨다", () => {
  it("DELETE_ORDER는 FACT_TABLES와 **같은 집합**이다 — 테이블을 더하고 한쪽만 고치면 잡힌다", () => {
    expect([...DELETE_ORDER].sort()).toEqual([...FACT_TABLES].sort())
  })

  it("자식이 부모보다 앞에 있다", () => {
    // 오늘 아는 FK는 하나다: fact_order_item.order_id → fact_order.id.
    // 새 부모-자식이 생기면 여기 한 줄을 더한다.
    const at = (t: string): number => DELETE_ORDER.indexOf(t as never)
    expect(at("fact_order_item"), "품목이 주문보다 먼저 지워져야 한다").toBeLessThan(at("fact_order"))
  })
})

run("③ 클레임 정합 — 취소된 판매의 원가도 빠진다", () => {
  it("ESM: fact_claim으로 간 9건은 품목을 만들지 않는다", async () => {
    const c = CASES[0]!
    const { db, repo } = await fresh()
    try {
      const r = await importOnce(repo, c, "b1")
      expect(r.perTable.get("fact_claim")).toBe(c.claims)
      expect(
        r.perTable.get("fact_order_item"),
        "품목이 155(=146+9)면 취소된 물건의 매입원가가 손익에 들어간다",
      ).toBe(c.orders)

      // 품목의 부모는 **전부** fact_order다 — 클레임 source_key를 가리키는 것이 없다
      const claimKeys = (await db.prepare(`SELECT source_key FROM fact_claim`).all()).map((x) =>
        String(x["source_key"]),
      )
      const itemParents = new Set(
        (
          await db
            .prepare(
              `SELECT o.source_key AS k FROM fact_order_item i JOIN fact_order o ON o.id = i.order_id`,
            )
            .all()
        ).map((x) => String(x["k"])),
      )
      expect(claimKeys.some((k) => itemParents.has(k)), "클레임 키가 품목의 부모로 나타났다").toBe(
        false,
      )
    } finally {
      await db.close()
    }
  })

  it("★ 되돌리기가 품목을 먼저 지운다 — FK가 막지 않는다 ★", async () => {
    // 품목이 생기기 전에는 드러날 수 없던 버그다. `FACT_TABLES` 순서대로 지우면
    // 부모(fact_order)가 먼저 사라져 `FOREIGN KEY constraint failed`가 난다.
    const c = CASES[0]!
    const { db, repo } = await fresh()
    try {
      await importOnce(repo, c, "b1")
      expect(await one(db, `SELECT COUNT(*) AS n FROM fact_order_item`)).toBe(c.items)

      await repo.undoBatch("b1", NOW)

      expect(await one(db, `SELECT COUNT(*) AS n FROM fact_order_item`)).toBe(0)
      expect(await one(db, `SELECT COUNT(*) AS n FROM fact_order`)).toBe(0)
      // 리스팅은 batch에 묶이지 않는다 (ADR-012) — 되돌려도 남는다
      expect(
        await one(db, `SELECT COUNT(*) AS n FROM marketplace_listing`),
        "연결은 사람의 것이라 되돌리기가 건드리지 않는다",
      ).toBeGreaterThan(0)
    } finally {
      await db.close()
    }
  })
})

run("④ 완료 기준 — 원가 1건이 순이익을 정확히 «수량 × 원가»만큼 깎는다", () => {
  it("원 단위까지 같고, «적용 불가»가 스스로 사라진다", async () => {
    const c = CASES[0]! // ESM — 주문·클레임이 섞여 있어 가장 까다롭다
    const { db, repo } = await fresh()
    try {
      await importOnce(repo, c, "b1")

      // ── 원가 이전 ──
      const before = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(before.pnl.cogs).toBe(0)
      expect(before.cogsBasis.ordersWithoutItems, "모든 주문에 품목이 붙었다").toBe(0)
      // 이제 «적용 불가»는 성립하지 않는다 — 곱할 대상이 생겼다
      expect(pnlGaps(before).map((g) => g.id)).not.toContain("cogs-unappliable")

      // ── 리스팅 하나를 SKU로 만들고 원가를 넣는다 (사람이 하는 그 순서) ──
      const listing = (
        await db
          .prepare(
            `SELECT l.id, l.listing_key FROM marketplace_listing l
              JOIN fact_order_item i ON i.listing_id = l.id
              JOIN fact_order o ON o.id = i.order_id
             WHERE o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
             GROUP BY l.id ORDER BY SUM(i.quantity) DESC LIMIT 1`,
          )
          .get(PERIOD.from, PERIOD.to)
      )!
      const made = await repo.createSkuForListings(LIB, [String(listing["id"])], "시험 SKU", NOW)
      const skuId = made.skuId!

      // 그 SKU가 이 기간에 판 수량 — 정답지는 DB가 아니라 **품목 합**이 낸다
      const qty = await one(
        db,
        `SELECT COALESCE(SUM(i.quantity),0) AS n FROM fact_order_item i
           JOIN fact_order o ON o.id = i.order_id
           JOIN marketplace_listing l ON l.id = i.listing_id
          WHERE l.sku_id = ? AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')`,
        skuId, PERIOD.from, PERIOD.to,
      )
      expect(qty, "판 것이 있어야 시험이 성립한다").toBeGreaterThan(0)

      const UNIT = 3_300
      await repo.addCost({
        libraryId: LIB, skuId, kind: "COGS", amount: UNIT,
        effectiveFrom: PERIOD.from, now: NOW,
      })

      // ── 원가 이후 ──
      const after = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(after.pnl.cogs, "원 단위까지 수량 × 원가여야 한다").toBe(qty * UNIT)
      expect(
        after.pnl.netProfit,
        "순이익이 정확히 그만큼 줄어든다 — 다른 항목은 움직이지 않는다",
      ).toBe(before.pnl.netProfit - qty * UNIT)
      expect(after.pnl.revenue, "매출은 그대로다").toBe(before.pnl.revenue)

      // ★ 문구가 스스로 사라졌는가 ★
      const ids = pnlGaps(after).map((g) => g.id)
      expect(ids, "적용 불가").not.toContain("cogs-unappliable")
      expect(ids, "기간 근사 — ESM은 기간 집계가 아니다").not.toContain("cogs-period-approx")
      // 아직 연결 안 된 리스팅이 남아 있으므로 그쪽은 계속 말해야 한다
      expect(ids, "나머지 리스팅은 여전히 미연결이다").toContain("cogs-unlinked")
    } finally {
      await db.close()
    }
  })
})
