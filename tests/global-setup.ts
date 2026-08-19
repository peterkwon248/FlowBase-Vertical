/**
 * vitest `globalSetup` — **워커가 뜨기 전에 한 번** 도는 자리.
 *
 * 여기 있는 것은 하나뿐이다: 개발용 DB의 스냅샷 뜨기. 왜 워커 안이 아니라 여기여야
 * 하는지는 `tests/dev-db.ts`의 머리말에 있다 — 요지는 **원본을 여는 연결이 하나뿐이면
 * 경합할 상대가 없다**는 것이다.
 *
 * 실패해도 테스트를 막지 않는다. 스냅샷이 없으면 소비자들이 지금까지처럼
 * `describe.skip`으로 간다 — 개발용 DB가 없는 기기(CI)의 정상 상태와 같은 모양이다.
 * **다만 조용히 넘기지 않고 이유를 적는다** (LOCK 6과 같은 태도).
 */

import { mkdirSync } from "node:fs"
import { snapshotDevDb, DEV_DB } from "./dev-db.js"

/**
 * ★ `.tmp/`를 만든다 — **새로 clone한 기기에서 두 게이트가 깨지던 자리** ★
 *
 * `linking-screen`·`screen-safety`는 `.tmp/*.sqlite`에 자기 세계를 짓는데,
 * 그 디렉터리는 gitignore라 **저장소에 없다.** 개발 기기에서는 e2e나 하네스가
 * 이미 만들어 둬서 보이지 않았고, 처음 clone한 기기에서만
 * `unable to open database file`로 죽었다 — 실제로 그렇게 발견됐다.
 *
 * 「내 기기에서는 되는데」의 교과서적 모양이라, 고치는 자리도 개별 테스트가 아니라
 * **워커가 뜨기 전 한 곳**이어야 한다. 나중에 `.tmp/`를 쓰는 테스트가 하나 더
 * 생겨도 같은 함정에 다시 빠지지 않는다.
 */
const TMP = ".tmp"

export async function setup(): Promise<void> {
  mkdirSync(TMP, { recursive: true })
  try {
    const at = await snapshotDevDb()
    if (at === null) {
      console.warn(`[global-setup] ${DEV_DB}가 없다 — 개발용 DB를 읽는 테스트는 건너뛴다`)
    }
  } catch (e) {
    console.warn(`[global-setup] 스냅샷 실패 — 관련 테스트를 건너뛴다: ${(e as Error).message}`)
  }
}
