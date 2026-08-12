/**
 * 마이그레이션 적용.
 *
 * 헌장 B-1이 "첫 마이그레이션부터 존재해야 하며 소급 추가 불가"라고 못 박은
 * 공통 6컬럼이 `001-initial.sql`에 있다. 그 파일은 **수정하지 않는다** —
 * 스키마 변경은 새 번호의 파일로 쌓는다.
 *
 * DB 핸들 타입을 좁게 잡아 둔 이유: 세션 2의 테스트는 `node:sqlite`로 돌지만
 * 실제 앱은 Tauri 쪽 바인딩을 쓴다 (ADR-003). 두 곳이 만족할 수 있는 최소
 * 표면만 요구한다.
 */

import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import type { Driver } from "./driver.js"

const here = dirname(fileURLToPath(import.meta.url))
export const MIGRATIONS_DIR = join(here, "migrations")

/**
 * 마이그레이션에 필요한 DB 표면 = 드라이버 계약 그대로.
 *
 * 예전에는 `exec` 하나만 요구했는데, **적용 여부를 조회해야 하므로** 읽기가
 * 필요해졌다. 저장 계층의 계약이 이미 `Driver`이고 호출부가 전부 그것을
 * 넘기므로 따로 좁힌 타입을 두지 않는다.
 */
export type MigratableDb = Driver

export interface Migration {
  readonly version: number
  readonly name: string
  readonly sql: string
}

export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const out = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => {
      const version = Number(f.slice(0, f.indexOf("-")))
      if (!Number.isInteger(version)) {
        throw new Error(`마이그레이션 파일명이 번호로 시작하지 않는다: ${f}`)
      }
      return { version, name: f, sql: readFileSync(join(dir, f), "utf-8") }
    })

  // 번호가 겹치면 하나가 **조용히 건너뛰어진다** — 적용 여부를 번호로 판정하기
  // 때문이다. 두 사람이 각자 003을 만드는 상황은 실제로 흔하다.
  const seen = new Map<number, string>()
  for (const m of out) {
    const dup = seen.get(m.version)
    if (dup) throw new Error(`마이그레이션 번호가 겹친다: ${dup} · ${m.name}`)
    seen.set(m.version, m.name)
  }
  return out
}

/**
 * 이미 적용된 버전. 첫 실행에는 `schema_migration` 자체가 없으므로 빈 집합이다
 * (그 테이블은 001이 만든다).
 */
async function appliedVersions(db: MigratableDb): Promise<Set<number>> {
  try {
    const rows = await db.prepare(`SELECT version FROM schema_migration`).all()
    return new Set(rows.map((r) => Number(r.version)))
  } catch {
    return new Set()
  }
}

/**
 * 아직 적용되지 않은 것만 적용한다. **여러 번 불러도 안전하다.**
 *
 * ★ 왜 멱등해야 하는가 ★
 * 예전 구현은 `schema_migration`을 **조회하지 않고** 매번 전부 다시 실행했다.
 * 테스트는 `:memory:`, 하네스는 매번 파일을 지우고 시작해서 드러나지 않았지만,
 * **앱이 영속 DB를 갖는 순간 두 번째 실행에서 터진다** — `CREATE TABLE`에
 * `IF NOT EXISTS`가 없고 003의 `ALTER TABLE`은 더 확실히 실패한다.
 *
 * 그 상태로 이식을 시작하면 "DB 지우고 다시" 리듬이 생기고, **그 리듬이
 * 영속성 버그를 가린다.** 그래서 앱이 생기기 전에 여기서 닫는다.
 *
 * 각 파일은 하나의 트랜잭션으로 적용된다 — 중간에 실패하면 그 파일의 변경이
 * 통째로 롤백되므로 반쯤 적용된 스키마가 남지 않는다. 적용 기록(`INSERT INTO
 * schema_migration`)도 같은 트랜잭션 안이라 기록과 실제가 어긋나지 않는다.
 *
 * @returns **이번에 적용한** 것만. 이미 적용돼 있던 것은 포함하지 않는다.
 */
export async function migrate(
  db: MigratableDb,
  dir: string = MIGRATIONS_DIR,
): Promise<Migration[]> {
  const done = await appliedVersions(db)
  const applied: Migration[] = []
  for (const m of loadMigrations(dir)) {
    if (done.has(m.version)) continue
    await db.transaction(async () => {
      await db.exec(m.sql)
    })
    applied.push(m)
  }
  return applied
}
