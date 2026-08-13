/**
 * Tauri 어댑터 — **IPC 없이** 계약을 지키는지 본다.
 *
 * 가짜 `invoke`를 넣어 호출을 기록한다. 웹뷰를 띄우지 않고도 트랜잭션 깊이,
 * 벌크 적재, PRAGMA 순서를 확인할 수 있고, 그게 어댑터가 `invoke`를
 * 주입받게 만든 이유다.
 *
 * 보는 것은 `driver-node.ts`와 **같은 의미론인가**이다. 두 드라이버가 여기서
 * 갈라지면 되돌리기(ADR-004)가 실행 환경에 따라 다르게 동작하게 된다.
 */

import { describe, expect, it } from "vitest"
import { openTauriDriver, type Command, type InvokeFn } from "../src/core/store/driver-tauri.js"
import { PRAGMAS } from "../src/core/store/driver.js"

interface Call {
  cmd: Command
  args: Record<string, unknown>
}

function fake(result: (cmd: Command) => unknown = () => 0) {
  const calls: Call[] = []
  const invoke: InvokeFn = async (cmd, args) => {
    calls.push({ cmd, args })
    return result(cmd)
  }
  /** `db_exec`로 나간 SQL만 순서대로. 트랜잭션 흐름을 이걸로 읽는다. */
  const sqls = (): string[] =>
    calls.filter((c) => c.cmd === "db_exec").map((c) => String(c.args["sql"]))
  return { calls, invoke, sqls }
}

describe("여는 순간", () => {
  it("DB를 열고 PRAGMA를 계약 순서대로 건다", async () => {
    const f = fake()
    await openTauriDriver("app.sqlite", { invoke: f.invoke })
    expect(f.calls[0]?.cmd).toBe("db_open")
    expect(f.calls[0]?.args).toEqual({ path: "app.sqlite" })
    expect(f.sqls()).toEqual([...PRAGMAS])
  })

  it("pragmas: false면 걸지 않는다", async () => {
    const f = fake()
    await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    expect(f.sqls()).toEqual([])
  })
})

describe("트랜잭션 — 깊이 판단은 이쪽 몫이다", () => {
  it("BEGIN → 본문 → COMMIT", async () => {
    const f = fake()
    const db = await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    await db.transaction(async () => {
      await db.exec("INSERT INTO t VALUES (1)")
    })
    expect(f.sqls()).toEqual(["BEGIN", "INSERT INTO t VALUES (1)", "COMMIT"])
  })

  it("본문이 던지면 ROLLBACK하고 그대로 올린다", async () => {
    const f = fake()
    const db = await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    await expect(
      db.transaction(async () => {
        throw new Error("터졌다")
      }),
    ).rejects.toThrow("터졌다")
    expect(f.sqls()).toEqual(["BEGIN", "ROLLBACK"])
  })

  it("중첩되면 SAVEPOINT로 내린다 — BEGIN을 두 번 보내지 않는다", async () => {
    const f = fake()
    const db = await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    await db.transaction(async () => {
      await db.transaction(async () => {
        await db.exec("INSERT INTO t VALUES (1)")
      })
    })
    expect(f.sqls()).toEqual([
      "BEGIN",
      "SAVEPOINT sp_1",
      "INSERT INTO t VALUES (1)",
      "RELEASE sp_1",
      "COMMIT",
    ])
  })

  it("중첩 안쪽이 던지면 그 지점까지만 되돌린다", async () => {
    const f = fake()
    const db = await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    await db.transaction(async () => {
      await db.transaction(async () => {
        throw new Error("안쪽")
      }).catch(() => {})
      await db.exec("계속한다")
    })
    expect(f.sqls()).toEqual([
      "BEGIN",
      "SAVEPOINT sp_1",
      "ROLLBACK TO sp_1",
      "RELEASE sp_1",
      "계속한다",
      "COMMIT",
    ])
  })
})

describe("벌크 적재 — 왕복이 청크당 1회다", () => {
  it("행이 몇 개든 db_run_many는 한 번만 부른다", async () => {
    const f = fake((cmd) => (cmd === "db_run_many" ? 3 : 0))
    const db = await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    const r = await db.runMany("INSERT INTO t VALUES (?)", [[1], [2], [3]])
    expect(r.changes).toBe(3)
    expect(f.calls.filter((c) => c.cmd === "db_run_many")).toHaveLength(1)
  })

  it("트랜잭션 밖이면 스스로 감싼다", async () => {
    const f = fake()
    const db = await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    await db.runMany("INSERT INTO t VALUES (?)", [[1]])
    expect(f.sqls()).toEqual(["BEGIN", "COMMIT"])
  })

  it("★ 이미 트랜잭션 안이면 SAVEPOINT를 더 열지 않는다 ★", async () => {
    const f = fake()
    const db = await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    await db.transaction(async () => {
      await db.runMany("INSERT INTO t VALUES (?)", [[1]])
      await db.runMany("INSERT INTO t VALUES (?)", [[2]])
    })
    // 청크마다 SAVEPOINT를 여는 건 순수한 낭비다 (node 쪽과 같은 판단)
    expect(f.sqls()).toEqual(["BEGIN", "COMMIT"])
  })

  it("Iterable을 받아도 배열로 넘긴다 — 직렬화는 어댑터 몫이다", async () => {
    const f = fake()
    const db = await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    function* rows(): Generator<readonly number[]> {
      yield [1]
      yield [2]
    }
    await db.runMany("INSERT INTO t VALUES (?)", rows())
    const call = f.calls.find((c) => c.cmd === "db_run_many")
    expect(call?.args["rows"]).toEqual([[1], [2]])
  })
})

describe("준비된 문장", () => {
  it("prepare 자체는 왕복하지 않는다 — 실행할 때만 나간다", async () => {
    const f = fake()
    const db = await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    const before = f.calls.length
    const stmt = db.prepare("SELECT 1")
    expect(f.calls.length).toBe(before)
    await stmt.all()
    expect(f.calls[f.calls.length - 1]?.cmd).toBe("db_all")
  })

  it("get은 없으면 undefined다 — Rust의 null을 계약에 맞춘다", async () => {
    const f = fake((cmd) => (cmd === "db_get" ? null : 0))
    const db = await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    expect(await db.prepare("SELECT 1").get()).toBeUndefined()
  })

  it("파라미터를 그대로 넘긴다", async () => {
    const f = fake()
    const db = await openTauriDriver(":memory:", { invoke: f.invoke, pragmas: false })
    await db.prepare("SELECT ?, ?").all("a", 1)
    const call = f.calls.find((c) => c.cmd === "db_all")
    expect(call?.args).toEqual({ sql: "SELECT ?, ?", params: ["a", 1] })
  })
})
