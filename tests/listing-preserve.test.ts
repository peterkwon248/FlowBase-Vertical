/**
 * ADR-012 — 마켓 리스팅의 보존 규칙.
 *
 * ★ 사람의 결정은 파일의 재도착보다 오래 산다 ★
 * `marketplace_listing`은 한 행에 두 주인이 있다 — `title`·`grain`은 마켓이,
 * `sku_id`·`link_state`는 사람이 소유한다. Fact처럼 통째로 UPSERT하면 사용자가
 * 맺은 연결이 **조용히 증발한다.**
 *
 * 이 파일은 그 보존이 실제로 지켜지는지를 세 방향에서 본다:
 *   재가져오기 · 되돌리기 · 파일에서의 부재
 */

import { describe, it, expect, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository, type BatchOpen, type ListingUpsert } from "../src/core/store/repository.js"

const LIB = "lib-1"
const CONN = "conn-1"

async function seed(db: Driver): Promise<void> {
  await migrate(db)
  await db.prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`).run(LIB, "기본", "t0")
  await db
    .prepare(
      `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(CONN, LIB, "kr-marketplace", "mk-a", "연결 1", "CONNECTED", "t0", "t0")
}

function batch(id: string, at: string): BatchOpen {
  return {
    id,
    libraryId: LIB,
    connectionId: CONN,
    sourceName: `${id}.xlsx`,
    sourceBytes: 100,
    containerFormat: "xlsx",
    mappingVersion: "mk-a/order/order@1",
    startedAt: at,
  }
}

const L = (key: string, title: string, grain: "product" | "option" = "product"): ListingUpsert => ({
  listingKey: key,
  title,
  grain,
})

describe("리스팅 보존 (ADR-012)", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver(":memory:")
    await seed(db)
    repo = new Repository(db)
  })

  async function row(key: string): Promise<Record<string, unknown> | undefined> {
    return db
      .prepare(`SELECT * FROM marketplace_listing WHERE connection_id = ? AND listing_key = ?`)
      .get(CONN, key)
  }

  /** 사람이 연결 화면에서 SKU를 맺은 상태를 만든다. */
  async function link(key: string, skuId: string): Promise<void> {
    await db.prepare(`INSERT INTO product (id, library_id, name, created_at, updated_at) VALUES (?,?,?,?,?)`)
      .run("p-1", LIB, "상품", "t0", "t0")
      .catch(() => {})
    await db
      .prepare(
        `INSERT OR IGNORE INTO sku (id, library_id, product_id, code, name, status, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(skuId, LIB, "p-1", skuId, "SKU", "ACTIVE", "t0", "t0")
    await db
      .prepare(
        `UPDATE marketplace_listing
            SET sku_id = ?, link_state = 'linked', linked_by = 'user', linked_at = 't1'
          WHERE connection_id = ? AND listing_key = ?`,
      )
      .run(skuId, CONN, key)
  }

  it("첫 적재는 unlinked로 들어온다 — 연결은 사람이 정한다", async () => {
    const s = await repo.upsertListings(LIB, CONN, [L("A", "가"), L("B", "나")], "t1")
    expect(s.inserted).toBe(2)
    const a = await row("A")
    expect(a?.["link_state"]).toBe("unlinked")
    expect(a?.["sku_id"]).toBeNull()
    expect(a?.["grain"]).toBe("product")
  })

  /** ★ 이 테스트가 ADR-012의 본체다 ★ */
  it("재가져오기는 title만 갱신하고 연결은 보존한다", async () => {
    await repo.upsertListings(LIB, CONN, [L("A", "옛 이름")], "t1")
    await link("A", "sku-1")

    // 같은 파일이 다시 온다 — 마켓이 이름을 바꿨다
    const s = await repo.upsertListings(LIB, CONN, [L("A", "새 이름")], "t2")
    expect(s.updated, "새 행이 아니라 갱신이다").toBe(1)
    expect(s.inserted).toBe(0)

    const a = await row("A")
    expect(a?.["title"], "마켓이 소유한 값은 갱신된다").toBe("새 이름")
    expect(a?.["updated_at"]).toBe("t2")
    // ── 사람이 소유한 값 — 하나도 건드려지지 않아야 한다 ──
    expect(a?.["sku_id"], "연결이 증발했다").toBe("sku-1")
    expect(a?.["link_state"]).toBe("linked")
    expect(a?.["linked_by"]).toBe("user")
    expect(a?.["linked_at"]).toBe("t1")
  })

  it("여러 번 다시 와도 같다 — 멱등이다", async () => {
    await repo.upsertListings(LIB, CONN, [L("A", "가")], "t1")
    await link("A", "sku-1")
    for (const t of ["t2", "t3", "t4"]) {
      await repo.upsertListings(LIB, CONN, [L("A", "가")], t)
    }
    const n = await db
      .prepare(`SELECT COUNT(*) AS n FROM marketplace_listing WHERE connection_id = ?`)
      .get(CONN)
    expect(Number(n?.["n"]), "행이 늘어나면 자연키 id가 깨진 것이다").toBe(1)
    expect((await row("A"))?.["sku_id"]).toBe("sku-1")
  })

  /** ★ 부재는 삭제 신호가 아니다 (ADR-012 결정 3) ★ */
  it("파일이 안 싣고 와도 리스팅과 연결이 남는다", async () => {
    await repo.upsertListings(LIB, CONN, [L("A", "가"), L("B", "나")], "t1")
    await link("A", "sku-1")

    // 다음 달 파일에는 A가 없다 (단종·품절·기간 필터 — 이유는 여럿이고
    // 그중 "연결을 끊어라"는 하나도 없다)
    await repo.upsertListings(LIB, CONN, [L("B", "나")], "t2")

    const a = await row("A")
    expect(a, "부재를 삭제로 읽었다").toBeTruthy()
    expect(a?.["sku_id"], "연결까지 사라졌다").toBe("sku-1")
  })

  /** ★ 되돌리기는 Fact의 장치다 — 리스팅은 대상이 아니다 ★ */
  it("배치를 되돌려도 리스팅은 불가침이다", async () => {
    const b = batch("batch-1", "t1")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [
      { id: "o-1", source_key: "k1", ordered_at: "2026-07-01", status: "OK", total_amount: 1000 },
    ])
    await repo.upsertListings(LIB, CONN, [L("A", "가")], "t1")
    await link("A", "sku-1")

    await repo.undoBatch("batch-1", "t2")

    const orders = await db.prepare(`SELECT COUNT(*) AS n FROM fact_order`).get()
    expect(Number(orders?.["n"]), "Fact는 되돌아가야 한다").toBe(0)

    const a = await row("A")
    expect(a, "리스팅이 되돌리기에 쓸려갔다").toBeTruthy()
    expect(a?.["sku_id"], "연결이 되돌리기에 쓸려갔다").toBe("sku-1")
  })

  it("옵션 단위 리스팅은 grain으로 자기를 선언한다", async () => {
    await repo.upsertListings(
      LIB,
      CONN,
      [L("P1블랙", "티셔츠 · 블랙", "option"), L("P1화이트", "티셔츠 · 화이트", "option")],
      "t1",
    )
    const rows = await db
      .prepare(`SELECT listing_key, grain FROM marketplace_listing WHERE connection_id = ? ORDER BY listing_key`)
      .all(CONN)
    expect(rows.length, "같은 상품의 옵션은 각자 한 행이다").toBe(2)
    for (const r of rows) expect(r["grain"]).toBe("option")
  })
})
