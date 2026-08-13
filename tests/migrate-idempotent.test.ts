/**
 * 마이그레이션 멱등성 — **두 번 실행해도 무손상.**
 *
 * 3a-b(이식)의 선행 조건이다. 앱이 영속 DB를 갖는 첫 순간이 곧 3a-b인데,
 * 그 순간 두 번째 실행에서 터지는 버그를 안고 착수하면 이식 내내
 * "DB 지우고 다시" 리듬이 생기고 **그 리듬이 영속성 버그를 가린다.**
 *
 * 예전 구현은 `schema_migration`을 조회하지 않고 매번 전부 다시 실행했다.
 * 테스트는 `:memory:`, 하네스는 매번 파일을 지워서 드러나지 않았을 뿐이다.
 */

import { describe, it, expect, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate, loadMigrations } from "../src/core/store/migrate-node.js"

const dirs: string[] = []
function tempDbPath(): string {
  const d = mkdtempSync(join(tmpdir(), "fb-mig-"))
  dirs.push(d)
  return join(d, "t.sqlite")
}

afterEach(() => {
  for (const d of dirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true })
    } catch {
      /* 지워지지 않으면 그만 — 임시 디렉터리다 */
    }
  }
})

describe("마이그레이션 멱등성 — 파일 DB를 다시 열어도 안전하다", () => {
  it("★ 같은 DB에 migrate를 두 번 돌려도 터지지 않는다 ★", async () => {
    const path = tempDbPath()
    const total = loadMigrations().length

    const a = openNodeDriver(path)
    const first = await migrate(a)
    expect(first).toHaveLength(total) // 처음엔 전부 적용
    await a.close()

    // 앱을 껐다 켠 상황. 예전 구현은 여기서 CREATE TABLE 중복으로 터졌다.
    const b = openNodeDriver(path)
    const second = await migrate(b)
    expect(second).toHaveLength(0) // 두 번째엔 적용할 게 없다

    const rows = await b.prepare(`SELECT version FROM schema_migration ORDER BY version`).all()
    expect(rows.map((r) => Number(r.version))).toEqual(loadMigrations().map((m) => m.version))
    await b.close()
  })

  it("세 번째·네 번째도 마찬가지다", async () => {
    const path = tempDbPath()
    for (let i = 0; i < 4; i++) {
      const db = openNodeDriver(path)
      const applied = await migrate(db)
      expect(applied).toHaveLength(i === 0 ? loadMigrations().length : 0)
      await db.close()
    }
  })

  it("★ 재실행이 데이터를 건드리지 않는다 ★", async () => {
    const path = tempDbPath()
    const a = openNodeDriver(path)
    await migrate(a)
    await a.prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`).run("L1", "내 라이브러리", "t0")
    await a.close()

    const b = openNodeDriver(path)
    await migrate(b)
    const r = await b.prepare(`SELECT name FROM library WHERE id = ?`).get("L1")
    // 재실행이 테이블을 다시 만들었다면 이 행이 사라졌을 것이다.
    expect(r?.name).toBe("내 라이브러리")
    await b.close()
  })

  it("스키마가 온전히 남는다 — 재실행 후에도 테이블·트리거가 그대로다", async () => {
    const path = tempDbPath()
    const a = openNodeDriver(path)
    await migrate(a)
    const before = await a.prepare(
      `SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`,
    ).all()
    await a.close()

    const b = openNodeDriver(path)
    await migrate(b)
    const after = await b.prepare(
      `SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`,
    ).all()
    expect(after).toEqual(before)
    await b.close()
  })

  it("번호가 겹치는 마이그레이션은 로드 단계에서 거부한다", async () => {
    // 번호로 적용 여부를 판정하므로, 겹치면 하나가 조용히 건너뛰어진다.
    // 두 사람이 각자 003을 만드는 상황은 실제로 흔하다.
    const d = mkdtempSync(join(tmpdir(), "fb-dup-"))
    dirs.push(d)
    const { writeFileSync } = await import("node:fs")
    writeFileSync(join(d, "001-a.sql"), "SELECT 1;")
    writeFileSync(join(d, "001-b.sql"), "SELECT 1;")
    expect(() => loadMigrations(d)).toThrow(/번호가 겹친다/)
  })
})
