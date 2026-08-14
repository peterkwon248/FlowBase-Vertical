/**
 * 가져오기 기록 — **되돌리기 버튼의 3상태가 `assertUndoable`과 같은 답을 내는가.**
 *
 * 화면이 «되돌릴 수 있다»를 스스로 계산하면 리포지토리의 판정과 두 벌이 되고,
 * 그 둘은 언젠가 갈린다 — 버튼은 활성인데 누르면 거부되거나, 그 반대가 된다.
 * 여기서는 **두 답이 같은지**를 직접 대조한다.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository, type BatchOpen } from "../src/core/store/repository.js"
import { loadHistoryRows, type HistoryRow } from "../src/core/history/rows.js"
import { entityLabel, stamp, statusText, undoConfirm, blockedWhy, historyVals } from "../src/app/history.js"
import { emptyVals } from "../src/app/generated/vals.js"
import type { DocType } from "../src/core/coverage/index.js"

const LIB = "lib-1"
const CONN = "conn-1"

/** 하네스는 팩 레지스트리를 못 쓴다 — 여기서는 성격을 직접 준다. */
const resolve = (mv: string): DocType | null =>
  mv.includes("/order/") ? "order" : mv.includes("/settlement/") ? "settlement" : null

async function seed(db: Driver): Promise<void> {
  await migrate(db)
  await db.prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`).run(LIB, "기본", "t0")
  await db
    .prepare(
      `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(CONN, LIB, "kr-marketplace", "mk-a", "테스트 채널", "CONNECTED", "t0", "t0")
}

const batch = (id: string, file: string, at: string): BatchOpen => ({
  id,
  libraryId: LIB,
  connectionId: CONN,
  sourceName: file,
  sourceBytes: 100,
  containerFormat: "xlsx",
  mappingVersion: "mk-a/order/order-line@1",
  startedAt: at,
})

const order = (id: string, sk: string, amt: number) => ({
  id,
  source_key: sk,
  ordered_at: "2026-07-10",
  status: "PAID",
  total_amount: amt,
})

describe("가져오기 기록 — 3상태", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver()
    await seed(db)
    repo = new Repository(db)
  })

  const load = (): Promise<readonly HistoryRow[]> => loadHistoryRows(db, LIB, resolve)
  const find = (rows: readonly HistoryRow[], id: string): HistoryRow =>
    rows.find((r) => r.id === id)!

  it("갓 넣은 배치는 되돌릴 수 있다", async () => {
    const a = batch("b-A", "7월.xlsx", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [order("o-1", "SK-1", 1000)])
    await repo.commitBatch("b-A", "t1")

    const r = find(await load(), "b-A")
    expect(r.undo).toBe("can")
    expect(r.blockedBy).toBeNull()
    expect(r.fetched).toBe(1)
    expect(r.created, "신규 삽입 — 되돌리면 사라진다").toBe(1)
    expect(r.updated).toBe(0)
  })

  it("★ 덮인 배치는 잠기고, 무엇이 덮었는지 파일 이름으로 말한다 ★", async () => {
    const a = batch("b-A", "7월.xlsx", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [order("o-1", "SK-1", 1000)])
    await repo.commitBatch("b-A", "t1")

    const b = batch("b-B", "7월 다시.xlsx", "t2")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [order("o-1", "SK-1", 1500)])
    await repo.commitBatch("b-B", "t2")

    const rows = await load()
    const oldOne = find(rows, "b-A")
    expect(oldOne.undo).toBe("blocked")
    expect(oldOne.blockedBy?.sourceName, "batch id가 아니라 파일 이름이다").toBe("7월 다시.xlsx")

    const newOne = find(rows, "b-B")
    expect(newOne.undo, "덮은 쪽은 되돌릴 수 있다").toBe("can")
    expect(newOne.created, "새로 넣은 행은 없다 — 전부 갱신이다").toBe(0)
    expect(newOne.updated).toBe(1)
  })

  /** ★ 화면 판정과 리포지토리 판정이 같은 답을 내는가 — 이 대조가 요점이다 ★ */
  it("«잠김»이라 말한 배치는 실제로 거부되고, «가능»이라 한 배치는 실제로 된다", async () => {
    const a = batch("b-A", "7월.xlsx", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [order("o-1", "SK-1", 1000)])
    await repo.commitBatch("b-A", "t1")

    const b = batch("b-B", "7월 다시.xlsx", "t2")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [order("o-1", "SK-1", 1500)])
    await repo.commitBatch("b-B", "t2")

    for (const r of await load()) {
      if (r.undo === "blocked") {
        await expect(repo.undoBatch(r.id, "t9"), `${r.id}는 잠겼다고 했다`).rejects.toThrow()
      }
    }
    // «가능»이라 한 것은 실제로 된다
    await expect(repo.undoBatch("b-B", "t3")).resolves.toBeGreaterThanOrEqual(0)
  })

  it("되돌린 배치는 «되돌림»이 되고 시각을 남긴다", async () => {
    const a = batch("b-A", "7월.xlsx", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [order("o-1", "SK-1", 1000)])
    await repo.commitBatch("b-A", "t1")
    await repo.undoBatch("b-A", "2026-08-14T05:00:00")

    const r = find(await load(), "b-A")
    expect(r.undo).toBe("undone")
    expect(r.undoneAt).toBe("2026-08-14T05:00:00")
    expect(r.ownedByTable, "소유한 행이 없다").toEqual({})
    expect(statusText(r).text).toBe("되돌림 · 08-14 05:00")
  })

  it("한 파일이 두 표로 갈린 것이 엔티티 칸에 보인다 (rowRouting)", async () => {
    const a = batch("b-A", "ESM.xlsx", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [order("o-1", "SK-1", 1000)])
    await repo.loadChunk("fact_claim", a, [
      { id: "c-1", source_key: "CK-1", claimed_at: "2026-07-11", claim_type: "RETURN", status: "DONE", amount: 500 },
    ])
    await repo.commitBatch("b-A", "t1")

    const r = find(await load(), "b-A")
    expect(r.ownedByTable).toEqual({ fact_order: 1, fact_claim: 1 })
    expect(entityLabel(r.ownedByTable)).toContain("주문 1")
    expect(entityLabel(r.ownedByTable)).toContain("클레임 1")
  })
})

