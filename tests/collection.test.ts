/**
 * 묶음 — **어느 파일들을 합쳐 볼 것인가** (ADR-021 · 마이그레이션 013).
 *
 * 사용자가 물었다: *"앱이 무비판적으로 모든 파일을 받아들여 합치는 것 같다."*
 * 실측하면 맞았다 — `active_*` 뷰의 조건은 `b.status = 'committed'` 하나뿐이었고,
 * 그 조건의 원래 목적은 「적재 중 배제」였지 「고르기」가 아니었다.
 *
 * ★ 이 파일이 지키는 성질 ★
 * ```
 * ① 선택 없음 = 전부       013 이전 DB와 이후 DB가 **같은 답**을 낸다
 * ② 고르면 그것만          손익·정산·주문·반품·광고가 동시에 따라온다
 * ③ 중첩해도 안 두 배      한 파일이 묶음 둘에 들어도 매출이 한 번만 세어진다
 * ④ 빼기 ≠ 되돌리기        계산에서만 빠진다. 다시 담으면 그대로 돌아온다
 * ```
 *
 * ①이 가장 중요하다 — 이 마이그레이션은 **기존 시험 26곳이 지나는 뷰**를 다시
 * 만든다. 「선택 없음 = 전부」가 참이 아니면 손익·정산·주문·커버리지가 한꺼번에 0을
 * 본다. 그래서 013이 「전체를 골랐다」를 값으로 저장하지 않고 **행 없음**으로 둔다.
 *
 * ③은 뷰의 EXISTS가 아니라 **PK 둘**이 지킨다(013 주석의 실측 참조). 그래서 ③절은
 * «EXISTS라서 안 두 배»가 아니라 «오늘 그 1:1을 떠받치는 것»을 못 박는다.
 *
 * 금액은 `SUM`으로 본다. 행이 겹쳐 세어지는 사고는 `COUNT(DISTINCT …)`에서는 숨고
 * SUM에서만 드러나기 때문이다.
 */

import { describe, expect, it } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { listingIdFor, Repository } from "../src/core/store/repository.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { coverage, type DocType } from "../src/core/coverage/index.js"
import { loadCoverage, scopeCoverage } from "../src/core/coverage/load.js"

const LIB = "lib-1"
const NOW = "2026-08-20T00:00:00"
const PERIOD = { from: "2026-07-01", to: "2026-08-31" }

type Db = ReturnType<typeof openNodeDriver>

/** 배치 하나 = 파일 하나. 이 시험에서 「파일」이라고 부르는 것이 이것이다. */
async function addBatch(db: Db, id: string, name: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes, container_format,
                          mapping_version, started_at, committed_at, status, row_count)
       VALUES (?,?,'conn-x',?,0,'xlsx','x/order/line@1',?,?,'committed',1)`,
    )
    .run(id, LIB, name, NOW, NOW)
}

async function seed(db: Db): Promise<Repository> {
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
  return repo
}

/** 주문 한 건 + 품목 한 줄을 **지정한 배치에** 넣는다. */
async function addOrder(db: Db, batchId: string, id: string, on: string, amount: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fact_order (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                               source_key, ordered_at, status, total_amount)
       VALUES (?,'conn-x',?,?,?,'x/order/line@1',?,?,'PAID',?)`,
    )
    .run(id, batchId, LIB, NOW, id, on, amount)
  await db
    .prepare(
      `INSERT INTO fact_order_item (id, connection_id, batch_id, library_id, updated_at,
                                    mapping_version, source_key, order_id, listing_id, quantity, gross_amount)
       VALUES (?,'conn-x',?,?,?,'x/order/line@1',?,?,?,1,?)`,
    )
    .run(`${id}-i`, batchId, LIB, NOW, `${id}-i`, id, listingIdFor("conn-x", "sku-1"), amount)
}

