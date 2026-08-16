/**
 * [합성] Tauri 연결이 **전역 하나**일 때 두 동작이 겹치면 무슨 일이 나는가.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 파일은 두 번 쓰였다 ★
 *
 * 처음(2026-08-16 오전)에는 **재현**이었다. 그때 `db.rs`의 계약은 이랬다:
 *
 * ```rust
 * pub struct Db(Mutex<Option<Connection>>);   // 연결 하나
 * db_open  →  *guard = Some(conn)             // 있던 것을 **교체**한다
 * db_close →  guard.take()                    // **가져가 버린다**
 * ```
 *
 * 두 동작을 겹쳤더니 둘 다 재현됐다 —
 * ① 남의 close가 도는 적재의 연결을 가져간다 → 「DB가 열려 있지 않다」
 * ② 닫지 않아도 **교체**만으로 적재가 남의 연결에서 돈다 (트랜잭션 경계가 섞인다)
 *
 * 지금은 **계약이 바뀌었다.** 열기마다 임차 번호가 나오고, 이미 임차 중이면
 * 새 열기를 거절하며, 명령은 자기 번호가 아니면 듣지 않는다. 그래서 이 파일은
 * 이제 «그 두 사고가 **일어날 수 없다**»를 단언한다. 재현하던 시나리오를 그대로
 * 두고 결말만 바꾼 것이 요점이다 — 시나리오를 지우면 무엇을 막고 있는지가
 * 사라진다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 여전히 합성이다 ★ 진짜 Rust를 돌리려면 앱을 띄워야 한다. 아래 가짜는
 * `src-tauri/src/db.rs`의 **바뀐 계약**을 모사한다. 이 시험이 답하는 것은
 * «분기가 살아 있는가»뿐이고, 「실제 앱에서 얼마나 자주 겹치는가」는 답하지
 * 않는다 (ADR-007 경계).
 */

import { describe, expect, it } from "vitest"
import { openTauriDriver } from "../src/core/store/driver-tauri.js"

/**
 * 바뀐 `db.rs`를 모사한다. 실제 SQL은 돌리지 않는다 — 계약만 본다.
 *
 * ```rust
 * db_open(path, force) -> Opened { lease, took_over }   이미 있으면 force가 아닌 한 거절
 * db_close(lease)                                       자기 번호일 때만 닫는다
 * 나머지(lease, …)                                      번호가 다르면 거절
 * ```
 */
function fakeRust() {
  let open: { lease: number } | null = null
  let issued = 0
  const log: string[] = []
  const invoke = async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
    // IPC는 비동기다 — 그 사이에 다른 동작이 끼어들 수 있다는 것이 이 시험의 전부다
    await Promise.resolve()
    const lease = Number(args?.["lease"] ?? 0)
    switch (cmd) {
      case "db_open": {
        const force = args?.["force"] === true
        if (open !== null && !force) {
          log.push("open거절")
          throw new Error("DB를 이미 다른 동작이 쓰고 있다 — 한 번에 하나만 연다")
        }
        const tookOver = open !== null
        open = { lease: ++issued }
        log.push(`open#${open.lease}${tookOver ? "(넘겨받음)" : ""}`)
        return { lease: open.lease, tookOver }
      }
      case "db_close":
        if (open === null || open.lease !== lease) {
          log.push(`close무시#${lease}`)
          return null
        }
        log.push(`close#${lease}`)
        open = null
        return null
      default:
        if (open === null) throw new Error("DB가 열려 있지 않다")
        if (open.lease !== lease) {
          throw new Error("이 연결은 더 이상 유효하지 않다 — 다른 동작이 DB를 넘겨받았다")
        }
        log.push(`${cmd}#${lease}`)
        return cmd === "db_all" ? [] : 0
    }
  }
  return { invoke, log, current: () => open }
}

describe("[합성] 한 번에 하나 — 저장 계층이 거부한다", () => {
  it("★ 도는 적재가 있으면 두 번째 열기가 **거절된다** ★ (①의 결말이 바뀌었다)", async () => {
    const rust = fakeRust()

    // ① «적재»가 연결을 연다
    const importer = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })
    await importer.exec("PRAGMA foreign_keys = ON")

    // ② 그 사이에 «원가 저장»이 자기 연결을 열려 한다 (data.ts의 writeThenReload 모양)
    await expect(
      openTauriDriver("pnl.sqlite", { invoke: rust.invoke }),
      "남의 연결을 말없이 교체하지 않는다",
    ).rejects.toThrow("이미 다른 동작이 쓰고 있다")

    // ③ 적재는 **아무 일 없었다는 듯** 이어진다. 이것이 이 처방의 값이다.
    await expect(
      importer.runMany("INSERT INTO x VALUES (?)", [["x"]]),
    ).resolves.toEqual({ changes: 0 })

    expect(rust.log).toContain("open거절")
  })

  it("★ 남의 close가 도는 적재의 연결을 **가져가지 못한다** ★", async () => {
    const rust = fakeRust()
    const importer = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })

    // 이전 세션의 잔여물처럼 «번호를 모르는 close»가 들어온 상황을 만든다.
    // (앱에서는 열기 자체가 거절되므로 여기까지 오지도 않는다 — 계약의 두 번째 문이다)
    await rust.invoke("db_close", { lease: 999 })

    await expect(importer.exec("SELECT 1")).resolves.toBeUndefined()
    expect(rust.log).toContain("close무시#999")
    expect(rust.current()?.lease, "적재의 연결이 그대로 살아 있다").toBe(1)
  })

  it("★ 넘겨받은 뒤의 옛 번호는 **명령이 거부된다** ★ (②의 트랜잭션 섞임을 막는 문)", async () => {
    const rust = fakeRust()
    const stale = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })

    // 새 세션의 첫 열기만 넘겨받는다 (`data.ts`의 firstOpen).
    const fresh = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke, force: true })

    // 옛 드라이버로 BEGIN을 보내도 남의 연결에서 돌지 않는다 — 거절된다.
    await expect(stale.exec("BEGIN")).rejects.toThrow("더 이상 유효하지 않다")
    await expect(fresh.exec("BEGIN")).resolves.toBeUndefined()
  })

  it("넘겨받으면 **알린다** — 조용히 치우지 않는다 (헌장 6)", async () => {
    const rust = fakeRust()
    await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })

    let told = 0
    await openTauriDriver("pnl.sqlite", {
      invoke: rust.invoke,
      force: true,
      onTakeOver: () => told++,
    })
    expect(told).toBe(1)

    // 넘겨받을 것이 없으면 말하지 않는다 — «0이면 말하지 않는다»의 그 규율.
    const clean = fakeRust()
    let quiet = 0
    await openTauriDriver("pnl.sqlite", {
      invoke: clean.invoke,
      force: true,
      onTakeOver: () => quiet++,
    })
    expect(quiet).toBe(0)
  })

  it("직렬화하면 아무 일도 없다 — 정상 경로가 막히지 않는다", async () => {
    const rust = fakeRust()
    const a = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })
    await a.exec("SELECT 1")
    await a.close()
    const b = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })
    await expect(b.exec("SELECT 1")).resolves.toBeUndefined()
    await b.close()
  })
})
