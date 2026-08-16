/**
 * 드라이버 계약 — **저장 계층이 아는 SQLite의 전부.**
 *
 * 리포지토리와 그 위쪽은 이 인터페이스만 본다. `node:sqlite`든 rusqlite든,
 * 드라이버 교체가 **구현 파일 하나 교체**로 끝나야 한다. 그래서 여기에는 특정
 * 드라이버의 고유 개념(`lastInsertRowid` 타입, BigInt 정책, 옵션 객체 모양 등)을
 * 담지 않는다.
 *
 * 이 경계가 지켜지는지는 `tests/driver-boundary.test.ts`가 증명한다 — 가짜
 * 드라이버로 갈아끼워도 리포지토리가 그대로 동작하면 새는 곳이 없는 것이다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 계약 개정 (2026-08-12, ADR-008) — 동기 → 비동기 ★
 *
 * 이 계약은 원래 전부 **동기**였고, ADR-003은 그 위에서 "드라이버 교체 = 구현
 * 파일 하나 교체"라고 적었다. **그 전제가 Tauri에서 깨진다** — IPC(`invoke`)는
 * 비동기이므로 동기 계약을 그 위에 구현할 방법이 없다.
 *
 * 그래서 드라이버를 바꾸는 대신 **계약을 개정했다.** 조용히 우회하지 않고
 * 여기에 적어둔다. 대가는 리포지토리와 그 호출부가 `async`가 되는 것이고,
 * 얻는 것은 구현이 TS 한 벌로 유지되는 것이다 (ADR-008이 B를 기각한 이유).
 *
 * ★ Rust 쪽은 벙어리 실행기다 ★
 * 이 계약에 있는 것은 전부 "SQL 문자열 + 파라미터를 실행한다"뿐이다.
 * 되돌리기 의미론(ADR-004)·`row_shadow` 규칙·LIFO 판정 같은 **도메인 로직이
 * 드라이버로 스며들면 안 된다.** 그게 리포지토리를 Rust로 옮기는 안(ADR-008 B)을
 * 기각한 이유이므로, 여기서 재발하면 기각의 의미가 없어진다.
 * `tests/driver-boundary.test.ts`가 이 표면을 단언한다.
 * ─────────────────────────────────────────────────────────────
 */

/** SQL 파라미터·결과로 오갈 수 있는 값. 드라이버 공통 분모다. */
export type SqlValue = string | number | null

export type Row = Record<string, SqlValue>

export interface RunResult {
  /** 영향받은 행 수. 되돌리기 검증이 이 값을 쓴다. */
  readonly changes: number
}

export interface Statement {
  run(...params: readonly SqlValue[]): Promise<RunResult>
  get(...params: readonly SqlValue[]): Promise<Row | undefined>
  all(...params: readonly SqlValue[]): Promise<Row[]>
}

export interface Driver {
  /** DDL·PRAGMA 실행. 파라미터를 받지 않는다. */
  exec(sql: string): Promise<void>
  /**
   * 준비된 문장. **호출자가 재사용을 책임진다** — 청크 적재에서 행마다
   * `prepare`를 부르면 파싱 비용이 행 수만큼 든다 (ADR-001 조건 3).
   *
   * 핸들을 만드는 것 자체는 동기다. 실제 실행만 비동기다.
   */
  prepare(sql: string): Statement
  /**
   * 같은 SQL을 **여러 파라미터 묶음으로 한 번에** 실행한다.
   *
   * ★ 이게 없으면 적재가 IPC로 무너진다 ★
   * `loadChunk`는 행마다 `run()`을 부르는데, 원격 드라이버에서 그건 #13 기준
   * **80,137번의 왕복**이다. 청크를 통째로 넘기면 **청크당 1회**가 된다.
   *
   * 구현은 이 호출 전체를 하나의 트랜잭션으로 처리한다. 도메인 로직은 없다 —
   * 같은 SQL을 N번 실행할 뿐이다.
   *
   * `Iterable`을 받는 이유: 로컬 드라이버는 **한 행씩 흘려보내** 청크 전체를
   * 메모리에 띄우지 않을 수 있다. 원격(IPC) 드라이버는 어차피 직렬화하려고
   * 모아야 하지만, 그 선택은 드라이버 몫이지 계약이 강요할 일이 아니다.
   */
  runMany(sql: string, rows: Iterable<readonly SqlValue[]>): Promise<RunResult>
  /**
   * 하나의 트랜잭션으로 실행한다. 예외가 나면 롤백한다.
   *
   * 드라이버마다 트랜잭션 API가 다르므로(암시적 래퍼 · 명시적 BEGIN 등)
   * 여기서는 "이 함수 안은 원자적"이라는 계약만 요구한다.
   */
  transaction<T>(fn: () => Promise<T>): Promise<T>
  close(): Promise<void>
}

