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
import { migrate } from "@core/store/migrate-web.js"
import { loadPnlSnapshot, type PnlSnapshot } from "@core/profit/snapshot.js"
import { loadSettlementRows, type SettlementRow } from "@core/settlement/rows.js"
import { loadOrderRows, type OrderRow } from "@core/order/rows.js"
import { loadLinkingView, type LinkingView } from "@core/linking/view.js"
import { loadCoverage, type ConnectionCoverage } from "@core/coverage/load.js"
import { loadHistoryRows, type HistoryRow } from "@core/history/rows.js"
import { loadProductRows, type ProductView } from "@core/product/rows.js"
import { Repository, type BatchDigest } from "@core/store/repository.js"
import { krLinkingMatcher } from "@packs/kr-marketplace/linking-matcher.js"
import { krDocTypeResolver } from "@packs/kr-marketplace/markets/index.js"
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
  /**
   * 채널 화면이 그리는 커버리지 (§22).
   *
   * 기간을 받지 않는다 — «이 채널에 정산 파일이 있는가»는 7월을 보든 8월을 보든
   * 같은 사실이고, 기간으로 자르면 지난달만 들어온 파일이 «없는 것»이 된다.
   * `linking`이 기간을 안 받는 것과 같은 이유다.
   */
  coverage: readonly ConnectionCoverage[]
  /**
   * 가져오기 기록. 기간을 받지 않는다 — «7월 파일을 언제 넣었나»는 8월을 보고
   * 있어도 답이 같고, 되돌리기는 기간과 무관한 행위다.
   */
  history: readonly HistoryRow[]
  /**
   * 상품 화면이 그리는 SKU 목록과 원가 (③).
   *
   * 기간을 **받기는 한다** — 판매 수량 칸 때문이다. 원가와 연결은 «기준»이라
   * 기간과 무관하지만 «이 기간에 몇 개 팔렸나»는 기간의 값이라, 한 조회 안에
   * 둘이 섞인다. 섞인 것을 숨기지 않으려고 `soldQty`만 기간을 타는 것으로 못박아 뒀다.
   */
  products: ProductView | null
  /** 못 읽은 이유. 숨기지 않고 화면이 말할 수 있게 들고 나간다 (헌장 6). */
  error: string | null
}

/** 오늘(`YYYY-MM-DD`). 원가 입력의 기본 적용일이자 «지금 유효한 원가»의 기준일이다. */
export const today = (): string => new Date().toISOString().slice(0, 10)

/**
 * 밀린 마이그레이션 따라잡기 — **세션당 한 번.**
 *
 * ★ 2026-08-14에 드러난 구멍 ★
 * 마이그레이션 005가 늘자 기존 DB(버전 4)를 읽던 앱이 `no such column: period_end`로
 * 죽었다. 앱이 **DB를 열기만 하고 따라잡지 않고 있었다** — 새로 만드는 길(`pnl.ts`)과
 * 그대로 두는 길만 있고 그 사이가 비어 있었다.
 *
 * `migrate`는 멱등하고(테스트가 지킨다) 밀린 것이 없으면 조회 한 번으로 끝난다.
 * 그래도 세션당 한 번으로 묶는 이유는 쓰기 뒤 재조회가 잦기 때문이다.
 */
let migrated: Promise<void> | null = null
const catchUp = async (db: Parameters<typeof migrate>[0]): Promise<void> => {
  migrated ??= migrate(db).then((applied) => {
    if (applied.length > 0) {
      console.info("[data] 마이그레이션 적용:", applied.map((m) => m.version).join(", "))
    }
  })
  await migrated
}

export async function loadDevSnapshot(): Promise<LoadResult> {
  try {
    const db = await openTauriDriver(DEV_DB_PATH, { pragmas: false })
    try {
      await catchUp(db)
      // 연결을 한 번만 연다. 화면마다 열면 같은 순간의 두 화면이 서로 다른
      // 스냅샷을 볼 수 있고, 그 차이는 아무도 모르게 쌓인다.
      const snapshot = await loadPnlSnapshot(db, DEV_LIBRARY, DEV_PERIOD)
      const settlement = await loadSettlementRows(db, DEV_LIBRARY, DEV_PERIOD)
      const orders = await loadOrderRows(db, DEV_LIBRARY, DEV_PERIOD)
      const linking = await loadLinkingView(db, DEV_LIBRARY, krLinkingMatcher)
      const resolveDocType = krDocTypeResolver()
      const coverage = await loadCoverage(db, DEV_LIBRARY, resolveDocType)
      const history = await loadHistoryRows(db, DEV_LIBRARY, resolveDocType)
      const products = await loadProductRows(db, DEV_LIBRARY, DEV_PERIOD, today())
      return { snapshot, settlement, orders, linking, coverage, history, products, error: null }
    } finally {
      await db.close()
    }
  } catch (e) {
    return {
      snapshot: null,
      settlement: [],
      orders: [],
      linking: null,
      coverage: [],
      history: [],
      products: null,
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
      // 쓰기가 새 컬럼을 건드릴 수 있으므로 읽기와 같은 규율로 먼저 따라잡는다.
      await catchUp(db)
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
      coverage: [],
      history: [],
      products: null,
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
/**
 * **같은 바이트가 이미 들어온 적이 있나** — 확인 단계의 고지 재료 (마이그레이션 006).
 *
 * 읽지 못하면 빈 배열이다. 지문 조회 실패로 가져오기를 막지 않는다 — 이건 방어가
 * 아니라 **고지**이고, 고지를 못 하는 것이 가져오기를 못 하는 것보다 낫다.
 */
export async function findPriorImports(
  hash: string,
): Promise<readonly { sourceName: string; at: string; undone: boolean }[]> {
  try {
    const db = await openTauriDriver(DEV_DB_PATH, { pragmas: false })
    try {
      await catchUp(db)
      const rows = await new Repository(db).batchesWithHash(DEV_LIBRARY, hash)
      return rows.map((r) => ({
        sourceName: String(r["source_name"] ?? ""),
        at: String(r["committed_at"] ?? r["started_at"] ?? "").slice(0, 10),
        undone: String(r["status"] ?? "") === "undone",
      }))
    } finally {
      await db.close()
    }
  } catch {
    return []
  }
}

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
