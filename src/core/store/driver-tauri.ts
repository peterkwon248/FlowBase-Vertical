/**
 * Tauri 어댑터 — **이 파일만 IPC를 안다.**
 *
 * 리포지토리는 `driver.ts`의 계약만 본다. `node:sqlite`(테스트·하네스)와 이것
 * (앱)이 같은 계약을 만족하므로, 위층은 어느 쪽에서 도는지 모른다.
 *
 * ★ 판단은 여기, 실행은 Rust ★
 * Rust 커맨드는 SQL을 실행할 뿐이고 **트랜잭션 깊이를 세지 않는다.** 중첩되면
 * SAVEPOINT로 내리는 것은 호출 순서에 대한 판단이므로 이쪽 몫이다 —
 * 도메인 판단이 Rust로 내려가면 리포지토리를 Rust로 옮기는 안을 기각한
 * 의미가 없어진다 (ADR-008 조건 2).
 *
 * ★ `invoke`를 주입받는 이유 ★
 * Tauri 런타임 없이 이 어댑터를 시험할 수 있어야 한다. 가짜 `invoke`를 넣으면
 * 트랜잭션 깊이·벌크 적재·PRAGMA 순서를 **웹뷰를 띄우지 않고** 검증할 수 있다.
 * 실제 앱에서는 인자를 생략해 `@tauri-apps/api`의 것을 쓴다.
 */

import type { Driver, Row, RunResult, SqlValue, Statement } from "./driver.js"
import { FILE_PRAGMAS, SESSION_PRAGMAS } from "./driver.js"

/** Rust 쪽 커맨드 이름. `src-tauri/src/lib.rs`의 등록 목록과 1:1이다. */
export const COMMANDS = [
  "db_open",
  "db_close",
  "db_exec",
  "db_run",
  "db_get",
  "db_all",
  "db_run_many",
] as const

export type Command = (typeof COMMANDS)[number]

export type InvokeFn = (cmd: Command, args: Record<string, unknown>) => Promise<unknown>

async function defaultInvoke(cmd: Command, args: Record<string, unknown>): Promise<unknown> {
  // 정적 import를 쓰면 Node에서 도는 테스트가 이 모듈을 로드하다 깨진다.
  // 앱(웹뷰)에서만 실제로 필요한 의존이므로 그때 부른다.
  const { invoke } = await import("@tauri-apps/api/core")
  return invoke(cmd, args)
}

export interface TauriDriverOptions {
  invoke?: InvokeFn
  /** 연결 설정을 건다 (기본 켬). **파일을 바꾸지 않는다.** */
  pragmas?: boolean
  /**
   * `journal_mode = WAL`까지 건다 — **그 DB 파일의 성질이 영구히 바뀐다.**
   * 앱은 켜지 않는다. 이 저장소의 개발용 DB는 OneDrive 폴더에 있어 WAL의 `-shm`이
   * 열리지 않을 수 있고, 그 실패는 화면이 통째로 비는 모양으로 나타난다
   * (`driver.ts`의 사고 기록).
   */
  journal?: boolean
}

export async function openTauriDriver(
  path: string,
  { invoke = defaultInvoke, pragmas = true, journal = false }: TauriDriverOptions = {},
): Promise<Driver> {
  await invoke("db_open", { path })

  let depth = 0

  const exec = async (sql: string): Promise<void> => {
    await invoke("db_exec", { sql })
  }

  /**
   * `driver-node.ts`와 **같은 의미론**이다. 두 드라이버가 여기서 갈라지면
   * 되돌리기(ADR-004)가 드라이버마다 다르게 동작하게 된다.
   */
  async function inTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (depth > 0) {
      const name = `sp_${depth}`
      depth++
      await exec(`SAVEPOINT ${name}`)
      try {
        const out = await fn()
        await exec(`RELEASE ${name}`)
        return out
      } catch (e) {
        await exec(`ROLLBACK TO ${name}`)
        await exec(`RELEASE ${name}`)
        throw e
      } finally {
        depth--
      }
    }

    depth++
    await exec("BEGIN")
    try {
      const out = await fn()
      await exec("COMMIT")
      return out
    } catch (e) {
      await exec("ROLLBACK")
      throw e
    } finally {
      depth--
    }
  }

  /**
   * 준비된 문장. **핸들을 만드는 것 자체는 왕복하지 않는다** — SQL 문자열을
   * 들고 있다가 실행할 때 넘긴다. 파싱 결과 재사용은 Rust 쪽
   * `prepare_cached`가 맡는다 (같은 SQL이면 같은 문장을 쓴다).
   */
  const prepare = (sql: string): Statement => ({
    async run(...params: readonly SqlValue[]): Promise<RunResult> {
      const changes = (await invoke("db_run", { sql, params })) as number
      return { changes }
    },
    async get(...params: readonly SqlValue[]): Promise<Row | undefined> {
      const row = (await invoke("db_get", { sql, params })) as Row | null
      return row ?? undefined
    },
    async all(...params: readonly SqlValue[]): Promise<Row[]> {
      return (await invoke("db_all", { sql, params })) as Row[]
    },
  })

  const driver: Driver = {
    exec,
    prepare,

    /**
     * 청크를 통째로 넘긴다. 행마다 왕복하면 #13 기준 80,137번이 되고,
     * 그게 원격 드라이버에서 적재가 무너지는 이유다 (`driver.ts` 주석).
     */
    async runMany(sql, rows) {
      const payload = [...rows].map((r) => [...r])
      const call = async (): Promise<RunResult> => {
        const changes = (await invoke("db_run_many", { sql, rows: payload })) as number
        return { changes }
      }
      // 이미 트랜잭션 안이면 자체 트랜잭션을 열지 않는다 — 바깥이 이미
      // 원자성을 보장하므로 SAVEPOINT를 더 여는 건 낭비다 (node 쪽과 동일).
      if (depth > 0) return call()
      return inTransaction(call)
    },

    transaction: inTransaction,

    async close() {
      await invoke("db_close", {})
    },
  }

  // PRAGMA 목록은 계약 쪽(`driver.ts`)에 있다. 드라이버가 바뀌어도 설정이
  // 따라가야 하기 때문이다 (ADR-003).
  if (journal) for (const p of FILE_PRAGMAS) await exec(p)
  if (pragmas) for (const p of SESSION_PRAGMAS) await exec(p)

  return driver
}
