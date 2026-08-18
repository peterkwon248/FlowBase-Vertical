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
import {
  loadChannelRows,
  loadDailySeries,
  loadProfitRows,
  type ChannelRow,
  type DailySeries,
  type ProfitRow,
} from "@core/profit/rows.js"
import { loadSettlementRows, type SettlementRow } from "@core/settlement/rows.js"
import { loadOrderRows, type OrderRow } from "@core/order/rows.js"
import { loadLinkingView, type LinkingView } from "@core/linking/view.js"
import { loadCoverage, type ConnectionCoverage } from "@core/coverage/load.js"
import { loadHistoryRows, type HistoryRow } from "@core/history/rows.js"
import { loadProductRows, type ProductView } from "@core/product/rows.js"
import { Repository, type BatchDigest } from "@core/store/repository.js"
import type { ImportAnalysis } from "@core/import/analyze.js"
import { krLinkingMatcher } from "@packs/kr-marketplace/linking-matcher.js"
import { krDocTypeResolver } from "@packs/kr-marketplace/markets/index.js"
import { defaultMonth, loadAvailableMonths, monthPeriod, type Month, type MonthRow } from "@core/profit/months.js"
import type { Period } from "@core/profit/index.js"

declare const __PROJECT_ROOT__: string

const root = __PROJECT_ROOT__.replace(/\\/g, "/").replace(/\/$/, "")

/** 3b-0 CLI가 만드는 DB. 실파일 3종이 들어 있다. */
export const DEV_DB_PATH = `${root}/.tmp/pnl.sqlite`

/**
 * ★ 기간은 이제 **상수가 아니라 데이터에서 온다** (2026-08-16, MVP 1) ★
 *
 * 여기 `{2026-07-01, 2026-07-31}`이 박혀 있었다. 7월 파일만 넣는 동안은 그게
 * 사실이었지만, **8월 파일을 넣는 순간 앱은 그 데이터를 영영 못 보여준다** —
 * 가져오기는 성공하고 대시보드는 7월을 그린다. 사용자가 «넣었는데 안 나온다»를
 * 겪는 그 자리다.
 *
 * 그래서 기본 기간은 **주문이 있는 가장 최근 달**이고(`defaultMonth` — «최신 달»이
 * 아닌 이유가 거기 적혀 있다), 사용자가 헤더에서 다른 달을 고르면 그 달이 된다.
 *
 * 조회 층이 달을 제대로 가르는지는 붙이기 **전에** 쟀다 —
 * `tests/month-switch.test.ts` (교차월 정산 귀속·기간집계 포함).
 */
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
  /**
   * 대시보드의 **상품별 손익**. 기간 안 판매를 SKU로 묶은 것이다 —
   * 못 채우는 칸(수수료·배송비·광고비)이 무엇이고 왜인지는 `core/profit/rows.ts`.
   */
  profitRows: readonly ProfitRow[]
  /** 대시보드의 **채널별 손익**. 연결 단위로 같은 계산을 다시 묶는다. */
  channelRows: readonly ChannelRow[]
  /** 일별 매출 + **그 차트가 담지 못한 기간 집계 금액**. */
  daily: DailySeries
  /**
   * **이 조회가 실제로 본 기간.** 화면은 이 값으로 «2026년 7월»을 쓴다.
   *
   * 요청한 달을 그대로 되돌려주지 않는다 — 그 달에 데이터가 없으면 최신 달로
   * 물러나므로, 화면이 «내가 요청한 달»을 그리면 숫자와 라벨이 갈린다.
   */
  period: Period
  /** 그 기간의 달 (`YYYY-MM`). 선택기가 «지금 이것» 표시에 쓴다. */
  month: Month
  /** 고를 수 있는 달 — **데이터가 있는 것만**, 최신이 앞. 종류별 건수를 함께 든다. */
  months: readonly MonthRow[]
  /** 못 읽은 이유. 숨기지 않고 화면이 말할 수 있게 들고 나간다 (헌장 6). */
  error: string | null
}

/** 오늘이 속한 달. 데이터가 하나도 없을 때의 기간이다 — 그때 화면은 어차피 빈다. */
const thisMonth = (): Month => new Date().toISOString().slice(0, 7)

/**
 * ★ 이 세션에서 아직 연 적이 없다 ★
 *
 * 저장 계층이 «한 번에 하나»를 불변식으로 강제한다 — 이미 임차 중이면 새 열기를
 * **거절**한다 (`src-tauri/src/db.rs`). 그런데 웹뷰가 새로 뜨면(재실행·새로고침)
 * 이전 세션이 들고 있던 번호는 아무도 못 쓰는데 Rust는 그걸 알 수 없다. 거절만
 * 하면 앱이 영영 못 연다.
 *
 * 그 자리를 **시계로 판정하지 않는다**(「몇 초 지났으면 죽은 것」은 느린 기기에서
 * 정상 동작을 죽었다고 부른다 — ③-b에서 «미완료» 판정에 내린 결론과 같다).
 * 근거는 **«이 모듈이 방금 로드됐다»**는 사실 자체다: 새 세션이므로 옛 번호는
 * 정의상 죽었다. 그래서 첫 열기만 넘겨받고, 그다음부터는 거절이 진짜 거절이다.
 */
