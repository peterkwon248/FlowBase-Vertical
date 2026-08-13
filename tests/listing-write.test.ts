/**
 * 연결 쓰기 — **이 앱의 첫 사용자 쓰기다** (§21-6 완료 기준 b).
 *
 * 지금까지의 쓰기는 전부 가져오기(파일 → Fact)였다. 여기서 처음으로 **사람이 누른
 * 것이 DB에 남는다.** 그래서 확인할 것이 두 겹이다:
 *
 *   ① 값이 제대로 쓰이는가        sku 생성 · 4필드 기록 · 상태 이동
 *   ② 사람만 쓸 수 있는가         자동 확정이 구조적으로 불가능한가
 *
 * ②가 이 파일의 무게중심이다. 유사도 점수는 이 함수들의 **인자에 없다** —
 * 제안이 아무리 확신해도 스스로 연결할 방법이 없다는 뜻이다.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository, type BatchOpen, type ListingUpsert } from "../src/core/store/repository.js"

const LIB = "lib-1"
const CONN = "conn-1"
const NOW = "2026-08-13T10:00:00"

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

const L = (key: string, title: string, grain: "product" | "option" = "option"): ListingUpsert => ({
  listingKey: key,
  title,
  grain,
})

const idOf = (key: string): string => `lst-${CONN}-${key}`

describe("연결 쓰기 (§21-6)", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver(":memory:")
    await seed(db)
    repo = new Repository(db)
    await repo.upsertListings(
      LIB,
      CONN,
      [L("P1|블랙", "미니팬 · 블랙"), L("P1|화이트", "미니팬 · 화이트"), L("P2", "거리측정기")],
      "t1",
    )
  })

  const row = async (key: string): Promise<Record<string, unknown> | undefined> =>
    db.prepare(`SELECT * FROM marketplace_listing WHERE id = ?`).get(idOf(key))

  /** ★ 완료 기준 b의 본체 — 군집 하나가 SKU 하나로 간다 ★ */
  it("새 SKU로 등록 — 옵션 여럿이 한 SKU가 되고 4필드가 기록된다", async () => {
    const skuId = await repo.createSkuForListings(
      LIB,
      [idOf("P1|블랙"), idOf("P1|화이트")],
      "미니팬 NS-19",
      NOW,
    )

    const sku = await db.prepare(`SELECT * FROM sku WHERE id = ?`).get(skuId)
    expect(sku?.["name"]).toBe("미니팬 NS-19")
    expect(sku?.["code"], "코드는 순번으로 뽑는다").toBe("SKU-0001")
    expect(sku?.["status"]).toBe("ACTIVE")

    // 상품도 함께 생긴다 — sku.product_id가 NOT NULL이다
    const prod = await db.prepare(`SELECT * FROM product WHERE id = ?`).get(String(sku?.["product_id"]))
    expect(prod?.["name"]).toBe("미니팬 NS-19")

    for (const k of ["P1|블랙", "P1|화이트"]) {
      const r = await row(k)
      expect(r?.["sku_id"], `${k}가 안 이어졌다`).toBe(skuId)
      expect(r?.["link_state"]).toBe("linked")
      expect(r?.["linked_by"], "사람이 눌렀다는 기록").toBe("user")
      expect(r?.["linked_at"]).toBe(NOW)
    }
    // 누르지 않은 것은 그대로다
    expect((await row("P2"))?.["link_state"]).toBe("unlinked")
  })

  it("연속 등록은 코드가 이어진다", async () => {
    await repo.createSkuForListings(LIB, [idOf("P1|블랙")], "미니팬", NOW)
    const second = await repo.createSkuForListings(LIB, [idOf("P2")], "거리측정기", NOW)
    const sku = await db.prepare(`SELECT code FROM sku WHERE id = ?`).get(second)
    expect(sku?.["code"]).toBe("SKU-0002")
  })

  it("기존 SKU에 잇는다 — ESM 상품이 11번가 군집과 한 SKU로 (N:1)", async () => {
    const skuId = await repo.createSkuForListings(
      LIB,
      [idOf("P1|블랙"), idOf("P1|화이트")],
      "미니팬 NS-19",
      NOW,
    )
    await repo.upsertListings(LIB, CONN, [L("E1", "미니팬 NS-19", "product")], "t2")
    const n = await repo.linkListings([idOf("E1")], skuId, NOW)

    expect(n).toBe(1)
    const linked = await db
      .prepare(`SELECT COUNT(*) AS n FROM marketplace_listing WHERE sku_id = ?`)
      .get(skuId)
    expect(Number(linked?.["n"]), "한 SKU에 리스팅 셋이 모인다").toBe(3)
  })

  /** ★ 연결 해제는 사람의 명시 행위만 (ADR-012 결정 3) ★ */
  it("연결 해제는 4필드를 되돌린다 — 리스팅 자체는 남는다", async () => {
    const skuId = await repo.createSkuForListings(LIB, [idOf("P2")], "거리측정기", NOW)
    await repo.unlinkListings([idOf("P2")], "t3")

    const r = await row("P2")
    expect(r, "리스팅이 사라지면 안 된다").toBeTruthy()
    expect(r?.["sku_id"]).toBeNull()
    expect(r?.["link_state"]).toBe("unlinked")
    expect(r?.["linked_by"]).toBeNull()
    expect(r?.["linked_at"]).toBeNull()
    // SKU는 남는다 — 연결만 끊은 것이지 상품을 지운 것이 아니다
    expect(await db.prepare(`SELECT id FROM sku WHERE id = ?`).get(skuId)).toBeTruthy()
  })

  it("무시도 상태다 — 매번 다시 묻지 않기 위해", async () => {
    await repo.ignoreListings([idOf("P2")], NOW)
    const r = await row("P2")
    expect(r?.["link_state"]).toBe("ignored")
    expect(r, "무시는 삭제가 아니다").toBeTruthy()
    expect(r?.["sku_id"]).toBeNull()
  })

  /** ★ 완료 기준 c — 되돌리기는 연결을 건드리지 않는다 (ADR-012) ★ */
  it("연결한 뒤 배치를 되돌려도 연결이 산다", async () => {
    const skuId = await repo.createSkuForListings(LIB, [idOf("P1|블랙")], "미니팬", NOW)

    const b: BatchOpen = {
      id: "batch-1",
      libraryId: LIB,
      connectionId: CONN,
      sourceName: "a.xlsx",
      sourceBytes: 10,
      containerFormat: "xlsx",
      mappingVersion: "mk-a/order@1",
      startedAt: "t2",
    }
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [
      { id: "o-1", source_key: "k1", ordered_at: "2026-07-01", status: "OK", total_amount: 1000 },
    ])
    await repo.undoBatch("batch-1", "t3")

    expect(Number((await db.prepare(`SELECT COUNT(*) AS n FROM fact_order`).get())?.["n"])).toBe(0)
    expect((await row("P1|블랙"))?.["sku_id"], "연결이 되돌리기에 쓸려갔다").toBe(skuId)
  })

  /**
   * ★ 이 테스트가 «자동 확정 없음»의 구조적 증거다 ★
   *
   * 쓰기 함수들의 인자에 **일치도가 없다.** 제안이 1.0을 내도 그 값을 넘길 자리가
   * 없으므로, 자동 확정은 잊어서 안 하는 것이 아니라 **할 방법이 없다.**
   */
  it("쓰기 함수는 일치도를 받지 않는다 — 자동 확정이 구조적으로 불가능하다", () => {
    // (libraryId, listingIds, name, now) — 점수가 들어갈 자리가 없다
    expect(repo.createSkuForListings.length).toBe(4)
    // (listingIds, skuId, now)
    expect(repo.linkListings.length).toBe(3)
  })
})
