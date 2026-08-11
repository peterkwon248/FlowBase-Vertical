/**
 * 드라이버 계약 — **저장 계층이 아는 SQLite의 전부.**
 *
 * 리포지토리와 그 위쪽은 이 인터페이스만 본다. `node:sqlite`든 rusqlite든
 * tauri-plugin-sql이든, 드라이버 교체가 **구현 파일 하나 교체**로 끝나야 한다.
 * 그래서 여기에는 특정 드라이버의 고유 개념(`lastInsertRowid` 타입, BigInt 정책,
 * 옵션 객체 모양 등)을 담지 않는다.
 *
 * 이 경계가 지켜지는지는 `tests/driver-boundary.test.ts`가 증명한다 — 가짜
 * 드라이버로 갈아끼워도 리포지토리가 그대로 동작하면 새는 곳이 없는 것이다.
 */

/** SQL 파라미터·결과로 오갈 수 있는 값. 드라이버 공통 분모다. */
export type SqlValue = string | number | null

export type Row = Record<string, SqlValue>

export interface RunResult {
  /** 영향받은 행 수. 되돌리기 검증이 이 값을 쓴다. */
  readonly changes: number
}

export interface Statement {
  run(...params: readonly SqlValue[]): RunResult
  get(...params: readonly SqlValue[]): Row | undefined
  all(...params: readonly SqlValue[]): Row[]
}

export interface Driver {
  /** DDL·PRAGMA 실행. 파라미터를 받지 않는다. */
  exec(sql: string): void
  /**
   * 준비된 문장. **호출자가 재사용을 책임진다** — 청크 적재에서 행마다
   * `prepare`를 부르면 파싱 비용이 행 수만큼 든다 (ADR-001 조건 3).
   */
  prepare(sql: string): Statement
  /**
   * 하나의 트랜잭션으로 실행한다. 예외가 나면 롤백한다.
   *
   * 드라이버마다 트랜잭션 API가 다르므로(암시적 래퍼 · 명시적 BEGIN 등)
   * 여기서는 "이 함수 안은 원자적"이라는 계약만 요구한다.
   */
  transaction<T>(fn: () => T): T
  close(): void
}

/**
 * 열 때 걸어야 하는 설정. **SQL/PRAGMA 수준으로 정의한다** — 드라이버가 바뀌어도
 * 설정이 따라가야 하기 때문이다. 근거는 ADR-003에 있다.
 */
export const PRAGMAS: readonly string[] = [
  // 로컬 앱이라 읽기와 쓰기가 겹친다. WAL이라야 적재 중에도 화면이 조회된다.
  "PRAGMA journal_mode = WAL",
  // 청크 트랜잭션마다 fsync를 강제하지 않는다. WAL에서 NORMAL은 프로세스
  // 크래시에 안전하고, OS 크래시에서만 마지막 트랜잭션을 잃는다 —
  // 가져오기는 되돌리고 다시 하면 되는 작업이라 이 교환이 성립한다.
  "PRAGMA synchronous = NORMAL",
  // 외래키를 실제로 강제한다. SQLite 기본값은 꺼짐이다.
  "PRAGMA foreign_keys = ON",
  // 임시 인덱스·정렬을 디스크에 쓰지 않는다.
  "PRAGMA temp_store = MEMORY",
  // 페이지 캐시 64MB (음수는 KB 단위). 헌장 B-2의 메모리 규율 안에서
  // 집계 쿼리가 디스크를 덜 때리게 한다.
  "PRAGMA cache_size = -64000",
]

export function applyPragmas(db: Driver, pragmas: readonly string[] = PRAGMAS): void {
  for (const p of pragmas) db.exec(p)
}
