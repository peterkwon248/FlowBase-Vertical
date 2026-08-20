/**
 * 제외 배너 접기 — **접되 숨기지 않는가** (마이그레이션 012).
 *
 * ─────────────────────────────────────────────────────────────
 * 사용자 지적: *"파일에서 7행이 제외됐습니다 — 이게 계속 떠서 불편함."*
 *
 * 그냥 닫으면 LOCK 6 위반이다. 제외 7행 중 5행은 「읽지 못한 행」이고 그건 양식
 * 해석이 틀렸다는 신호다 — 닫는 버튼이 그 신호를 지우면 배너가 있던 이유가 사라진다.
 *
 * 그래서 이 시험이 지키는 것은 「접힌다」가 아니라 **「접혀도 남는다」**와
 * **「사실이 바뀌면 다시 펴진다」** 둘이다.
 * ─────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from "vitest"
import { openNodeDriver } from "@core/store/driver-node.js"
import { migrate } from "@core/store/migrate-node.js"
import { Repository } from "@core/store/repository.js"
import { excludedBanner } from "../src/app/dashboard.js"

const LIB = "lib-1"
const KEY = "dash.excluded"
const NOW = "2026-08-21T10:00:00"

async function fresh() {
  const db = openNodeDriver(":memory:")
  await migrate(db)
  const repo = new Repository(db)
  await repo.ensureLibrary(LIB, "기본", NOW)
  return { db, repo }
}

describe("알림 확인 (012) — 저장 계층", () => {
  it("★ 행이 없으면 «미확인»이다 — false가 아니라 null이다 (§22) ★", async () => {
    const { db, repo } = await fresh()
    expect(await repo.noticeAck(LIB, KEY)).toBeNull()
    await db.close()
  })

  it("★ 「봤다」가 아니라 «이 수를 봤다»를 저장한다 ★", async () => {
    const { db, repo } = await fresh()
    await repo.setNoticeAck(LIB, KEY, 7, NOW)
    // 수를 안 들고 있으면 제외가 12행이 돼도 화면이 조용하다 — 가장 나쁜 실패다.
    expect(await repo.noticeAck(LIB, KEY)).toBe(7)
    await db.close()
  })

  it("다시 누르면 그때의 수로 갱신된다 — 행이 늘지 않는다", async () => {
    const { db, repo } = await fresh()
    await repo.setNoticeAck(LIB, KEY, 7, NOW)
    await repo.setNoticeAck(LIB, KEY, 12, NOW)
    expect(await repo.noticeAck(LIB, KEY)).toBe(12)
    const n = (await db
      .prepare(`SELECT COUNT(*) AS n FROM notice_ack`)
      .get()) as Record<string, unknown>
    expect(Number(n["n"])).toBe(1)
    await db.close()
  })

  it("확인을 거두면 다시 «미확인»이다 — 반대 선언이 아니라 «없음»이다", async () => {
    const { db, repo } = await fresh()
    await repo.setNoticeAck(LIB, KEY, 7, NOW)
    await repo.clearNoticeAck(LIB, KEY)
    expect(await repo.noticeAck(LIB, KEY)).toBeNull()
    await db.close()
  })

  it("키가 다르면 서로를 건드리지 않는다 — 이 표는 나중에 진단도 받는다", async () => {
    const { db, repo } = await fresh()
    await repo.setNoticeAck(LIB, KEY, 7, NOW)
    expect(await repo.noticeAck(LIB, "diag.todo")).toBeNull()
    await db.close()
  })
})

describe("제외 배너 — 접되 숨기지 않는다", () => {
  it("미확인이면 배너가 펴진다", () => {
    expect(excludedBanner(7, null)).toEqual({
      banner: true,
      chip: true,
      chipLabel: "일부 제외",
    })
  })

  it("★ 확인하면 배너는 접히되 **칩은 남는다** — 세고 있는 부재다 ★", () => {
    const b = excludedBanner(7, 7)
    expect(b.banner, "배너가 접혀야 한다").toBe(false)
    expect(b.chip, "칩까지 사라지면 그게 조용한 실패다").toBe(true)
    expect(b.chipLabel).toContain("확인함")
  })

  it("★★ 수가 늘면 **다시 펴진다** — 확인한 적 없는 새 사실이다 ★★", () => {
    // 5행일 때 확인했는데 새 파일로 7행이 됐다.
    expect(excludedBanner(7, 5).banner).toBe(true)
    expect(excludedBanner(7, 5).chipLabel).toBe("일부 제외")
  })

  it("수가 줄면 그대로 접혀 있다 — 되돌리기로 준 것은 다시 물을 일이 아니다", () => {
    expect(excludedBanner(3, 9).banner).toBe(false)
    expect(excludedBanner(3, 9).chipLabel).toContain("확인함")
  })

  it("제외가 0이면 배너도 칩도 없다 — 없는 것을 말하지 않는다", () => {
    expect(excludedBanner(0, null)).toMatchObject({ banner: false, chip: false })
  })
})