let firstOpen = true

/**
 * DB를 연다. **모든 열기가 여기를 지난다** — 넘겨받기 조건이 한 곳에만 있어야
 * «첫 열기만»이라는 규칙이 갈리지 않는다.
 */
async function open(): Promise<Awaited<ReturnType<typeof openTauriDriver>>> {
  const force = firstOpen
  firstOpen = false
  return openTauriDriver(DEV_DB_PATH, {
    force,
    // 넘겨받았다는 것은 이전 세션이 **동작 중에 끝났다**는 뜻이다. 데이터 쪽
    // 뒷정리는 이미 `abortStaleBatches`가 가져오기 시작에서 하고 다이제스트로
    // 말한다 — 여기서 새 표면을 만들지 않고 기록만 남긴다.
    onTakeOver: () => console.info("[data] 이전 세션의 연결이 남아 있어 넘겨받았다"),
  })
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

/**
 * ★ 앱이 **세션 PRAGMA를 건다** (2026-08-16) ★
 *
 * 네 호출부가 전부 `pragmas: false`였고 **왜 껐는지 기록이 없었다**(git 이력 확인).
 * 그 상태에서 앱은 `foreign_keys`가 **꺼진 채** 돌고 있었다 — 되돌리기의 삭제 순서
 * 방어(`DELETE_ORDER`)는 「FK가 켜져 있으면 부모를 먼저 못 지운다」를 전제로 잡은
 * 것인데, **앱에서는 그 전제가 서 있지 않았다.** 테스트 세계(FK 켜짐)와 앱
 * 세계(꺼짐)의 비대칭이 DB 설정 층에서 재발한 것이다.
 *
 * 켜기 전에 쟀다: `PRAGMA foreign_key_check` — **실기기 DB와 그 백업 모두 위반 0건.**
 * 그래서 켜도 기존 데이터가 터지지 않는다.
 *
 * `journal_mode`는 여전히 안 건다 — 그건 파일에 남고, 이 DB는 롤백 모드여야 한다
 * (`driver.ts`의 사고 기록). 그래서 `journal: true`를 주지 않는다.
 */
export async function loadDevSnapshot(want?: Month): Promise<LoadResult> {
  try {
    const db = await open()
    try {
      await catchUp(db)

      /**
       * ★ 고른 달이 아직 있는지 **매번 다시 묻는다** ★
       *
       * 사용자가 8월을 보다가 8월 batch를 되돌리면 그 달은 사라진다. 요청을
       * 곧이곧대로 쓰면 없는 달을 그리게 되고, 화면은 «0원»과 «데이터 없음»을
       * 구별하지 못한다. 목록에 없으면 최신 달로 물러나고, 물러난 사실은
       * `period`/`month`를 그대로 들고 나가는 것으로 화면에 전해진다.
       */
      const months = await loadAvailableMonths(db, DEV_LIBRARY)
      const has = months.some((m) => m.ym === want)
      const month = want !== undefined && has ? want : (defaultMonth(months) ?? thisMonth())
      const period = monthPeriod(month)

      // 연결을 한 번만 연다. 화면마다 열면 같은 순간의 두 화면이 서로 다른
      // 스냅샷을 볼 수 있고, 그 차이는 아무도 모르게 쌓인다.
      const snapshot = await loadPnlSnapshot(db, DEV_LIBRARY, period)
      const settlement = await loadSettlementRows(db, DEV_LIBRARY, period)
      const orders = await loadOrderRows(db, DEV_LIBRARY, period)
      const linking = await loadLinkingView(db, DEV_LIBRARY, krLinkingMatcher)
      const resolveDocType = krDocTypeResolver()
      const coverage = await loadCoverage(db, DEV_LIBRARY, resolveDocType)
      const history = await loadHistoryRows(db, DEV_LIBRARY, resolveDocType)
      /**
       * ★ 기준일은 **보고 있는 기간의 끝**이지 오늘이 아니다 ★
       *
       * 오늘을 쓰면 화면 셋이 서로 다른 말을 한다. 적대적 검토가 실측한 모양:
       * 사용자가 날짜 기본값(오늘 = 8/14) 그대로 원가를 넣고 7월을 보면 —
       *
       * ```
       * 게이지   «원가 61/61 — 전부 입력됐습니다»   (오늘 기준이라 다 보인다)
       * 손익     매입원가 0원                        (7월 판매에 8/14 원가는 안 붙는다)
       * gaps     «미입력 — 넣으면 채워진다»          (넣었는데 또 넣으라고 한다)
       * ```
       *
       * 손익이 판매일로 원가를 고르므로(ADR-009 ①-보완 2) 화면도 **같은 창**으로
       * 봐야 한다. 기간 끝을 기준일로 쓰면 «이 기간 판매에 붙는 원가»가 되고 셋이
       * 한 말을 한다. 그래도 8/14 원가는 사라지지 않는다 — 8월을 보면 나타난다.
       */
      const products = await loadProductRows(db, DEV_LIBRARY, period, period.to)
      const profitRows = await loadProfitRows(db, DEV_LIBRARY, period)
      const channelRows = await loadChannelRows(db, DEV_LIBRARY, period)
      const daily = await loadDailySeries(db, DEV_LIBRARY, period)
      return {
        snapshot,
        settlement,
        orders,
        linking,
        coverage,
        history,
        products,
        profitRows,
        channelRows,
        daily,
        period,
        month,
        months,
        error: null,
      }
    } finally {
      await db.close()
    }
  } catch (e) {
    return failed(e, want)
  }
}

/**
 * 못 읽었을 때의 결과. **화면은 이 값을 쓰지 않는다** — `App`이 `error`를 보고
 * 화면을 그대로 두고 모달로 말한다(2026-08-16의 그 사고). 그래도 기간 자리를
 * 비워 두지 않는 이유는 «읽기 실패»가 «기간이 없다»로 새지 않게 하려는 것이다.
 */
function failed(e: unknown, want?: Month): LoadResult {
  const month = want ?? thisMonth()
  return {
    snapshot: null,
    settlement: [],
    orders: [],
    linking: null,
    coverage: [],
    history: [],
    products: null,
    profitRows: [],
    channelRows: [],
    daily: { points: [], periodOnly: 0 },
    period: monthPeriod(month),
    month,
    months: [],
    error: e instanceof Error ? e.message : String(e),
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
  /** 보고 있던 달. 주지 않으면 최신 달로 돌아간다 — 쓰기가 화면을 옮기게 된다. */
  want?: Month,
): Promise<LoadResult> {
  try {
    const db = await open()
    try {
      // 쓰기가 새 컬럼을 건드릴 수 있으므로 읽기와 같은 규율로 먼저 따라잡는다.
      await catchUp(db)
      await write(new Repository(db))
    } finally {
      await db.close()
    }
  } catch (e) {
    return failed(e, want)
  }
  return loadDevSnapshot(want)
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
    const db = await open()
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

/**
 * 판정 단계에서 본 것을 남긴다 — **넣지 않아도 남는다** (마이그레이션 009).
 *
 * ★ 여기가 「파일이 증발하던」 자리다 ★
 * 프로파일이 없으면 위저드는 «넣을 수 없습니다»로 끝났고 기록이 0이었다. 그래서
 * 같은 파일을 다음 달에 다시 넣어도 앱은 처음 보는 것처럼 굴었다. 이제 **본 것은
 * 남는다** — 맞는 양식이 없었다는 사실까지 포함해서.
 *
 * `analyzeImport`는 DB를 건드리지 않는다는 계약이라(시트 바꿔 다시 보기가 싸야
 * 한다) 저장은 부르는 쪽인 여기서 한다 — `findPriorImports`와 같은 자리다.
 *
 * 실패해도 가져오기를 막지 않는다. 배우지 못하는 것이 못 넣는 것보다 낫다.
 */
export async function recordSighting(
  a: ImportAnalysis,
  profileId: string | null,
): Promise<void> {
  try {
    const db = await open()
    try {
      await catchUp(db)
      const sheet = a.sheets[a.sheetIndex]
      await new Repository(db).recordFileSighting({
        libraryId: DEV_LIBRARY,
        sourceHash: a.contentHash,
        sourceName: a.fileName,
        sourceBytes: a.byteLength,
        containerFormat: a.format,
        sheetIndex: a.sheetIndex,
        sheetName: sheet?.name ?? null,
        headerRowIndex: a.header.rowIndex,
        profileId,
        // 아직 안 넣었다. 넣으면 `runImport`가 같은 키로 갱신하며 배치를 붙인다.
        batchId: null,
        at: nowStamp(),
        columns: a.columns,
      })
    } finally {
      await db.close()
    }
  } catch {
    /* 배우지 못해도 가져오기는 계속된다 */
  }
}

export async function readDigest(batchId: string): Promise<BatchDigest | null> {
  try {
    const db = await open()
    try {
      return (await new Repository(db).batchDigest(batchId)) ?? null
    } finally {
      await db.close()
    }
  } catch {
    return null
  }
}
