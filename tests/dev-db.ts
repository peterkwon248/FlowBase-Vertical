/**
 * 개발용 DB의 **스냅샷** — 불변식 테스트가 읽는 자리.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 생겼나 — `database is locked`가 게이트를 갉기 시작했다 ★
 *
 * 세 파일(`order-rows`·`settlement-rows`·`dashboard-wiring`)이 **같은 물리 파일**
 * `.tmp/pnl.sqlite`를 각자의 워커에서 동시에 열고 있었다. 전체 스위트에서 한 번,
 * 그리고 세 파일만 5회 돌린 반복에서 1회차에 `sumInRange`의 `prepare`가
 * `database is locked`로 죽었다.
 *
 * ★ 확정된 것과 확정되지 않은 것을 가른다 ★
 *
 *   확정   세 워커가 **살아 있는 개발용 DB를 동시에 연다** (구조적 노출)
 *   확정   `busy_timeout`이 어디에도 설정돼 있지 않다 → 기본값 0 → 경합이 생기면
 *          기다리지 않고 **즉시** 실패한다
 *   확정   증상은 재현됐다 (5회 중 1회). 그리고 첫 회차 뒤로는 잦아든다
 *   ✗미확정 **정확한 방아쇠**. 아래 둘을 실측했는데 재현되지 않았다 —
 *          ① 체크포인트 안 된 `-wal`(1.8MB)을 남기고 동시 독자 24개 → 전부 통과
 *          ② 롤백 모드 hot journal을 남기고 동시 독자 6개 → 전부 통과
 *
 * **재현 실패를 적어 두는 이유는 다음 사람이 같은 실험을 다시 하지 않게 하기 위해서다.**
 * 그럴듯한 원인을 «확정»으로 적으면, 언젠가 이 자리가 다시 깨졌을 때 그 문장이
 * 조사를 엉뚱한 데로 보낸다 (작업 리듬 8 — 틀린 실측은 틀린 추정보다 위험하다).
 *
 * ★ 그래서 처방은 «방아쇠를 없애는 것»이 아니라 «노출을 없애는 것»이다 ★
 * 방아쇠가 무엇이든, 워커가 살아 있는 DB를 아예 안 열면 그 자리에서 못 깨진다.
 *
 * ★ 이 flaky가 왜 지금 위험한가 ★
 * 「한 번 깨졌다 재실행 통과 → *아 그거 원래 가끔 그래* → 진짜 회귀도 재실행으로
 * 넘기는 습관」의 순서로 진행된다. 하네스의 존재 이유(사람 눈 대신 기계)가
 * 무뎌지는 정확히 그 경로다. 그리고 경합 상대가 될 만한 것(앱·CLI)이 그 파일을
 * 만지는 때는 **사람이 앱을 쓴 직후**라, 하필 실기기 세션 다음 회차가 위험하다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 처방: 물리 파일 공유를 없앤다 — 그런데 «워커별»이 아니라 «워커 전»이다 ★
 *
 * 워커마다 `VACUUM INTO`를 뜨면 **원본을 세 워커가 동시에 여는 일이 그대로 남는다**
 * — 경합의 자리가 질의에서 스냅샷 뜨기로 옮겨갈 뿐이다. 그래서 `globalSetup`에서
 * **한 번만** 뜬다(워커가 뜨기 전, 프로세스 하나):
 *
 *   원본을 여는 연결   1개   (경합할 상대가 없다)
 *   스냅샷을 읽는 연결 N개   (쓰는 자가 없다 → 공유 잠금끼리는 절대 안 부딪힌다)
 *
 * `copyFileSync`가 아니라 `VACUUM INTO`인 이유는 이미 확립돼 있다 —
 * **살아 있는 DB의 파일 복사는 사본이 아니다**(리스팅 86개가 39개로 찢어진 그 사고).
 * `VACUUM INTO`는 SQLite 자신이 만드는 일관된 사본이라 동시 독자와 안전하게 공존한다.
 *
 * ★ 남는 성질 — 이 테스트들이 «절대값»을 걸지 않는 이유는 그대로다 ★
 * 스냅샷이라도 내용은 사용자가 넣은 것이다. 그래서 여기 붙는 단언은 **불변식**이어야
 * 한다(`목록 행 수 = 적재 행 수` 같은 것). 절대값을 걸면 사용자가 파일을 하나 더
 * 넣는 날 게이트가 빨개지고, 그건 회귀가 아니라 데이터가 는 것이다.
 */

import { existsSync, rmSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"

/**
 * 앱이 여는 개발용 DB. `src/app/data.ts`의 `DEV_DB_PATH`와 **같은 파일**이어야 한다
 * — 거기는 Vite의 `__PROJECT_ROOT__`로 절대경로를 만들어서 여기서 import할 수 없다.
 */
export const DEV_DB = ".tmp/pnl.sqlite"

/** 테스트가 읽는 사본. `globalSetup`이 만들고 워커는 읽기만 한다. */
export const DEV_SNAPSHOT = ".tmp/dev-snapshot.sqlite"

/**
 * 스냅샷을 만든다. **원본이 없으면 아무것도 하지 않는다** — 그 경우 소비자 쪽
 * `existsSync(DEV_SNAPSHOT)`가 거짓이 되어 지금까지처럼 `describe.skip`으로 간다
 * (개발용 DB가 없는 기기에서 테스트가 빨개지지 않는 성질을 보존한다).
 *
 * @returns 스냅샷을 떴으면 경로, 원본이 없으면 `null`
 */
export async function snapshotDevDb(): Promise<string | null> {
  // 지난 회차의 사본은 지운다. `VACUUM INTO`는 대상 파일이 있으면 거부한다 —
  // 그리고 **남겨 두면 원본이 사라진 뒤에도 옛 사본으로 테스트가 도는** 더 나쁜
  // 상태가 된다(«스킵»이어야 할 자리가 «통과»가 된다).
  rmSync(DEV_SNAPSHOT, { force: true })
  rmSync(`${DEV_SNAPSHOT}-wal`, { force: true })
  rmSync(`${DEV_SNAPSHOT}-shm`, { force: true })
  if (!existsSync(DEV_DB)) return null

  // `pragmas: false` — 원본에 WAL 전환 같은 **쓰기**를 걸지 않는다. 읽으러 왔을 뿐이다.
  const src = openNodeDriver(DEV_DB, { pragmas: false })
  try {
    // 사람이 앱을 켜 둔 채 테스트를 돌릴 수 있다. 그때 원본에 쓰는 쪽이 있으면
    // 즉시 포기하지 말고 기다린다 — 기본값이 0이라 «기다린다»를 명시해야 한다.
    await src.exec("PRAGMA busy_timeout = 5000")
    // 작은따옴표 이스케이프는 필요 없다 — 경로가 상수다.
    await src.exec(`VACUUM INTO '${DEV_SNAPSHOT}'`)
  } finally {
    await src.close()
  }

  /**
   * ★ 사본을 롤백 저널 모드로 못박는다 ★
   * WAL 헤더를 물려받으면 독자마다 `-shm`을 붙잡게 되고, 그 준비 과정이 다시
   * 워커끼리 부딪힐 여지를 남긴다. 쓰는 자가 없는 파일을 롤백 모드로 두면 독자들은
   * **공유 잠금만** 잡으므로 경합이 구조적으로 불가능해진다.
   */
  const snap = openNodeDriver(DEV_SNAPSHOT, { pragmas: false })
  try {
    await snap.exec("PRAGMA journal_mode = DELETE")
  } finally {
    await snap.close()
  }
  return DEV_SNAPSHOT
}
