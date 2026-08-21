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
    // ★ 「가져온 행」은 **파일 행 수**라 `loadChunk`가 세지 않는다 (2026-08-14) ★
    // 한 파일 행이 여러 Fact 행이 되는 경우가 둘이다(품목 · 이중 기록). 무엇이
    // 한 행인지는 매핑이 알고, `runImport`가 그 수를 넘긴다.
    await repo.addBatchRows("b-A", 1)
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
    outcome: "done",
    undoneAt: null,
    blockedBy: null,
    // 015 — 이 시험들이 만드는 것은 **배치 줄**이다. 통이 척추가 돼도 그 모양은 남는다.
    kind: "fact",
    outcomes: {},
    seenCount: 1,
    sightingId: 1,
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

  /**
   * ★★ 「출처」 칸 — 어느 파일인지가 화면에 선다 (ADR-028 · §21-8) ★★
   *
   * 015는 이 칸의 머리글이 「연결」이라 기준 데이터에 상수 「채널 없음」을 넣었다.
   * 그런데 그 구분은 바로 옆 「유형」 칸이 이미 하고 있었고, 정작 **어느 파일인지는
   * 화면 어디에도 없었다** — 원가 파일을 둘 넣으면 두 줄이 구별되지 않았다.
   */
  describe("출처 칸 (ADR-028)", () => {
    const ref = (over: Partial<HistoryRow> = {}): HistoryRow =>
      row({ kind: "reference", channel: "", outcomes: { cost: 35 }, undo: "blocked", ...over })

    it("★★ 기준 데이터의 출처는 **파일 이름**이다 ★★", () => {
      const vals = emptyVals()
      historyVals(vals, [ref({ sourceName: "2026-01 통합 매출 대시보드.xlsx" })])
      const s0 = (vals.syncRows as { conn: string; type: string }[])[0]!
      expect(s0.conn).toBe("2026-01 통합 매출 대시보드.xlsx")
      // 「채널 없음」이 사라져도 숨긴 것이 아니다 — 옆 칸이 더 정확하게 말한다
      expect(s0.type).toBe("기준 데이터")
      expect(JSON.stringify(vals.syncRows)).not.toContain("채널 없음")
    })

    it("★★ 원가 파일 둘을 넣으면 두 줄이 **다른 이름**으로 뜬다 ★★", () => {
      const vals = emptyVals()
      historyVals(vals, [
        ref({ id: "intake:1", sourceName: "1월 단가표.xlsx" }),
        ref({ id: "intake:2", sourceName: "2월 단가표.xlsx" }),
      ])
      const conns = (vals.syncRows as { conn: string }[]).map((r) => r.conn)
      expect(conns).toEqual(["1월 단가표.xlsx", "2월 단가표.xlsx"])
      expect(new Set(conns).size, "두 줄이 구별되지 않는다 — 이게 3.11이었다").toBe(2)
    })

    it("Fact 행의 출처는 **연결 이름**이다 — 지금 그대로다", () => {
      const vals = emptyVals()
      historyVals(vals, [row()])
      expect((vals.syncRows as { conn: string }[])[0]!.conn).toBe("11번가")
    })

    it("훑기만 한 파일도 이름으로 선다 — 「안 넣었다」와 「기록이 없다」는 다르다", () => {
      const vals = emptyVals()
      historyVals(vals, [ref({ kind: "seen", outcomes: {}, sourceName: "낯선 파일.xlsx" })])
      const s0 = (vals.syncRows as { conn: string; type: string }[])[0]!
      expect(s0.conn).toBe("낯선 파일.xlsx")
      expect(s0.type).toBe("훑기만")
    })

    it("연결 이름이 빈 Fact 행은 «—»다 — 파일 이름을 대신 끼워 넣지 않는다", () => {
      const vals = emptyVals()
      historyVals(vals, [row({ channel: "" })])
      expect((vals.syncRows as { conn: string }[])[0]!.conn).toBe("—")
    })
  })

  /**
   * ★ 018 — 장부의 줄이 **전부** 눌린다 (ADR-028 결정 4) ★
   * 015까지 기준 데이터 행은 `cursor: pointer`를 달고도 아무 일이 없었다 (1.6 · U-3).
   */
  it("★ 기준 데이터 행도 눌리면 열린다 — 어포던스만 그리고 막지 않는다 ★", () => {
    const vals = emptyVals()
    const opened: string[] = []
    historyVals(
      vals,
      [row({ kind: "reference", channel: "", outcomes: { cost: 35 }, sourceName: "원가.xlsx" })],
      { askUndo: () => {}, openRows: (r) => opened.push(r.sourceName) },
    )
    ;(vals.syncRows as { click: () => void }[])[0]!.click()
    expect(opened, "눌러도 아무 일이 없다 — 015의 U-3 위반 자리다").toEqual(["원가.xlsx"])
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

/**
 * ★ 대열 4 ③-b — 「적재 중 초록 영구」와 「abort ≠ undo」 ★
 *
 * 옛 판정은 `batchStatus === "committed" ? "완료" : "적재 중"` 한 줄이었고 색은 늘
 * 초록이었다. 그래서 **적재하다 죽은 배치가 영원히 「적재 중」**이고, 끝나지 않은
 * 일이 완료와 같은 색을 썼다. 그리고 `open`을 되돌리면 「되돌림」이라 표시됐는데
 * 그것은 취소다 — 손익에 반영된 적이 없다.
 */
describe("배치가 어떻게 끝났나 — 완료 · 되돌림 · 취소 · 미완료", () => {
  const row = (over: Partial<HistoryRow>): HistoryRow => ({
    id: "b-1", channel: "11번가", sourceName: "7월.xls", sheetName: null, docType: null,
    at: "2026-08-16T01:00:00", batchStatus: "committed", fetched: 128, created: 128,
    updated: 0, failed: 0, ownedByTable: {}, undo: "can", outcome: "done",
    undoneAt: null, blockedBy: null,
    kind: "fact", outcomes: {}, seenCount: 1, sightingId: 1,
    ...over,
  })

  it("미완료는 초록이 아니다 — 끝나지 않은 일이 완료와 같은 색을 쓰지 않는다", () => {
    const done = statusText(row({ outcome: "done" }))
    const open = statusText(row({ outcome: "unfinished", batchStatus: "open" }))
    expect(done.text).toBe("완료")
    expect(open.text, "「적재 중」이라고 말하지 않는다").toContain("미완료")
    expect(open.color, "완료와 같은 색이면 구분이 사라진다").not.toBe(done.color)
  })

  it("취소와 되돌림을 가른다 — 손익에 반영된 적이 있었나가 다르다", () => {
    const undone = statusText(row({ undo: "undone", outcome: "undone", undoneAt: "2026-08-16T02:00:00" }))
    const aborted = statusText(row({ undo: "undone", outcome: "aborted", undoneAt: "2026-08-16T02:00:00" }))
    expect(undone.text).toContain("되돌림")
    expect(aborted.text).toContain("취소됨")
    expect(aborted.text).not.toContain("되돌림")
  })

  it("미완료를 치우는 확인 문구는 «되돌리기»라고 말하지 않는다", () => {
    const d = undoConfirm(row({ outcome: "unfinished", batchStatus: "open" }), () => {})
    expect(d.title).toContain("치울까요")
    expect(d.confirmLabel).toBe("치우기")
    // 있지도 않았던 변화를 되돌리는 것처럼 들리면 안 된다
    expect(d.body).not.toContain("이전 판으로 돌아갑니다")
    expect(d.body).toContain("손익에 잡힌 적이 없")
  })
})

/**
 * 위 문구 게이트는 `outcome`을 손으로 준다. 그 값이 **실제 경로에서** 그렇게
 * 나오는지는 여기서 잰다 — 저장을 거쳐야 「커밋된 적이 없다」가 확인된다.
 */
describe("outcome은 저장이 파생한다 — `committed_at`이 취소와 되돌리기를 가른다", () => {
  let db: Driver
  let repo: Repository
  const NOW = "2026-08-16T01:00:00"
  const open = (id: string): BatchOpen => ({
    id, libraryId: "lib-1", connectionId: "conn-1", sourceName: `${id}.xls`,
    sourceBytes: 1, containerFormat: "biff", mappingVersion: "m@1", startedAt: NOW,
  })

  beforeEach(async () => {
    db = openNodeDriver()
    await migrate(db)
    await db.prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`).run("lib-1", "기본", NOW)
    await db.prepare(
      `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    ).run("conn-1", "lib-1", "kr-marketplace", "mk-a", "11번가", "CONNECTED", NOW, NOW)
    repo = new Repository(db)
  })

  const outcomeOf = async (id: string): Promise<string> => {
    const rows = await loadHistoryRows(db, "lib-1", () => null)
    return rows.find((r) => r.id === id)!.outcome
  }

  it("적재하다 만 배치는 «미완료»다", async () => {
    await repo.openBatch(open("b-open"))
    expect(await outcomeOf("b-open")).toBe("unfinished")
  })

  it("커밋한 적 없는 배치를 치우면 «취소»다", async () => {
    await repo.openBatch(open("b-abort"))
    await repo.undoBatch("b-abort", NOW)
    expect(await outcomeOf("b-abort"), "새 컬럼 없이 committed_at으로 갈린다").toBe("aborted")
  })

  it("커밋한 배치를 물리면 «되돌림»이다 — 같은 함수인데 뜻이 다르다", async () => {
    await repo.openBatch(open("b-undo"))
    await repo.commitBatch("b-undo", NOW)
    await repo.undoBatch("b-undo", NOW)
    expect(await outcomeOf("b-undo")).toBe("undone")
  })
})
