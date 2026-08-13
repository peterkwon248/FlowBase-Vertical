/**
 * 앱이 DB에 닿는 곳 — **지금은 개발용 한 자리뿐이다.**
 *
 * 실제 배포에서는 사용자 데이터 디렉터리의 DB를 열고, 가져오기 화면이 파일을
 * 받아 채운다. 아직 그 경로가 없으므로, 배선을 검증하려면 **이미 데이터가 든
 * DB**를 열어야 한다 — 3b-0 CLI(`npx tsx tools/harness/pnl.ts`)가 만든 것이다.
 *
 * ★ 이게 조건 3의 게이트를 성립시킨다 ★
 * 화면과 CLI가 **같은 DB를 같은 스냅샷 함수로** 읽으므로, 숫자가 같은 것은
 * 우연이 아니라 구조다. 다르게 나오면 배선이 틀린 것이다.
 *
 * Tauri 밖(브라우저)에서는 `invoke`가 없어 열리지 않는다. 그때는 조용히
 * 실패하고 빈 값을 유지한다 — 화면이 "데이터 없음"을 정직하게 그리는 것이
 * 그 상황의 사실이기 때문이다.
 */

import { openTauriDriver } from "@core/store/driver-tauri.js"
import { loadPnlSnapshot, type PnlSnapshot } from "@core/profit/snapshot.js"
import { loadSettlementRows, type SettlementRow } from "@core/settlement/rows.js"
import type { Period } from "@core/profit/index.js"

declare const __PROJECT_ROOT__: string

const root = __PROJECT_ROOT__.replace(/\\/g, "/").replace(/\/$/, "")

/** 3b-0 CLI가 만드는 DB. 실파일 3종이 들어 있다. */
export const DEV_DB_PATH = `${root}/.tmp/pnl.sqlite`

/** CLI와 같은 기간·라이브러리 — 대조가 성립하려면 같아야 한다. */
export const DEV_PERIOD: Period = { from: "2026-07-01", to: "2026-07-31" }
export const DEV_LIBRARY = "lib-1"

export interface LoadResult {
  snapshot: PnlSnapshot | null
  /** 정산 화면이 그리는 묶음. 대시보드와 **같은 DB·같은 연결**에서 읽는다. */
  settlement: readonly SettlementRow[]
  /** 못 읽은 이유. 숨기지 않고 화면이 말할 수 있게 들고 나간다 (헌장 6). */
  error: string | null
}

export async function loadDevSnapshot(): Promise<LoadResult> {
  try {
    const db = await openTauriDriver(DEV_DB_PATH, { pragmas: false })
    try {
      // 연결을 한 번만 연다. 화면마다 열면 같은 순간의 두 화면이 서로 다른
      // 스냅샷을 볼 수 있고, 그 차이는 아무도 모르게 쌓인다.
      const snapshot = await loadPnlSnapshot(db, DEV_LIBRARY, DEV_PERIOD)
      const settlement = await loadSettlementRows(db, DEV_LIBRARY, DEV_PERIOD)
      return { snapshot, settlement, error: null }
    } finally {
      await db.close()
    }
  } catch (e) {
    return {
      snapshot: null,
      settlement: [],
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
