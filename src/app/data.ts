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
import type { Driver } from "@core/store/driver.js"
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
import type { CostsView } from "./costs.js"
import type { BatchRowPage, FactTable } from "@core/store/repository.js"
import { loadPendingCostView, type PendingCostView } from "@core/linking/pending-cost.js"
import { loadFieldmapView, type FieldmapView } from "./fieldmap.js"
import { krCostBridgeMatcher } from "@packs/kr-marketplace/linking-matcher.js"
import { loadHistoryRows, type HistoryRow } from "@core/history/rows.js"
import { loadProductRows, type ProductView } from "@core/product/rows.js"
import { Repository, type BatchDigest } from "@core/store/repository.js"
import type { ImportAnalysis } from "@core/import/analyze.js"
import { krLinkingMatcher } from "@packs/kr-marketplace/linking-matcher.js"
import { krDocTypeResolver } from "@packs/kr-marketplace/markets/index.js"
import { loadProfiles } from "@packs/kr-marketplace/profiles/index.js"
import { mergeProfiles } from "@core/import/mapping/derive.js"
import { profileVersion, type MappingProfile } from "@core/import/mapping/index.js"
import { formatDefects, validateProfiles } from "@core/import/mapping/validate.js"
import type { DocTypeResolver } from "@core/coverage/load.js"
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
   * **파일에서 제외된 행의 총계** — 대시보드의 「일부 제외」 배너가 쓴다.
   *
   * 기간을 받지 않는다. 제외는 파일의 성질이지 달의 성질이 아니라서,
   * 기간으로 자르면 「7월에 3행 제외」가 무엇의 3인지 설명할 수 없게 된다.
   */
  excluded: { readonly files: number; readonly rows: number; readonly reasons: readonly { readonly reason: string; readonly count: number }[] }
  /** 「확인함」 당시의 제외 행 수 (012). `null`이면 미확인 — 그때만 배너가 펴진다. */
  excludedAck: number | null
  /**
   * 상품 화면이 그리는 SKU 목록과 원가 (③).
   *
   * 기간을 **받기는 한다** — 판매 수량 칸 때문이다. 원가와 연결은 «기준»이라
   * 기간과 무관하지만 «이 기간에 몇 개 팔렸나»는 기간의 값이라, 한 조회 안에
   * 둘이 섞인다. 섞인 것을 숨기지 않으려고 `soldQty`만 기간을 타는 것으로 못박아 뒀다.
   */
  products: ProductView | null
  /**
   * 비용 화면의 고정비·운영비 (마이그레이션 010).
   *
   * 기준일은 **보고 있는 기간의 시작**이다 — 손익이 그 기준으로 안분하므로
   * (`loadPnlSnapshot`) 화면이 다른 날을 쓰면 표의 합과 3층의 「− 고정비」가
   * 어긋난다. 원가에서 「화면 셋이 같은 창을 봐야 한다」고 세운 규율 그대로다.
   */
  costs: CostsView | null
  /**
   * 원가 대기 (011) — 연결 화면의 「원가 대기」 탭이 그린다.
   * 기간을 받지 않는다 — 대기는 파일의 성질이지 달의 성질이 아니다 (`linking`과
   * 같은 판단). 후보 계산은 준비된 매처로 행당 유사도만 남는다 (실측 43ms).
   */
  pendingCost: PendingCostView | null
  /**
   * 필드 매핑 화면의 양식 목록 (B1) — **009 읽기 표면의 첫 호출자.**
   * 내장 프로파일 9장 + 프로파일 없이 목격된 파일들. 기간을 받지 않는다 —
   * 「어떤 양식을 아느냐」는 달의 성질이 아니다.
   */
  fieldmap: FieldmapView | null
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
 * ★ 웹판인가 — **Tauri가 없으면 브라우저다** (2026-08-18) ★
 *
 * 데스크톱 앱의 웹뷰에는 `window.__TAURI_INTERNALS__`가 주입돼 있다. 없으면
 * 평범한 브라우저이고, 그쪽에는 파일시스템도 rusqlite도 없다.
 *
 * 판정을 **한 곳**에 둔다. 화면 여기저기서 다시 물으면 「앱에서는 되는데 웹에서는
 * 안 되는」 자리가 갈래마다 생긴다.
 */
