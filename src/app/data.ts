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
import { loadOrderRows, type OrderRow } from "@core/order/rows.js"
import { loadLinkingView, type LinkingView } from "@core/linking/view.js"
import { Repository, type BatchDigest } from "@core/store/repository.js"
import { krLinkingMatcher } from "@packs/kr-marketplace/linking-matcher.js"
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
  /** 주문 화면이 그리는 행 (주문 + 클레임). */
  orders: readonly OrderRow[]
  /**
   * 상품 연결 화면이 그리는 카드 (§21-6).
   *
   * 기간을 받지 않는다 — 리스팅은 «사실»이 아니라 «기준»이라 7월에만 팔린 상품도
   * 여전히 연결 대상이다. 기간으로 자르면 지난달 상품이 목록에서 사라지고,
   * 사용자는 자기가 연결했던 것이 없어졌다고 읽는다.
   */
  linking: LinkingView | null
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
      const orders = await loadOrderRows(db, DEV_LIBRARY, DEV_PERIOD)
      const linking = await loadLinkingView(db, DEV_LIBRARY, krLinkingMatcher)
      return { snapshot, settlement, orders, linking, error: null }
    } finally {
      await db.close()
    }
  } catch (e) {
    return {
      snapshot: null,
      settlement: [],
      orders: [],
      linking: null,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * **이 앱에서 사용자가 일으키는 첫 쓰기.** 리포지토리를 열어 한 번 쓰고 닫는다.
 *
 * ★ 쓰기 뒤에 반드시 다시 읽는다 ★
 * 화면 상태를 손으로 갱신하면(«방금 만든 SKU를 목록에 밀어넣기») 그 순간 화면이
 * DB와 다른 것을 믿기 시작한다. 카운트를 한 곳에서만 세기로 한 것과 같은 이유로,
 * 쓰기 결과도 **다시 조회해서** 받는다. 61장짜리 목록이라 비용도 문제가 아니다.
 *
 * 실패를 삼키지 않는다 (헌장 6) — 호출한 쪽이 이유를 받아 화면에 말할 수 있다.
 */
export async function writeThenReload(
  write: (repo: Repository) => Promise<void>,
): Promise<LoadResult> {
  try {
    const db = await openTauriDriver(DEV_DB_PATH, { pragmas: false })
    try {
      await write(new Repository(db))
    } finally {
      await db.close()
    }
  } catch (e) {
    return {
      snapshot: null,
      settlement: [],
      orders: [],
      linking: null,
      error: e instanceof Error ? e.message : String(e),
    }
  }
  return loadDevSnapshot()
}

/** 쓰기 시각. 되돌리기·이력이 이 값을 본다 (ADR-004). */
export const nowStamp = (): string => new Date().toISOString().slice(0, 19)

/**
 * 방금 넣은 batch가 무엇을 했는지 다시 읽는다.
 *
 * 적재하면서 센 수를 그대로 화면에 쓰지 않는 이유는 **화면이 말하는 수가 DB가
 * 아는 수여야** 하기 때문이다 — 쓰기 뒤에 다시 조회하는 `writeThenReload`와 같은 규율이다.
 */
export async function readDigest(batchId: string): Promise<BatchDigest | null> {
  try {
    const db = await openTauriDriver(DEV_DB_PATH, { pragmas: false })
    try {
      return (await new Repository(db).batchDigest(batchId)) ?? null
    } finally {
      await db.close()
    }
  } catch {
    return null
  }
}
