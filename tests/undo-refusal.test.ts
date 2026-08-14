/**
 * 되돌리기 **거부 경로** — ADR-004의 «순서 꼬이면 거부»가 실제로 거부하는가.
 *
 * ★ 왜 이제 쓰는가 ★
 * 7월 리허설이 이 상황을 **실재하게 만들었다.** 위저드로 11번가 파일을 다시 넣자
 * 128행이 새 batch로 이관됐고, `batch-11st`은 **행을 0개 소유한 배치**가 됐다.
 * 그때까지 이 저장소에는 거부 경로를 밟는 테스트가 **0건**이었다 —
 * `multi-batch-undo.test.ts`의 5개는 전부 순서를 지킨 성공 경로만 걷는다.
 *
 * 엣지가 실재할 때가 테스트를 쓸 때다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 판정 조건은 «시각 LIFO»가 아니다 ★
 * `assertUndoable`은 `SELECT ... FROM row_shadow WHERE prev_batch_id = ?` 하나만
 * 본다. 배치의 시각·순번·status는 보지 않는다. 즉 규칙은 **«나를 덮어쓴 그림자가
 * 하나도 없을 것»**이고, ADR-004는 이를 «행 단위 LIFO»라 부른다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, it, expect, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository, type BatchOpen } from "../src/core/store/repository.js"

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

const batch = (id: string, at: string): BatchOpen => ({
  id,
  libraryId: LIB,
  connectionId: CONN,
  sourceName: `${id}.xlsx`,
  sourceBytes: 100,
  containerFormat: "xlsx",
  mappingVersion: "mk-a/order/order@1",
  startedAt: at,
})

const order = (id: string, sk: string, amt: number) => ({
  id,
  source_key: sk,
  ordered_at: "2026-07-10",
  status: "PAID",
  total_amount: amt,
})

describe("되돌리기 거부 — 나를 덮어쓴 배치가 있으면 막는다", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver()
    await seed(db)
    repo = new Repository(db)
  })

  /**
   * ★ 리허설이 만든 그 상황 ★
   * A가 넣은 행을 B가 UPSERT로 가져가면 A는 **행 0개짜리 배치**가 된다.
   * 그때 A를 되돌리려 하면 «아무 일 없이 성공»이 아니라 **거부**여야 한다 —
   * A를 되돌린다는 것은 B가 덮어쓰기 전 상태로 돌리는 것이고, B가 살아 있는 한
   * 그럴 수 없기 때문이다.
   */
  it("★ 행 0개가 된 배치는 되돌릴 수 없다 — 이관이 남긴 그림자가 그 신호다 ★", async () => {
    const a = batch("b-A", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [order("o-1", "SK-1", 1000)])
    await repo.commitBatch("b-A", "t1")

    const b = batch("b-B", "t2")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [order("o-1", "SK-1", 1500)])
    await repo.commitBatch("b-B", "t2")

    // A는 이제 fact 행을 하나도 소유하지 않는다
    const owned = await db
      .prepare(`SELECT COUNT(*) AS n FROM fact_order WHERE batch_id = ?`)
      .all("b-A")
    expect(Number(owned[0]!["n"]), "행이 B로 이관됐다").toBe(0)

    await expect(repo.undoBatch("b-A", "t3")).rejects.toThrow(
      /배치 b-B가 이 배치의 행을 덮어썼다/,
    )
  })

  it("거부는 아무것도 남기지 않는다 — 트랜잭션이 통째로 롤백한다", async () => {
    const a = batch("b-A", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [order("o-1", "SK-1", 1000)])
    await repo.recordExclusions("b-A", [{ rowIndex: 3, reason: "subtitle", detail: "제목 행" }])
    await repo.commitBatch("b-A", "t1")

    const b = batch("b-B", "t2")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [order("o-1", "SK-1", 1500)])
    await repo.commitBatch("b-B", "t2")

    await expect(repo.undoBatch("b-A", "t3")).rejects.toThrow()

    const row = (
      await db.prepare(`SELECT batch_id, total_amount, version FROM fact_order`).all()
    )[0]!
    expect(row["batch_id"], "행은 B 소유 그대로").toBe("b-B")
    expect(Number(row["total_amount"])).toBe(1500)

    const st = await repo.batchStatus("b-A")
    expect(st!["status"], "A는 여전히 committed").toBe("committed")

    const shadows = await db.prepare(`SELECT COUNT(*) AS n FROM row_shadow`).all()
    expect(Number(shadows[0]!["n"]), "그림자도 그대로").toBe(1)

    const excl = await db
      .prepare(`SELECT COUNT(*) AS n FROM batch_exclusion WHERE batch_id = ?`)
      .all("b-A")
    expect(Number(excl[0]!["n"]), "제외 기록도 그대로").toBe(1)
  })

  /**
   * 거부는 **행 단위가 아니라 배치 통째**다. 한 줄만 이관돼도 배치 전체가 잠긴다.
   * ADR-004에 명시돼 있지 않은 성질이라 여기서 못박는다 — 나중에 «행 단위 거부»로
   * 완화한다면 그건 의도된 변경이어야 하고, 이 단언이 그때 깨진다.
   */
  it("한 줄만 이관돼도 배치 전체가 잠긴다 — 남은 행은 되돌릴 방법이 없다", async () => {
    const a = batch("b-A", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [order("o-1", "SK-1", 1000), order("o-2", "SK-2", 2000)])
    await repo.commitBatch("b-A", "t1")

    const b = batch("b-B", "t2")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [order("o-1", "SK-1", 1500)])
    await repo.commitBatch("b-B", "t2")

    await expect(repo.undoBatch("b-A", "t3")).rejects.toThrow(/덮어썼다/)

    const stranded = await db
      .prepare(`SELECT COUNT(*) AS n FROM fact_order WHERE batch_id = ?`)
      .all("b-A")
    expect(Number(stranded[0]!["n"]), "SK-2는 여전히 A 소유인데 되돌릴 수 없다").toBe(1)
  })

  it("올바른 순서로는 되돌아간다 — B 먼저, 그다음 A", async () => {
    const a = batch("b-A", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [order("o-1", "SK-1", 1000)])
    await repo.commitBatch("b-A", "t1")

    const b = batch("b-B", "t2")
    await repo.openBatch(b)
    await repo.loadChunk("fact_order", b, [order("o-1", "SK-1", 1500)])
    await repo.commitBatch("b-B", "t2")

    await repo.undoBatch("b-B", "t3")
    const restored = (await db.prepare(`SELECT batch_id, total_amount FROM fact_order`).all())[0]!
    expect(restored["batch_id"], "A 버전으로 복원됐다").toBe("b-A")
    expect(Number(restored["total_amount"])).toBe(1000)

    // 그림자가 사라졌으므로 이제 A도 되돌릴 수 있다
    await expect(repo.undoBatch("b-A", "t4")).resolves.toBe(1)
    const left = await db.prepare(`SELECT COUNT(*) AS n FROM fact_order`).all()
    expect(Number(left[0]!["n"])).toBe(0)
  })

  it("대조군 — 적재가 아예 없던 빈 배치는 조용히 되돌아간다", async () => {
    await repo.openBatch(batch("b-empty", "t1"))
    await repo.commitBatch("b-empty", "t1")

    await expect(repo.undoBatch("b-empty", "t2")).resolves.toBe(0)
    const st = await repo.batchStatus("b-empty")
    expect(st!["status"]).toBe("undone")
  })

  it("없는 배치는 다른 문구로 거부한다 — 조건이 다르면 말도 달라야 한다", async () => {
    await expect(repo.undoBatch("b-nope", "t1")).rejects.toThrow(/되돌릴 수 없는 배치: b-nope/)
  })
})

