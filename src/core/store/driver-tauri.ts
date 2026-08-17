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

/**
 * `db_open`이 돌려주는 것. **번호가 곧 임차권**이고, 이후 모든 명령이 그것을 든다.
 * 번호가 없는 명령은 없다 — 있으면 그 자리가 «남의 연결에서 도는» 구멍이 된다.
 */
export interface Opened {
  readonly lease: number
  /** 이전 세션의 연결이 남아 있어 넘겨받았나 (`force`로 연 첫 열기에서만 참). */
  readonly tookOver: boolean
}

export interface TauriDriverOptions {
  invoke?: InvokeFn
  /** 연결 설정을 건다 (기본 켬). **파일을 바꾸지 않는다.** */
  pragmas?: boolean
  /**
   * ★ 이미 열려 있어도 **넘겨받는다** — 세션의 첫 열기만 준다 ★
   *
   * 기본은 거짓이고, 그때 저장 계층은 「이미 다른 동작이 쓰고 있다」로 **거절**한다
   * (`db.rs`의 임차 계약). 웹뷰가 새로 뜨면 이전 세션의 번호를 아무도 못 쓰는데
   * 거절만 하면 앱이 영영 못 여므로, 그 한 번만 참으로 연다.
   */
  force?: boolean
  /** 넘겨받았을 때 부르는 쪽에 알린다. 조용히 치우지 않는다 (헌장 6). */
  onTakeOver?: () => void
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
  {
    invoke = defaultInvoke,
    pragmas = true,
    journal = false,
    force = false,
    onTakeOver,
  }: TauriDriverOptions = {},
): Promise<Driver> {
  const opened = (await invoke("db_open", { path, force })) as Opened | null

  /**
   * ★ 실행 파일이 프론트엔드보다 **오래됐을 때** 여기서 걸린다 (2026-08-16) ★
   *
   * 실제로 일어났다. 사용자가 나흘 전에 빌드된 `target/debug/app.exe`를 켰는데,
   * 그것은 개발 서버(`devUrl`)에서 **오늘의 프론트엔드**를 받아 온다. 옛 Rust의
   * `db_open`은 아무것도 돌려주지 않으므로(`Result<(), String>` → `null`) 여기서
   * `opened.lease`가 터졌고, 화면에는
   * *"Cannot destructure property 'lease' of 'opened' as it is null"*이 떴다.
   *
   * 그 문구는 **사용자가 할 일을 하나도 알려주지 않는다.** 원인이 「옛 실행
   * 파일」인데 읽는 사람은 데이터가 깨진 줄 안다. 그래서 그 조합을 이름으로
   * 불러 준다 — 문구가 «그래서 뭘 해야 하는데»까지 답해야 한다 (§22-3).
   */
  if (opened === null || typeof opened.lease !== "number") {
    throw new Error(
      "앱 실행 파일이 화면보다 오래됐습니다 — 옛 실행 파일이 새 저장 계약(임차 번호)을 " +
        "모릅니다. 앱을 완전히 닫고 최신 빌드로 다시 여세요 " +
        "(바탕화면 「FlowBase 손익」 · src-tauri/target/release/app.exe).",
    )
  }

  const { lease } = opened
  if (opened.tookOver) onTakeOver?.()

  let depth = 0

  const exec = async (sql: string): Promise<void> => {
    await invoke("db_exec", { lease, sql })
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
      const changes = (await invoke("db_run", { lease, sql, params })) as number
      return { changes }
    },
    async get(...params: readonly SqlValue[]): Promise<Row | undefined> {
      const row = (await invoke("db_get", { lease, sql, params })) as Row | null
      return row ?? undefined
    },
    async all(...params: readonly SqlValue[]): Promise<Row[]> {
      return (await invoke("db_all", { lease, sql, params })) as Row[]
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
        const changes = (await invoke("db_run_many", { lease, sql, rows: payload })) as number
        return { changes }
      }
      // 이미 트랜잭션 안이면 자체 트랜잭션을 열지 않는다 — 바깥이 이미
      // 원자성을 보장하므로 SAVEPOINT를 더 여는 건 낭비다 (node 쪽과 동일).
      if (depth > 0) return call()
      return inTransaction(call)
    },

    transaction: inTransaction,

    async close() {
      await invoke("db_close", { lease })
    },
  }

  // PRAGMA 목록은 계약 쪽(`driver.ts`)에 있다. 드라이버가 바뀌어도 설정이
  // 따라가야 하기 때문이다 (ADR-003).
  if (journal) for (const p of FILE_PRAGMAS) await exec(p)
  if (pragmas) for (const p of SESSION_PRAGMAS) await exec(p)

  return driver
}
