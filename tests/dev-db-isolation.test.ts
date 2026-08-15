/**
 * 개발용 DB 격리 — **테스트는 살아 있는 DB를 열지 않는다** (`tests/dev-db.ts`).
 *
 * 세 파일을 고치는 것만으로는 같은 사고가 다시 온다. 다음 사람이 «개발 DB에 붙이는
 * 불변식 테스트»를 하나 더 쓰면 `.tmp/pnl.sqlite`를 그대로 열 것이고, 그때 워커가
 * 넷이 된다. **어길 수 있는 상태를 없앤다** — 규칙을 게이트로 만든다.
 */

import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { DEV_DB, DEV_SNAPSHOT } from "./dev-db.js"

/** 이 파일만 원본 경로를 안다. 나머지는 스냅샷을 통해서만 닿는다. */
const OWNER = "dev-db.ts"

describe("개발용 DB는 스냅샷으로만 읽는다", () => {
  it("어떤 테스트도 원본 경로를 직접 열지 않는다", () => {
    const files = readdirSync("tests").filter((f) => f.endsWith(".ts"))
    expect(files.length, "테스트 파일을 하나도 못 찾았다 — 경로가 바뀌었나").toBeGreaterThan(20)

    for (const f of files) {
      if (f === OWNER) continue
      const code = readFileSync(`tests/${f}`, "utf8")
        // 주석은 판정에서 뺀다 — 이 사고의 내력을 적어 두는 것까지 막을 이유는 없다
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
      expect(
        code.includes(DEV_DB),
        `tests/${f}가 ${DEV_DB}를 직접 연다 — DEV_SNAPSHOT을 쓴다 (tests/dev-db.ts 참조)`,
      ).toBe(false)
    }
  })

  /** 가드를 부러뜨려 확인한다 (작업 리듬 3) — 검사가 정말 읽고 있는가. */
  it("가드는 실제로 그 문자열을 본다", () => {
    const owner = readFileSync(`tests/${OWNER}`, "utf8")
    expect(owner.includes(DEV_DB), "소유자 파일에는 그 경로가 있어야 한다").toBe(true)
    // 위 검사가 «주석 제거 후»를 보므로, 상수 선언이 코드로 살아 있는지도 확인한다
    const code = owner.replace(/\/\*[\s\S]*?\*\//g, "")
    expect(code.includes(DEV_DB)).toBe(true)
  })

  /**
   * 스냅샷이 **쓰는 자 없는 롤백 모드**인지 — 독자끼리 부딪힐 여지가 남았는지를 잰다.
   * 개발용 DB가 없는 기기에서는 스냅샷도 없다. 그때는 검사할 대상이 없는 것이지
   * 실패가 아니다.
   */
  it("스냅샷은 롤백 모드이고 곁에 -wal/-shm이 없다", async () => {
    if (!existsSync(DEV_SNAPSHOT)) return
    const db = openNodeDriver(DEV_SNAPSHOT, { pragmas: false })
    try {
      const mode = await db.prepare("PRAGMA journal_mode").get()
      expect(String(mode?.["journal_mode"]).toLowerCase(), "WAL이면 독자가 -shm을 붙잡는다").toBe(
        "delete",
      )
    } finally {
      await db.close()
    }
    expect(existsSync(`${DEV_SNAPSHOT}-wal`)).toBe(false)
    expect(existsSync(`${DEV_SNAPSHOT}-shm`)).toBe(false)
  })
})