/**
 * ─────────────────────────────────────────────────────────────
 * ★ 판정 완료 (2026-08-14) — 이 절의 단언이 뒤집힌 자리다 ★
 *
 * 전에는 «지금 이렇다»를 못박고 있었다: *"이미 되돌린 배치를 또 되돌려도 막지
 * 않는다 — 그리고 `undone_at`을 덮는다"*. 그 단언이 깨지는 순간이 판정하는
 * 순간이라고 적어 뒀고, 판정이 났다:
 *
 *   **undone → undone 재실행은 결함이다.** 하는 일이 없으면서 `undone_at`만
 *   파괴한다. 최초로 되돌린 시각은 감사 이력이고, 이 앱은 이력 덮어쓰기를
 *   전부 금지해 왔다 — 조정도 삭제도 기록으로 남기는 판에 되돌리기 시각만
 *   예외일 이유가 없다.
 *
 *   **open 배치의 undo는 별개 질문이라 허용을 유지한다.** 다만 의미가 다르다 —
 *   `open`의 undo는 «취소(abort)», `committed`의 undo가 «되돌리기(undo)»다.
 *   v1은 스키마를 나누지 않고(별도 `aborted_at` 없음) 주석과 이 테스트가
 *   의미를 진다.
 * ─────────────────────────────────────────────────────────────
 */
