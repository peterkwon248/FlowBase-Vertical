/**
 * Tauri 커맨드 표면 — **벙어리 실행기 경계가 지켜지는가.**
 *
 * ADR-008은 리포지토리를 Rust로 옮기는 안(B)을 기각했다. 그 기각이 의미를
 * 가지려면 Rust 쪽에 도메인이 없어야 한다. 여기 있는 것이 그 단언이다.
 *
 * 이 테스트는 **소스를 읽어서** 판정한다. 실제로 IPC를 태우지 않는 이유는
 * 경계가 런타임 동작이 아니라 **표면의 모양**이기 때문이다 — 커맨드가 하나
 * 늘어나는 순간 잡혀야 하고, 그건 웹뷰를 띄우지 않아도 알 수 있다.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { COMMANDS } from "../src/core/store/driver-tauri.js"

const LIB = readFileSync("src-tauri/src/lib.rs", "utf8")
const DB = readFileSync("src-tauri/src/db.rs", "utf8")

/** 주석을 걷어낸 실제 코드. 금지어 검사는 코드만 봐야 한다 — 이 파일들의
 *  주석은 오히려 "여기 있으면 안 되는 것"을 이름으로 적어두고 있기 때문이다. */
function codeOnly(src: string): string {
  return src
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n")
}

describe("Rust 커맨드 표면", () => {
  it("등록된 커맨드가 TS 쪽 목록과 정확히 같다", () => {
    const registered = [...LIB.matchAll(/db::(db_\w+)/g)].map((m) => m[1]).sort()
    expect(registered).toEqual([...COMMANDS].sort())
  })

  it("정의된 커맨드가 등록된 것 말고는 없다", () => {
    const defined = [...DB.matchAll(/#\[tauri::command\]\s*pub fn (\w+)/g)]
      .map((m) => m[1])
      .sort()
    expect(defined).toEqual([...COMMANDS].sort())
  })

  it("커맨드는 db.rs에만 있다 — 다른 곳에서 표면이 늘어나지 않는다", () => {
    expect(LIB).not.toMatch(/#\[tauri::command\]/)
  })

  it("이름이 전부 SQL 실행 계열이다", () => {
    // db_open/db_close는 연결 수명, 나머지는 실행. 그 밖의 동사가 생기면
    // 도메인이 내려온 것이다 (db_undo_batch 같은 것).
    for (const c of COMMANDS) {
      expect(c, `${c}는 SQL 실행 계열 이름이 아니다`).toMatch(
        /^db_(open|close|exec|run|get|all|run_many)$/,
      )
    }
  })
})

describe("도메인이 Rust로 스며들지 않았다 (ADR-008 조건 2)", () => {
  const code = codeOnly(DB).toLowerCase()

  /** 되돌리기 의미론(ADR-004)·스키마 지식이 내려왔는지 보는 낱말들. */
  const FORBIDDEN = [
    "row_shadow",
    // `batch`가 아니라 `batch_id`를 본다. rusqlite의 `execute_batch`가 API
    // 이름이라 단어만 보면 그것까지 잡히는데, 정작 위험한 것은 스키마를
    // 아는 것이므로 컬럼명으로 좁혔다.
    "batch_id",
    "adjustment",
    "lifo",
    "undo",
    "revert",
    "fact_",
    "source_key",
    "mapping_version",
    "library_id",
    "connection_id",
  ]

  for (const word of FORBIDDEN) {
    it(`"${word}"를 모른다`, () => {
      expect(code, `db.rs 코드에 ${word}가 있다 — 도메인이 내려왔다`).not.toContain(word)
    })
  }

  it("SQL 문자열을 만들지 않는다 — 받은 것을 실행할 뿐이다", () => {
    // 커맨드가 SQL을 조립하기 시작하면 스키마를 아는 것이다.
    expect(code).not.toMatch(/"\s*(select|insert|update|delete)\s/i)
  })

  it("트랜잭션 깊이를 세지 않는다 — 그 판단은 리포지토리 층에 있다", () => {
    expect(code).not.toMatch(/\bdepth\b/)
    expect(code).not.toMatch(/savepoint/)
  })
})