/** 나머지 세 Fact — 뷰 다섯이 **전부** 범위를 지키는지 보려면 하나씩 있어야 한다. */
async function addRest(db: Db, batchId: string, tag: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fact_settlement (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                                    source_key, settled_on, net_amount)
       VALUES (?,'conn-x',?,?,?,'x/settle@1',?,'2026-07-10',1000)`,
    )
    .run(`s-${tag}`, batchId, LIB, NOW, `s-${tag}`)
  await db
    .prepare(
      `INSERT INTO fact_claim (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                               source_key, claim_type, status, claimed_at, amount)
       VALUES (?,'conn-x',?,?,?,'x/claim@1',?,'RETURN','DONE','2026-07-11',500)`,
    )
    .run(`c-${tag}`, batchId, LIB, NOW, `c-${tag}`)
  await db
    .prepare(
      `INSERT INTO fact_ad_spend (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                                  source_key, campaign_key, spent_on, spend_amount)
       VALUES (?,'conn-x',?,?,?,'x/ad@1',?,'cmp-1','2026-07-12',300)`,
    )
    .run(`a-${tag}`, batchId, LIB, NOW, `a-${tag}`)
}

const countView = async (db: Db, view: string): Promise<number> =>
  Number((await db.prepare(`SELECT COUNT(*) AS n FROM ${view}`).get())?.["n"] ?? 0)

const sumOrders = async (db: Db): Promise<number> =>
  Number((await db.prepare(`SELECT COALESCE(SUM(total_amount),0) AS s FROM active_order`).get())?.["s"] ?? 0)

describe("① 선택 없음 = 전부 — 013 이전과 같은 답을 낸다", () => {
  it("★ 묶음을 하나도 안 만들면 아무것도 안 달라진다 ★", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "7월 매출.xlsx")
      await addBatch(db, "b2", "8월 매출.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)
      await addOrder(db, "b2", "o2", "2026-08-05", 20_000)

      expect(await repo.activeCollection(LIB), "행이 없으면 전체다").toBeNull()
      expect(await sumOrders(db)).toBe(30_000)
      expect(await countView(db, "active_order")).toBe(2)
    } finally {
      await db.close()
    }
  })

  it("묶음을 **만들기만** 해도 안 달라진다 — 고르는 것과 만드는 것은 다르다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "7월.xlsx")
      await addBatch(db, "b2", "8월.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)
      await addOrder(db, "b2", "o2", "2026-08-05", 20_000)

      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "7월 결산", batchIds: ["b1"], now: NOW })
      expect(await sumOrders(db), "안 골랐으므로 전체 그대로").toBe(30_000)
    } finally {
      await db.close()
    }
  })
})

describe("② 고르면 그것만 — 뷰 다섯이 동시에 따라온다", () => {
  it("★★ 묶음을 고르면 손익이 그 파일들만으로 다시 선다 ★★", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "7월.xlsx")
      await addBatch(db, "b2", "8월.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)
      await addOrder(db, "b2", "o2", "2026-08-05", 20_000)

      const all = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(all.pnl.revenue).toBe(30_000)

      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "7월 결산", batchIds: ["b1"], now: NOW })
      await repo.setActiveCollection(LIB, "col-1", NOW)

      const only7 = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(only7.pnl.revenue, "8월 파일은 계산 밖이다").toBe(10_000)

      // 전체로 되돌리면 그대로 복구된다 — 데이터는 하나도 안 없어졌다
      await repo.setActiveCollection(LIB, null, NOW)
      expect((await loadPnlSnapshot(db, LIB, PERIOD)).pnl.revenue).toBe(30_000)
    } finally {
      await db.close()
    }
  })

  it("뷰 다섯이 **전부** 범위를 안다 — 하나라도 새면 그 화면만 다른 세계를 본다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "안에.xlsx")
      await addBatch(db, "b2", "밖에.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)
      await addOrder(db, "b2", "o2", "2026-08-05", 20_000)
      await addRest(db, "b1", "in")
      await addRest(db, "b2", "out")

      const views = ["active_order", "active_order_item", "active_settlement", "active_claim", "active_ad_spend"]
      for (const v of views) expect(await countView(db, v), `${v} 전체`).toBe(2)

      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "안에만", batchIds: ["b1"], now: NOW })
      await repo.setActiveCollection(LIB, "col-1", NOW)
      for (const v of views) expect(await countView(db, v), `${v}가 범위를 안 지킨다`).toBe(1)
    } finally {
      await db.close()
    }
  })

  it("빈 묶음을 고르면 0이다 — 사고가 아니라 «아직 아무것도 안 담았다»", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "7월.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)

      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "빈 것", now: NOW })
      await repo.setActiveCollection(LIB, "col-1", NOW)
      expect(await sumOrders(db)).toBe(0)
      // 화면이 «데이터가 없습니다»가 아니라 «이 묶음이 비었습니다»를 말해야 하는 자리다
      expect((await repo.collections(LIB))[0]?.batchCount).toBe(0)
    } finally {
      await db.close()
    }
  })
})

/**
 * ★ 이 절이 무엇을 증명하고 무엇을 증명 못 하는지 ★
 *
 * 「중첩해도 두 배가 안 난다」는 성질은 **뷰의 EXISTS가 아니라 PK 둘이** 지키고
 * 있다 — `collection_active`가 라이브러리당 한 행이고 `collection_batch`가 짝당
 * 한 행이라, 지금은 JOIN으로 써도 행이 안 는다. 실측으로 확인했다(013 주석).
 *
 * 그래서 여기 있는 시험은 «EXISTS가 아니면 붉어진다»를 증명하지 못한다. 대신
 * **오늘 그 1:1을 실제로 떠받치는 것**(활성은 늘 하나 · 담기는 멱등)을 못 박는다.
 * 그 둘이 무너지는 날 EXISTS가 값을 하고, 그때 이 시험이 먼저 붉어진다.
 */
describe("③ 중첩해도 두 배가 안 된다 — 그 성질을 떠받치는 것", () => {
  it("★ 활성은 늘 하나다 — 두 번 고르면 갈아탄다, 쌓이지 않는다 ★", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "매출.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)
      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "가", batchIds: ["b1"], now: NOW })
      await repo.createCollection({ id: "col-2", libraryId: LIB, name: "나", batchIds: ["b1"], now: NOW })

      await repo.setActiveCollection(LIB, "col-1", NOW)
      await repo.setActiveCollection(LIB, "col-2", NOW)

      // 활성이 둘로 쌓이면 그 순간 JOIN판이 매출을 두 배로 만든다. PK가 그걸 막는다
      const rows = await db.prepare(`SELECT COUNT(*) AS n FROM collection_active`).all()
      expect(Number(rows[0]?.["n"]), "활성 행이 쌓였다").toBe(1)
      expect(await repo.activeCollection(LIB)).toBe("col-2")
      expect(await sumOrders(db)).toBe(10_000)
    } finally {
      await db.close()
    }
  })

  it("한 파일이 묶음 둘에 들어도 매출이 한 번만 세어진다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "매출.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)

      // ADR-021의 요구다 — 「7월 결산」과 「광고 제외본」이 같은 매출 파일을 공유한다
      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "7월 결산", batchIds: ["b1"], now: NOW })
      await repo.createCollection({ id: "col-2", libraryId: LIB, name: "광고 제외본", batchIds: ["b1"], now: NOW })
      await repo.setActiveCollection(LIB, "col-1", NOW)

      // 활성이 여럿이 되는 날 JOIN판이 여기서 20,000을 낸다 (SUM에만 보이는 사고다)
      expect(await sumOrders(db), "겹쳐 담긴 파일이 두 번 세어졌다").toBe(10_000)
      expect(await countView(db, "active_order")).toBe(1)
      expect((await loadPnlSnapshot(db, LIB, PERIOD)).pnl.revenue).toBe(10_000)
    } finally {
      await db.close()
    }
  })

  it("같은 파일을 두 번 담아도 한 번이다 — 「담아라」의 결과는 «들어 있다»", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "매출.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)
      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "7월", batchIds: ["b1"], now: NOW })

      expect(await repo.addToCollection("col-1", ["b1"], NOW), "이미 든 것은 0건 추가").toBe(0)
      await repo.setActiveCollection(LIB, "col-1", NOW)
      expect(await sumOrders(db)).toBe(10_000)
      expect((await repo.collectionBatches("col-1")).length).toBe(1)
    } finally {
      await db.close()
    }
  })
})

describe("④ 빼기 ≠ 되돌리기 — 데이터는 남는다", () => {
  it("★ 묶음에서 빼도 fact 행은 그대로다 — 다시 담으면 돌아온다 ★", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "7월.xlsx")
      await addBatch(db, "b2", "8월.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)
      await addOrder(db, "b2", "o2", "2026-08-05", 20_000)
      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "둘 다", batchIds: ["b1", "b2"], now: NOW })
      await repo.setActiveCollection(LIB, "col-1", NOW)
      expect(await sumOrders(db)).toBe(30_000)

      expect(await repo.removeFromCollection("col-1", ["b2"], NOW)).toBe(1)
      expect(await sumOrders(db), "계산에서만 빠진다").toBe(10_000)

      // 되돌리기였다면 여기가 0이다. 뺀 것은 **데이터를 안 지운다**
      const still = await db.prepare(`SELECT COUNT(*) AS n FROM fact_order`).get()
      expect(Number(still?.["n"]), "원본은 두 건 그대로").toBe(2)

      await repo.addToCollection("col-1", ["b2"], NOW)
      expect(await sumOrders(db), "다시 담으면 그대로 돌아온다").toBe(30_000)
    } finally {
      await db.close()
    }
  })

  it("묶음을 지워도 파일은 안 지워지고, 선택은 「전체」로 돌아간다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "7월.xlsx")
      await addBatch(db, "b2", "8월.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)
      await addOrder(db, "b2", "o2", "2026-08-05", 20_000)
      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "7월", batchIds: ["b1"], now: NOW })
      await repo.setActiveCollection(LIB, "col-1", NOW)
      expect(await sumOrders(db)).toBe(10_000)

      await repo.deleteCollection("col-1", NOW)
      expect(await repo.activeCollection(LIB), "없는 묶음을 가리킨 채로 남지 않는다").toBeNull()
      expect(await sumOrders(db), "전체로 돌아온다").toBe(30_000)
      expect(Number((await db.prepare(`SELECT COUNT(*) AS n FROM batch`).get())?.["n"])).toBe(2)
    } finally {
      await db.close()
    }
  })
})

describe("★ 뷰를 고쳤어도 안 건드려진 것 ★", () => {
  it("되돌리기는 묶음과 무관하다 — 범위 밖 파일도 되돌려진다 (ADR-004)", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "7월.xlsx")
      await addBatch(db, "b2", "8월.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)
      await addOrder(db, "b2", "o2", "2026-08-05", 20_000)
      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "7월", batchIds: ["b1"], now: NOW })
      await repo.setActiveCollection(LIB, "col-1", NOW)

      // b2는 지금 «안 보인다». 그렇다고 «되돌릴 것이 없다»가 되면 ADR-004가 깨진다 —
      // 되돌리기는 batch·row_shadow를 직접 보므로 뷰와 무관해야 한다.
      const removed = await repo.undoBatch("b2", NOW)
      expect(removed, "범위 밖이라고 되돌릴 게 없어지면 안 된다").toBeGreaterThan(0)
      const left = await db.prepare(`SELECT COUNT(*) AS n FROM fact_order`).get()
      expect(Number(left?.["n"]), "b2의 행이 실제로 지워졌다").toBe(1)
    } finally {
      await db.close()
    }
  })

  it("★ 가져오기 기록은 전부 보인다 — 안 그러면 묶음을 만들 수가 없다 ★", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "7월.xlsx")
      await addBatch(db, "b2", "8월.xlsx")
      await addOrder(db, "b1", "o1", "2026-07-05", 10_000)
      await addOrder(db, "b2", "o2", "2026-08-05", 20_000)
      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "7월", batchIds: ["b1"], now: NOW })
      await repo.setActiveCollection(LIB, "col-1", NOW)

      // 파일 목록이 범위에 걸리면 «담을 파일을 고를 화면»이 자기 자신을 가린다
      const hist = await repo.batchHistory(LIB)
      expect(hist.length, "묶음 밖 파일도 목록에는 있어야 한다").toBe(2)
    } finally {
      await db.close()
    }
  })
})

describe("함정 — 새 파일이 조용히 빠진다 (ADR-021)", () => {
  it("가져오기 결과가 «이 파일은 이 묶음에 없습니다»를 말할 수 있다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "7월.xlsx")
      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "7월 결산", batchIds: ["b1"], now: NOW })
      await repo.setActiveCollection(LIB, "col-1", NOW)

      await addBatch(db, "b2", "8월.xlsx") // 방금 가져온 파일
      expect(await repo.batchInActiveScope(LIB, "b2"), "안 담겼다는 사실을 앱이 알아야 한다").toBe(false)
      expect(await repo.batchInActiveScope(LIB, "b1")).toBe(true)

      await repo.setActiveCollection(LIB, null, NOW)
      expect(await repo.batchInActiveScope(LIB, "b2"), "전체에서는 늘 참이다").toBe(true)
    } finally {
      await db.close()
    }
  })
})

describe("이력 — 「지난달 순이익이 왜 달라졌나」에 답한다", () => {
  it("만들기·담기·빼기·이름 바꾸기·지우기가 전부 남는다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "7월.xlsx")
      await addBatch(db, "b2", "8월.xlsx")

      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "7월", batchIds: ["b1"], now: NOW })
      await repo.addToCollection("col-1", ["b2"], NOW)
      await repo.removeFromCollection("col-1", ["b2"], NOW)
      await repo.renameCollection("col-1", "7월 결산", NOW)
      await repo.deleteCollection("col-1", NOW)

      const ev = await repo.collectionEvents(LIB)
      const kinds = ev.map((e) => String(e["kind"])).reverse()
      expect(kinds).toEqual(["created", "added", "added", "removed", "renamed", "deleted"])
      // 지워진 묶음의 이력도 남는다 — FK를 안 걸었기 때문이다
      expect(ev.length).toBe(6)
      expect(String(ev[0]?.["name"]), "지울 때의 이름이 박제된다").toBe("7월 결산")
    } finally {
      await db.close()
    }
  })

  it("이미 든 파일을 또 담아도 이력이 안 쌓인다 — 같은 사실을 두 번 적지 않는다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatch(db, "b1", "7월.xlsx")
      await repo.createCollection({ id: "col-1", libraryId: LIB, name: "7월", batchIds: ["b1"], now: NOW })
      await repo.addToCollection("col-1", ["b1"], NOW)
      const ev = await repo.collectionEvents(LIB)
      expect(ev.filter((e) => e["kind"] === "added").length).toBe(1)
    } finally {
      await db.close()
    }
  })
})

describe("조용히 지나가지 않는다 (LOCK 6)", () => {
  it("없는 묶음을 고르면 던진다 — 슬그머니 「전체」로 흐르지 않는다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await expect(repo.setActiveCollection(LIB, "col-없음", NOW)).rejects.toThrow("없는 묶음")
    } finally {
      await db.close()
    }
  })

  it("이름이 비면 던지고, 같은 이름 둘은 못 만든다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await expect(
        repo.createCollection({ id: "c1", libraryId: LIB, name: "   ", now: NOW }),
      ).rejects.toThrow("이름")
      await repo.createCollection({ id: "c1", libraryId: LIB, name: "7월", now: NOW })
      // 고르는 순간 구분이 안 되는 이름이므로 만들 때 막는다
      await expect(
        repo.createCollection({ id: "c2", libraryId: LIB, name: "7월", now: NOW }),
      ).rejects.toThrow()
    } finally {
      await db.close()
    }
  })
})

/**
 * ★★ 묶음이 «자격»을 갖는다 — 017 · [ADR-023](docs/ADR-023-통-묶음-자격-입구순서.md) 결정 2 ★★
 *
 * 013은 fact 뷰 다섯에 범위를 넣었다. 그런데 **커버리지의 보유 판정만 빠져 있었다** —
 * `loadCoverage`가 `FROM batch`를 직접 읽어서, 한 함수 안에서 두 기준이 돌았다:
 *
 *     counts   active_* 뷰   → 범위를 지킨다        0건이 된다
 *     held     FROM batch    → 범위를 **무시**한다   그대로 「열림」
 *
 * 그 조합의 증상이 정확히 §22가 금지한 것이다 — **열린 지표가 0을 그린다.**
 * 「없어서 0」과 「있는데 범위 밖이라 0」이 화면에서 같은 그림이 된다.
 */
describe("묶음이 커버리지의 판정 단위다 (017 · ADR-023 확인 ①)", () => {
  /** 성격이 다른 배치를 따로 만든다 — `held`는 `mapping_version`에서 나오기 때문이다. */
  async function addBatchAs(db: Db, id: string, mv: string): Promise<void> {
    await db
      .prepare(
        `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes, container_format,
                            mapping_version, started_at, committed_at, status, row_count)
         VALUES (?,?,'conn-x',?,0,'xlsx',?,?,?,'committed',1)`,
      )
      .run(id, LIB, `${id}.xlsx`, mv, NOW, NOW)
  }

  const resolver = (mv: string): DocType | null =>
    mv.startsWith("x/order") ? "order" : mv.startsWith("x/settle") ? "settlement" : null

  const heldOf = async (db: Db): Promise<readonly DocType[]> =>
    (await loadCoverage(db, LIB, resolver)).find((c) => c.connectionId === "conn-x")!.coverage.held

  it("★ 범위 밖 파일은 «보유»가 아니다 — 열린 지표가 0을 그리지 않는다 ★", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatchAs(db, "b-order", "x/order/line@1")
      await addBatchAs(db, "b-settle", "x/settle@1")

      expect(await heldOf(db), "선택 없음 = 전부 (013 ①)").toEqual(["order", "settlement"])

      // 「7월 결산」에는 주문 파일만 담는다
      await repo.createCollection({
        id: "col-7",
        libraryId: LIB,
        name: "7월 결산",
        batchIds: ["b-order"],
        now: NOW,
      })
      await repo.setActiveCollection(LIB, "col-7", NOW)

      expect(await heldOf(db), "★ 범위 밖의 정산은 보유가 아니다 ★").toEqual(["order"])

      // 「전체」로 돌아오면 그대로 복구된다 — 되돌리기가 아니라 **보기**다 (ADR-021)
      await repo.setActiveCollection(LIB, null, NOW)
      expect(await heldOf(db), "빼기는 계산에서만 뺀다").toEqual(["order", "settlement"])
    } finally {
      await db.close()
    }
  })

  it("되돌린 배치는 담겨 있어도 보유가 아니다 — 「담겼다」와 「살아 있다」는 다르다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      const repo = await seed(db)
      await addBatchAs(db, "b-order", "x/order/line@1")
      await addBatchAs(db, "b-settle", "x/settle@1")
      await repo.createCollection({
        id: "col-7",
        libraryId: LIB,
        name: "7월 결산",
        batchIds: ["b-order", "b-settle"],
        now: NOW,
      })
      await repo.setActiveCollection(LIB, "col-7", NOW)
      expect(await heldOf(db)).toEqual(["order", "settlement"])

      // 013이 정한 대로 되돌린 배치도 묶음에 **남는다**. 그래도 데이터는 없다.
      await db.prepare(`UPDATE batch SET status = 'undone' WHERE id = 'b-settle'`).run()
      expect(await heldOf(db), "묶음에는 남아 있어도 보유는 아니다").toEqual(["order"])
    } finally {
      await db.close()
    }
  })

  /**
   * ★ 어느 연결도 혼자서는 못 여는 지표가 **범위로는 열린다** ★
   *
   * 이게 「판정 단위를 연결에서 묶음으로 올린다」가 실제로 뜻하는 것이다. 대시보드는
   * 채널 하나가 아니라 지금 고른 범위 전체를 그리므로, 연결별 판정만으로는 자기
   * 자격을 물을 자리가 없다.
   */
  it("★ 범위는 연결들의 **합집합**이다 — 교집합으로 접으면 숙제 검사가 된다 ★", () => {
    const conn = (held: DocType[], counts: Partial<Record<DocType, number>>, skus = 0) => ({
      connectionId: `c-${held.join("-")}`,
      channel: "채널",
      marketplaceKey: "x",
      state: "CONNECTED",
      counts: { order: 0, settlement: 0, ad: 0, cost: 0, ...counts },
      skuCount: skus,
      lastImportAt: null,
      settlementGross: 0,
      coverage: coverage(held, { settlementGross: 0 }),
    })

    // 11번가는 정산만, ESM은 주문만 — 어느 쪽도 혼자서는 기여이익을 못 연다
    const a = conn(["settlement"], { settlement: 128 })
    const b = conn(["order", "cost"], { order: 155, cost: 35 }, 35)
    expect(a.coverage.entries.find((e) => e.metric === "contribution")!.open).toBe(false)
    expect(b.coverage.entries.find((e) => e.metric === "contribution")!.open).toBe(false)

    const scope = scopeCoverage([a, b], "7월 결산")
    expect(scope.collectionName).toBe("7월 결산")
    expect(scope.counts).toEqual({ order: 155, settlement: 128, ad: 0, cost: 35 })
    expect(
      scope.coverage.entries.find((e) => e.metric === "contribution")!.open,
      "★ 합쳐야 열리는 것이 있다 — 그래서 판정이 범위로 올라간다 ★",
    ).toBe(true)
    expect(scope.coverage.hasPartial, "35/35는 부분이 아니다").toBe(false)
  })

  it("범위의 원가도 절단점이 없다 — 236/261이면 **열리고 25를 말한다**", () => {
    const conn = {
      connectionId: "c1",
      channel: "채널",
      marketplaceKey: "x",
      state: "CONNECTED",
      counts: { order: 1, settlement: 1, ad: 0, cost: 236 },
      skuCount: 261,
      lastImportAt: null,
      settlementGross: 0,
      coverage: coverage(["order", "settlement", "cost"], {
        settlementGross: 0,
        partial: { cost: { have: 236, need: 261 } },
      }),
    }
    const scope = scopeCoverage([conn], null)
    expect(scope.collectionName, "묶음이 없으면 「전체」다 — 013 «전체는 행이 아니다»").toBeNull()

    const contrib = scope.coverage.entries.find((e) => e.metric === "contribution")!
    expect(contrib.open, "★ 열린다 (옛 §22-3 ①은 잠갔다) ★").toBe(true)
    expect(contrib.partial[0]).toMatchObject({ docType: "cost", have: 236, need: 261, short: 25 })
  })

  /**
   * ★★ 절단점 금지를 **기계가 지킨다** ★★
   *
   * ADR-023 확인 ②가 이름까지 대며 금지한 것이 `if (ratio < 0.9) return locked`다.
   * 「지금 그런 줄이 없다」는 오늘의 사실일 뿐이라 내일 다시 생긴다. 비율을 촘촘히
   * 훑어 **전부 열려 있는지** 보면, 어떤 절단점이 들어와도 이 줄이 붉어진다.
   */
  it("★ 어떤 비율에서도 열린다 — 1/1000부터 999/1000까지 (확인 ②) ★", () => {
    for (const have of [1, 2, 9, 100, 234, 500, 899, 900, 998, 999]) {
      const c = coverage(["order", "settlement", "cost"], {
        settlementGross: 0,
        partial: { cost: { have, need: 1000 } },
      })
      const e = c.entries.find((x) => x.metric === "contribution")!
      expect(e.open, `원가 ${have}/1000에서 잠겼다 — 절단점이 생겼다`).toBe(true)
      expect(e.partial[0]?.short, `${have}/1000의 부족분이 안 맞는다`).toBe(1000 - have)
    }
  })

  it("★ 잠기는 것은 «아예 없을 때»뿐이다 — 부족과 부재는 다르다 ★", () => {
    const none = coverage(["order", "settlement"], { settlementGross: 0 })
    expect(none.entries.find((e) => e.metric === "cogs")!.open, "원가가 0이면 잠긴다").toBe(false)
    expect(none.entries.find((e) => e.metric === "cogs")!.partial, "부재는 부분이 아니다").toEqual([])

    // 붙은 SKU가 0이면 «덜 넣었다»가 아니다 — 넣을 자리가 아직 없는 것이고
    // 그 처방은 상품 연결이다 (`cogs-unlinked`가 그쪽을 말한다)
    const noSku = coverage(["order", "settlement", "cost"], {
      settlementGross: 0,
      partial: { cost: { have: 0, need: 0 } },
    })
    expect(noSku.entries.find((e) => e.metric === "cogs")!.partial).toEqual([])
  })
})
