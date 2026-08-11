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

const here = dirname(fileURLToPath(import.meta.url))
export const MIGRATIONS_DIR = join(here, "migrations")

/** 마이그레이션에 필요한 최소 DB 표면. */
export interface MigratableDb {
  exec(sql: string): void
}

export interface Migration {
  readonly version: number
  readonly name: string
  readonly sql: string
}

export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => {
      const version = Number(f.slice(0, f.indexOf("-")))
      if (!Number.isInteger(version)) {
        throw new Error(`마이그레이션 파일명이 번호로 시작하지 않는다: ${f}`)
      }
      return { version, name: f, sql: readFileSync(join(dir, f), "utf-8") }
    })
}

/** 전부 적용한다. 이미 적용된 것은 건너뛴다. */
export function migrate(db: MigratableDb, dir: string = MIGRATIONS_DIR): Migration[] {
  const applied: Migration[] = []
  for (const m of loadMigrations(dir)) {
    db.exec(m.sql)
    applied.push(m)
  }
  return applied
}
