/// <reference types="vite/client" />
/**
 * 번들에서 마이그레이션을 읽는다 — **앱(웹뷰)이 쓰는 쪽.**
 *
 * 브라우저에는 파일시스템이 없으므로 SQL을 빌드 시점에 문자열로 끌어온다.
 * `?raw`는 파일 내용을 그대로 준다.
 *
 * ★ SQL 파일이 여전히 유일한 진실이다 ★
 * 여기서 SQL을 새로 쓰거나 베끼지 않는다. `migrations/*.sql`을 그대로 읽을
 * 뿐이라, 테스트(디스크)와 앱(번들)이 **같은 바이트**를 적용한다.
 * `eager: true`라 새 파일을 더하면 자동으로 잡힌다 — 목록을 손으로 관리하는
 * 순간 하나를 빠뜨리는 날이 온다.
 */

import { applyMigrations, buildMigrations, type MigratableDb, type Migration } from "./migrate.js"

const RAW = import.meta.glob("./migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

export function loadMigrations(): Migration[] {
  const files = Object.entries(RAW).map(([path, sql]) => ({
    name: path.slice(path.lastIndexOf("/") + 1),
    sql,
  }))
  if (files.length === 0) {
    throw new Error("번들에 마이그레이션이 하나도 없다 — glob 경로를 확인해야 한다")
  }
  return buildMigrations(files)
}

export async function migrate(db: MigratableDb): Promise<Migration[]> {
  return applyMigrations(db, loadMigrations())
}
