/**
 * 원가 (③④) — **«모르는 것»과 «0원»이 끝까지 갈리는가.**
 *
 * 이 파일이 지키는 성질은 둘이다:
 *
 * ```
 * ① costAt의 규칙          판매일 이전 중 가장 늦은 이력 · 없으면 null
 * ② TS와 SQL이 같은 답     화면은 costAt, 손익은 costAtSql — 갈리면 여기서 잡힌다
 * ```
 *
 * ②가 이 파일의 존재 이유다. 되돌리기 버튼의 3상태를 «같은 신호를 세어» 만든 것과
 * 같은 문제이고, 그때와 같은 처방을 쓴다 — **두 답을 직접 대조한다.**
 */

import { describe, expect, it } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { listingIdFor, Repository } from "../src/core/store/repository.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { pnlGaps } from "../src/core/profit/gaps.js"
import { loadProductRows } from "../src/core/product/rows.js"
import {
  costAt,
  costAtSql,
  isCalendarDate,
  parseCostDraft,
  type CostEntry,
} from "../src/core/cost/index.js"

const LIB = "lib-1"
const NOW = "2026-08-14T00:00:00"
const PERIOD = { from: "2026-07-01", to: "2026-07-31" }

const e = (amount: number, effectiveFrom: string, kind: CostEntry["kind"] = "COGS"): CostEntry => ({
  kind,
  amount,
  effectiveFrom,
  note: null,
  enteredAt: NOW,
  enteredBy: "user",
})

describe("costAt — 원가는 숫자가 아니라 시계열이다", () => {
  it("판매일 이전 중 **가장 늦은** 이력을 쓴다", () => {
    const h = [e(1000, "2026-06-01"), e(1200, "2026-07-01"), e(1500, "2026-08-01")]
    expect(costAt(h, "COGS", "2026-07-15")).toBe(1200)
    expect(costAt(h, "COGS", "2026-08-01")).toBe(1500)
  })

  it("★ 이력이 없으면 «미상»이다 — 0이 아니다 ★", () => {
    // 0을 내면 그 상품의 기여이익이 **매출 전액**이 되고, 화면은 «원가 미입력»이
    // 아니라 «엄청 남는 상품»이라고 말한다. §22가 «부재를 0으로 바꾸지 않는다»고
    // 한 것의 계산기판이라, 이 한 줄이 이 파일에서 가장 중요한 단언이다.
    expect(costAt([], "COGS", "2026-07-15")).toBeNull()
    expect(costAt([e(1000, "2026-08-01")], "COGS", "2026-07-15")).toBeNull()
  })

  it("아직 적용 전인 원가는 과거 주문에 쓰지 않는다 — 소급 금지", () => {
    // 목업의 `costQuick`(SKU당 숫자 하나)대로 만들었으면 8월에 원가를 고칠 때마다
    // 7월 손익이 바뀐다. `effective_from`이 그걸 막는 자리다.
    const h = [e(1000, "2026-07-01"), e(9999, "2026-08-01")]
    expect(costAt(h, "COGS", "2026-07-31")).toBe(1000)
  })

  it("0원 원가는 «없음»과 다르다 — 증정품·샘플이 그렇다", () => {
    expect(costAt([e(0, "2026-07-01")], "COGS", "2026-07-15")).toBe(0)
  })

  it("종류가 섞여 있어도 자기 것만 본다", () => {
    const h = [e(1000, "2026-07-01"), e(500, "2026-07-10", "PACKAGING")]
    expect(costAt(h, "COGS", "2026-07-20")).toBe(1000)
    expect(costAt(h, "PACKAGING", "2026-07-20")).toBe(500)
    expect(costAt(h, "LOGISTICS", "2026-07-20")).toBeNull()
  })

  it("★ 판매일이 시각을 달고 와도 그날 원가가 걸린다 ★", () => {
    // `ordered_at`은 `2026-07-31T16:41:20`처럼 온다. `Date`로 파싱하면 실행 기기의
    // 시간대가 끼어들어 하루가 어긋난다 — `range-boundary`가 BETWEEN에서 잡은
    // 것과 같은 함정이라, ISO의 사전순 = 시간순 성질을 그대로 쓴다.
    const h = [e(1200, "2026-07-31")]
    expect(costAt(h, "COGS", "2026-07-31T16:41:20")).toBe(1200)
    expect(costAt(h, "COGS", "2026-07-30T23:59:59")).toBeNull()
  })
})

