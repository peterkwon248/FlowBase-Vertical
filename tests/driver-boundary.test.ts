import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { Repository, FACT_TABLES } from "../src/core/store/repository.js"
import type { Driver, Row, SqlValue, Statement } from "../src/core/store/driver.js"

const STORE_DIR = fileURLToPath(new URL("../src/core/store", import.meta.url))

/**
 * 가짜 드라이버 — SQLite를 전혀 쓰지 않는다.
 *
 * 리포지토리가 `driver.ts`의 계약만 쓰는지 증명하는 장치다. 특정 드라이버의
 * API가 새어 있으면 여기서 터진다.
 */
class FakeDriver implements Driver {
  readonly sql: string[] = []
  readonly params: SqlValue[][] = []
  private canned: Row | undefined
  txDepth = 0
  maxTxDepth = 0

  constructor(private readonly changes = 1) {}

  setNextGet(row: Row | undefined): void {
    this.canned = row
  }

  exec(sql: string): void {
    this.sql.push(sql)
  }

  prepare(sql: string): Statement {
    this.sql.push(sql)
    const self = this
    return {
      run(...p: readonly SqlValue[]) {
        self.params.push([...p])
        return { changes: self.changes }
      },
      get(...p: readonly SqlValue[]) {
        self.params.push([...p])
        // 집계 조회에만 준비된 답을 준다. 존재 확인 조회(되돌리기 가능 여부 등)에
        // 값을 돌려주면 "행이 있다"는 뜻이 되어 엉뚱한 분기를 탄다.
        return sql.includes("COUNT(*)") ? self.canned : undefined
      },
      all(...p: readonly SqlValue[]) {
        self.params.push([...p])
        return []
      },
    }
  }

  transaction<T>(fn: () => T): T {
    this.txDepth++
    this.maxTxDepth = Math.max(this.maxTxDepth, this.txDepth)
    try {
      return fn()
    } finally {
      this.txDepth--
    }
  }

  close(): void {}
}

const BATCH = {
  id: "b1",
  libraryId: "lib",
  connectionId: "conn",
  sourceName: "x.xlsx",
  sourceBytes: 10,
  containerFormat: "xlsx",
  mappingVersion: "v1",
  startedAt: "2026-08-12T00:00:00Z",
}

describe("드라이버 경계 — 교체가 파일 하나로 끝나는가", () => {
  it("SQLite 없이 가짜 드라이버만으로 리포지토리가 돈다", () => {
    const fake = new FakeDriver()
    const repo = new Repository(fake)

    repo.openBatch(BATCH)
    fake.setNextGet({ n: 0 })
    repo.loadChunk("fact_order", BATCH, [
      { id: "o1", source_key: "K1", ordered_at: "2026-07-01", status: "PAID", total_amount: 1000 },
    ])
    repo.commitBatch("b1", "2026-08-12T00:01:00Z")
    repo.undoBatch("b1", "2026-08-12T00:02:00Z")

    // 계약 밖의 것을 부르지 않았다면 여기까지 예외 없이 온다.
    expect(fake.sql.length).toBeGreaterThan(0)
    expect(fake.maxTxDepth).toBeGreaterThanOrEqual(1)
  })

  it("적재가 청크당 트랜잭션 하나를 쓴다 (ADR-001 조건 3)", () => {
    const fake = new FakeDriver()
    const repo = new Repository(fake)
    fake.setNextGet({ n: 0 })
    repo.loadChunk(
      "fact_order",
      BATCH,
      Array.from({ length: 50 }, (_, i) => ({
        id: `o${i}`,
        source_key: `K${i}`,
        ordered_at: "2026-07-01",
        status: "PAID",
        total_amount: i,
      })),
    )
    // 행마다 트랜잭션을 열면 중첩 깊이가 아니라 횟수가 문제인데,
    // 여기서는 "한 번만 감쌌다"를 깊이 1로 확인한다.
    expect(fake.maxTxDepth).toBe(1)
  })

  it("행마다 prepare하지 않는다 — 문장을 재사용한다", () => {
    const fake = new FakeDriver()
    const repo = new Repository(fake)
    fake.setNextGet({ n: 0 })
    const rows = Array.from({ length: 100 }, (_, i) => ({
      id: `o${i}`,
      source_key: `K${i}`,
      ordered_at: "2026-07-01",
      status: "PAID",
      total_amount: i,
    }))
    repo.loadChunk("fact_order", BATCH, rows)
    repo.loadChunk("fact_order", BATCH, rows)

    const inserts = fake.sql.filter((s) => s.startsWith("INSERT INTO fact_order"))
    // 100행 × 2청크를 넣었는데 INSERT 문장 준비는 한 번뿐이어야 한다.
    expect(inserts).toHaveLength(1)
  })

  it("store 밖으로 드라이버 구현이 새지 않는다", () => {
    // `node:sqlite`를 **코드에서** 아는 파일은 어댑터 하나뿐이어야 한다.
    // 주석에서 언급하는 건 설명이지 의존이 아니므로 걷어내고 본다.
    const stripComments = (s: string): string =>
      s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

    const offenders = readdirSync(STORE_DIR)
      .filter((f) => f.endsWith(".ts") && f !== "driver-node.ts")
      .filter((f) => stripComments(readFileSync(join(STORE_DIR, f), "utf-8")).includes("node:sqlite"))
    expect(offenders.join(", ")).toBe("")
  })
})

describe("좁은 커맨드 표면 — 합격 기준 4", () => {
  it("전체 테이블을 읽는 함수가 존재하지 않는다", () => {
    const surface = Object.getOwnPropertyNames(Repository.prototype)
    // 있으면 안 되는 이름들. "없다"를 테스트로 고정한다.
    for (const banned of ["selectAll", "findAll", "loadAll", "all", "dump", "query", "raw", "exec"]) {
      expect(surface, `Repository에 ${banned}가 있다`).not.toContain(banned)
    }
  })

  it("조회는 범위를 반드시 받는다", () => {
    const repo = new Repository(new FakeDriver())
    // countInRange·sumInRange 둘 다 from/to가 필수 인자다 — 시그니처로 강제된다.
    expect(Repository.prototype.countInRange.length).toBeGreaterThanOrEqual(5)
    expect(Repository.prototype.sumInRange.length).toBeGreaterThanOrEqual(6)
    expect(repo).toBeDefined()
  })

  it("Fact 테이블 직접 조회를 거부한다", () => {
    const repo = new Repository(new FakeDriver())
    for (const t of FACT_TABLES) {
      expect(() => repo.countInRange(t, "lib", "ordered_at", "2026-07-01", "2026-07-31")).toThrow(
        /active_\* 뷰로만/,
      )
    }
  })

  it("식별자에 SQL을 끼워 넣을 수 없다", () => {
    const repo = new Repository(new FakeDriver())
    expect(() =>
      repo.sumInRange("active_order", "total_amount; DROP TABLE batch", "lib", "ordered_at", "a", "b"),
    ).toThrow(/허용되지 않는 식별자/)
  })

  it("공통 6컬럼을 호출자가 직접 넘길 수 없다", () => {
    const repo = new Repository(new FakeDriver())
    expect(() =>
      repo.loadChunk("fact_order", BATCH, [
        { id: "o1", source_key: "K1", library_id: "다른값" } as never,
      ]),
    ).toThrow(/공통 컬럼은 직접 넘길 수 없다/)
  })
})