/**
 * ★ 파일에 **영구히 남는** PRAGMA ★
 *
 * ─────────────────────────────────────────────────────────────
 * `journal_mode`는 연결 설정이 아니라 **DB 파일의 성질**이다. 한 번 걸면 그 파일을
 * 여는 **다음 사람도 그 모드로 열게 된다** — 연결을 닫아도 되돌아오지 않는다.
 *
 * 2026-08-16에 이것이 사용자를 물었다. 재가져오기 도구가 개발용 DB를 `pragmas: true`로
 * 열었고, 그 안의 이 한 줄이 `.tmp/pnl.sqlite`를 `delete` → `wal`로 **영구히** 바꿨다.
 * 앱은 늘 `pragmas: false`로 열어 왔으므로 그 DB는 계속 롤백 모드였는데, 모드가
 * 바뀌자 앱의 조회가 전부 실패하고 **화면이 통째로 비었다** — 사용자에게는
 * "방금 연결한 것이 다 사라졌다"로 보였다.
 *
 * 그래서 목록을 가른다. **남의 DB를 여는 쪽은 세션 것만 건다.** 파일 성질을 바꾸는
 * 것은 «내가 만든 DB»에만, 그것도 **이름을 불러서**(`journal: true`) 한다.
 * ─────────────────────────────────────────────────────────────
 */
export const FILE_PRAGMAS: readonly string[] = [
  // 로컬 앱이라 읽기와 쓰기가 겹친다. WAL이라야 적재 중에도 화면이 조회된다.
  //
  // ⚠ 이 저장소의 개발용 DB는 OneDrive 폴더 안에 있다. WAL은 `-shm` 공유 메모리
  //   파일을 요구하는데 동기화 폴더에서 그것이 열리지 않을 수 있다 — 위 사고의
  //   증상이 정확히 그 모양이었다. 켜는 자리를 좁게 두는 이유가 하나 더 있는 셈이다.
  "PRAGMA journal_mode = WAL",
]

/**
 * 연결에만 사는 설정. **닫으면 사라진다** — 남의 DB에 걸어도 그 파일이 바뀌지 않는다.
 *
 * SQL/PRAGMA 수준으로 정의하는 이유는 그대로다: 드라이버가 바뀌어도 설정이
 * 따라가야 하기 때문이다 (ADR-003).
 */
export const SESSION_PRAGMAS: readonly string[] = [
  // 청크 트랜잭션마다 fsync를 강제하지 않는다. WAL에서 NORMAL은 프로세스
  // 크래시에 안전하고, OS 크래시에서만 마지막 트랜잭션을 잃는다 —
  // 가져오기는 되돌리고 다시 하면 되는 작업이라 이 교환이 성립한다.
  "PRAGMA synchronous = NORMAL",
  // 외래키를 실제로 강제한다. SQLite 기본값은 꺼짐이다.
  "PRAGMA foreign_keys = ON",
  // 임시 인덱스·정렬을 디스크에 쓰지 않는다.
  "PRAGMA temp_store = MEMORY",
  // 페이지 캐시 32MB (음수는 KB 단위).
  //
  // 처음엔 64MB로 뒀는데 측정 없이 고른 값이었고, 종단 게이트에서 그 64MB가
  // 그대로 Worker 예산(256MB)을 잡아먹어 0.1MB 차이로 기준을 넘겼다. 32MB로
  // 내려도 8만 행 집계에서 체감 차이가 없다 — 캐시는 클수록 좋은 게 아니라
  // 예산 안에서 충분하면 되는 것이다.
  "PRAGMA cache_size = -32000",
]

/**
 * 옛 이름 — **둘을 합친 것**이다. 새 코드는 `SESSION_PRAGMAS`를 쓴다.
 *
 * 이 상수를 남겨 두는 이유는 «전부 걸겠다»가 여전히 뜻이 있는 자리가 있기
 * 때문이다(내가 만들고 나만 쓰는 DB). 다만 그 자리는 이름을 불러 고르게 한다.
 */
export const PRAGMAS: readonly string[] = [...FILE_PRAGMAS, ...SESSION_PRAGMAS]

/**
 * 드라이버가 노출해도 되는 표면. **SQL 실행 계열이 전부다.**
 *
 * `tests/driver-boundary.test.ts`가 이 목록으로 실제 드라이버를 검사한다.
 * 여기 없는 이름이 드라이버에 생겼다면 도메인 로직이 내려간 것이다 (ADR-008 조건 2).
 */
export const DRIVER_SURFACE = ["exec", "prepare", "runMany", "transaction", "close"] as const

export async function applyPragmas(db: Driver, pragmas: readonly string[] = PRAGMAS): Promise<void> {
  for (const p of pragmas) await db.exec(p)
}
