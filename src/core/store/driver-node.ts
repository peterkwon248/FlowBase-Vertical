/**
 * `node:sqlite` 어댑터 — **이 파일만 드라이버 구현을 안다.**
 *
 * 테스트와 하네스가 도는 경로다. 실제 앱은 Tauri 쪽 바인딩을 쓰게 되고
 * (ADR-003·ADR-008), 그때 교체되는 것은 이 파일 하나다. 리포지토리는
 * `driver.ts`의 계약만 보므로 손댈 필요가 없다.
 *
 * ★ 여기가 왜 async인가 ★
 * `node:sqlite`는 동기다. 그런데 계약이 비동기인 이유는 Tauri IPC 때문이다
 * (ADR-008). 이 어댑터는 동기 호출을 즉시 resolve된 Promise로 감싼다 —
 * 비용은 마이크로태스크 하나이고, 얻는 것은 두 드라이버가 **같은 계약**을
 * 만족하는 것이다.
 *
 * `createRequire`로 불러오는 이유: `node:sqlite`는 Node 22.5에 추가된 신규
 * 빌트인이라 Vite의 내장 목록에 없다. 정적 import를 쓰면 Vite가 `node:`
 * 접두를 떼고 `sqlite`라는 패키지를 찾다가 실패한다.
 */

import { createRequire } from "node:module"
import type { Driver, Row, RunResult, SqlValue, Statement } from "./driver.js"
import { FILE_PRAGMAS, SESSION_PRAGMAS } from "./driver.js"

interface NodeStatement {
  run(...params: unknown[]): { changes: number | bigint }
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

interface NodeDatabase {
  exec(sql: string): void
  prepare(sql: string): NodeStatement
  close(): void
}

interface NodeSqliteModule {
  DatabaseSync: new (path: string) => NodeDatabase
}

// 모듈 id를 변수로 둬야 번들러의 정적 분석을 타지 않는다.
const MODULE_ID = "node:sqlite"
let cached: NodeSqliteModule | null = null

function load(): NodeSqliteModule {
  if (!cached) {
    cached = createRequire(import.meta.url)(MODULE_ID) as NodeSqliteModule
  }
  return cached
}

function wrap(stmt: NodeStatement): Statement {
  return {
    async run(...params: readonly SqlValue[]): Promise<RunResult> {
      const r = stmt.run(...params)
      // node:sqlite는 changes를 bigint로 줄 수 있다 — 계약은 number다.
      return { changes: Number(r.changes) }
    },
    async get(...params: readonly SqlValue[]): Promise<Row | undefined> {
      return stmt.get(...params) as Row | undefined
    },
    async all(...params: readonly SqlValue[]): Promise<Row[]> {
      return stmt.all(...params) as Row[]
    },
  }
}

/**
 * @param pragmas 연결 설정을 건다 (기본 켬). **파일을 바꾸지 않는다.**
 * @param journal `journal_mode = WAL`까지 건다 — **그 DB 파일의 성질이 영구히 바뀐다.**
 *   내가 만들고 나만 쓰는 DB에만 켠다. 남의 DB(앱의 개발용 DB 등)에 켜면
 *   그 파일을 여는 다음 사람이 다른 세계를 보게 된다 (`driver.ts`의 사고 기록).
 */
export function openNodeDriver(
  path = ":memory:",
  { pragmas = true, journal = false }: { pragmas?: boolean; journal?: boolean } = {},
): Driver {
  const db = new (load().DatabaseSync)(path)
  let depth = 0
  /** SQL → 준비된 문장. 벌크 적재가 청크마다 다시 준비하지 않게 한다. */
  const stmtCache = new Map<string, NodeStatement>()

  /** BEGIN/COMMIT을 직접 다룬다. 중첩되면 SAVEPOINT로 내린다. */
  async function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (depth > 0) {
      const name = `sp_${depth}`
      depth++
      db.exec(`SAVEPOINT ${name}`)
      try {
        const out = await fn()
        db.exec(`RELEASE ${name}`)
        return out
      } catch (e) {
        db.exec(`ROLLBACK TO ${name}`)
        db.exec(`RELEASE ${name}`)
        throw e
      } finally {
        depth--
      }
    }

    depth++
    db.exec("BEGIN")
    try {
      const out = await fn()
      db.exec("COMMIT")
      return out
    } catch (e) {
      db.exec("ROLLBACK")
      throw e
    } finally {
      depth--
    }
  }

  const driver: Driver = {
    async exec(sql) {
      db.exec(sql)
    },

    prepare: (sql) => wrap(db.prepare(sql)),

    /**
     * 같은 SQL을 여러 파라미터 묶음으로. **도메인 로직은 없다** — 준비된 문장
     * 하나를 N번 실행할 뿐이고, 전체가 한 트랜잭션이다 (ADR-008 조건 2).
     */
    async runMany(sql, rows) {
      // 준비된 문장을 캐시한다. 청크마다 다시 준비하면 그 파싱 비용이 청크 수만큼
      // 든다 (ADR-001 조건 3 — 계약이 벌크로 바뀌어도 이유는 그대로다).
      let stmt = stmtCache.get(sql)
      if (!stmt) {
        stmt = db.prepare(sql)
        stmtCache.set(sql, stmt)
      }
      const prepared = stmt
      const body = (): RunResult => {
        let changes = 0
        for (const params of rows) changes += Number(prepared.run(...params).changes)
        return { changes }
      }
      // 이미 트랜잭션 안이면 **자체 트랜잭션을 열지 않는다.** 바깥 것이 이미
      // 원자성을 보장하므로, 청크마다 SAVEPOINT를 더 여는 건 순수한 낭비다.
      if (depth > 0) return body()
      return inTransaction(async () => body())
    },

    transaction: inTransaction,

    async close() {
      db.close()
    },
  }

  // PRAGMA는 **동기로** 건다. `applyPragmas`(비동기)를 fire-and-forget으로
  // 부르면 `openNodeDriver`가 반환된 뒤에야 적용되어, 첫 질의가 설정 없는
  // 연결에서 돌 수 있다. 이 어댑터는 `node:sqlite`가 동기라는 걸 알고 있으므로
  // 그 사실을 쓴다 — 목록은 계약 쪽(`PRAGMAS`)에 그대로 둔다.
  //
  // `:memory:`에는 WAL이 적용되지 않는다 — SQLite가 조용히 무시하므로
  // 별도 분기가 필요 없다.
  if (journal) for (const p of FILE_PRAGMAS) db.exec(p)
  if (pragmas) for (const p of SESSION_PRAGMAS) db.exec(p)
  return driver
}
