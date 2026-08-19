/**
 * 브라우저에서 도는 SQLite — **드라이버 계약의 셋째 구현.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 셋째가 생겼나 ★
 *
 * 화면을 보려면 실기기에서 앱을 띄우고 창을 캡처해야 했다. 그게 비싸서
 * **안 보고 넘어가는 압력**이 생겼고(도넛 범례가 뭉개진 채 한 번 나갔다),
 * 클라우드 세션에서는 아예 불가능했다. 실제로 이번 세션에도 시트 목록을
 * 렌더해 보고 나서야 «행 수가 두 번 찍힌다»(결함 62)를 발견했다.
 *
 * ADR-003이 저장 계층을 **다섯 메서드**로 좁혀 둔 덕에, 셋째 구현을 더하는 일이
 * 화면·조회·손익 코드를 한 줄도 건드리지 않는다:
 *
 * ```
 * driver-node.ts   node:sqlite      테스트 · 하네스
 * driver-tauri.ts  rusqlite (IPC)   데스크톱 앱
 * driver-wasm.ts   sql.js (wasm)    브라우저          ← 이 파일
 * ```
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 메모리 DB다 — 새로고침하면 사라진다 ★
 * `sql.js`는 파일시스템이 없어 DB 전체를 메모리에 올린다. 그래서 이 드라이버로
 * 도는 웹판은 **보기 전용**이고, 화면이 그 사실을 말한다 (`isWasm`).
 * 「넣었는데 없어졌다」가 되지 않게 하는 것이 조용한 실패 금지(LOCK 6)의 이 자리
 * 적용이다.
 *
 * ★ 동기 API를 비동기 계약에 맞춘다 ★
 * sql.js는 전부 동기다. 계약이 `Promise`인 이유는 IPC(Tauri) 때문이지 여기서
 * 기다릴 것이 있어서가 아니라, 그냥 감싸면 된다. 반대 방향(비동기를 동기로)이면
 * 불가능했을 것이다 — 계약이 느슨한 쪽에 맞춰져 있어서 셋째가 들어올 수 있었다.
 */

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js"
import type { Driver, RunResult, Row, SqlValue, Statement } from "./driver.js"
import { SESSION_PRAGMAS } from "./driver.js"

export interface WasmDriverOptions {
  /** `sql-wasm.wasm`의 주소. 번들러가 준 URL을 그대로 넘긴다. */
  readonly wasmUrl: string
  /** 기존 DB 바이트. 없으면 빈 DB로 시작한다 (마이그레이션이 표를 만든다). */
  readonly bytes?: Uint8Array
}

let runtime: Promise<SqlJsStatic> | null = null

/** wasm 런타임은 **한 번만** 초기화한다 — 페이지당 여러 번 열어도 다시 받지 않는다. */
function sqlRuntime(wasmUrl: string): Promise<SqlJsStatic> {
  runtime ??= initSqlJs({ locateFile: () => wasmUrl })
  return runtime
}

/** sql.js가 돌려주는 값 → 계약의 `SqlValue`. */
function toSqlValue(v: unknown): SqlValue {
  if (v === null || v === undefined) return null
  if (typeof v === "number" || typeof v === "string") return v
  if (typeof v === "bigint") return Number(v)
  if (v instanceof Uint8Array) return null // BLOB은 이 앱의 스키마에 없다
  return String(v)
}

function toRow(obj: Record<string, unknown>): Row {
  const out: Row = {}
  for (const [k, v] of Object.entries(obj)) out[k] = toSqlValue(v)
  return out
}

export async function openWasmDriver(opts: WasmDriverOptions): Promise<Driver> {
  const SQL = await sqlRuntime(opts.wasmUrl)
  const db: Database = opts.bytes ? new SQL.Database(opts.bytes) : new SQL.Database()

  // 세션 설정은 세 구현이 **같은 목록**을 쓴다 (ADR-014). `journal_mode`는 파일에
  // 남는 설정이라 여기 없다 — 메모리 DB에는 애초에 해당이 없다.
  for (const p of SESSION_PRAGMAS) db.run(p)

  let depth = 0

  /**
   * BEGIN/COMMIT을 직접 다룬다. **중첩되면 SAVEPOINT로 내린다** —
   * `driver-node`와 같은 규칙이어야 리포지토리가 어느 드라이버에서 돌든
   * 같게 행동한다. 그냥 통과시키면 안쪽만 되돌릴 수 없어 «같은 코드, 다른 결과»가
   * 된다.
   */
  async function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (depth > 0) {
      const name = `sp_${depth}`
      depth++
      db.run(`SAVEPOINT ${name}`)
      try {
        const out = await fn()
        db.run(`RELEASE ${name}`)
        return out
      } catch (e) {
        db.run(`ROLLBACK TO ${name}`)
        db.run(`RELEASE ${name}`)
        throw e
      } finally {
        depth--
      }
    }

    depth++
    db.run("BEGIN")
    try {
      const out = await fn()
      db.run("COMMIT")
      return out
    } catch (e) {
      db.run("ROLLBACK")
      throw e
    } finally {
      depth--
    }
  }

  const statement = (sql: string): Statement => ({
    async run(...params: readonly SqlValue[]): Promise<RunResult> {
      db.run(sql, params as never)
      return { changes: db.getRowsModified() }
    },
    async get(...params: readonly SqlValue[]): Promise<Row | undefined> {
      const st = db.prepare(sql)
      try {
        st.bind(params as never)
        return st.step() ? toRow(st.getAsObject()) : undefined
      } finally {
        st.free()
      }
    },
    async all(...params: readonly SqlValue[]): Promise<Row[]> {
      const st = db.prepare(sql)
      try {
        st.bind(params as never)
        const out: Row[] = []
        while (st.step()) out.push(toRow(st.getAsObject()))
        return out
      } finally {
        st.free()
      }
    },
  })

  return {
    async exec(sql: string): Promise<void> {
      db.exec(sql)
    },

    prepare: statement,

    async runMany(sql: string, rows: Iterable<readonly SqlValue[]>): Promise<RunResult> {
      // ★ 문장을 **한 번만** 준비한다 ★ 행마다 준비하면 파싱 비용이 행 수만큼
      // 든다 (ADR-001 조건 3). 여기가 그 계약이 존재하는 이유다.
      const body = (): RunResult => {
        const st = db.prepare(sql)
        let changes = 0
        try {
          for (const params of rows) {
            st.run(params as never)
            changes += db.getRowsModified()
          }
        } finally {
          st.free()
        }
        return { changes }
      }
      // ★ 이미 트랜잭션 안이면 자체 트랜잭션을 열지 않는다 ★ `driver-node`와 같은
      // 규칙이다. 그냥 BEGIN을 걸면 «트랜잭션 안의 트랜잭션»으로 그 자리에서 터진다
      // — `recordExclusions`가 실제로 그 모양(transaction 안에서 runMany)이다.
      if (depth > 0) return body()
      return inTransaction(async () => body())
    },

    transaction: inTransaction,

    async close(): Promise<void> {
      db.close()
    },
  }
}
