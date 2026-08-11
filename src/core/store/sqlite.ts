/**
 * SQLite 드라이버 접점 — **여기 한 곳에서만 드라이버를 만진다.**
 *
 * 세션 2의 테스트는 `node:sqlite`(Node 22.5+ 내장)로 돈다. 실제 앱은 Tauri 쪽
 * 바인딩을 쓸 것이고 그 선택은 ADR-003이 다룬다. 두 세계가 만나는 지점을
 * 이 파일로 좁혀 두면, 바인딩이 바뀌어도 리포지토리 계층은 그대로다.
 *
 * `createRequire`로 불러오는 이유: `node:sqlite`는 Node 22.5에 추가된 신규
 * 빌트인이라 Vite의 내장 모듈 목록에 없다. 정적 import를 쓰면 Vite가 `node:`
 * 접두를 떼고 `sqlite`라는 패키지를 찾다가 실패한다. 런타임 require는 그
 * 변환을 거치지 않는다.
 */

import { createRequire } from "node:module"

/** 리포지토리가 필요로 하는 최소 표면. 드라이버 전체를 노출하지 않는다. */
export interface SqliteStatement {
  run(...params: unknown[]): unknown
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

export interface SqliteDb {
  exec(sql: string): void
  prepare(sql: string): SqliteStatement
  close(): void
}

interface NodeSqliteModule {
  DatabaseSync: new (path: string, options?: Record<string, unknown>) => SqliteDb
}

// 모듈 id를 변수로 둬야 번들러의 정적 분석을 타지 않는다.
const MODULE_ID = "node:sqlite"

let cached: NodeSqliteModule | null = null

function load(): NodeSqliteModule {
  if (cached) return cached
  const require = createRequire(import.meta.url)
  cached = require(MODULE_ID) as NodeSqliteModule
  return cached
}

export function openDatabase(path = ":memory:"): SqliteDb {
  return new (load().DatabaseSync)(path)
}
