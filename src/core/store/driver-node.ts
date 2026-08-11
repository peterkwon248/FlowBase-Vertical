/**
 * `node:sqlite` 어댑터 — **이 파일만 드라이버 구현을 안다.**
 *
 * 세션 2의 테스트가 도는 경로다. 실제 앱은 Tauri 쪽 바인딩을 쓰게 되고
 * (ADR-003), 그때 교체되는 것은 이 파일 하나다. 리포지토리는 `driver.ts`의
 * 계약만 보므로 손댈 필요가 없다.
 *
 * `createRequire`로 불러오는 이유: `node:sqlite`는 Node 22.5에 추가된 신규
 * 빌트인이라 Vite의 내장 목록에 없다. 정적 import를 쓰면 Vite가 `node:`
 * 접두를 떼고 `sqlite`라는 패키지를 찾다가 실패한다.
 */

import { createRequire } from "node:module"
import type { Driver, Row, RunResult, SqlValue, Statement } from "./driver.js"
import { applyPragmas } from "./driver.js"

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
    run(...params: readonly SqlValue[]): RunResult {
      const r = stmt.run(...params)
      // node:sqlite는 changes를 bigint로 줄 수 있다 — 계약은 number다.
      return { changes: Number(r.changes) }
    },
    get(...params: readonly SqlValue[]): Row | undefined {
      return stmt.get(...params) as Row | undefined
    },
    all(...params: readonly SqlValue[]): Row[] {
      return stmt.all(...params) as Row[]
    },
  }
}

export function openNodeDriver(path = ":memory:", { pragmas = true } = {}): Driver {
  const db = new (load().DatabaseSync)(path)
  let depth = 0

  const driver: Driver = {
    exec: (sql) => db.exec(sql),
    prepare: (sql) => wrap(db.prepare(sql)),

    transaction<T>(fn: () => T): T {
      // 중첩되면 SAVEPOINT로 내린다 — 바깥 트랜잭션을 깨지 않기 위해.
      if (depth > 0) {
        const name = `sp_${depth}`
        depth++
        db.exec(`SAVEPOINT ${name}`)
        try {
          const out = fn()
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
        const out = fn()
        db.exec("COMMIT")
        return out
      } catch (e) {
        db.exec("ROLLBACK")
        throw e
      } finally {
        depth--
      }
    },

    close: () => db.close(),
  }

  // `:memory:`에는 WAL이 적용되지 않는다 — SQLite가 조용히 무시하므로
  // 별도 분기가 필요 없다.
  if (pragmas) applyPragmas(driver)
  return driver
}