describe("입력 검증 — 화면이 막고, 저장이 한 번 더 막는다", () => {
  it("쉼표·공백·«원»을 걷어낸다 — 사람이 읽기 위한 표기다", () => {
    const p = parseCostDraft({ amount: " 12,000원 ", effectiveFrom: "2026-08-01" })
    expect(p.ok && p.amount).toBe(12_000)
  })

  it("0은 받고 음수는 막는다", () => {
    expect(parseCostDraft({ amount: "0", effectiveFrom: "2026-08-01" }).ok).toBe(true)
    const neg = parseCostDraft({ amount: "-1", effectiveFrom: "2026-08-01" })
    expect(neg.ok).toBe(false)
    expect(!neg.ok && neg.problems).toContain("amount-negative")
  })

  it("원 단위 정수가 아니면 막는다 — 반올림해서 받아주지 않는다", () => {
    const p = parseCostDraft({ amount: "1200.5", effectiveFrom: "2026-08-01" })
    expect(!p.ok && p.problems).toContain("amount-not-integer")
  })

  it("문제를 **전부 모아서** 돌려준다 — 같은 칸을 세 번 고치게 하지 않는다", () => {
    const p = parseCostDraft({ amount: "abc", effectiveFrom: "" })
    expect(!p.ok && p.problems.length).toBe(2)
  })

  it("★ 달력에 없는 날을 막는다 — 형식만 보면 2026-02-31이 통과한다 ★", () => {
    // 통과시키면 그 값은 `effective_from <= ordered_at` 비교에서 3월 1일 이후로
    // 행세하고, 원가가 엉뚱한 달부터 적용된다.
    expect(isCalendarDate("2026-02-31")).toBe(false)
    expect(isCalendarDate("2026-02-28")).toBe(true)
    expect(isCalendarDate("2026-13-01")).toBe(false)
    const p = parseCostDraft({ amount: "1000", effectiveFrom: "2026-02-31" })
    expect(!p.ok && p.problems).toContain("date-malformed")
  })
})

