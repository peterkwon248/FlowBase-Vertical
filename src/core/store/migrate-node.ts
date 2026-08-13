/**
 * 디스크에서 마이그레이션을 읽는다 — **테스트와 하네스가 쓰는 쪽.**
 *
 * 앱(웹뷰)은 `migrate-web.ts`를 쓴다. 적용 규칙은 양쪽 다 `migrate.ts` 하나를
 * 부르므로, 읽는 방법만 다르고 **적용은 같다**.
 */

import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
  applyMigrations,
  buildMigrations,
  type MigratableDb,
  type Migration,
} from "./migrate.js"

const here = dirname(fileURLToPath(import.meta.url))
export const MIGRATIONS_DIR = join(here, "migrations")

export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((name) => ({ name, sql: readFileSync(join(dir, name), "utf-8") }))
  return buildMigrations(files)
}

/** 예전 시그니처 그대로. 호출부는 import 경로만 이쪽으로 바꾸면 된다. */
export async function migrate(
  db: MigratableDb,
  dir: string = MIGRATIONS_DIR,
): Promise<Migration[]> {
  return applyMigrations(db, loadMigrations(dir))
}

export { buildMigrations, type MigratableDb, type Migration } from "./migrate.js"