describe("화면 문구", () => {
  const row = (over: Partial<HistoryRow> = {}): HistoryRow => ({
    id: "b-1",
    channel: "11번가",
    sourceName: "7월.xls",
    sheetName: "Sheet",
    docType: "settlement",
    at: "2026-08-14T02:18:11",
    batchStatus: "committed",
    fetched: 128,
    created: 100,
    updated: 28,
    failed: 2,
    ownedByTable: { fact_settlement: 128 },
    undo: "can",
    undoneAt: null,
    blockedBy: null,
    ...over,
  })

  it("시각은 짧게 — 초는 버린다", () => {
    expect(stamp("2026-08-14T02:18:11")).toBe("08-14 02:18")
    expect(stamp("2026-08-14")).toBe("2026-08-14")
  })

  it("잠김 문구가 «무엇이 덮었나»를 말한다", () => {
    const s = statusText(row({ undo: "blocked", blockedBy: { sourceName: "8월.xls", at: null } }))
    expect(s.text).toContain("8월.xls")
    expect(s.text).toContain("잠김")
  })

  it("★ 테이블 횡단 잠김을 설명한다 — 사용자 입장에서 놀라운 동작이라서 ★", () => {
    const why = blockedWhy(row({ undo: "blocked", blockedBy: { sourceName: "8월.xls", at: "2026-08-20T10:00:00" } }))
    expect(why).toContain("일부만 덮여도 배치 전체가 잠깁니다")
    expect(why).toContain("먼저 그쪽을 되돌리면")
    expect(why).toContain("08-20 10:00")
  })

  it("확인 다이얼로그가 행 수를 명시한다 — 규모를 모르고 누르게 하지 않는다", () => {
    const c = undoConfirm(row(), () => {})
    expect(c.hasRows).toBe(true)
    const kv = Object.fromEntries((c.rows as { k: string; v: string }[]).map((r) => [r.k, r.v]))
    expect(kv["사라질 행"]).toBe("100건")
    expect(kv["이전 판으로 복원될 행"]).toBe("28건")
  })

  it("★ 다이얼로그에 batch_id가 없다 — 목업은 노출했다 (헌장 C-4) ★", () => {
    const c = undoConfirm(row(), () => {})
    const all = JSON.stringify(c.rows) + String(c.body) + String(c.title)
    expect(all).not.toContain("batch_id")
    expect(all).not.toContain("b-1")
    expect(all, "사람이 알아보는 것은 파일 이름이다").toContain("7월.xls")
  })

  it("«동기화» 어휘를 쓰지 않는다 — 유형은 «파일»뿐이다 (LOCK 10)", () => {
    const vals = emptyVals()
    historyVals(vals, [row()])
    const s = (vals.syncRows as { type: string }[])[0]!
    expect(s.type).toBe("파일")
    expect(JSON.stringify(vals.syncRows)).not.toContain("동기화")
  })

  it("소요 시간을 지어내지 않는다", () => {
    const vals = emptyVals()
    historyVals(vals, [row()])
    expect((vals.syncRows as { dur: string }[])[0]!.dur).toBe("—")
  })

  it("잠긴 행에는 되돌리기 버튼을 그리지 않는다 (§21-1)", () => {
    const vals = emptyVals()
    historyVals(vals, [row({ undo: "blocked", blockedBy: { sourceName: "8월.xls", at: null } })])
    const s = (vals.syncRows as { canUndo: boolean; undone: boolean; status: string }[])[0]!
    expect(s.canUndo).toBe(false)
    expect(s.undone).toBe(false)
    expect(s.status, "버튼이 없는 대신 사유가 보인다").toContain("잠김")
  })
})
