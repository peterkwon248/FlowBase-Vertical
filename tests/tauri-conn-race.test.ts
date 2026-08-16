/**
 * [합성] Tauri 연결이 **전역 하나**일 때 두 동작이 겹치면 무슨 일이 나는가.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 합성인가 ★
 * 진짜 Rust를 돌리려면 앱을 띄워야 한다. 대신 **`src-tauri/src/db.rs`의 계약을
 * 그대로 모사**한다 — 읽고 확인한 것은 셋이다 (2026-08-16):
 *
 * ```rust
 * pub struct Db(Mutex<Option<Connection>>);   // 연결 하나
 * db_open  →  *guard = Some(conn)             // 있던 것을 **교체**한다
 * db_close →  guard.take()                    // **가져가 버린다**
 * with_conn →  guard.as_ref().ok_or("DB가 열려 있지 않다")
 * ```
 *
 * 그러니 이 시험이 답하는 것은 «분기가 살아 있는가»뿐이다 (ADR-007 경계).
 * 「실제 앱에서 얼마나 자주 겹치는가」는 답하지 않는다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 앱이 그 겹침을 막고 있는가 — 잠금이 둘인데 서로를 모른다 ★
 * `App.tsx`의 연결·원가 쓰기는 `busy.current`로 직렬화되는데 위저드의 적재는
 * `wiz.busy`라는 **다른 잠금**을 쓴다. 둘이 서로를 안 보므로 적재가 도는 동안
 * 원가 저장이 들어올 수 있고, 그 경로가 `openTauriDriver` → `db_open`이다.
 */

import { describe, expect, it } from "vitest"
import { openTauriDriver } from "../src/core/store/driver-tauri.js"

/** `db.rs`의 전역 연결 하나를 모사한다. 실제 SQL은 돌리지 않는다 — 계약만 본다. */
function fakeRust() {
  let conn: { id: number } | null = null
  let seq = 0
  const log: string[] = []
  const invoke = async (cmd: string, args?: Record<string, unknown>): Promise<unknown> => {
    // IPC는 비동기다 — 그 사이에 다른 동작이 끼어들 수 있다는 것이 이 시험의 전부다
    await Promise.resolve()
    switch (cmd) {
      case "db_open":
        conn = { id: ++seq }
        log.push(`open#${conn.id}(${String(args?.["path"] ?? "")})`)
        return null
      case "db_close":
        log.push(`close#${conn?.id ?? "-"}`)
        conn = null
        return null
      default:
        if (conn === null) throw new Error("DB가 열려 있지 않다")
        log.push(`${cmd}#${conn.id}`)
        return cmd === "db_all" ? [] : { changes: 0 }
    }
  }
  return { invoke, log, current: () => conn }
}

describe("[합성] 전역 연결 하나 — 두 동작이 겹치면", () => {
  it("★ 재현: 도는 적재의 연결을 남의 close가 가져간다 ★", async () => {
    const rust = fakeRust()

    // ① «적재»가 연결을 연다
    const importer = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })
    await importer.exec("PRAGMA foreign_keys = ON")

    // ② 그 사이에 «원가 저장»이 자기 연결을 열고 닫는다 (data.ts의 writeThenReload 모양)
    const writer = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })
    await writer.exec("SELECT 1")
    await writer.close()

    // ③ 적재가 다음 청크를 넣으려 한다
    await expect(
      importer.runMany("INSERT INTO fact_order VALUES (?)", [["x"]]),
      "남이 닫은 연결로 적재가 이어진다",
    ).rejects.toThrow("DB가 열려 있지 않다")

    // 그리고 그 실패의 결과가 대열 4 ③의 그것이다 — open batch 잔존
    expect(rust.log.join(" ")).toContain("close#2")
  })

  it("★ 재현: 닫지 않아도 «교체»만으로 갈린다 ★", async () => {
    const rust = fakeRust()
    const importer = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })
    const other = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })
    await other.exec("SELECT 1")

    // 적재는 자기 연결을 쓴다고 믿지만 실제로는 **남의 연결**에서 돈다.
    // 트랜잭션 경계가 통째로 섞인다 — 적재의 BEGIN 안에 남의 쓰기가 들어온다
    await importer.exec("BEGIN")
    expect(rust.current()?.id, "적재가 연 것은 1번인데 지금 사는 것은 2번이다").toBe(2)
  })

  /**
   * 이 시험이 **답하지 않는 것**을 적어 둔다 (7-f).
   * 실제 앱에서 이 겹침이 얼마나 자주 나는지는 여기서 알 수 없다 — 다만 «막는
   * 구조가 없다»는 것은 위 둘로 확정됐다.
   */
  it("직렬화하면 안 난다 — 그래서 처방은 «한 번에 하나»를 강제하는 것이다", async () => {
    const rust = fakeRust()
    const a = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })
    await a.exec("SELECT 1")
    await a.close()
    const b = await openTauriDriver("pnl.sqlite", { invoke: rust.invoke })
    await expect(b.exec("SELECT 1")).resolves.toBeUndefined()
    await b.close()
  })
})
