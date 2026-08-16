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
    const { skuId } = await repo.createSkuForListings(
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
    const { skuId: second } = await repo.createSkuForListings(LIB, [idOf("P2")], "거리측정기", NOW)
    const sku = await db.prepare(`SELECT code FROM sku WHERE id = ?`).get(second)
    expect(sku?.["code"]).toBe("SKU-0002")
  })

  it("기존 SKU에 잇는다 — ESM 상품이 11번가 군집과 한 SKU로 (N:1)", async () => {
    const { skuId } = await repo.createSkuForListings(
      LIB,
      [idOf("P1|블랙"), idOf("P1|화이트")],
      "미니팬 NS-19",
      NOW,
    )
    await repo.upsertListings(LIB, CONN, [L("E1", "미니팬 NS-19", "product")], "t2")
    const n = await repo.linkListings([idOf("E1")], skuId!, NOW)

    expect(n).toBe(1)
    const linked = await db
      .prepare(`SELECT COUNT(*) AS n FROM marketplace_listing WHERE sku_id = ?`)
      .get(skuId)
    expect(Number(linked?.["n"]), "한 SKU에 리스팅 셋이 모인다").toBe(3)
  })

  /** ★ 연결 해제는 사람의 명시 행위만 (ADR-012 결정 3) ★ */
  it("연결 해제는 4필드를 되돌린다 — 리스팅 자체는 남는다", async () => {
    const { skuId } = await repo.createSkuForListings(LIB, [idOf("P2")], "거리측정기", NOW)
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
    const { skuId } = await repo.createSkuForListings(LIB, [idOf("P1|블랙")], "미니팬", NOW)

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

  /**
   * ★ 멱등 — 2d에서 실제로 난 사고다 ★
   *
   * 사용자가 한 카드의 [새 SKU로 등록]을 두 번 눌렀고, 두 번째 호출이 새 SKU를
   * 하나 더 만들고 리스팅을 옮겨 첫 번째를 고아로 남겼다 (실측: sku 62 · 리스팅
   * 붙은 SKU 61).
   *
   * 처음 진단은 "쓰기 도는 동안 버튼을 안 막았다"였는데 **반쪽이었다.**
   * 잠금은 UX이고 이건 정확성이다 — 같은 요청이 두 번 갈 경로는 더블클릭 말고도
   * 코드가 늘면 또 생긴다. 방어는 쓰기 함수 자신이 한다.
   */
  it("같은 리스팅으로 두 번 등록해도 SKU가 둘이 되지 않는다", async () => {
    const first = await repo.createSkuForListings(LIB, [idOf("P1|블랙")], "미니팬", NOW)
    expect(first.skuId, "첫 호출은 만든다").toBeTruthy()
    expect(first.linked).toBe(1)
    expect(first.alreadyLinked).toBe(0)

    const second = await repo.createSkuForListings(LIB, [idOf("P1|블랙")], "미니팬", NOW)
    // 오류가 아니다 — 사용자는 같은 일을 두 번 시켰을 뿐이다
    expect(second.skuId, "두 번째는 아무것도 만들지 않는다").toBeNull()
    expect(second.linked).toBe(0)
    expect(second.alreadyLinked).toBe(1)

    const n = await db.prepare(`SELECT COUNT(*) AS n FROM sku`).get()
    expect(Number(n?.["n"]), "SKU는 하나뿐이다").toBe(1)
    // 리스팅은 첫 SKU에 그대로 붙어 있다 — 옮겨지지 않았다
    expect((await row("P1|블랙"))?.["sku_id"]).toBe(first.skuId)
  })

  it("일부만 이미 연결됐으면 나머지로 만든다 — 전부 거부하지 않는다", async () => {
    const first = await repo.createSkuForListings(LIB, [idOf("P1|블랙")], "미니팬", NOW)
    const second = await repo.createSkuForListings(
      LIB,
      [idOf("P1|블랙"), idOf("P1|화이트")],
      "미니팬 묶음",
      NOW,
    )
    expect(second.skuId, "새 리스팅이 있으니 만든다").toBeTruthy()
    expect(second.linked, "화이트만 이어진다").toBe(1)
    expect(second.alreadyLinked, "블랙은 건너뛴다").toBe(1)
    // 블랙은 **원래 SKU에 그대로** — 조용히 옮기지 않는다
    expect((await row("P1|블랙"))?.["sku_id"]).toBe(first.skuId)
    expect((await row("P1|화이트"))?.["sku_id"]).toBe(second.skuId)
  })

  /** 고아는 «한 번 있었던 사고»가 아니라 연결을 옮기면 언제든 생기는 상태다. */
  it("고아 SKU를 치운다 — 원가가 붙은 것은 남긴다", async () => {
    const a = await repo.createSkuForListings(LIB, [idOf("P1|블랙")], "미니팬", NOW)
    const b = await repo.createSkuForListings(LIB, [idOf("P2")], "거리측정기", NOW)
    // b의 리스팅을 a로 옮긴다 → b가 고아가 된다 (정상 동작의 부산물이다)
    await repo.linkListings([idOf("P2")], a.skuId!, NOW)

    const purged = await repo.purgeOrphanSkus(LIB)
    expect(purged.skus, "고아 하나를 치운다").toBe(1)
    expect(purged.products, "껍데기 상품도 함께").toBe(1)

    const left = await db.prepare(`SELECT id FROM sku`).all()
    expect(left.map((r) => String(r["id"]))).toEqual([a.skuId])

    // 두 번 돌려도 안전하다 — 치울 것이 없으면 0이다
    expect((await repo.purgeOrphanSkus(LIB)).skus).toBe(0)
    expect(b.skuId, "b는 만들어졌다가 치워진 것이다").toBeTruthy()
  })

  it("리스팅이 없어도 원가가 있으면 치우지 않는다 — 사람의 판단을 지운다", async () => {
    const a = await repo.createSkuForListings(LIB, [idOf("P1|블랙")], "미니팬", NOW)
    await repo.unlinkListings([idOf("P1|블랙")], NOW)
    await db
      .prepare(
        `INSERT INTO cost_history (library_id, sku_id, kind, amount, effective_from, entered_at, entered_by)
         VALUES (?,?,?,?,?,?,?)`,
      )
      .run(LIB, a.skuId, "COGS", 1000, "2026-07-01", NOW, "user")

    const purged = await repo.purgeOrphanSkus(LIB)
    expect(purged.skus, "원가가 붙은 SKU는 고아가 아니다").toBe(0)
  })
})

