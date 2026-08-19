/**
 * 고정비·운영비 — **손익 3층의 마지막 줄이 항등식이 아니게 된다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 파일이 지키는 것 ★
 *
 * `snapshot.ts`가 `prorateFixed(base.fixedMonthly ?? 0, period)`를 부르는데
 * **`fixedMonthly`를 넘기는 코드가 전 호출부 20곳 중 0곳**이었다. 그래서:
 *
 *   채널 기여이익 − 고정비(늘 0) = 회사 순이익      → 두 줄이 늘 같은 수
 *
 * 「입구가 있다」와 「입구가 쓰인다」는 다르고, 안 쓰이는 입구는 없는 것보다
 * 나쁘다 — 있으니까 됐다고 믿게 만든다. 그 입구를 없애고 표를 놓았다.
 *
 * 가장 중요한 단언은 **두 줄이 갈라지는가**이고, 그다음이 **과거가 안 바뀌는가**다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { listingIdFor, Repository } from "../src/core/store/repository.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { loadProfitRows } from "../src/core/profit/rows.js"
import { pnlGaps } from "../src/core/profit/gaps.js"

const LIB = "lib-1"
const NOW = "2026-08-19T00:00:00"
/** 7월 = 31일. 일할 안분이 나누어떨어지지 않는 달이라 반올림도 함께 잰다. */
const JULY = { from: "2026-07-01", to: "2026-07-31" }

let db: Driver
let repo: Repository

beforeEach(async () => {
  db = openNodeDriver()
  await migrate(db)
  repo = new Repository(db)
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
       VALUES ('sku-1',?,'prd-1','SKU-1','SKU-1','ACTIVE',?,?)`,
    )
    .run(LIB, NOW, NOW)
  await db
    .prepare(
      `INSERT INTO marketplace_listing
         (id, library_id, connection_id, listing_key, title, grain, sku_id, link_state, linked_at, linked_by, updated_at)
       VALUES (?,?,'conn-x','sku-1','SKU-1','option','sku-1','linked',?,'user',?)`,
    )
    .run(listingIdFor("conn-x", "sku-1"), LIB, NOW, NOW)
  await db
    .prepare(
      `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes, container_format,
                          mapping_version, started_at, committed_at, status, row_count)
       VALUES ('b1',?,'conn-x','손으로 세운 것',0,'xlsx','x/order/line@1',?,?,'committed',1)`,
    )
    .run(LIB, NOW, NOW)
})

/** 주문 한 건 + 품목 한 줄. 운영비 요율이 곱할 «주문 수»와 «개수»가 여기서 생긴다. */
async function order(id: string, on: string, amount: number, qty: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fact_order (id, connection_id, batch_id, library_id, updated_at, mapping_version,
                               source_key, ordered_at, status, total_amount)
       VALUES (?,'conn-x','b1',?,?,'x/order/line@1',?,?,'PAID',?)`,
    )
    .run(id, LIB, NOW, id, on, amount)
  await db
    .prepare(
      `INSERT INTO fact_order_item (id, connection_id, batch_id, library_id, updated_at,
                                    mapping_version, source_key, order_id, listing_id, quantity, gross_amount)
       VALUES (?,'conn-x','b1',?,?,'x/order/line@1',?,?,?,?,?)`,
    )
    .run(`${id}-i`, LIB, NOW, `${id}-i`, id, listingIdFor("conn-x", "sku-1"), qty, amount)
}

const fixed = (label: string, amount: number, from: string) =>
  repo.setOverhead({
    libraryId: LIB,
    kind: "FIXED",
    basis: "MONTH",
    label,
    amount,
    effectiveFrom: from,
    now: NOW,
  })

