import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { Repository, FACT_TABLES } from "../src/core/store/repository.js"
import type { Driver, Row, SqlValue, Statement } from "../src/core/store/driver.js"
import { DRIVER_SURFACE } from "../src/core/store/driver.js"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { tmpdir } from "node:os"

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

  async exec(sql: string): Promise<void> {
    this.sql.push(sql)
  }

  prepare(sql: string): Statement {
    this.sql.push(sql)
    const self = this
    return {
      async run(...p: readonly SqlValue[]) {
        self.params.push([...p])
        return { changes: self.changes }
      },
      async get(...p: readonly SqlValue[]) {
        self.params.push([...p])
        if (sql.includes("COUNT(*)")) return self.canned
        // ★ 존재 확인 조회는 **극성이 둘로 갈린다** ★
        //   · 배치 자신을 찾는 조회 → 없으면 «되돌릴 수 없는 배치»로 거부된다
        //   · 그림자 blocker 조회   → 없는 것이 정상(=되돌릴 수 있다)
        // 하나로 뭉뚱그려 undefined를 주면 앞의 것이 항상 거부된다. 이 스텁의
        // 목적은 SQL이 아니라 **드라이버 계약**을 시험하는 것이므로, 배치는
        // «있고 committed»라고 답한다.
        if (sql.includes("FROM batch")) return { status: "committed" }
        return undefined
      },
      async all(...p: readonly SqlValue[]) {
        self.params.push([...p])
        return []
      },
    }
  }

  /** 벌크 실행 — 도메인 로직 없이 같은 SQL을 N번. 파라미터는 전부 기록한다. */
  readonly bulk: { sql: string; rows: number }[] = []

  async runMany(sql: string, rows: Iterable<readonly SqlValue[]>) {
    this.sql.push(sql)
    // 계약이 `Iterable`이므로 **한 번만 순회한다** — 제너레이터는 두 번 못 돈다.
    // `rows.length`에 기대는 구현은 여기서 터진다.
    let n = 0
    for (const p of rows) {
      this.params.push([...p])
      n++
    }
    this.bulk.push({ sql, rows: n })
    return { changes: n * this.changes }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    this.txDepth++
    this.maxTxDepth = Math.max(this.maxTxDepth, this.txDepth)
    try {
      return await fn()
    } finally {
      this.txDepth--
    }
  }

  async close(): Promise<void> {}
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
  it("SQLite 없이 가짜 드라이버만으로 리포지토리가 돈다", async () => {
    const fake = new FakeDriver()
    const repo = new Repository(fake)

    await repo.openBatch(BATCH)
    fake.setNextGet({ n: 0 })
    await repo.loadChunk("fact_order", BATCH, [
      { id: "o1", source_key: "K1", ordered_at: "2026-07-01", status: "PAID", total_amount: 1000 },
    ])
    await repo.commitBatch("b1", "2026-08-12T00:01:00Z")
    await repo.undoBatch("b1", "2026-08-12T00:02:00Z")

    // 계약 밖의 것을 부르지 않았다면 여기까지 예외 없이 온다.
    expect(fake.sql.length).toBeGreaterThan(0)
    expect(fake.maxTxDepth).toBeGreaterThanOrEqual(1)
  })

  it("적재가 청크당 트랜잭션 하나를 쓴다 (ADR-001 조건 3)", async () => {
    const fake = new FakeDriver()
    const repo = new Repository(fake)
    fake.setNextGet({ n: 0 })
    await repo.loadChunk(
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

  it("행마다 prepare하지 않는다 — 문장을 재사용한다", async () => {
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
    await repo.loadChunk("fact_order", BATCH, rows)
    await repo.loadChunk("fact_order", BATCH, rows)

    // ★ 청크당 1회다. 행당 1회가 아니다 ★
    // 원격 드라이버(Tauri IPC)에서 행마다 왕복하면 #13이 80,137번이 된다 (ADR-008).
    const inserts = fake.bulk.filter((b) => b.sql.startsWith("INSERT INTO fact_order"))
    expect(inserts).toHaveLength(2) // 청크 2개
    expect(inserts.map((b) => b.rows)).toEqual([100, 100])

    // SQL 문자열은 캐시되어 두 청크가 **같은 문장**을 쓴다.
    expect(inserts[0]!.sql).toBe(inserts[1]!.sql)
    // 그리고 파라미터는 200행이 전부 내려갔다 — 벌크가 행을 삼키지 않았다.
    expect(fake.params.filter((p) => p.length > 5)).toHaveLength(200)
  })

  it("★ 드라이버 표면은 SQL 실행 계열뿐이다 — 도메인 로직이 내려가지 않았다 ★", () => {
    // ADR-008 조건 2. 리포지토리를 Rust로 옮기는 안(B)을 기각한 이유가
    // "되돌리기 의미론·shadow 규칙·LIFO 판정이 두 벌이 된다"였다. A로 가더라도
    // 그 로직이 드라이버로 스며들면 기각의 의미가 사라진다.
    const actual = Object.keys(openNodeDriver(":memory:", { pragmas: false })).sort()
    expect(actual).toEqual([...DRIVER_SURFACE].sort())

    // 이름만 봐도 도메인이 아니어야 한다 — batch·undo·shadow·adjustment 금지.
    const domainWords = /batch|undo|shadow|adjust|recon|fact_|profit|source_key/i
    const leaked = actual.filter((k) => domainWords.test(k))
    expect(leaked.join(", "), "드라이버에 도메인 개념이 생겼다 (ADR-008 조건 2)").toBe("")
  })

  it("드라이버 계약 자체에도 도메인 이름이 없다", () => {
    const contract = readFileSync(join(STORE_DIR, "driver.ts"), "utf-8")
    // 인터페이스 본문의 메서드 이름만 본다 — 주석의 설명은 의존이 아니다.
    const body = contract.slice(contract.indexOf("export interface Driver"))
    const methods = [...body.matchAll(/^\s{2}(\w+)[<(]/gm)].map((m) => m[1]!)
    expect(methods.sort()).toEqual([...DRIVER_SURFACE].sort())
  })

  it("store 밖으로 드라이버 구현이 새지 않는다", async () => {
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
  it("전체 테이블을 읽는 함수가 존재하지 않는다", async () => {
    const surface = Object.getOwnPropertyNames(Repository.prototype)
    // 있으면 안 되는 이름들. "없다"를 테스트로 고정한다.
    for (const banned of ["selectAll", "findAll", "loadAll", "all", "dump", "query", "raw", "exec"]) {
      expect(surface, `Repository에 ${banned}가 있다`).not.toContain(banned)
    }
  })

  it("조회는 범위를 반드시 받는다", async () => {
    const repo = new Repository(new FakeDriver())
    // countInRange·sumInRange 둘 다 from/to가 필수 인자다 — 시그니처로 강제된다.
    expect(Repository.prototype.countInRange.length).toBeGreaterThanOrEqual(5)
    expect(Repository.prototype.sumInRange.length).toBeGreaterThanOrEqual(6)
    expect(repo).toBeDefined()
  })

  it("Fact 테이블 직접 조회를 거부한다", async () => {
    const repo = new Repository(new FakeDriver())
    for (const t of FACT_TABLES) {
      await expect(
        repo.countInRange(t, "lib", "ordered_at", "2026-07-01", "2026-07-31"),
      ).rejects.toThrow(/active_\* 뷰로만/)
    }
  })

  it("식별자에 SQL을 끼워 넣을 수 없다", async () => {
    const repo = new Repository(new FakeDriver())
    await expect(
      repo.sumInRange("active_order", "total_amount; DROP TABLE batch", "lib", "ordered_at", "a", "b"),
    ).rejects.toThrow(/허용되지 않는 식별자/)
  })

  it("공통 6컬럼을 호출자가 직접 넘길 수 없다", async () => {
    const repo = new Repository(new FakeDriver())
    await expect(
      repo.loadChunk("fact_order", BATCH, [
        { id: "o1", source_key: "K1", library_id: "다른값" } as never,
      ]),
    ).rejects.toThrow(/공통 컬럼은 직접 넘길 수 없다/)
  })
})

/**
 * ★ 남의 DB의 **파일 성질**을 바꾸지 않는다 (2026-08-16 사고) ★
 *
 * 재가져오기 도구가 개발용 DB를 `pragmas: true`로 열었고, 그 안의
 * `PRAGMA journal_mode = WAL` 한 줄이 그 파일을 `delete` → `wal`로 **영구히**
 * 바꿨다. 앱은 늘 `pragmas: false`로 열어 왔으므로 그 DB는 계속 롤백 모드였는데,
 * 모드가 바뀌자 앱의 조회가 전부 실패하고 화면이 통째로 비었다.
 *
 * 「연결에만 사는 설정」과 「파일에 남는 설정」을 가른 것이 처방이고, 이 게이트가
 * 그 갈래를 지킨다.
 */
describe("저널 모드 — 파일에 남는 것은 이름을 불러야 걸린다", () => {
  const tmp = (): string =>
    join(tmpdir(), `fb-journal-${process.pid}-${counter++}.sqlite`)
  let counter = 0

  it("기본으로 열면 남의 DB 저널 모드가 그대로다", async () => {
    const path = tmp()
    // 롤백 모드 DB를 만든다 (앱이 쓰는 그 상태)
    const seed = openNodeDriver(path, { pragmas: false })
    await seed.exec("PRAGMA journal_mode = DELETE")
    await seed.exec("CREATE TABLE t (a INTEGER)")
    await seed.close()

    const db = openNodeDriver(path) // pragmas 기본 = 켬
    const mode = await db.prepare("PRAGMA journal_mode").get()
    await db.close()
    expect(String(mode?.["journal_mode"]).toLowerCase(), "도구가 남의 파일을 바꿨다").toBe(
      "delete",
    )
    rmSync(path, { force: true })
  })

  it("가드를 부러뜨려 확인한다 — journal: true면 실제로 바뀐다", async () => {
    const path = tmp()
    const seed = openNodeDriver(path, { pragmas: false })
    await seed.exec("PRAGMA journal_mode = DELETE")
    await seed.exec("CREATE TABLE t (a INTEGER)")
    await seed.close()

    const db = openNodeDriver(path, { journal: true })
    const mode = await db.prepare("PRAGMA journal_mode").get()
    await db.close()
    expect(String(mode?.["journal_mode"]).toLowerCase()).toBe("wal")
    for (const s of ["", "-wal", "-shm"]) rmSync(`${path}${s}`, { force: true })
  })
})