/**
 * ★ SKU 순번 — **번호에 구멍이 생겨도 새 SKU가 만들어진다** (2026-08-16 사고) ★
 *
 * 사용자가 연결 세션 도중 이것에 막혔다:
 *
 * ```
 * UNIQUE constraint failed: product.id
 * SKU COUNT = 61 → 다음 순번 62 · 그런데 이미 있는 최대 번호도 62
 * ```
 *
 * 순번을 `COUNT(*) + 1`로 뽑고 있었는데 그것은 «번호에 구멍이 없다»를 전제한다.
 * 구멍은 **정상 동작으로 생긴다** — `purgeOrphanSkus`가 고아를 치우면 그 번호가
 * 빈다. 그 뒤로 COUNT는 영원히 이미 쓰인 번호를 가리킨다.
 */
describe("SKU 순번은 COUNT가 아니라 «비어 있는 자리»다", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver(":memory:")
    await seed(db)
    repo = new Repository(db)
  })

  /** 고아 정리가 중간 번호를 비운 세계를 만든다 — 실기기가 그 상태였다. */
  it("고아를 치워 번호에 구멍이 나도 새 SKU가 만들어진다", async () => {
    await repo.upsertListings(LIB, CONN, [L("k1", "가"), L("k2", "나"), L("k3", "다")], NOW)
    const all = await db.prepare(`SELECT id FROM marketplace_listing ORDER BY listing_key`).all()
    const ids = all.map((r) => String(r["id"]))

    const a = await repo.createSkuForListings(LIB, [ids[0]!], "가", NOW)
    const b = await repo.createSkuForListings(LIB, [ids[1]!], "나", NOW)
    expect(a.skuId).not.toBe(b.skuId)

    // 가운데 것을 고아로 만들고 치운다 → 번호 1이 빈다. COUNT는 1, 최대 번호는 2
    await repo.unlinkListings([ids[0]!], NOW)
    const purged = await repo.purgeOrphanSkus(LIB)
    expect(purged.skus, "고아 하나가 치워진다").toBe(1)

    const before = await db.prepare(`SELECT COUNT(*) AS n FROM sku`).get()
    expect(Number(before?.["n"]), "COUNT는 1인데 이미 쓰인 최대 번호는 2다").toBe(1)

    // ★ 여기서 옛 코드가 터졌다 — COUNT(1) + 1 = 2 = 이미 있는 번호 ★
    const c = await repo.createSkuForListings(LIB, [ids[2]!], "다", NOW)
    expect(c.skuId, "새 SKU가 만들어져야 한다").not.toBeNull()
    expect(c.linked).toBe(1)

    const codes = (await db.prepare(`SELECT code FROM sku ORDER BY code`).all()).map((r) =>
      String(r["code"]),
    )
    expect(new Set(codes).size, "코드가 겹치지 않는다").toBe(codes.length)
  })

  /**
   * 코드는 사람이 바꿀 수 있다 (§14-2 — 기준 데이터는 편집 가능). 그래서 순번을
   * **코드**에서 읽으면 사람이 이름을 고치는 날 다시 틀린다. `id`에서 읽는 이유다.
   */
  it("사람이 코드를 바꿔도 다음 순번이 어긋나지 않는다", async () => {
    await repo.upsertListings(LIB, CONN, [L("k1", "가"), L("k2", "나")], NOW)
    const ids = (await db.prepare(`SELECT id FROM marketplace_listing ORDER BY listing_key`).all())
      .map((r) => String(r["id"]))

    await repo.createSkuForListings(LIB, [ids[0]!], "가", NOW)
    await db.prepare(`UPDATE sku SET code = ?`).run("감성무드등")

    const b = await repo.createSkuForListings(LIB, [ids[1]!], "나", NOW)
    expect(b.skuId, "코드가 순번 형식이 아니어도 만들어진다").not.toBeNull()
  })
})