describe("고정비 — 마지막 층이 열린다", () => {
  it("★★ 넣기 전에는 **채널 기여이익 = 회사 순이익**이었다 ★★", async () => {
    await order("o1", "2026-07-10", 1_000_000, 1)
    const s = await loadPnlSnapshot(db, LIB, JULY)
    // 이게 이 파일이 없애려는 바로 그 상태다. 「고정비 0원인 회사」가 아니라
    // 「고정비를 넣을 자리가 없는 앱」이었다.
    expect(s.pnl.fixed).toBe(0)
    expect(s.pnl.netProfit).toBe(s.pnl.channelContribution)
  })

  it("★★ 넣으면 두 줄이 갈라진다 — 이게 사용자가 겪는 사실이다 ★★", async () => {
    await order("o1", "2026-07-10", 1_000_000, 1)
    const before = await loadPnlSnapshot(db, LIB, JULY)

    await fixed("사무실 임대료", 1_800_000, "2026-01-01")
    await fixed("인건비", 6_200_000, "2026-01-01")
    const after = await loadPnlSnapshot(db, LIB, JULY)

    // 7월 전체를 조회하므로 월액이 그대로 들어온다 (31/31일)
    expect(after.pnl.fixed).toBe(8_000_000)
    expect(after.pnl.netProfit).toBe(after.pnl.channelContribution - 8_000_000)
    expect(after.pnl.netProfit).toBeLessThan(before.pnl.netProfit)
    // 위층은 흔들리면 안 된다 — 고정비는 상품에도 채널에도 붙지 않는다
    expect(after.pnl.productContribution).toBe(before.pnl.productContribution)
    expect(after.pnl.channelContribution).toBe(before.pnl.channelContribution)
  })

  it("기간이 짧으면 **일할로** 들어온다 — 8/31 고정이 아니다", async () => {
    await order("o1", "2026-07-05", 1_000_000, 1)
    await fixed("임대료", 3_100_000, "2026-01-01")
    // 7월 1~8일 = 8일 / 31일
    const s = await loadPnlSnapshot(db, LIB, { from: "2026-07-01", to: "2026-07-08" })
    expect(s.pnl.fixed).toBe(800_000)
  })

  it("★ 적용일이 과거를 지킨다 — 오늘 올린 임대료가 지난달을 바꾸지 않는다 ★", async () => {
    await order("o7", "2026-07-10", 1_000_000, 1)
    await order("o8", "2026-08-10", 1_000_000, 1)
    await fixed("임대료", 1_800_000, "2026-01-01")
    await fixed("임대료", 2_200_000, "2026-08-01") // 8월부터 인상

    const july = await loadPnlSnapshot(db, LIB, JULY)
    const aug = await loadPnlSnapshot(db, LIB, { from: "2026-08-01", to: "2026-08-31" })
    expect(july.pnl.fixed, "7월이 8월 임대료로 계산됐다").toBe(1_800_000)
    expect(aug.pnl.fixed).toBe(2_200_000)
  })

  it("★ 0원은 «지움»이다 — 사무실을 뺀 달부터 사라지고 그 전은 남는다 ★", async () => {
    await order("o7", "2026-07-10", 1_000_000, 1)
    await order("o8", "2026-08-10", 1_000_000, 1)
    await fixed("임대료", 1_800_000, "2026-01-01")
    await fixed("임대료", 0, "2026-08-01")

    expect((await loadPnlSnapshot(db, LIB, JULY)).pnl.fixed).toBe(1_800_000)
    expect(
      (await loadPnlSnapshot(db, LIB, { from: "2026-08-01", to: "2026-08-31" })).pnl.fixed,
    ).toBe(0)
    // 행을 지운 게 아니라 0원을 얹은 것이다 — 화면이 「임대료 0원」을 그려야
    // 사용자가 자기가 그렇게 넣었다는 것을 안다
    const rows = await repo.overheads(LIB, "FIXED", "2026-08-15")
    expect(rows.map((r) => [r.label, r.amount])).toEqual([["임대료", 0]])
  })

  it("★ 상품별 손익에는 안 들어간다 — 배분하지 않는 것이 정의다 ★", async () => {
    await order("o1", "2026-07-10", 1_000_000, 1)
    const before = await loadProfitRows(db, LIB, JULY)
    await fixed("임대료", 1_800_000, "2026-01-01")
    const after = await loadProfitRows(db, LIB, JULY)

    // 상품별 표는 **한 칸도 움직이지 않는다.** 고정비를 상품에 나눠 붙이면
    // 「많이 판 상품이 임대료를 많이 낸다」가 되는데 그건 사실이 아니다.
    expect(after).toEqual(before)

    // 대신 회사 순이익에서만 빠진다 — 상품 손익의 합이 회사 순이익이 아닌 이유다
    const snap = await loadPnlSnapshot(db, LIB, JULY)
    expect(snap.pnl.fixed).toBe(1_800_000)
    expect(snap.pnl.netProfit).toBe(snap.pnl.channelContribution - 1_800_000)
  })

  it("같은 항목·같은 적용일을 다시 저장하면 **덮는다** — 되묻지 않는다", async () => {
    await fixed("임대료", 1_800_000, "2026-01-01")
    await fixed("임대료", 1_900_000, "2026-01-01")
    const rows = await repo.overheads(LIB, "FIXED", "2026-07-01")
    expect(rows).toHaveLength(1)
    expect(rows[0]!.amount).toBe(1_900_000)
  })
})