export const isWebDemo = (): boolean =>
  typeof window !== "undefined" &&
  (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ === undefined

/**
 * ★ 웹판의 연결은 **하나뿐이고 닫지 않는다** ★
 *
 * `sql.js`는 DB를 메모리에 들고 있어서 `close()`가 곧 **소멸**이다. 이 파일의
 * 조회들은 전부 «열고 → 읽고 → 닫는» 모양인데, 그 규율은 파일 DB를 전제한다.
 * 웹판에서 그대로 두면 **첫 조회 뒤 DB가 사라진다.**
 *
 * 그래서 웹판에서는 연결을 한 번만 만들고, 돌려주는 핸들의 `close()`를 아무 일도
 * 하지 않게 감싼다 — 호출부를 고치지 않고도(그리고 데스크톱 동작을 건드리지 않고도)
 * 같은 코드가 두 세계에서 돈다.
 */
let webDb: Promise<Driver> | null = null

async function openWebDemo(): Promise<Driver> {
  webDb ??= (async () => {
    const [{ openWasmDriver }, wasmUrl] = await Promise.all([
      import("@core/store/driver-wasm.js"),
      import("sql.js/dist/sql-wasm.wasm?url").then((m) => m.default as string),
    ])
    // 동봉된 데모 DB. **비식별화 픽스처로 만든 것**이지 실데이터가 아니다
    // (`tools/harness/demo-db.ts`). 없으면 빈 DB로 서고, 화면은 §22대로
    // 「이 기간 파일 없음」을 말한다 — 조용히 0원을 그리지 않는다.
    const res = await fetch(`${import.meta.env.BASE_URL}demo.sqlite`)
    const bytes = res.ok ? new Uint8Array(await res.arrayBuffer()) : undefined
    if (!res.ok) console.warn("[data] 데모 DB를 받지 못했다 — 빈 DB로 연다")
    return openWasmDriver(bytes === undefined ? { wasmUrl } : { wasmUrl, bytes })
  })()
  const db = await webDb
  // 닫기를 삼킨다 — 이유는 위 주석. 조용히 삼키는 것이 아니라 **여기서만** 삼킨다.
  return { ...db, close: async (): Promise<void> => {} }
}

/**
 * DB를 연다. **모든 열기가 여기를 지난다** — 넘겨받기 조건이 한 곳에만 있어야
 * «첫 열기만»이라는 규칙이 갈리지 않는다.
 */
async function open(): Promise<Driver> {
  if (isWebDemo()) return openWebDemo()
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
      const pendingCost = await loadPendingCostView(db, DEV_LIBRARY, krCostBridgeMatcher)
      const repo = new Repository(db)
      // 개인 프로파일(B2)이 내장을 가린 병합본 — 필드매핑·커버리지·기록이 같은
      // 세계를 본다. 내장만 보면 `…@u1` batch의 docType을 못 풀어 커버리지가
      // 조용히 그 파일을 잃는다.
      const world = await profileWorld(repo)
      const fieldmap = await loadFieldmapView(repo, world.merged, DEV_LIBRARY, world.userVersions)
      const resolveDocType = world.resolveDocType
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
      const excluded = await repo.exclusionTotals(DEV_LIBRARY)
      /**
       * 항목마다 **이력 건수**를 함께 센다 — 「임대료 · 03부터 (이력 3)」이 되려면
       * 필요하다. 항목 수가 열 개 안팎이라 N+1이 실질 비용이 아니고, 세는 규칙을
       * 한 쿼리에 우겨넣으면 «그 시점에 유효한 값 하나»의 판정과 섞인다.
       */
      const withHistory = async (kind: "FIXED" | "OPS") =>
        Promise.all(
          (await repo.overheads(DEV_LIBRARY, kind, period.from)).map(async (o) => ({
            ...o,
            historyCount: (await repo.overheadHistory(DEV_LIBRARY, kind, o.label)).length,
          })),
        )
      const costs: CostsView = {
        fixed: await withHistory("FIXED"),
        ops: await withHistory("OPS"),
        stance: {
          fixed: await repo.overheadStance(DEV_LIBRARY, "FIXED"),
          ops: await repo.overheadStance(DEV_LIBRARY, "OPS"),
        },
      }
      return {
        snapshot,
        settlement,
        orders,
        linking,
        pendingCost,
        fieldmap,
        coverage,
        history,
        excluded,
        excludedAck: await new Repository(db).noticeAck(DEV_LIBRARY, EXCLUDED_NOTICE),
        products,
        costs,
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
    pendingCost: null,
    fieldmap: null,
    coverage: [],
    history: [],
    // 못 읽었으면 «제외가 없다»가 아니라 «모른다»이고, 배너는 그때 뜨지 않는다.
    excluded: { files: 0, rows: 0, reasons: [] },
    excludedAck: null,
    products: null,
    // 못 읽었으면 «고정비가 없다»가 아니라 «모른다»이다. 화면이 그때 «두지 않음»을
    // 그리면 사용자가 자기 선언이 사라진 줄 안다.
    costs: null,
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
 * ★ 프로파일의 세계 — **내장 + 내 확정판의 병합** (계획 B2) ★
 *
 * 사용자가 확정한 파생판(`mapping_profile source='user'`)이 같은 자연키의
 * 내장을 가린다 — 목업 고정 문구 «직접 지정한 매핑은 덮어쓰지 않습니다»의 이행.
 * 판정(analyze)·별칭 색인·필드매핑 화면·커버리지 해석이 전부 이 병합본을 쓴다:
 * **사용자의 답이 다음 판정의 확정 층이 된다** (§20 규칙 4).
 *
 * ★ 문에서 거르되 던지지 않는다 ★ 내장 프로파일의 문(`loadProfiles`)은 결함에
 * 던진다 — 그건 우리 잘못이고 앱이 안 뜨는 게 맞다. 개인 프로파일의 결함은
 * 성격이 다르다: 썩은 행 하나가 앱 전체를 막으면 사용자는 자기 데이터 전부를
 * 잃은 걸로 겪는다. 그래서 **세어서 경고하고 건너뛴다** (LOCK 6 — 조용히는 아니다).
 *
 * ★ docType 해석도 여기서 늘린다 ★ `krDocTypeResolver`는 내장 버전만 안다 —
 * `…@u1`로 적재된 batch를 그대로 두면 커버리지·기록이 그 파일의 종류를 몰라
 * **조용히 빠뜨린다.** 개인 프로파일의 버전을 먼저 보고, 없으면 내장으로 물러난다.
 */
async function profileWorld(repo: Repository): Promise<{
  readonly merged: readonly MappingProfile[]
  readonly userVersions: ReadonlySet<string>
  readonly resolveDocType: DocTypeResolver
}> {
  const { profiles: raw, broken } = await repo.userProfiles()
  if (broken > 0) console.warn(`[data] 본문이 읽히지 않는 개인 프로파일 ${broken}건 — 건너뛴다`)
  const user: MappingProfile[] = []
  for (const p of raw) {
    const defects = validateProfiles([p])
    if (defects.size > 0) {
      console.warn(`[data] 개인 프로파일 결함 — 건너뛴다\n${formatDefects(defects)}`)
    } else {
      user.push(p)
    }
  }
  const merged = mergeProfiles(loadProfiles(), user)
  const userVersions = new Set(user.map(profileVersion))
  const kr = krDocTypeResolver()
  const byUserVersion = new Map(user.map((p) => [profileVersion(p), p.docType]))
  const resolveDocType: DocTypeResolver = (mv) => {
    const dt = byUserVersion.get(mv)
    if (dt === "order" || dt === "settlement" || dt === "ad") return dt
    return kr(mv)
  }
  return { merged, userVersions, resolveDocType }
}

/**
 * 판정이 쓰는 프로파일 후보 — **병합본이다** (`analyzeImport`의 재료).
 *
 * DB를 못 열면 내장만으로 물러난다 — 판정은 DB 없이도 서야 하는 계약이고
 * (웹 데모), 그 상황에서 개인 프로파일은 어차피 저장할 수도 없었다.
 */
export async function loadAllProfiles(): Promise<readonly MappingProfile[]> {
  try {
    const db = await open()
    try {
      await catchUp(db)
      return (await profileWorld(new Repository(db))).merged
    } finally {
      await db.close()
    }
  } catch {
    return loadProfiles()
  }
}

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
/**
 * 이 batch가 넣은 행 한 페이지 (§21 «history-rows»).
 *
 * **필요할 때만 연다** — 스냅샷에 실어 나르면 화면에 안 보이는 8만 행을 매 조회마다
 * 읽게 된다 (LOCK 5). 열었을 때만, 한 페이지만.
 */
export async function loadBatchRows(
  batchId: string,
  table: FactTable,
  limit: number,
  offset: number,
): Promise<BatchRowPage> {
  try {
    const db = await open()
    try {
      await catchUp(db)
      return await new Repository(db).batchRows(batchId, table, limit, offset)
    } finally {
      await db.close()
    }
  } catch {
    // 못 읽으면 **빈 페이지**가 아니라 0행짜리 결과다 — 화면이 「없다」와
    // 「못 읽었다」를 가르려면 부르는 쪽이 그 차이를 알아야 하는데, 여기서는
    // 예외를 삼키지 않고 그대로 던지는 편이 맞다.
    throw new Error("적재된 행을 읽지 못했습니다")
  }
}

/** 대시보드 제외 배너의 확인 키 (012). 화면이 정하는 안정된 문자열이다. */
export const EXCLUDED_NOTICE = "dash.excluded"

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
 * **훑은 시트를 전부 남긴다** — 판정이 이미 전 시트를 봤으므로 재료가 손에 있다.
 *
 * 실패해도 가져오기를 막지 않는다. 배우지 못하는 것이 못 넣는 것보다 낫다.
 */
export async function recordSighting(a: ImportAnalysis): Promise<void> {
  try {
    const db = await open()
    try {
      await catchUp(db)
      const repo = new Repository(db)
      const at = nowStamp()
      /**
       * ★ **훑은 시트 전부**를 남긴다 — 고른 하나가 아니라 ★
       *
       * 판정이 이미 전 시트를 봤으므로(`sheetMatches`) 재료는 손에 있다. 고른
       * 시트만 남기면 19장짜리 워크북에서 18장을 또 잃는다 — 그리고 하필 그
       * 18장에 원가 마스터(7열)와 자사몰(101열)이 들어 있다.
       *
       * 드리프트의 증거도 안 고른 시트에 있다: 같은 11번가 양식이 한 파일에서
       * 63열, 다른 파일에서 60열이었다.
       */
      for (const m of a.sheetMatches) {
        await repo.recordFileSighting({
          libraryId: DEV_LIBRARY,
          sourceHash: a.contentHash,
          sourceName: a.fileName,
          sourceBytes: a.byteLength,
          containerFormat: a.format,
          sheetIndex: m.sheetIndex,
          sheetName: m.sheetName,
          headerRowIndex: m.header.rowIndex,
          // 시트마다 답이 다르다. 「이 파일의 프로파일」 같은 것은 없다.
          profileId: m.profiles[0]?.profile.id ?? null,
          // 아직 안 넣었다. 넣으면 `runImport`가 같은 키로 갱신하며 배치를 붙인다.
          batchId: null,
          at,
          columns: m.columns,
        })
      }
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