describe("status 가드 — 판정 완료", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver()
    await seed(db)
    repo = new Repository(db)
  })

  it("★ 이미 되돌린 배치는 거부한다 — 감사 이력을 덮지 않는다 ★", async () => {
    const a = batch("b-A", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [order("o-1", "SK-1", 1000)])
    await repo.commitBatch("b-A", "t1")

    await expect(repo.undoBatch("b-A", "t-undo-1")).resolves.toBe(1)
    await expect(repo.undoBatch("b-A", "t-undo-2")).rejects.toThrow(/이미 되돌린 배치다/)

    const st = await repo.batchStatus("b-A")
    expect(st!["undone_at"], "최초로 되돌린 시각이 그대로 남는다").toBe("t-undo-1")
  })

  it("«취소» — 커밋되지 않은 open 배치는 여전히 되돌려진다 (별개 의미)", async () => {
    const a = batch("b-open", "t1")
    await repo.openBatch(a)
    await repo.loadChunk("fact_order", a, [order("o-1", "SK-1", 1000)])
    // 커밋하지 않는다 — 적재하다 만 상태

    await expect(repo.undoBatch("b-open", "t2")).resolves.toBe(1)
    const st = await repo.batchStatus("b-open")
    expect(st!["status"]).toBe("undone")
    expect(st!["committed_at"], "커밋한 적이 없다 — 이건 «되돌리기»가 아니라 «취소»다").toBeNull()
  })

  it("취소한 배치도 두 번은 안 된다 — 같은 가드가 두 의미 모두에 걸린다", async () => {
    await repo.openBatch(batch("b-open", "t1"))
    await repo.undoBatch("b-open", "t2")
    await expect(repo.undoBatch("b-open", "t3")).rejects.toThrow(/이미 되돌린 배치다/)
  })

  it("반대 방향에도 가드가 있다 — undone 배치는 커밋되지 않는다. 이제 대칭이다", async () => {
    await repo.openBatch(batch("b-A", "t1"))
    await repo.commitBatch("b-A", "t1")
    await repo.undoBatch("b-A", "t2")

    await expect(repo.commitBatch("b-A", "t3")).rejects.toThrow(/커밋할 수 없는 배치/)
  })

  it("거부는 검사 단계에서 난다 — DELETE가 헛돌지 않는다", async () => {
    // 존재하지 않는 배치. 전에는 DELETE 10여 개가 돈 뒤 맨 끝에서 걸렸다.
    await expect(repo.undoBatch("b-nope", "t1")).rejects.toThrow(/되돌릴 수 없는 배치/)
  })
})