describe("운영비 — 금액이 아니라 요율이다", () => {
  it("주문당·개당 요율이 수량을 만나 금액이 된다", async () => {
    await order("o1", "2026-07-10", 500_000, 3)
    await order("o2", "2026-07-11", 500_000, 2)
    await repo.setOverhead({
      libraryId: LIB, kind: "OPS", basis: "ORDER", label: "포장 박스",
      amount: 780, effectiveFrom: "2026-01-01", now: NOW,
    })
    await repo.setOverhead({
      libraryId: LIB, kind: "OPS", basis: "UNIT", label: "택배 부자재",
      amount: 210, effectiveFrom: "2026-01-01", now: NOW,
    })
    const s = await loadPnlSnapshot(db, LIB, JULY)
    // 주문 2건 × 780 + 개수 5개 × 210 = 1,560 + 1,050
    expect(s.pnl.ops).toBe(2_610)
  })

  it("★ 운영비는 **상품 기여이익**에서 빠진다 — 고정비와 층이 다르다 ★", async () => {
    await order("o1", "2026-07-10", 1_000_000, 1)
    const before = await loadPnlSnapshot(db, LIB, JULY)
    await repo.setOverhead({
      libraryId: LIB, kind: "OPS", basis: "ORDER", label: "포장",
      amount: 1_000, effectiveFrom: "2026-01-01", now: NOW,
    })
    const after = await loadPnlSnapshot(db, LIB, JULY)
    expect(before.pnl.productContribution - after.pnl.productContribution).toBe(1_000)
  })
})

describe("종류와 basis의 짝 — 잘못된 조합을 저장에서 막는다", () => {
  it("고정비에 «주문당»을 줄 수 없다 — 그건 정의상 운영비다", async () => {
    await expect(
      repo.setOverhead({
        libraryId: LIB, kind: "FIXED", basis: "ORDER", label: "x",
        amount: 100, effectiveFrom: "2026-01-01", now: NOW,
      }),
    ).rejects.toThrow(/고정비는 월 단위만/)
  })

  it("★ 운영비에 «월 정액»을 줄 수 없다 — 안분 기준이 데이터에 없다 ★", async () => {
    // 월 정액 3PL 계약을 상품에 배분하려면 «매출 비례? 개수 비례?»를 정해야 한다.
    // 아무 기준이나 고르면 상품별 손익이 조용히 그 가정을 품는다.
    await expect(
      repo.setOverhead({
        libraryId: LIB, kind: "OPS", basis: "MONTH", label: "3PL 정액",
        amount: 100, effectiveFrom: "2026-01-01", now: NOW,
      }),
    ).rejects.toThrow(/운영비는 주문당·개당만/)
  })

  it("적용일 형식과 금액을 저장이 한 번 더 막는다", async () => {
    const bad = (patch: Record<string, unknown>) =>
      repo.setOverhead({
        libraryId: LIB, kind: "FIXED", basis: "MONTH", label: "임대료",
        amount: 100, effectiveFrom: "2026-01-01", now: NOW, ...patch,
      } as never)
    await expect(bad({ effectiveFrom: "2026-1-1" })).rejects.toThrow(/YYYY-MM-DD/)
    await expect(bad({ amount: -1 })).rejects.toThrow(/0보다 작을 수 없다/)
    await expect(bad({ amount: 1.5 })).rejects.toThrow(/정수/)
    await expect(bad({ label: "  " })).rejects.toThrow(/비어 있다/)
  })
})