/** SKU 하나 · 주문 하나 · 품목 하나를 손으로 세운다. 어느 프로파일도 품목을 안 넣는다. */
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
  const skus: readonly [string, string][] = [["sku-1", "SKU-0001"], ["sku-2", "SKU-0002"]]
  for (const [id, code] of skus) {
    await db
      .prepare(
        `INSERT INTO sku (id, library_id, product_id, code, name, status, created_at, updated_at)
         VALUES (?,?,?,?,?,'ACTIVE',?,?)`,
      )
      .run(id, LIB, "prd-1", code, code, NOW, NOW)
    /**
     * ★ 품목은 SKU를 **리스팅을 통해** 안다 ★ `fact_order_item.sku_id`를 직접 채우지
     * 않는 것이 설계다(`snapshot.ts`의 `ITEM_JOIN`). 그래서 시험도 그 경로로 세운다 —
     * 여기서 `sku_id`를 박아 넣으면 실제와 다른 배관을 시험하게 된다.
     */
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

/**
 * 주문 한 건 + 품목 한 줄.
 *
 * `sku`가 `null`이면 **리스팅이 아직 SKU에 안 이어진** 품목이다 — «SKU가 없는
 * 품목»이 아니라 «연결이 안 된 품목»이고, 그 둘은 처방이 다르다(`cogs-unlinked`).
 * `period`를 주면 기간 집계 행이 된다 (조건 2).
 */
async function addOrderItem(
  db: ReturnType<typeof openNodeDriver>,
  o: {
    id: string
    on: string
    amount: number
    sku: string | null
    qty: number
    period?: string
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fact_order (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                               source_key, ordered_at, status, total_amount, date_precision, period_end)
       VALUES (?,'conn-x','b1',?,?,'x/order/line@1',?,?,'PAID',?,?,?)`,
    )
    .run(
      o.id, LIB, NOW, o.id, o.on, o.amount,
      o.period === undefined ? null : "period",
      o.period ?? null,
    )

  // 연결이 없는 품목은 **리스팅은 있고 sku_id만 비어 있는** 모양으로 만든다.
  let listingId: string | null = null
  if (o.sku === null) {
    listingId = listingIdFor("conn-x", `orphan-${o.id}`)
    await db
      .prepare(
        `INSERT INTO marketplace_listing
           (id, library_id, connection_id, listing_key, title, grain, sku_id, link_state, updated_at)
         VALUES (?,?,'conn-x',?,?,'option', NULL, 'unlinked', ?)`,
      )
      .run(listingId, LIB, `orphan-${o.id}`, `미연결 ${o.id}`, NOW)
  } else {
    listingId = listingIdFor("conn-x", o.sku)
  }

  await db
    .prepare(
      `INSERT INTO fact_order_item (id, connection_id, batch_id, library_id, updated_at,
                                    mapping_version, source_key, order_id, listing_id, quantity, gross_amount)
       VALUES (?,'conn-x','b1',?,?,'x/order/line@1',?,?,?,?,?)`,
    )
    .run(`${o.id}-i`, LIB, NOW, `${o.id}-i`, o.id, listingId, o.qty, o.amount)
}

describe("★ TS와 SQL이 같은 답을 낸다 — 규칙이 두 벌이 아니다 ★", () => {
  it("costAt(화면)과 costAtSql(손익)이 같은 줄을 고른다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      // 한 SKU에 이력 셋 — 경계를 넘나드는 판매일로 물어본다.
      for (const [amt, from] of [[1000, "2026-06-01"], [1200, "2026-07-10"], [1500, "2026-08-01"]] as const) {
        await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: amt, effectiveFrom: from, now: NOW })
      }

      const raw = await repo.costHistory(LIB, "sku-1")
      const history: CostEntry[] = raw.map((r) => e(Number(r["amount"]), String(r["effective_from"])))

      const sql = costAtSql({ libraryId: "?", skuId: "?", kind: "'COGS'", on: "?" })
      for (const on of ["2026-05-31", "2026-06-01", "2026-07-09", "2026-07-10", "2026-07-31T23:59:59", "2026-08-01"]) {
        const fromSql = await db.prepare(`SELECT ${sql} AS v`).get(LIB, "sku-1", on)
        const a = fromSql?.["v"] == null ? null : Number(fromSql["v"])
        expect(a, `${on}에서 두 답이 갈렸다`).toBe(costAt(history, "COGS", on))
      }
    } finally {
      await db.close()
    }
  })
})

describe("④ 원가 → 손익", () => {
  it("품목 × 그날 원가가 매입원가가 된다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-07-01", now: NOW })
      await repo.addCost({ libraryId: LIB, skuId: "sku-2", kind: "COGS", amount: 300, effectiveFrom: "2026-07-01", now: NOW })
      await addOrderItem(db, { id: "o1", on: "2026-07-05", amount: 5000, sku: "sku-1", qty: 2 })
      await addOrderItem(db, { id: "o2", on: "2026-07-20", amount: 900, sku: "sku-2", qty: 3 })

      const snap = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(snap.pnl.cogs, "1000×2 + 300×3").toBe(2_900)
      expect(snap.cogsBasis.itemsWithoutCost).toBe(0)
      // 원가가 손익에 실제로 들어갔는지 — 기여이익이 그만큼 줄어야 한다
      expect(snap.pnl.productContribution).toBe(5_900 - 2_900)
    } finally {
      await db.close()
    }
  })

  it("★ 원가를 모르는 품목은 0으로 세지 않는다 — 빠지고, 빠졌다고 말한다 ★", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-07-01", now: NOW })
      await addOrderItem(db, { id: "o1", on: "2026-07-05", amount: 5000, sku: "sku-1", qty: 2 })
      await addOrderItem(db, { id: "o2", on: "2026-07-20", amount: 900, sku: "sku-2", qty: 3 })

      const snap = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(snap.pnl.cogs, "sku-2는 원가를 모르므로 빠진다").toBe(2_000)
      expect(snap.cogsBasis.items).toBe(2)
      expect(snap.cogsBasis.itemsWithoutLink, "둘 다 연결은 돼 있다").toBe(0)
      expect(snap.cogsBasis.itemsWithoutCost).toBe(1)
      expect(snap.cogsBasis.qtyWithoutCost, "크기를 말할 수 있어야 한다").toBe(3)

      const gap = pnlGaps(snap).find((g) => g.id === "cogs-missing")
      expect(gap, "일부만 빠진 것을 말하지 않으면 조용한 거짓이다").toBeDefined()
      expect(gap!.state).toBe("일부 미입력")
      // 절반만 넣은 원가가 «전부 넣은 것»처럼 보이는 자리라 warn이다
      expect(gap!.tone).toBe("warn")
    } finally {
      await db.close()
    }
  })

  it("판매일 이후에 등록한 원가는 그 판매에 붙지 않는다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      await new Repository(db).addCost({
        libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-08-01", now: NOW,
      })
      await addOrderItem(db, { id: "o1", on: "2026-07-05", amount: 5000, sku: "sku-1", qty: 2 })

      const snap = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(snap.pnl.cogs, "8월부터인 원가가 7월 판매에 소급되면 안 된다").toBe(0)
      expect(snap.cogsBasis.itemsWithoutCost).toBe(1)
    } finally {
      await db.close()
    }
  })
})

describe("★ 연결과 원가는 다른 부재다 — 처방이 다르면 다른 단서다 ★", () => {
  it("리스팅이 SKU에 안 이어지면 «원가 미입력»이 아니라 «연결 안 됨»이다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      await new Repository(db).addCost({
        libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-07-01", now: NOW,
      })
      await addOrderItem(db, { id: "o1", on: "2026-07-05", amount: 5000, sku: "sku-1", qty: 2 })
      await addOrderItem(db, { id: "o2", on: "2026-07-06", amount: 900, sku: null, qty: 1 })

      const snap = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(snap.cogsBasis.itemsWithoutLink).toBe(1)
      expect(snap.cogsBasis.itemsWithoutCost, "연결 안 된 것을 원가 미상으로 세지 않는다").toBe(0)

      const ids = pnlGaps(snap).map((g) => g.id)
      expect(ids).toContain("cogs-unlinked")
      // 원가는 이어진 것 전부에 들어 있으므로 «미입력»은 뜨지 않아야 한다
      expect(ids).not.toContain("cogs-missing")
    } finally {
      await db.close()
    }
  })

  it("★ 나중에 연결하면 과거 판매에 원가가 **소급해서** 붙는다 ★", async () => {
    // 적재 시점에 sku_id를 박아 넣었다면 여기서 0이 나온다 — 그게 이 설계가
    // 피하려던 두 번째 함정이다.
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      await new Repository(db).addCost({
        libraryId: LIB, skuId: "sku-2", kind: "COGS", amount: 700, effectiveFrom: "2026-07-01", now: NOW,
      })
      await addOrderItem(db, { id: "o1", on: "2026-07-05", amount: 900, sku: null, qty: 3 })

      expect((await loadPnlSnapshot(db, LIB, PERIOD)).pnl.cogs, "연결 전에는 0").toBe(0)

      // 사람이 상품 연결 화면에서 이었다 — Fact를 손대지 않는다
      await db
        .prepare(
          `UPDATE marketplace_listing SET sku_id = ?, link_state = 'linked', linked_by = 'user', linked_at = ?
            WHERE listing_key = ?`,
        )
        .run("sku-2", NOW, "orphan-o1")

      const after = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(after.pnl.cogs, "700 × 3 — 이미 들어온 판매에 소급해서 붙는다").toBe(2_100)
      expect(after.cogsBasis.itemsWithoutLink).toBe(0)
    } finally {
      await db.close()
    }
  })

  it("★ 수량 0인 품목은 «원가 미상»의 모집단이 아니다 ★", async () => {
    // 쿠팡 제트는 안 팔린 옵션도 행으로 내보낸다(실측 147행 중 103행이 수량 0).
    // 그걸 세면 게이지가 거짓으로 빨개진다 — 사실은 지우지 않고 세는 자리에서 가른다.
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      await addOrderItem(db, { id: "o1", on: "2026-07-05", amount: 0, sku: "sku-1", qty: 0 })
      await addOrderItem(db, { id: "o2", on: "2026-07-06", amount: 900, sku: "sku-2", qty: 1 })

      const snap = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(snap.cogsBasis.items, "판 것만 센다").toBe(1)
      expect(snap.cogsBasis.itemsWithoutCost).toBe(1)
      // 그래도 **행은 남아 있다** — 사실을 지워서 경보를 끄지 않는다 (§22)
      const all = await db.prepare(`SELECT COUNT(*) AS n FROM active_order_item`).get()
      expect(Number(all?.["n"]), "0개 팔린 품목도 적재돼 있다").toBe(2)
    } finally {
      await db.close()
    }
  })
})

describe("★ 조건 2 — 기간 집계의 원가 근사를 조용히 넘기지 않는다 ★", () => {
  it("기간 안에서 원가가 바뀌면 말한다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-07-01", now: NOW })
      // 기간 한복판에서 원가가 올랐다 — 기간 시작일 단가로 계산되므로 근사가 된다
      await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1400, effectiveFrom: "2026-07-15", now: NOW })
      await addOrderItem(db, {
        id: "o1", on: "2026-07-01", amount: 50_000, sku: "sku-1", qty: 10, period: "2026-07-31",
      })

      const snap = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(snap.pnl.cogs, "기간 시작일 단가 1000 × 10").toBe(10_000)
      expect(snap.cogsBasis.periodApproxItems).toBe(1)

      const gap = pnlGaps(snap).find((g) => g.id === "cogs-period-approx")
      expect(gap, "근사를 말하지 않으면 조용한 근사가 된다").toBeDefined()
      expect(gap!.tone).toBe("warn")
    } finally {
      await db.close()
    }
  })

  it("기간 안에서 원가가 안 바뀌면 **아무 말도 하지 않는다**", async () => {
    // 근사가 실재하지 않는데 경고하면 그건 늑대 소년이다 — 있을 때만 뜬다.
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      await new Repository(db).addCost({
        libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-06-01", now: NOW,
      })
      await addOrderItem(db, {
        id: "o1", on: "2026-07-01", amount: 50_000, sku: "sku-1", qty: 10, period: "2026-07-31",
      })

      const snap = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(snap.cogsBasis.periodApproxItems).toBe(0)
      expect(pnlGaps(snap).map((g) => g.id)).not.toContain("cogs-period-approx")
    } finally {
      await db.close()
    }
  })

  it("기간 **밖에서** 바뀐 원가는 근사가 아니다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-07-01", now: NOW })
      // 기간이 끝난 **다음 날**부터 오른 원가 — 이 기간의 계산에 영향이 없다
      await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1400, effectiveFrom: "2026-08-01", now: NOW })
      await addOrderItem(db, {
        id: "o1", on: "2026-07-01", amount: 50_000, sku: "sku-1", qty: 10, period: "2026-07-31",
      })
      expect((await loadPnlSnapshot(db, LIB, PERIOD)).cogsBasis.periodApproxItems).toBe(0)
    } finally {
      await db.close()
    }
  })
})

describe("★ «원가 0원»의 뜻이 셋이라 갈라 말한다 ★", () => {
  it("품목이 없으면 «미입력»이 아니라 «적용 불가»다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      // 주문 헤더만 있고 품목이 없다 — **오늘 실제 DB의 모양**이다.
      await db
        .prepare(
          `INSERT INTO fact_order (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                                   source_key, ordered_at, status, total_amount)
           VALUES ('o1','conn-x','b1',?,?,'x/order/line@1','o1','2026-07-05','PAID',5000)`,
        )
        .run(LIB, NOW)

      const snap = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(snap.cogsBasis.hasOrderItems).toBe(false)
      const gaps = pnlGaps(snap)
      const un = gaps.find((g) => g.id === "cogs-unappliable")
      expect(un, "원가를 넣어도 안 움직인다는 사실을 말해야 한다").toBeDefined()
      expect(un!.tone, "사용자가 자기 몫을 다 해도 숫자가 틀려 있다").toBe("warn")
      // 둘을 함께 말하면 «원가를 넣으세요»가 못 지킬 숙제가 된다
      expect(gaps.find((g) => g.id === "cogs-missing")).toBeUndefined()
    } finally {
      await db.close()
    }
  })

  it("★ 원가를 넣는 순간 옛 문장이 거짓이 되던 자리 ★", async () => {
    // 전에는 `pnl.cogs === 0`이면 무조건 *"cost_history가 비어 있다"*라고 했다.
    // 원가를 넣어도 cogs가 0인 상태를 만들어, 그 문장이 더는 나오지 않는지 본다.
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      await new Repository(db).addCost({
        libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-07-01", now: NOW,
      })
      await db
        .prepare(
          `INSERT INTO fact_order (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                                   source_key, ordered_at, status, total_amount)
           VALUES ('o1','conn-x','b1',?,?,'x/order/line@1','o1','2026-07-05','PAID',5000)`,
        )
        .run(LIB, NOW)

      const snap = await loadPnlSnapshot(db, LIB, PERIOD)
      expect(snap.pnl.cogs).toBe(0)
      for (const g of pnlGaps(snap)) {
        expect(g.detail, "비어 있지 않은데 비었다고 말하면 안 된다").not.toContain("cost_history가 비어 있다")
      }
    } finally {
      await db.close()
    }
  })
})

describe("정정 — 같은 날짜는 묻고 나서 덮는다", () => {
  it("같은 (SKU · 종류 · 적용일)이면 **넣지 않고** 지금 값을 돌려준다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      const first = await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-07-01", now: NOW })
      expect(first.inserted).toBe(true)

      const again = await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1200, effectiveFrom: "2026-07-01", now: NOW })
      expect(again.inserted, "조용히 덮으면 오타 한 번이 이력을 지운다").toBe(false)
      expect(again.replaced).toBe(false)
      expect(again.previous, "무엇이 덮이는지 사람에게 보여줄 수 있어야 한다").toBe(1000)

      const rows = await repo.costHistory(LIB, "sku-1")
      expect(rows.length, "거부됐으니 줄이 늘지 않는다").toBe(1)
      expect(Number(rows[0]!["amount"])).toBe(1000)
    } finally {
      await db.close()
    }
  })

  it("replace를 켜면 그 줄을 덮는다 — 새 줄이 생기지 않는다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-07-01", now: NOW })
      const r = await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1200, effectiveFrom: "2026-07-01", now: NOW, replace: true })
      expect(r.replaced).toBe(true)
      expect(r.previous).toBe(1000)

      const rows = await repo.costHistory(LIB, "sku-1")
      expect(rows.length).toBe(1)
      expect(Number(rows[0]!["amount"])).toBe(1200)
    } finally {
      await db.close()
    }
  })

  it("다른 날짜면 **새 줄**이다 — 그게 이력이다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-07-01", now: NOW })
      await repo.addCost({ libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1200, effectiveFrom: "2026-08-01", now: NOW })
      expect((await repo.costHistory(LIB, "sku-1")).length).toBe(2)
    } finally {
      await db.close()
    }
  })

  it("저장 경로가 화면 없이도 막는다 — 하네스·CLI가 우회한다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const repo = new Repository(db)
      const bad = { libraryId: LIB, skuId: "sku-1", kind: "COGS", effectiveFrom: "2026-07-01", now: NOW }
      await expect(repo.addCost({ ...bad, amount: -1 })).rejects.toThrow(/0보다 작을 수 없다/)
      await expect(repo.addCost({ ...bad, amount: 1.5 })).rejects.toThrow(/정수/)
      await expect(repo.addCost({ ...bad, amount: 100, effectiveFrom: "8/1" })).rejects.toThrow(/YYYY-MM-DD/)
    } finally {
      await db.close()
    }
  })
})

describe("③ 상품 화면 조회", () => {
  it("원가가 없는 SKU는 «미상»으로 남고 게이지의 분모는 SKU 수다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      await new Repository(db).addCost({
        libraryId: LIB, skuId: "sku-1", kind: "COGS", amount: 1000, effectiveFrom: "2026-07-01", now: NOW,
      })

      const v = await loadProductRows(db, LIB, PERIOD, "2026-08-14")
      expect(v.total).toBe(2)
      expect(v.costed, "둘 중 하나만 넣었다").toBe(1)
      const byId = new Map(v.rows.map((r) => [r.skuId, r]))
      expect(byId.get("sku-1")!.cost).toBe(1000)
      expect(byId.get("sku-1")!.costFrom).toBe("2026-07-01")
      expect(byId.get("sku-2")!.cost, "0이 아니라 null이다").toBeNull()
    } finally {
      await db.close()
    }
  })

  it("품목이 없으면 판매 수량은 0이 아니라 «미상»이다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await seed(db)
      const v = await loadProductRows(db, LIB, PERIOD, "2026-08-14")
      expect(v.hasOrderItems).toBe(false)
      expect(v.rows.every((r) => r.soldQty === null), "«0개 팔림»과 «데이터 없음»은 다르다").toBe(true)

      await addOrderItem(db, { id: "o1", on: "2026-07-05", amount: 5000, sku: "sku-1", qty: 2 })
      const after = await loadProductRows(db, LIB, PERIOD, "2026-08-14")
      expect(after.hasOrderItems).toBe(true)
      const byId = new Map(after.rows.map((r) => [r.skuId, r]))
      expect(byId.get("sku-1")!.soldQty).toBe(2)
      expect(byId.get("sku-2")!.soldQty, "이제는 진짜로 0개 팔린 것이다").toBe(0)
    } finally {
      await db.close()
    }
  })
})
