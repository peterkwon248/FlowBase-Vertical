import { describe, it, expect, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate.js"
import { Repository, type BatchOpen } from "../src/core/store/repository.js"

const LIB = "lib-1"
const CONN = "conn-1"

function seed(db: Driver): void {
  migrate(db)
  db.prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`).run(
    LIB,
    "기본",
    "2026-08-12T00:00:00Z",
  )
  db.prepare(
    `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    CONN,
    LIB,
    "kr-marketplace",
    "mk-a",
    "연결 1",
    "CONNECTED",
    "2026-08-12T00:00:00Z",
    "2026-08-12T00:00:00Z",
  )
}

function batch(id: string, at = "2026-08-12T00:00:00Z"): BatchOpen {
  return {
    id,
    libraryId: LIB,
    connectionId: CONN,
    sourceName: "orders.xlsx",
    sourceBytes: 1234,
    containerFormat: "xlsx",
    mappingVersion: "mk-a/order/order@1",
    startedAt: at,
  }
}

const order = (n: number) => ({
  id: `o-${n}`,
  source_key: `SK-${n}`,
  ordered_at: "2026-07-15",
  status: "PAID",
  total_amount: n * 1000,
})

describe("합격 기준 1 — 적재 → 되돌리기 → 행수 원복", () => {
  let db: Driver
  let repo: Repository

  beforeEach(() => {
    db = openNodeDriver()
    seed(db)
    repo = new Repository(db)
  })

  it("청크 적재 후 되돌리면 행이 사라지고 배치가 undone이 된다", () => {
    const b = batch("b-1")
    repo.openBatch(b)
    repo.loadChunk("fact_order", b, [order(1), order(2), order(3)])
    repo.commitBatch("b-1", "2026-08-12T00:01:00Z")

    const inRange = () =>
      repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")

    expect(inRange()).toBe(3)
    expect(repo.sumInRange("active_order", "total_amount", LIB, "ordered_at", "2026-07-01", "2026-07-31")).toBe(6000)

    const removed = repo.undoBatch("b-1", "2026-08-12T00:02:00Z")
    expect(removed).toBe(3)
    expect(inRange()).toBe(0)
    expect(repo.batchStatus("b-1")?.status).toBe("undone")
  })

  it("여러 배치 중 하나만 되돌린다", () => {
    const b1 = batch("b-1")
    const b2 = batch("b-2")
    repo.openBatch(b1)
    repo.loadChunk("fact_order", b1, [order(1), order(2)])
    repo.commitBatch("b-1", "t")
    repo.openBatch(b2)
    repo.loadChunk("fact_order", b2, [order(3), order(4)])
    repo.commitBatch("b-2", "t")

    expect(repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")).toBe(4)
    repo.undoBatch("b-1", "t")
    expect(repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")).toBe(2)
  })

  it("적재 중(open)인 배치는 활성 조회에 나타나지 않는다", () => {
    const b = batch("b-1")
    repo.openBatch(b)
    repo.loadChunk("fact_order", b, [order(1)])
    // 아직 커밋 전 — 사실이 아니다.
    expect(repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")).toBe(0)
    repo.commitBatch("b-1", "t")
    expect(repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")).toBe(1)
  })

  it("같은 source_key 재가져오기는 UPSERT다 (헌장 B-2)", () => {
    const b1 = batch("b-1")
    repo.openBatch(b1)
    const first = repo.loadChunk("fact_order", b1, [order(1), order(2)])
    expect(first).toEqual({ inserted: 2, updated: 0 })
    repo.commitBatch("b-1", "t")

    const b2 = batch("b-2")
    repo.openBatch(b2)
    const second = repo.loadChunk("fact_order", b2, [
      { ...order(1), total_amount: 9999 },
      order(3),
    ])
    expect(second).toEqual({ inserted: 1, updated: 1 })
    repo.commitBatch("b-2", "t")

    // 행이 늘지 않고 값만 갱신됐다.
    expect(repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")).toBe(3)
    const row = db.prepare(`SELECT total_amount, version, batch_id FROM fact_order WHERE source_key='SK-1'`).get()
    expect(row?.total_amount).toBe(9999)
    expect(row?.version).toBe(2)
    expect(row?.batch_id).toBe("b-2")
  })

  it("제외 행이 사유와 함께 남고 되돌리기로 함께 사라진다", () => {
    const b = batch("b-1")
    repo.openBatch(b)
    repo.recordExclusions("b-1", [
      { rowIndex: 5, reason: "total", detail: "라벨 없는 집계 행" },
      { rowIndex: 9, reason: "blank", detail: "빈 행" },
    ])
    expect(repo.batchStatus("b-1")?.excluded_count).toBe(2)
    repo.commitBatch("b-1", "t")
    repo.undoBatch("b-1", "t")
    const n = db.prepare(`SELECT COUNT(*) AS n FROM batch_exclusion WHERE batch_id='b-1'`).get()
    expect(Number(n?.n)).toBe(0)
  })
})

describe("합격 기준 3 — 되돌리기 후 재가져오기 시 조정 생존 (헌장 B-3)", () => {
  let db: Driver
  let repo: Repository

  beforeEach(() => {
    db = openNodeDriver()
    seed(db)
    repo = new Repository(db)
  })

  it("조정은 배치를 되돌려도 살아남고 재가져오기 후에도 그대로다", () => {
    const b1 = batch("b-1")
    repo.openBatch(b1)
    repo.loadChunk("fact_order", b1, [order(1)])
    repo.commitBatch("b-1", "t")

    // 사용자가 값을 고친다 — 원본을 덮어쓰지 않고 조정으로 쌓는다.
    repo.addAdjustment({
      libraryId: LIB,
      connectionId: CONN,
      table: "fact_order",
      sourceKey: "SK-1",
      field: "total_amount",
      previousValue: 1000,
      newValue: 1200,
      reason: "정산서 기준 정정",
      createdAt: "2026-08-12T01:00:00Z",
    })
    expect(repo.adjustmentsFor(CONN, "fact_order", "SK-1")).toHaveLength(1)

    // 배치를 되돌린다 — Fact 행은 사라진다.
    repo.undoBatch("b-1", "t")
    expect(repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")).toBe(0)

    // ★ 조정은 남아 있어야 한다 ★ batch가 아니라 source_key에 묶여 있으므로.
    expect(repo.adjustmentsFor(CONN, "fact_order", "SK-1")).toHaveLength(1)

    // 같은 파일을 다시 가져온다.
    const b2 = batch("b-2")
    repo.openBatch(b2)
    repo.loadChunk("fact_order", b2, [order(1)])
    repo.commitBatch("b-2", "t")

    // 원본은 돌아왔고 조정도 그대로다 — 유효값 = 원본 + 조정 스택.
    expect(repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")).toBe(1)
    const adj = repo.adjustmentsFor(CONN, "fact_order", "SK-1")
    expect(adj).toHaveLength(1)
    expect(adj[0]?.new_value).toBe("1200")
    expect(adj[0]?.reason).toBe("정산서 기준 정정")
  })

  it("조정 스택은 여러 겹이 시간순으로 쌓인다", () => {
    const b = batch("b-1")
    repo.openBatch(b)
    repo.loadChunk("fact_order", b, [order(1)])
    repo.commitBatch("b-1", "t")

    for (const [i, v] of [1200, 1300, 1250].entries()) {
      repo.addAdjustment({
        libraryId: LIB,
        connectionId: CONN,
        table: "fact_order",
        sourceKey: "SK-1",
        field: "total_amount",
        previousValue: i === 0 ? 1000 : null,
        newValue: v,
        reason: `${i + 1}차 정정`,
        createdAt: `2026-08-12T0${i + 1}:00:00Z`,
      })
    }
    const stack = repo.adjustmentsFor(CONN, "fact_order", "SK-1")
    expect(stack.map((a) => a.new_value)).toEqual(["1200", "1300", "1250"])
  })

  it("대사 확인은 조정과 별개다 — 조정이 불일치를 지우지 못한다", () => {
    // 헌장 B-3: 대사는 원본끼리만 비교한다.
    db.prepare(
      `INSERT INTO recon_ack (library_id, connection_id, recon_key, difference, reason, acked_at)
       VALUES (?,?,?,?,?,?)`,
    ).run(LIB, CONN, "2026-07/settlement", -12400, "마켓 수수료 반올림 차이", "2026-08-12T02:00:00Z")

    repo.addAdjustment({
      libraryId: LIB,
      connectionId: CONN,
      table: "fact_settlement",
      sourceKey: "S-1",
      field: "net_amount",
      previousValue: 100,
      newValue: 112400,
      reason: "조정으로 맞춰보려는 시도",
      createdAt: "2026-08-12T02:01:00Z",
    })

    // 조정을 넣어도 대사 기록의 차이는 그대로다.
    const ack = db.prepare(`SELECT difference FROM recon_ack WHERE recon_key = ?`).get("2026-07/settlement")
    expect(ack?.difference).toBe(-12400)
  })
})

describe("합격 기준 4 — 활성 로드 (전체 테이블 적재 경로 부재)", () => {
  it("대량 적재 후에도 조회는 범위 결과만 돌려준다", () => {
    const db = openNodeDriver()
    seed(db)
    const repo = new Repository(db)
    const b = batch("b-1")
    repo.openBatch(b)

    // 5,000행을 청크로 넣는다.
    for (let c = 0; c < 5; c++) {
      repo.loadChunk(
        "fact_order",
        b,
        Array.from({ length: 1000 }, (_, i) => {
          const n = c * 1000 + i
          return {
            id: `o-${n}`,
            source_key: `SK-${n}`,
            // 절반은 조회 범위 밖에 둔다.
            ordered_at: n % 2 === 0 ? "2026-07-15" : "2026-06-15",
            status: "PAID",
            total_amount: 100,
          }
        }),
      )
    }
    repo.commitBatch("b-1", "t")

    // 범위 안 2,500행만 세어진다 — 전체를 올려 세는 경로가 없다.
    expect(repo.countInRange("active_order", LIB, "ordered_at", "2026-07-01", "2026-07-31")).toBe(2500)
    // 집계도 SQL이 한다.
    expect(
      repo.sumInRange("active_order", "total_amount", LIB, "ordered_at", "2026-07-01", "2026-07-31"),
    ).toBe(250_000)
    db.close()
  })
})