describe("★ 「안 넣음」도 입력이다 (§22) ★", () => {
  it("선언이 없으면 **미선언**이다 — 0원과 다르다", async () => {
    expect(await repo.overheadStance(LIB, "FIXED")).toBeNull()
  })

  it("«두지 않는다»를 선언하면 이유와 함께 남는다", async () => {
    await repo.setOverheadStance({
      libraryId: LIB, kind: "FIXED", stance: "none", reason: "in-cogs", now: NOW,
    })
    expect(await repo.overheadStance(LIB, "FIXED")).toEqual({
      stance: "none",
      reason: "in-cogs",
    })
    // 운영비 쪽은 여전히 미선언 — 종류별로 따로 답한다
    expect(await repo.overheadStance(LIB, "OPS")).toBeNull()
  })

  it("선언을 바꾸면 덮고, 거두면 다시 미선언이 된다", async () => {
    await repo.setOverheadStance({ libraryId: LIB, kind: "FIXED", stance: "later", now: NOW })
    expect((await repo.overheadStance(LIB, "FIXED"))?.stance).toBe("later")
    await repo.setOverheadStance({
      libraryId: LIB, kind: "FIXED", stance: "none", reason: "not-applicable", now: NOW,
    })
    expect((await repo.overheadStance(LIB, "FIXED"))?.stance).toBe("none")
    await repo.clearOverheadStance(LIB, "FIXED")
    expect(await repo.overheadStance(LIB, "FIXED")).toBeNull()
  })
})

describe("★ 진단이 셋으로 갈린다 — 잔소리가 죽으면 옆의 경고도 죽는다 ★", () => {
  const gap = async (id: string) =>
    pnlGaps(await loadPnlSnapshot(db, LIB, JULY)).find((g) => g.id === id)

  beforeEach(async () => {
    await order("o1", "2026-07-10", 1_000_000, 1)
  })

  it("미선언 — **이때만 묻는다**. 두 줄이 같은 이유를 말한다", async () => {
    const g = await gap("overhead-missing")
    expect(g?.state).toBe("미입력")
    expect(g?.detail, "두 줄이 같은 수인 이유를 말하지 않는다").toContain("채널 기여이익과 같습니다")
  })

  it("«두지 않는다» 선언 — 재촉하지 않고 이유를 되짚어 준다", async () => {
    await repo.setOverheadStance({
      libraryId: LIB, kind: "FIXED", stance: "none", reason: "in-cogs", now: NOW,
    })
    const g = await gap("overhead-missing")
    expect(g?.state).toBe("두지 않음")
    expect(g?.note).toContain("원가에 이미 포함")
    // 원가에 포함이라고 한 사람에게는 **이중 차감**을 미리 경고한다
    expect(g?.detail).toContain("두 번 빠집니다")
  })

  it("«나중에» 선언 — 사실만 남기고 조용히 기다린다", async () => {
    await repo.setOverheadStance({ libraryId: LIB, kind: "FIXED", stance: "later", now: NOW })
    expect((await gap("overhead-missing"))?.state).toBe("나중에")
  })

  it("★ 고정비가 실제로 들어오면 줄이 **사라진다** ★", async () => {
    await fixed("임대료", 1_800_000, "2026-01-01")
    expect(await gap("overhead-missing")).toBeUndefined()
  })

  it("★ 운영비는 따로 센다 — 고정비를 넣었다고 메워지지 않는다 ★", async () => {
    await fixed("임대료", 1_800_000, "2026-01-01")
    expect(await gap("overhead-missing"), "고정비 줄은 사라져야 한다").toBeUndefined()
    expect((await gap("ops-missing"))?.state, "운영비 줄까지 함께 사라졌다").toBe("미입력")
  })

  it("운영비도 «두지 않는다»를 선언하면 조용해진다", async () => {
    await repo.setOverheadStance({
      libraryId: LIB, kind: "OPS", stance: "none", reason: "in-cogs", now: NOW,
    })
    expect(await gap("ops-missing")).toBeUndefined()
  })
})
