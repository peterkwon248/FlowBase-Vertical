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

import { snapshotDevDb, DEV_DB } from "./dev-db.js"

export async function setup(): Promise<void> {
  try {
    const at = await snapshotDevDb()
    if (at === null) {
      console.warn(`[global-setup] ${DEV_DB}가 없다 — 개발용 DB를 읽는 테스트는 건너뛴다`)
    }
  } catch (e) {
    console.warn(`[global-setup] 스냅샷 실패 — 관련 테스트를 건너뛴다: ${(e as Error).message}`)
  }
}
