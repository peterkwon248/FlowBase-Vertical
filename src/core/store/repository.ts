/**
 * 리포지토리 — **좁은 커맨드 표면.**
 *
 * 헌장 B-2(append-only)와 세션 2 합격 기준 4("전체 테이블 적재 경로가 없음")를
 * 구조로 만족시킨다. 여기 없는 동작은 상위 계층에서 할 수 없다 —
 * `selectAll()` 같은 함수가 **존재하지 않는 것**이 그 증명이다.
 *
 * `driver.ts`의 계약만 쓴다. 특정 드라이버의 API가 이 파일에 나타나면
 * 교체가 파일 하나로 끝나지 않는다.
 */

import type { Driver, Row, SqlValue } from "./driver.js"
import { readPage, type SheetBlock, type SheetCell } from "./sheet-block.js"
/**
 * ★ 타입만 가져온다 ★ `core/import`는 이 파일을 값으로 import하므로, 값을 되가져오면
 * 순환이 된다. `import type`은 컴파일에서 지워져 런타임 간선이 생기지 않는다.
 *
 * 유니온을 여기 다시 적지 않는 이유: `batch_exclusion.reason`이 그렇게 두 벌이 됐고
 * 001의 주석이 «파이프라인과 같은 집합»이라고 사람에게 부탁하고 있다. `code`는 SQL에
 * CHECK가 없어(008 참조) **이 타입이 유일한 잠금**이라 부탁으로 둘 수 없다.
 */
import type { IssueCode } from "../import/issues.js"
/** 열 서술의 모양은 `import/columns.ts`가 정한다 — 저장은 그걸 그대로 받아 적는다. */
import type { ColumnSighting } from "../import/columns.js"
/** 개인 프로파일(B2)의 본문 모양. 저장은 JSON 문자열로 하고 여기선 타입만 안다. */
import type { MappingProfile } from "../import/mapping/index.js"

/** 적재 가능한 Fact 테이블. 여기 없는 이름은 적재할 수 없다. */
export const FACT_TABLES = [
  "fact_order",
  "fact_order_item",
  "fact_settlement",
  "fact_claim",
  "fact_ad_spend",
] as const

export type FactTable = (typeof FACT_TABLES)[number]

/**
 * 적재된 행을 보여줄 때 **내보내지 않는 컬럼** (헌장 C-4 · 프라이버시).
 *
 * 공통 6컬럼과 대리 키는 내부 식별자라 화면에 나가면 안 되고(`tests/screen-safety`가
 * `conn-`·`batch-`·`connection_id`를 문자열로 잡는다), `buyer_ref`는 구매자
 * 식별 정보다 — 손익에 쓰이지 않으므로 보일 이유가 없다.
 *
 * **거부 목록이지 허용 목록이 아니다.** 새 컬럼이 생기면 기본이 «보인다»여야
 * 값이 조용히 사라지지 않는다 (LOCK 6). 대신 화면이 라벨을 강제하고, 라벨 없는
 * 컬럼은 시험이 먼저 잡는다.
 */
const HIDDEN_ROW_COLUMNS: ReadonlySet<string> = new Set([
  "id",
  "connection_id",
  "batch_id",
  "library_id",
  "version",
  "updated_at",
  "mapping_version",
  // 대리 키 — 사람이 알아보는 것은 이 값이 아니라 상품 이름이다.
  "order_id",
  "listing_id",
  "sku_id",
  // 구매자 식별 정보. 손익이 쓰지 않는다.
  "buyer_ref",
])

/** 한 페이지. `total`은 이 batch가 그 표에 넣은 **전체** 행 수다. */
export interface BatchRowPage {
  readonly columns: readonly string[]
  readonly rows: readonly (readonly (string | number | null)[])[]
  readonly total: number
}

/**
 * 조정이 가리킬 수 있는 대상 (ADR-020 A1·A3).
 *
 * ★ `settlement_daily`는 **실재하는 표가 아니다** ★
 * 정산 화면의 한 줄은 `GROUP BY settled_on, connection_id`의 결과라 Fact 행이
 * 아니다. 그 집계행에 붙는 조정을 Fact 행 조정과 구별하는 판별자가 이 이름이고,
 * **의미론도 여기서 갈린다** — `settlement_daily`는 delta 합산,
 * `fact_*`는 절대값 대체(`applyAdjustments`)다. 섞으면 조용히 틀린 금액이 된다.
 */
export const SETTLEMENT_DAILY = "settlement_daily"

export type AdjustmentTarget = FactTable | typeof SETTLEMENT_DAILY

/**
 * **지울 때의 순서** — 자식이 먼저다 (`PRAGMA foreign_keys = ON`).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 목록이 둘인가 ★
 * `fact_order_item.order_id`가 `fact_order(id)`를 가리킨다. `FACT_TABLES` 순서대로
 * 지우면 **부모를 먼저 지우게 되고**, 품목이 존재하는 순간 되돌리기가
 * `FOREIGN KEY constraint failed`로 통째로 실패한다.
 *
 * 품목 적재 전에는 `fact_order_item`이 늘 0행이라 **이 버그가 드러날 수 없었다.**
 * 되돌리기는 이미 실기기에서 한 바퀴 돌았지만 그 회차가 증명한 것은 «품목이 없는
 * 되돌리기»였다 — 게이트의 사각을 아는 것(작업 리듬 7)의 또 한 사례다.
 *
 * `FACT_TABLES`를 재정렬하지 않고 **따로 선언한다.** 그쪽은 «적재할 수 있는
 * 테이블의 목록»이고 순서에 뜻이 없다. 뜻이 있는 순서를 이름 없는 배열 순서에
 * 얹어 두면 다음 사람이 알파벳순으로 정렬하는 날 조용히 깨진다.
 * ─────────────────────────────────────────────────────────────
 *
 * `tests/order-item.test.ts`가 이 목록이 `FACT_TABLES`와 **같은 집합**인지, 그리고
 * 실파일 되돌리기가 FK에 걸리지 않는지 둘 다 지킨다.
 */
export const DELETE_ORDER = [
  "fact_order_item", // ← fact_order를 참조한다. 반드시 먼저.
  "fact_order",
  "fact_settlement",
  "fact_claim",
  "fact_ad_spend",
] as const satisfies readonly FactTable[]

/**
 * **Dimension 테이블** — Fact와 다른 규칙으로 산다.
 *
 * 목록을 따로 두는 것은 성격이 **타입으로 읽히게** 하기 위해서다. 주석은 지나치면
 * 안 읽히지만 목록이 갈려 있으면 `loadChunk`에 dimension을 넘기는 코드가 애초에
 * 컴파일되지 않는다.
 *
 * | | Fact | Dimension |
 * |---|---|---|
 * | 공통 6컬럼 (B-1) | 강제 | **없다** — batch에 묶이지 않으므로 |
 * | batch | 소속된다 | 무관 |
 * | 되돌리기 | batch 행 제거 | **불가침** |
 * | 재가져오기 | UPSERT (version↑) | 사람이 정한 값은 **보존** |
 */
export const DIMENSION_TABLES = ["marketplace_listing"] as const

export type DimensionTable = (typeof DIMENSION_TABLES)[number]

/**
 * 리스팅의 id — **자연키에서 만든다.** `upsertListings`가 쓰는 그 규칙이고,
 * 품목이 `listing_id`를 **조회 없이** 계산할 수 있는 근거다.
 *
 * 규칙이 한 곳에만 있어야 한다: 여기서 만든 id와 `upsertListings`가 넣는 id가
 * 어긋나면 품목이 존재하지 않는 리스팅을 가리키고 FK가 적재를 막는다.
 */
export const listingIdFor = (connectionId: string, listingKey: string): string =>
  `lst-${connectionId}-${listingKey}`

/** 리스팅 한 줄. 파일이 말해주는 것만 담는다 — 연결 상태는 사람이 정한다. */
export interface ListingUpsert {
  /** 마켓의 상품/옵션 식별자. **문자열로 유지한다** (ADR-002 · 숫자로 바꾸면 정밀도를 잃는다). */
  readonly listingKey: string
  readonly title: string
  /** 이 리스팅이 상품 단위인가 옵션 단위인가 (마이그레이션 004). */
  readonly grain: "product" | "option"
}

/** 헌장 B-1 공통 6컬럼. 적재 시 리포지토리가 채운다 — 호출자가 빠뜨릴 수 없다. */
const COMMON_COLUMNS = [
  "connection_id",
  "batch_id",
  "library_id",
  "version",
  "updated_at",
  "mapping_version",
] as const

export interface BatchOpen {
  readonly id: string
  readonly libraryId: string
  readonly connectionId: string
  readonly sourceName: string
  readonly sourceBytes: number
  /**
   * 파일 바이트의 지문 (SHA-1 hex). **같은 바이트·다른 이름**을 잡는 유일한 단서다.
   *
   * 파일명이 키에 들어가는 양식(기간 집계)에서는 이름만 바꿔 다시 넣으면
   * `source_key`가 갈라져 매출이 두 번 쌓인다 — 그 사고를 확인 단계에서 미리
   * 말하려면 지문이 batch에 남아 있어야 한다 (마이그레이션 006).
   */
  readonly sourceHash?: string
  readonly containerFormat: string
  readonly sheetName?: string
  readonly mappingVersion: string
  readonly startedAt: string
}

export interface ExclusionRecord {
  readonly rowIndex: number
  readonly reason: "total" | "subtitle" | "blank" | "trailing-blank" | "error"
  readonly detail: string
}

/**
 * **적재된 행에 붙는 주석** — 제외가 아니다 (마이그레이션 008).
 *
 * `rowIndex`는 `scope === "row"`일 때만 있다. 파일 전체에 걸친 사건(없는 컬럼)에
 * 행 번호를 지어 주면 «1행에서 일어난 일»처럼 보이는데, 실제로는 전 행이 겪는다.
 */
export interface IssueRecord {
  readonly code: IssueCode
  readonly scope: "row" | "file"
  readonly rowIndex: number | null
  readonly detail: string
}

/**
 * 「이 파일의 이 시트를 봤다」 — **적재와 무관하게 남는 사실** (마이그레이션 009).
 *
 * `profileId`와 `batchId`가 **둘 다 null인 것이 정상 경우**다. 맞는 양식이 없어
 * 넣지 못한 파일이야말로 지금까지 통째로 증발하던 쪽이고, 이 기록을 만든 이유다.
 */
export interface FileSightingRecord {
  readonly libraryId: string
  /** 파일 지문 (SHA-1 hex) — `batch.source_hash`와 같은 값·같은 표기. */
  readonly sourceHash: string
  readonly sourceName: string
  readonly sourceBytes: number
  readonly containerFormat: string
  readonly sheetIndex: number
  readonly sheetName: string | null
  /** 헤더 줄. **못 찾으면 null** — 0으로 넘겨짚지 않는다. */
  readonly headerRowIndex: number | null
  /** 맞은 프로파일. 없으면 null. */
  readonly profileId: string | null
  /** 적재까지 갔다면 그 배치. 안 갔으면 null. */
  readonly batchId: string | null
  readonly at: string
  readonly columns: readonly ColumnSighting[]
  /**
   * ★ 「몇 번 봤나」를 올리나 (016) ★ 기본은 `true`.
   *
   * 적재 경로는 이 함수를 **한 번의 가져오기에 두 번** 부른다 — 표를 담으려면
   * `sighting_id`가 루프 **전에** 필요하고(LOCK 5: 전 행을 모아 뒀다 담을 수 없다),
   * 배치 id와 열 목록은 루프 **뒤에**야 손에 들어오기 때문이다.
   *
   * 두 번 다 올리면 파일 하나를 넣었는데 「2번 봤다」가 된다. 두 번째 호출이
   * `false`를 준다 — **같은 목격 사건의 마무리**이지 새로 본 것이 아니다.
   */
  readonly countAsSeen?: boolean
}

/**
 * `createSkuForListings`의 결과.
 *
 * `skuId`가 `null`이면 **아무것도 만들지 않았다** — 받은 리스팅이 전부 이미
 * 이어져 있었다는 뜻이고, 같은 요청이 두 번 온 것이다. 화면은 이걸 오류로
 * 다루지 않는다 (사용자는 같은 일을 두 번 시켰을 뿐 잘못한 게 없다).
 */
export interface CreateSkuResult {
  readonly skuId: string | null
  readonly linked: number
  readonly alreadyLinked: number
}

/** 연결 하나. `displayName`은 프로파일이 선언한 **채널 통칭**이다 (문서 이름이 아니다). */
export interface ConnectionUpsert {
  readonly id: string
  readonly libraryId: string
  readonly packId: string
  readonly marketplaceKey: string
  readonly displayName: string
}

/**
 * 배치 하나가 무엇을 했는지 — 가져오기 다이제스트 화면이 읽는 **타입 있는 요약**.
 *
 * `batchStatus`는 `SELECT *`라 화면이 `Record<string, SqlValue>`를 손으로 파싱해야 했고,
 * 제외는 `batch_exclusion`에 **넣기만 하고 아무도 읽지 않았다**. 읽지 못한 것을
 * 표시해야 한다는 LOCK 6은 적재까지만 지켜지고 화면에는 닿지 못하고 있었다.
 */
/**
 * 가져오기 이력 한 줄 (`batchHistory`). 되돌리기 버튼의 3상태 판정 재료를 포함한다.
 */
/** 통의 한 줄 — **파일 × 시트**다 (009의 키). */
export interface IntakeHistoryRow {
  readonly id: number
  readonly sourceHash: string
  readonly sourceName: string
  readonly sheetName: string | null
  readonly sheetIndex: number
  /** 맞은 양식. **`null`이 정상값이다** — 「맞는 양식이 없었다」도 기록할 사실이다. */
  readonly profileId: string | null
  /** 적재까지 갔으면 그 배치. 기준 데이터는 `null`이고 그것이 정상이다. */
  readonly batchId: string | null
  readonly firstSeenAt: string
  readonly lastSeenAt: string
  readonly seenCount: number
  readonly columnCount: number
  /** batch가 못 담는 결과 (015). Fact 파일은 비어 있고, 그것도 결손이 아니다. */
  readonly outcomes: Readonly<Record<string, number>>
}

export interface BatchHistoryRow {
  readonly id: string
  readonly connectionId: string
  /** 사람이 읽는 채널 이름 — `connection.display_name` (헌장 C-4). */
  readonly channel: string
  readonly sourceName: string
  readonly sheetName: string | null
  readonly mappingVersion: string
  readonly status: string
  readonly startedAt: string
  readonly committedAt: string | null
  readonly undoneAt: string | null
  /**
   * **적재 당시** 센 행 — 되돌려도 안 변한다 (2026-08-16 정정).
   *
   * 옛 주석은 「적재 당시 센 행. 되돌리면 0이 된다」였는데 그 둘은 동시에 참일 수
   * 없다. «지금 몇 행인가»는 `ownedRows`가 답한다.
   *
   * ⚠ **이 정정 이전에 되돌려진 배치는 0으로 밀려 있다.** 그 0은 「가져온 행이
   * 없었다」가 아니라 **「옛 코드가 지웠다」**이고, 되찾을 수 없다 —
   * 007 이전 배치의 분해 카운터가 셋 다 0인 것과 같은 계열이다.
   */
  readonly rowCount: number
  readonly excludedCount: number
  /** **지금** 이 배치가 소유한 fact 행 — 되돌리면 사라질 수. */
  readonly ownedRows: number
  /**
   * 테이블별 소유 행. 「엔티티」 칸이 이걸 말한다 — ESM 한 파일이 `fact_order`와
   * `fact_claim` 둘로 갈리는 것(`rowRouting`)이 여기서 보인다.
   */
  readonly ownedByTable: Readonly<Record<string, number>>
  /** 이 배치가 덮어쓴 행 — 되돌리면 이전 판으로 **복원될** 수. */
  readonly restoresRows: number
  /** 이후 배치가 가져간 행. **0이 아니면 잠긴다.** */
  readonly takenOverRows: number
  /** 잠근 배치. `takenOverRows === 0`이면 `null`. */
  readonly blockedBy: {
    readonly id: string
    readonly sourceName: string
    readonly at: string | null
  } | null
}

/** 묶음 한 줄 — 화면의 목록이 쓰는 모양 (ADR-021 · 013). */
export interface CollectionRow {
  readonly id: string
  readonly name: string
  /** 담긴 파일 수. **지금 몇 행인가**는 아니다 — 그건 `batchHistory`가 답한다. */
  readonly batchCount: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface BatchDigest {
  readonly id: string
  readonly sourceName: string
  readonly containerFormat: string
  readonly sheetName: string | null
  readonly status: string
  readonly rowCount: number
  readonly excludedCount: number
  readonly startedAt: string
  readonly committedAt: string | null
  /** 제외 사유별 건수. **0건이면 빈 배열이고 그것도 사실이다.** */
  readonly exclusionsByReason: readonly { readonly reason: string; readonly count: number }[]
  /**
   * 적재의 분해 — 「신규 + 갱신 + 병합 + 제외 = 파일 행」 (마이그레이션 007).
   *
   * ⚠ **007 이전 배치는 셋 다 0이다.** «병합이 없었다»가 아니라 «세지 않았다»이므로,
   * 화면은 `merged > 0`일 때만 말한다 (ADR-009 ①-보완 3의 3번).
   */
  readonly inserted: number
  readonly updated: number
  readonly merged: number
  /**
   * **적재됐지만 온전하지 않은 행** — 중복 제거된 행 수 (마이그레이션 008).
   *
   * `issuesByCode`의 합이 아니다. 한 행이 사유 둘을 겪을 수 있으므로 그 합보다
   * 작을 수 있다 — `lostRows`가 `mappingErrors.length`와 다른 것과 같은 이유다.
   */
  readonly incompleteRows: number
  /** 행 단위 사건 — 사유별 **행 수**(중복 제거). 없으면 빈 배열이다. */
  readonly issuesByCode: readonly { readonly code: string; readonly rows: number }[]
  /**
   * 파일 전체에 걸친 사건. 행 수로 셀 수 없어 **기록마다 한 줄**로 낸다
   * (컬럼 둘이 없으면 두 줄이다).
   */
  readonly fileIssues: readonly { readonly code: string; readonly detail: string }[]
}

/** 적재할 행 하나 — 공통 컬럼을 뺀 본문만. */
export type FactRow = Readonly<Record<string, SqlValue>>

export interface LoadStats {
  readonly inserted: number
  readonly updated: number
}

export class Repository {
  private readonly insertCache = new Map<string, string>()
  private readonly columnCache = new Map<string, string[]>()

  constructor(private readonly db: Driver) {}

  // ─────────────────────────────────────────────────────────
  // 배치가 붙을 자리 — 라이브러리와 연결
  // ─────────────────────────────────────────────────────────

  /**
   * 라이브러리가 있게 한다. 이미 있으면 아무것도 하지 않는다.
   *
   * 지금까지 이걸 하는 코드는 전부 **생 INSERT**였다(`smoke.ts` · `pnl.ts` · `e2e-worker.ts`).
   * 하네스는 자기가 만든 DB를 자기가 아니까 그래도 됐지만, 사용자가 파일을 넣는
   * 경로에는 "처음이면 만들고 아니면 둔다"가 필요하다.
   */
  async ensureLibrary(id: string, name: string, now: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO library (id, name, created_at) VALUES (?,?,?)
         ON CONFLICT(id) DO NOTHING`,
      )
      .run(id, name, now)
  }

  /**
   * 연결이 있게 한다.
   *
   * ★ `displayName`은 프로파일이 선언한 **채널 통칭**이다 ★
   * 문서 이름(`label`)이 아니다. 이걸 헷갈리면 화면의 채널 열에
   * "11번가 결제일 정산확정" 같은 문서 제목이 뜬다 (헌장 C-4 계열).
   *
   * 재가져오기로 같은 연결이 다시 오면 이름만 갱신한다 — 사용자가 나중에
   * 덮어쓰는 값이 되면(§10-2) 그때 이 동작을 다시 본다.
   */
  async ensureConnection(c: ConnectionUpsert, now: string): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO connection
           (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
         VALUES (?,?,?,?,?,'CONNECTED',?,?)
         ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, updated_at = excluded.updated_at`,
      )
      .run(c.id, c.libraryId, c.packId, c.marketplaceKey, c.displayName, now, now)
  }

  // ─────────────────────────────────────────────────────────
  // 배치 수명주기 (헌장 B-2)
  // ─────────────────────────────────────────────────────────

  async openBatch(b: BatchOpen): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes,
           source_hash, container_format, sheet_name, mapping_version, status,
           row_count, excluded_count, started_at)
         VALUES (?,?,?,?,?,?,?,?,?, 'open', 0, 0, ?)`,
      )
      .run(
        b.id,
        b.libraryId,
        b.connectionId,
        b.sourceName,
        b.sourceBytes,
        b.sourceHash ?? null,
        b.containerFormat,
        b.sheetName ?? null,
        b.mappingVersion,
        b.startedAt,
      )
  }

  /**
   * 마켓 리스팅을 **보존 UPSERT**한다 (ADR-012).
   *
   * ─────────────────────────────────────────────────────────────
   * ★ 사람의 결정은 파일의 재도착보다 오래 산다 ★
   *
   * 파일이 다시 오면 갱신되는 것은 **마켓이 소유한 값뿐**이다:
   *
   *   갱신   title · grain · updated_at
   *   보존   sku_id · link_state · linked_by · linked_at
   *
   * 재가져오기가 `sku_id`를 덮으면 사용자가 맺은 연결이 조용히 증발한다. ADR-004가
   * "되돌리기 후 재가져오기 시 조정 생존"을 정한 것과 같은 원리를 dimension에
   * 적용한 것이다 — 새 결정이 아니라 기존 결정의 이행이다.
   *
   * ★ 부재는 삭제 신호가 아니다 ★
   * 파일이 어떤 리스팅을 싣고 오지 않아도(단종 등) 그 행과 연결은 남는다.
   * **연결을 끊는 유일한 경로는 사람의 명시적 행위**(연결 화면의 unlink)다
   * (§10-3 "연결 해제 시 데이터 남길지 묻는다"와 같은 계열).
   *
   * 그래서 이 함수에는 삭제가 없고, `undoBatch`도 이 표를 건드리지 않는다.
   * ─────────────────────────────────────────────────────────────
   */
  async upsertListings(
    libraryId: string,
    connectionId: string,
    listings: readonly ListingUpsert[],
    now: string,
  ): Promise<LoadStats> {
    if (listings.length === 0) return { inserted: 0, updated: 0 }

    // `UNIQUE (connection_id, listing_key)`가 충돌 지점이다. 충돌 시 마켓이 소유한
    // 값만 덮고 연결 4필드는 **UPDATE 절에 아예 적지 않는다** — 적지 않은 컬럼은
    // 건드려지지 않으므로, 보존이 "잊지 않고 유지하는 것"이 아니라 구조가 된다.
    const sql =
      `INSERT INTO marketplace_listing
         (id, library_id, connection_id, listing_key, title, grain,
          sku_id, link_state, linked_at, linked_by, updated_at)
       VALUES (?,?,?,?,?,?, NULL, 'unlinked', NULL, NULL, ?)
       ON CONFLICT (connection_id, listing_key) DO UPDATE SET
         title = excluded.title,
         grain = excluded.grain,
         updated_at = excluded.updated_at`

    const width = 7
    function* paramRows(): Generator<SqlValue[]> {
      for (const l of listings) {
        const p: SqlValue[] = new Array(width)
        // id는 **자연키에서 만든다** — 재가져오기마다 새 id를 뽑으면 같은 리스팅이
        // 매번 다른 행으로 보인다. 충돌 시 어차피 기존 id가 유지된다.
        p[0] = `lst-${connectionId}-${l.listingKey}`
        p[1] = libraryId
        p[2] = connectionId
        p[3] = l.listingKey
        p[4] = l.title
        p[5] = l.grain
        p[6] = now
        yield p
      }
    }

    return this.db.transaction(async () => {
      const before = await this.countListings(connectionId)
      await this.db.runMany(sql, paramRows())
      const inserted = (await this.countListings(connectionId)) - before
      return { inserted, updated: listings.length - inserted }
    })
  }

  // ══════════════════════════════════════════════════════════════
  // 연결 쓰기 — **이 앱의 첫 사용자 쓰기다** (§21-6)
  //
  // ★ 여기 오는 것은 사람이 누른 결과뿐이다 ★
  // 유사도 제안은 `packs/…/listing-match.ts`가 점수만 내고 끝난다. 이 함수들은
  // 그 점수를 보지도 않는다 — 인자로 받지 않으므로 **자동 확정이 구조적으로
  // 불가능하다.** "AI 초안 · 사람 확정"의 확정 지점이 여기다.
  // ══════════════════════════════════════════════════════════════

  /**
   * 리스팅에서 **새 SKU를 만들고 곧바로 잇는다.**
   *
   * `sku.product_id`가 NOT NULL이라 상품도 함께 만든다. 콜드스타트에서는 상품과
   * SKU가 1:1이고, 나중에 사람이 여러 SKU를 한 상품으로 묶는 것은 상품 화면의 일이다.
   *
   * 여러 리스팅을 한 번에 받는 것이 **군집의 이행**이다 — 11번가 옵션 3개가
   * 한 SKU로 간다 (§21-6 ①).
   */
  async createSkuForListings(
    libraryId: string,
    listingIds: readonly string[],
    name: string,
    now: string,
  ): Promise<CreateSkuResult> {
    if (listingIds.length === 0) throw new Error("연결할 리스팅이 없다")

    return this.db.transaction(async () => {
      /**
       * ★ 멱등 — 같은 요청이 두 번 와도 SKU가 둘이 되지 않는다 ★
       *
       * 2d에서 사용자가 한 카드의 [새 SKU로 등록]을 두 번 눌렀다. 두 번째 호출이
       * **새 SKU를 하나 더 만들고 리스팅을 그리로 옮겨**, 첫 번째가 리스팅 0개짜리
       * 고아로 남았다 (실측: sku 62 · 리스팅 붙은 SKU 61).
       *
       * 처음엔 "쓰기 도는 동안 버튼을 안 막았다"고 진단했는데 **반쪽이었다.**
       * 잠금은 UX이고 이건 정확성이다 — 더블클릭 말고도 같은 요청이 두 번 갈
       * 경로는 코드가 늘면 또 생긴다. 방어는 쓰기 함수 자신이 해야 한다.
       *
       * 이미 이어진 리스팅은 **건너뛰고 그 사실을 돌려준다.** 남는 것이 없으면
       * SKU를 아예 만들지 않는다 — 그 «만들지 않음»이 고아를 막는 자리다.
       */
      const rows = await this.db
        .prepare(
          `SELECT id FROM marketplace_listing
            WHERE link_state = 'linked' AND id IN (${listingIds.map(() => "?").join(",")})`,
        )
        .all(...listingIds)
      const already = new Set(rows.map((r) => String(r["id"])))
      const fresh = listingIds.filter((id) => !already.has(id))

      if (fresh.length === 0) {
        return { skuId: null, linked: 0, alreadyLinked: already.size }
      }

      // 코드는 순번으로 뽑는다. 사람이 읽는 이름은 `name`이고, 코드는 나중에
      // 상품 화면에서 바꾼다 (기준 데이터는 편집 가능 · §14-2).
      const seq = await this.nextSeq(libraryId)
      const code = `SKU-${String(seq).padStart(4, "0")}`
      const productId = `prd-${libraryId}-${seq}`
      const skuId = `sku-${libraryId}-${seq}`

      await this.db
        .prepare(
          `INSERT INTO product (id, library_id, name, created_at, updated_at) VALUES (?,?,?,?,?)`,
        )
        .run(productId, libraryId, name, now, now)
      await this.db
        .prepare(
          `INSERT INTO sku (id, library_id, product_id, code, name, status, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?)`,
        )
        .run(skuId, libraryId, productId, code, name, "ACTIVE", now, now)

      await this.linkListingsInternal(fresh, skuId, now)
      return { skuId, linked: fresh.length, alreadyLinked: already.size }
    })
  }

  /**
   * 미완료 배치를 치운다 — **재가져오기가 곧 정리다** (2026-08-16, 대열 4 ③의 마지막 조각).
   *
   * ─────────────────────────────────────────────────────────────
   * ★ 왜 필요한가 — 재시도가 정리를 막고 있었다 ★
   *
   * 적재가 도중에 죽으면 `open` 배치와 그 배치가 넣은 fact 행이 남는다. 그 행들은
   * 조회에 안 보이지만(`active_*`가 `status='committed'`로 거른다) 사라진 것도 아니다.
   *
   * 그 상태를 본 사용자의 **자연스러운 첫 행동은 「다시 넣어 보자」**다. 그런데
   * 그렇게 하면 UPSERT가 미완료 배치의 행을 덮고, 그림자 트리거
   * (`OLD.batch_id <> NEW.batch_id`)가 `prev_batch_id = 미완료 배치`를 남긴다 →
   * `assertUndoable` ③이 **그 미완료 배치를 영영 못 치우게 만든다.**
   * 치우려는 순간 못 치우게 되는 구조였고, 방아쇠가 사용자의 첫 행동이었다.
   *
   * ★ 그래서 **적재 «시작»에** 치운다 — 끝이 아니라 ★
   * 끝에 치우면 그림자 사슬(원본 → 미완료 → 새 배치)이 이미 얽혀 있어, 복원이
   * **새 배치의 데이터를 옛 판으로 덮어쓴다.** 시작 시점에는 그 사슬이 아직 없으므로
   * 평범한 되돌리기 한 번으로 깨끗하게 정리된다.
   *
   * 재시도는 「아까 그거 무효, 다시」라는 의사표시다. 시스템이 그 의사대로 닫아 준다.
   *
   * ★ 조용히 치우지 않는다 ★ 무엇을 치웠는지 부르는 쪽이 받아서 다이제스트에 남긴다
   * (LOCK 6). 그리고 치운 배치는 「취소됨」으로 보인다 — `committed_at`이 NULL이라
   * 되돌리기와 갈린다 (③-b).
   *
   * ⚠ **전제: 한 연결에 동시 적재는 하나다.** 위저드가 `wiz.busy`로 직렬화한다.
   * 그 전제가 깨지면(Tauri 연결이 전역 하나인 문제 — 대열에 등재) 도는 적재를
   * 치울 수 있다. 다만 그 경우 `assertUndoable`이 막으므로 **건너뛰고 보고한다.**
   * ─────────────────────────────────────────────────────────────
   *
   * @returns 치운 배치. 막혀서 못 치운 것은 `blocked: true`로 함께 돌려준다
   */
  async abortStaleBatches(
    libraryId: string,
    connectionId: string,
    at: string,
  ): Promise<readonly { readonly id: string; readonly sourceName: string; readonly blocked: boolean }[]> {
    const stale = await this.db
      .prepare(
        `SELECT id, source_name FROM batch
          WHERE library_id = ? AND connection_id = ? AND status = 'open'
          ORDER BY started_at`,
      )
      .all(libraryId, connectionId)

    const out: { id: string; sourceName: string; blocked: boolean }[] = []
    for (const b of stale) {
      const id = String(b["id"])
      try {
        await this.undoBatch(id, at)
        out.push({ id, sourceName: String(b["source_name"]), blocked: false })
      } catch {
        // 막혔다 = 다른 배치가 이미 그 행을 가져갔다. 손대지 않고 알린다.
        out.push({ id, sourceName: String(b["source_name"]), blocked: true })
      }
    }
    return out
  }

  /**
   * 다음 SKU 순번 — **`COUNT(*)`로 뽑지 않는다.**
   *
   * ─────────────────────────────────────────────────────────────
   * ★ 2026-08-16, 사용자가 연결 세션 도중 이것에 막혔다 ★
   *
   * ```
   * UNIQUE constraint failed: product.id
   * SKU COUNT = 61 → 다음 순번 62 · 그런데 이미 있는 최대 번호도 62
   * ```
   *
   * `COUNT(*) + 1`은 **번호에 구멍이 없다**를 전제한다. 그런데 구멍은 정상 동작으로
   * 생긴다 — `purgeOrphanSkus`가 고아를 치우면 그 번호가 빈다. 그 뒤로 COUNT는
   * 영원히 «이미 쓰인 번호»를 가리키고, 새 SKU를 만들 때마다 터진다.
   *
   * ★ 코드가 아니라 **id**에서 번호를 읽는다 ★
   * `code`는 사람이 바꿀 수 있다(§14-2 — 기준 데이터는 편집 가능). 사람이 코드를
   * 「감성무드등」으로 고치는 순간 코드 기반 MAX는 다시 틀린다. `id`는 아무도
   * 안 바꾸므로 그쪽이 진짜 근거다.
   *
   * 그리고 MAX를 뽑고도 **비어 있는지 한 번 더 본다.** 두 테이블의 id 형식이
   * 언젠가 갈릴 수 있고, 그때 조용히 충돌하는 것보다 한 번 더 묻는 편이 싸다.
   * ─────────────────────────────────────────────────────────────
   */
  private async nextSeq(libraryId: string): Promise<number> {
    const maxOf = async (table: "sku" | "product", prefix: string): Promise<number> => {
      const r = await this.db
        .prepare(
          `SELECT MAX(CAST(SUBSTR(id, ?) AS INTEGER)) AS m FROM ${table}
            WHERE library_id = ? AND id LIKE ?`,
        )
        .get(prefix.length + 1, libraryId, `${prefix}%`)
      return Number(r?.["m"] ?? 0)
    }
    let seq =
      Math.max(
        await maxOf("sku", `sku-${libraryId}-`),
        await maxOf("product", `prd-${libraryId}-`),
      ) + 1

    // 형식이 어긋난 id가 섞여 있어도 여기서 걸린다. 상한은 폭주 방지용이다 —
    // 여기 걸릴 만큼 도는 것은 그 자체가 사고이므로 조용히 넘기지 않고 던진다.
    for (let guard = 0; guard < 10_000; guard++) {
      const taken = await this.db
        .prepare(
          `SELECT 1 AS x FROM sku WHERE id = ?
            UNION ALL SELECT 1 FROM product WHERE id = ?
            UNION ALL SELECT 1 FROM sku WHERE library_id = ? AND code = ?`,
        )
        .get(
          `sku-${libraryId}-${seq}`,
          `prd-${libraryId}-${seq}`,
          libraryId,
          `SKU-${String(seq).padStart(4, "0")}`,
        )
      if (!taken) return seq
      seq++
    }
    throw new Error(`빈 SKU 순번을 찾지 못했다 (${libraryId})`)
  }

  /**
   * 리스팅이 하나도 붙지 않은 SKU를 치운다 — **고아 정리.**
   *
   * ★ 일회성 스크립트가 아니라 함수 + 테스트인 이유 ★
   * 고아는 «한 번 있었던 사고»가 아니라 **연결을 옮기면 언제든 생기는 상태**다.
   * 리스팅을 다른 SKU로 재연결하면 원래 SKU가 비고, 그건 정상 동작의 부산물이다.
   * 일회성으로 치우면 다음에 같은 일이 났을 때 아무도 모른다.
   *
   * ★ 원가가 붙은 SKU는 남긴다 ★
   * 리스팅이 없어도 사람이 원가를 넣었다면 그건 **사람의 판단**이고, 판단을 자동으로
   * 지우지 않는다 (헌장 3 — 원본 불변의 정신). 어차피 `cost_history.sku_id`가
   * NOT NULL이라 지우면 FK가 끊긴다.
   *
   * 상품도 함께 본다 — SKU를 지워 남은 상품이 비면 그 상품도 치운다. 콜드스타트에서
   * 상품과 SKU는 1:1로 태어나므로(`createSkuForListings`), 껍데기 상품이 남는다.
   */
  async purgeOrphanSkus(libraryId: string): Promise<{ skus: number; products: number }> {
    return this.db.transaction(async () => {
      const orphans = await this.db
        .prepare(
          `SELECT s.id, s.product_id FROM sku s
            WHERE s.library_id = ?
              AND NOT EXISTS (SELECT 1 FROM marketplace_listing l
                               WHERE l.sku_id = s.id AND l.link_state = 'linked')
              AND NOT EXISTS (SELECT 1 FROM cost_history c WHERE c.sku_id = s.id)`,
        )
        .all(libraryId)
      if (orphans.length === 0) return { skus: 0, products: 0 }

      for (const o of orphans) {
        await this.db.prepare(`DELETE FROM sku WHERE id = ?`).run(String(o["id"]))
      }
      // SKU가 하나도 안 남은 상품만 치운다 — 여러 SKU를 한 상품에 묶은 경우를 지키기 위해서다
      let products = 0
      for (const pid of new Set(orphans.map((o) => String(o["product_id"])))) {
        const r = await this.db
          .prepare(`SELECT COUNT(*) AS n FROM sku WHERE product_id = ?`)
          .get(pid)
        if (Number(r?.["n"] ?? 0) === 0) {
          await this.db.prepare(`DELETE FROM product WHERE id = ?`).run(pid)
          products++
        }
      }
      return { skus: orphans.length, products }
    })
  }

  /** 이미 있는 SKU에 리스팅을 잇는다. */
  async linkListings(
    listingIds: readonly string[],
    skuId: string,
    now: string,
  ): Promise<number> {
    if (listingIds.length === 0) return 0
    return this.db.transaction(async () => this.linkListingsInternal(listingIds, skuId, now))
  }

  private async linkListingsInternal(
    listingIds: readonly string[],
    skuId: string,
    now: string,
  ): Promise<number> {
    const sql =
      `UPDATE marketplace_listing
          SET sku_id = ?, link_state = 'linked', linked_by = 'user', linked_at = ?, updated_at = ?
        WHERE id = ?`
    for (const id of listingIds) await this.db.prepare(sql).run(skuId, now, now, id)
    return listingIds.length
  }

  /**
   * 연결을 끊는다 — **사람의 명시적 행위만** (ADR-012 결정 3).
   *
   * `sku_id`를 비우고 `unlinked`로 되돌린다. 파일의 부재로는 절대 여기 오지 않는다.
   */
  async unlinkListings(listingIds: readonly string[], now: string): Promise<number> {
    if (listingIds.length === 0) return 0
    return this.db.transaction(async () => {
      const sql =
        `UPDATE marketplace_listing
            SET sku_id = NULL, link_state = 'unlinked', linked_by = NULL, linked_at = NULL,
                updated_at = ?
          WHERE id = ?`
      for (const id of listingIds) await this.db.prepare(sql).run(now, id)
      return listingIds.length
    })
  }

  /**
   * "연결하지 않기로 했다"를 기록한다.
   *
   * **이것도 상태다** — 매번 다시 물어보지 않기 위해서다(001 스키마 주석).
   * 무시는 삭제가 아니므로 리스팅은 그대로 남고 `ignored` 탭에서 되돌릴 수 있다.
   */
  async ignoreListings(listingIds: readonly string[], now: string): Promise<number> {
    if (listingIds.length === 0) return 0
    return this.db.transaction(async () => {
      const sql =
        `UPDATE marketplace_listing
            SET link_state = 'ignored', linked_by = 'user', linked_at = ?, updated_at = ?
          WHERE id = ?`
      for (const id of listingIds) await this.db.prepare(sql).run(now, now, id)
      return listingIds.length
    })
  }

  // ── 원가 (기준 데이터) ──────────────────────────────────────────
  //
  // ★ Fact가 아니다 ★ batch에 묶이지 않고 되돌리기의 대상도 아니다 — 리스팅과 같은
  // 자리다 (ADR-012). 그래서 `loadChunk`를 타지 않고 여기 자기 입구를 갖는다.
  // 되돌리기 다이얼로그가 *"직접 입력한 원가와 상품 연결은 그대로 남습니다"*라고
  // 약속하는 근거가 이 분리다.

  /**
   * 원가 이력 — 라이브러리 전체, 또는 SKU 하나.
   *
   * **행을 그대로 준다.** «지금 유효한 값»을 여기서 고르지 않는 이유는 그 판정이
   * `costAt`의 것이기 때문이다 (`core/cost/index.ts`). 리포지토리가 «가장 늦은 것»을
   * 골라 주기 시작하면 규칙이 두 벌이 된다.
   */
  async costHistory(libraryId: string, skuId?: string): Promise<readonly Row[]> {
    const where = skuId === undefined ? "" : " AND sku_id = ?"
    const args = skuId === undefined ? [libraryId] : [libraryId, skuId]
    return this.db
      .prepare(
        `SELECT id, sku_id, kind, amount, effective_from, note, entered_at, entered_by
           FROM cost_history WHERE library_id = ?${where}
          ORDER BY sku_id, kind, effective_from DESC`,
      )
      .all(...args)
  }

  /**
   * 원가 한 줄을 넣는다. **같은 날짜가 이미 있으면 거부한다** — `replace`를 켜야 덮는다.
   *
   * ★ 왜 조용히 덮지 않는가 ★
   * `UNIQUE (library_id, sku_id, kind, effective_from)`가 있으니 UPSERT로 만들면
   * 코드는 짧아진다. 그런데 그 순간 **오타 한 번이 이력 한 칸을 소리 없이 지운다** —
   * 8/1자 원가 12,000원을 넣어 둔 SKU에 1,200원을 잘못 치면 8월 손익이 통째로
   * 바뀌는데 화면에는 아무 일도 일어나지 않는다.
   *
   * 그래서 «새 날짜 등록»과 «같은 날짜 정정»을 **다른 행위로 가른다.** 후자는
   * 화면이 먼저 묻고(§21-1 «되돌릴 수 없는 일은 묻는다») 답을 받아 `replace`로 온다.
   * 정정은 되돌릴 수 없다 — 덮인 값은 `row_shadow`가 없다(Fact가 아니므로).
   *
   * 검증은 `parseCostDraft`가 화면 쪽에서 하지만 **여기서 한 번 더 본다.** 화면만이면
   * 하네스·CLI가 우회한다 — 파일명 캡처 가드를 `runImport`에 둔 것과 같은 판단이다.
   */
  async addCost(c: {
    libraryId: string
    skuId: string
    kind: string
    amount: number
    effectiveFrom: string
    note?: string | null
    now: string
    enteredBy?: "user" | "import"
    replace?: boolean
    /**
     * 어느 파일에서 왔나 (015 · ADR-023 결정 1). **`undefined`가 정상값이다** —
     * 사람이 손으로 넣은 원가에는 파일이 없다. 그 구분은 `enteredBy`가 이미 한다.
     */
    sourceHash?: string | null
  }): Promise<{ inserted: boolean; replaced: boolean; previous: number | null }> {
    if (!Number.isInteger(c.amount)) throw new Error(`원가는 원 단위 정수여야 한다: ${c.amount}`)
    if (c.amount < 0) throw new Error(`원가는 0보다 작을 수 없다: ${c.amount}`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.effectiveFrom)) {
      throw new Error(`적용 시작일은 YYYY-MM-DD여야 한다: ${c.effectiveFrom}`)
    }

    return this.db.transaction(async () => {
      const prior = await this.db
        .prepare(
          `SELECT id, amount FROM cost_history
            WHERE library_id = ? AND sku_id = ? AND kind = ? AND effective_from = ?`,
        )
        .get(c.libraryId, c.skuId, c.kind, c.effectiveFrom)

      if (prior !== undefined) {
        const previous = Number(prior["amount"] ?? 0)
        if (c.replace !== true) {
          // 조용히 지나가지 않는다 (LOCK 6). 부르는 쪽이 사람에게 물을 수 있도록
          // «있다»는 사실과 **그 값**을 함께 돌려준다.
          return { inserted: false, replaced: false, previous }
        }
        await this.db
          .prepare(
            // 덮어쓸 때도 출처를 갱신한다 — 지금 값을 넣은 파일이 답이다.
            // **`undefined`면 기존 값을 지우지 않는다**(COALESCE) — 사람이 화면에서
            // 금액만 고쳤다고 「어느 파일에서 왔는지」가 사라지면 계보가 끊긴다.
            `UPDATE cost_history SET amount = ?, note = ?, entered_at = ?, entered_by = ?,
                    source_hash = COALESCE(?, source_hash)
              WHERE id = ?`,
          )
          .run(
            c.amount,
            c.note ?? null,
            c.now,
            c.enteredBy ?? "user",
            c.sourceHash ?? null,
            Number(prior["id"]),
          )
        return { inserted: false, replaced: true, previous }
      }

      await this.db
        .prepare(
          `INSERT INTO cost_history
             (library_id, sku_id, kind, amount, effective_from, note, entered_at, entered_by,
              source_hash)
           VALUES (?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          c.libraryId,
          c.skuId,
          c.kind,
          c.amount,
          c.effectiveFrom,
          c.note ?? null,
          c.now,
          c.enteredBy ?? "user",
          c.sourceHash ?? null,
        )
      return { inserted: true, replaced: false, previous: null }
    })
  }

  /**
   * 원가 한 줄을 **지운다**. 잘못 들어간 행을 되돌리는 유일한 경로다.
   *
   * ★ 왜 삭제가 허용되는가 ★
   * 원가는 Fact가 아니다 — `batch_id`도 `row_shadow`도 없고 되돌리기 대상도 아니다
   * (이 절 머리말). LOCK 2의 append-only는 «가져오기는 덮어쓰기가 아니라 batch
   * 추가»라는 **Fact 적재의 규약**이라 여기 걸리지 않는다. ADR-005도 원가 이력을
   * «감사 기록이 아니라 **계산의 입력**»으로 규정한다 — 틀린 날짜로 들어간 행은
   * 보존해야 할 원본이 아니라 **틀린 입력**이다.
   *
   * ★ id가 아니라 자연키로 특정한다 ★
   * `cost_history.id`는 AUTOINCREMENT라 기기마다 다르다. 시험 DB에서 본 id를 실기기에
   * 그대로 쓰면 **엉뚱한 행을 지운다.** 그래서 `UNIQUE (library_id, sku_id, kind,
   * effective_from)`로만 연다.
   *
   * ★ 지운 것을 돌려준다 — 복구 재료는 이 반환값이 전부다 ★
   * 그림자가 없으므로 되돌릴 수 없다. 부르는 쪽이 지운 행의 전 컬럼을 **눈에 보이게
   * 남기도록** 통째로 돌려준다 (LOCK 6 — 조용히 지나가지 않는다).
   *
   * 함께 돌려주는 둘은 «지운 뒤 무슨 일이 생기는가»다:
   *   `remaining` 같은 (SKU·종류)에 남는 이력. 비면 그 SKU는 «0원»이 아니라
   *             **«미상»**이 되어 손익 합계에서 통째로 빠진다 (`costAt`이 null).
   *   `bridge`   ADR-016의 다리 사전에 이 SKU가 걸려 있는가. 걸려 있으면 다음 원가
   *             파일 가져오기가 **같은 값을 다시 넣는다** — 지운 것이 조용히 되살아난다.
   *             여기서 손대지 않는다(resolved 행은 지우지 않는 것이 ADR-016의 결정이다).
   *             사람이 알고 결정할 수 있도록 **사실만** 올린다.
   */
  async removeCost(c: {
    libraryId: string
    skuId: string
    kind: string
    effectiveFrom: string
  }): Promise<{
    removed: Row | null
    remaining: readonly Row[]
    bridge: readonly Row[]
  }> {
    return this.db.transaction(async () => {
      const removed =
        (await this.db
          .prepare(
            `SELECT id, library_id, sku_id, kind, amount, effective_from, note, entered_at, entered_by
               FROM cost_history
              WHERE library_id = ? AND sku_id = ? AND kind = ? AND effective_from = ?`,
          )
          .get(c.libraryId, c.skuId, c.kind, c.effectiveFrom)) ?? null

      if (removed !== null) {
        await this.db
          .prepare(`DELETE FROM cost_history WHERE id = ?`)
          .run(Number(removed["id"]))
      }

      const remaining = await this.db
        .prepare(
          `SELECT amount, effective_from, entered_by FROM cost_history
            WHERE library_id = ? AND sku_id = ? AND kind = ?
            ORDER BY effective_from DESC`,
        )
        .all(c.libraryId, c.skuId, c.kind)

      const bridge = await this.db
        .prepare(
          `SELECT id, source_key, title, amount, effective_from FROM pending_cost
            WHERE library_id = ? AND kind = ? AND resolved_sku_id = ? AND state = 'resolved'
            ORDER BY source_key`,
        )
        .all(c.libraryId, c.kind, c.skuId)

      return { removed, remaining, bridge }
    })
  }

  // ─────────────────────────────────────────────────────────────
  // 원가 대기 (마이그레이션 011) — 못 붙은 원가를 버리지 않는다
  // ─────────────────────────────────────────────────────────────

  /**
   * 못 붙은 원가 행들을 쌓는다 (UPSERT — 재가져오기는 행을 늘리지 않는다).
   *
   * ★ resolved·dismissed 행의 상태는 **덮지 않는다** ★
   * 사람이 「이 상품이다」·「쓰지 않음」이라고 판단한 것이 재가져오기 한 번에
   * 초기화되면 판단이 아니라 메모다. 값(amount·effective_from)만 최신으로 따라간다 —
   * 대기실의 금액은 확정 전이라 «마지막으로 본 값»이 맞다.
   */
  async stashPendingCosts(
    rows: readonly {
      readonly libraryId: string
      readonly sourceKey: string
      readonly kind: string
      readonly title: string
      readonly modelCode: string | null
      readonly amount: number
      readonly effectiveFrom: string
      readonly sourceHash: string
      readonly sourceName: string
      readonly profileVersion: string
      readonly now: string
    }[],
  ): Promise<{ inserted: number; updated: number }> {
    let inserted = 0
    let updated = 0
    await this.db.transaction(async () => {
      for (const r of rows) {
        const prior = await this.db
          .prepare(
            `SELECT id FROM pending_cost
              WHERE library_id = ? AND kind = ? AND source_key = ?`,
          )
          .get(r.libraryId, r.kind, r.sourceKey)
        if (prior === undefined) inserted++
        else updated++
        await this.db
          .prepare(
            `INSERT INTO pending_cost
               (library_id, source_key, kind, title, model_code, amount, effective_from,
                source_hash, source_name, profile_version, first_seen_at, last_seen_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
             ON CONFLICT (library_id, kind, source_key) DO UPDATE SET
               title = excluded.title,
               model_code = excluded.model_code,
               amount = excluded.amount,
               effective_from = excluded.effective_from,
               source_hash = excluded.source_hash,
               source_name = excluded.source_name,
               profile_version = excluded.profile_version,
               last_seen_at = excluded.last_seen_at`,
          )
          .run(
            r.libraryId,
            r.sourceKey,
            r.kind,
            r.title,
            r.modelCode,
            r.amount,
            r.effectiveFrom,
            r.sourceHash,
            r.sourceName,
            r.profileVersion,
            r.now,
            r.now,
          )
      }
    })
    return { inserted, updated }
  }

  async pendingCosts(
    libraryId: string,
    state?: "pending" | "resolved" | "dismissed",
  ): Promise<
    readonly {
      readonly id: number
      readonly sourceKey: string
      readonly kind: string
      readonly title: string
      readonly modelCode: string | null
      readonly amount: number
      readonly effectiveFrom: string
      readonly sourceName: string
      readonly state: string
      readonly resolvedSkuId: string | null
    }[]
  > {
    const rows =
      state === undefined
        ? await this.db
            .prepare(`SELECT * FROM pending_cost WHERE library_id = ? ORDER BY title`)
            .all(libraryId)
        : await this.db
            .prepare(
              `SELECT * FROM pending_cost WHERE library_id = ? AND state = ? ORDER BY title`,
            )
            .all(libraryId, state)
    return rows.map((r) => ({
      id: Number(r["id"]),
      sourceKey: String(r["source_key"]),
      kind: String(r["kind"]),
      title: String(r["title"]),
      modelCode: r["model_code"] === null || r["model_code"] === undefined ? null : String(r["model_code"]),
      amount: Number(r["amount"] ?? 0),
      effectiveFrom: String(r["effective_from"]),
      sourceName: String(r["source_name"]),
      state: String(r["state"]),
      resolvedSkuId:
        r["resolved_sku_id"] === null || r["resolved_sku_id"] === undefined
          ? null
          : String(r["resolved_sku_id"]),
    }))
  }

  /**
   * ★ 과거의 사람 판단을 되찾는다 — 다리 사전 ★
   *
   * 같은 source_key가 resolved 상태면 그 SKU를 돌려준다. run-reference가 이걸로
   * 「지난달에 이었던 품명」을 곧장 붙인다 — 점수 자동 확정이 아니라 §20 규칙 4
   * («답 = 갱신, 다음 파일부터 질문 0»)의 원가판이다.
   */
  async resolvedCostBridge(
    libraryId: string,
    kind: string,
    sourceKey: string,
  ): Promise<string | null> {
    const r = await this.db
      .prepare(
        `SELECT resolved_sku_id FROM pending_cost
          WHERE library_id = ? AND kind = ? AND source_key = ? AND state = 'resolved'`,
      )
      .get(libraryId, kind, sourceKey)
    const id = r?.["resolved_sku_id"]
    return id === null || id === undefined ? null : String(id)
  }

  /**
   * 사람이 「이 상품이다」를 확정한다 — **한 트랜잭션**에서 원가를 넣고 상태를
   * 바꾼다. 두 호출로 가르면 하나만 성공한 어중간(원가는 들어갔는데 대기가
   * 남아 두 번 넣게 되는 상태)이 생긴다.
   *
   * 점수를 인자로 받지 않는다 — 자동 확정은 구조적으로 불가능해야 한다.
   */
  async resolvePendingCost(o: {
    id: number
    skuId: string
    now: string
  }): Promise<{ costInserted: boolean; previous: number | null }> {
    return this.db.transaction(async () => {
      const row = await this.db.prepare(`SELECT * FROM pending_cost WHERE id = ?`).get(o.id)
      if (row === undefined) throw new Error(`대기 행이 없다: ${o.id}`)
      if (String(row["state"]) === "resolved") {
        throw new Error(`이미 확정된 행이다: ${o.id} — 되돌리기는 v2다`)
      }
      const r = await this.addCost({
        libraryId: String(row["library_id"]),
        skuId: o.skuId,
        kind: String(row["kind"]),
        amount: Number(row["amount"] ?? 0),
        effectiveFrom: String(row["effective_from"]),
        note: `${String(row["source_name"])} · 대기에서 확정`,
        now: o.now,
        enteredBy: "user",
      })
      await this.db
        .prepare(
          `UPDATE pending_cost SET state = 'resolved', resolved_sku_id = ?, resolved_at = ?
            WHERE id = ?`,
        )
        .run(o.skuId, o.now, o.id)
      return { costInserted: r.inserted, previous: r.previous }
    })
  }

  /** 「쓰지 않음」 — 삭제가 아니라 세고 있는 부재다 (§20 규칙 3). */
  async dismissPendingCost(id: number): Promise<void> {
    await this.db
      .prepare(`UPDATE pending_cost SET state = 'dismissed' WHERE id = ? AND state = 'pending'`)
      .run(id)
  }

  /** 무시를 거둔다 — 다시 pending으로. resolved는 못 되돌린다 (v2). */
  async undoDismissPendingCost(id: number): Promise<void> {
    await this.db
      .prepare(`UPDATE pending_cost SET state = 'pending' WHERE id = ? AND state = 'dismissed'`)
      .run(id)
  }

  // ─────────────────────────────────────────────────────────────
  // 고정비·운영비 (마이그레이션 010)
  // ─────────────────────────────────────────────────────────────

  /**
   * **이 날짜에 유효한** 고정비·운영비 항목들.
   *
   * ★ 「최신」이 아니라 「그날 유효했던 것」이다 ★
   * 3월에 임대료가 올랐으면 2월 손익은 **2월에 유효했던 값**으로 계산돼야 한다.
   * 오늘 값으로 지난달을 다시 그리면 그건 틀린 숫자다 — `costAt`과 같은 규율이고,
   * 그래서 항목(`label`)마다 `effective_from <= asOf` 중 **가장 늦은 것** 하나를 고른다.
   *
   * 금액 0은 **지우지 않고 남긴다.** 「6월부터 사무실을 뺐다」가 0원 행이라
   * 여기서 걸러 버리면 5월과 6월이 구별되지 않는다 — 화면이 「임대료 0원」을
   * 그려야 사용자가 자기가 그렇게 넣었다는 것을 안다.
   */
  async overheads(
    libraryId: string,
    kind: "FIXED" | "OPS",
    asOf: string,
  ): Promise<
    readonly {
      readonly label: string
      readonly basis: "MONTH" | "ORDER" | "UNIT"
      readonly amount: number
      readonly effectiveFrom: string
      readonly note: string | null
    }[]
  > {
    const rows = await this.db
      .prepare(
        `SELECT o.label, o.basis, o.amount, o.effective_from, o.note
           FROM overhead o
           JOIN (
             SELECT label, MAX(effective_from) AS eff
               FROM overhead
              WHERE library_id = ? AND kind = ? AND effective_from <= ?
              GROUP BY label
           ) pick ON pick.label = o.label AND pick.eff = o.effective_from
          WHERE o.library_id = ? AND o.kind = ?
          ORDER BY o.label`,
      )
      .all(libraryId, kind, asOf, libraryId, kind)
    return rows.map((r) => ({
      label: String(r["label"]),
      basis: String(r["basis"]) as "MONTH" | "ORDER" | "UNIT",
      amount: Number(r["amount"] ?? 0),
      effectiveFrom: String(r["effective_from"]),
      note: r["note"] === null || r["note"] === undefined ? null : String(r["note"]),
    }))
  }

  /** 항목의 전체 이력 — 화면이 「3월부터 220만」을 보이려면 필요하다. */
  async overheadHistory(
    libraryId: string,
    kind: "FIXED" | "OPS",
    label: string,
  ): Promise<readonly { readonly amount: number; readonly effectiveFrom: string }[]> {
    const rows = await this.db
      .prepare(
        `SELECT amount, effective_from FROM overhead
          WHERE library_id = ? AND kind = ? AND label = ?
          ORDER BY effective_from DESC`,
      )
      .all(libraryId, kind, label)
    return rows.map((r) => ({
      amount: Number(r["amount"] ?? 0),
      effectiveFrom: String(r["effective_from"]),
    }))
  }

  /**
   * 항목을 넣거나 고친다.
   *
   * ★ `addCost`와 갈리는 자리 하나 ★
   * 원가는 같은 적용일이 있으면 **묻고 나서** 덮는다(`replace`). 여기는 **그냥
   * 덮는다.** 원가는 파일에서 대량으로 들어와 「35건 중 3건이 이미 있다」를
   * 사람이 판단해야 하지만, 고정비는 사람이 칸 하나를 고쳐 저장하는 것이라
   * 「이미 있습니다」를 되물으면 자기가 방금 친 값을 되묻는 꼴이다.
   *
   * 금액 0을 막지 않는다 — 「6월부터 임대료 없음」이 0원 행이다.
   */
  async setOverhead(o: {
    libraryId: string
    kind: "FIXED" | "OPS"
    basis: "MONTH" | "ORDER" | "UNIT"
    label: string
    amount: number
    effectiveFrom: string
    note?: string | null
    now: string
    enteredBy?: "user" | "import"
  }): Promise<void> {
    if (!Number.isInteger(o.amount)) throw new Error(`금액은 원 단위 정수여야 한다: ${o.amount}`)
    if (o.amount < 0) throw new Error(`금액은 0보다 작을 수 없다: ${o.amount}`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.effectiveFrom)) {
      throw new Error(`적용 시작일은 YYYY-MM-DD여야 한다: ${o.effectiveFrom}`)
    }
    if (o.label.trim() === "") throw new Error("항목 이름이 비어 있다")
    /**
     * ★ 종류와 basis는 **짝이 정해져 있다** ★
     *
     *   FIXED × MONTH            「얼마를 팔든 나가는 돈」이 고정비의 정의다
     *   OPS   × ORDER | UNIT     「주문·개수에 따라 나가는 돈」이 운영비의 정의다
     *
     * 남는 칸(OPS × MONTH)은 **일부러 비워 둔다.** 「월 정액인데 상품에 배분하고
     * 싶다」는 요구가 실재하지만(월 정액 3PL 계약) 그건 안분 기준을 정해야 하는
     * 별개 설계다 — 매출 비례? 개수 비례? 답이 데이터에 없다. 지금 아무 기준이나
     * 골라 넣으면 상품별 손익이 조용히 그 가정을 품는다.
     */
    if (o.kind === "FIXED" && o.basis !== "MONTH") {
      throw new Error(`고정비는 월 단위만 쓴다 — 주문·개수에 비례하면 운영비다: ${o.basis}`)
    }
    if (o.kind === "OPS" && o.basis === "MONTH") {
      throw new Error(
        `운영비는 주문당·개당만 쓴다 — 월 정액이면 고정비이고, ` +
          `상품에 배분해야 한다면 안분 기준부터 정해야 한다`,
      )
    }
    await this.db
      .prepare(
        `INSERT INTO overhead
           (library_id, kind, basis, label, amount, effective_from, note, entered_at, entered_by)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT (library_id, kind, label, effective_from) DO UPDATE SET
           basis = excluded.basis,
           amount = excluded.amount,
           note = excluded.note,
           entered_at = excluded.entered_at,
           entered_by = excluded.entered_by`,
      )
      .run(
        o.libraryId,
        o.kind,
        o.basis,
        o.label.trim(),
        o.amount,
        o.effectiveFrom,
        o.note ?? null,
        o.now,
        o.enteredBy ?? "user",
      )
  }

  /**
   * ★ 「두지 않는다」도 입력이다 (§22) ★
   *
   * `null`이면 **미선언**이고, 그때만 앱이 물어본다. 「0원」과 「0원이 맞다」를
   * 구분하지 못하면 일부러 안 넣은 사용자에게 영영 잔소리하게 되고, 지워지지
   * 않는 경고 하나가 진단 화면 전체를 안 보게 만든다.
   */
  /**
   * ★ 「확인함」을 남긴다 — 사실은 계속 센다 (012) ★
   *
   * 반환이 «확인 당시의 수»다. 화면은 그것을 **지금 수와 비교**해서 접을지 정한다 —
   * 지금이 더 크면 확인한 적 없는 새 사실이다. 「봤다」만 저장하면 문제가 커져도
   * 화면이 조용해진다 (LOCK 6).
   *
   * 행이 없으면 `null`이고 그때만 화면이 펼친다 — `overheadStance`와 같은 규약
   * (§22 «부재는 boolean이 아니다»).
   */
  async noticeAck(libraryId: string, noticeKey: string): Promise<number | null> {
    const r = (await this.db
      .prepare(`SELECT seen_count FROM notice_ack WHERE library_id = ? AND notice_key = ?`)
      .get(libraryId, noticeKey)) as Record<string, unknown> | undefined
    return r === undefined ? null : Number(r["seen_count"])
  }

  /** 「확인함」을 세운다. 같은 키를 다시 누르면 그때의 수로 갱신된다. */
  async setNoticeAck(
    libraryId: string,
    noticeKey: string,
    seenCount: number,
    now: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO notice_ack (library_id, notice_key, seen_count, acked_at)
         VALUES (?,?,?,?)
         ON CONFLICT(library_id, notice_key)
         DO UPDATE SET seen_count = excluded.seen_count, acked_at = excluded.acked_at`,
      )
      .run(libraryId, noticeKey, seenCount, now)
  }

  /** 확인을 거둔다 — 「접은 것을 다시 편다」. 선언의 반대는 반대 선언이 아니라 «없음»이다. */
  async clearNoticeAck(libraryId: string, noticeKey: string): Promise<void> {
    await this.db
      .prepare(`DELETE FROM notice_ack WHERE library_id = ? AND notice_key = ?`)
      .run(libraryId, noticeKey)
  }

  async overheadStance(
    libraryId: string,
    kind: "FIXED" | "OPS",
  ): Promise<{ readonly stance: "none" | "later"; readonly reason: string | null } | null> {
    const r = await this.db
      .prepare(`SELECT stance, reason FROM overhead_stance WHERE library_id = ? AND kind = ?`)
      .get(libraryId, kind)
    if (r === undefined) return null
    return {
      stance: String(r["stance"]) as "none" | "later",
      reason: r["reason"] === null || r["reason"] === undefined ? null : String(r["reason"]),
    }
  }

  async setOverheadStance(s: {
    libraryId: string
    kind: "FIXED" | "OPS"
    stance: "none" | "later"
    reason?: string | null
    now: string
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO overhead_stance (library_id, kind, stance, reason, declared_at)
         VALUES (?,?,?,?,?)
         ON CONFLICT (library_id, kind) DO UPDATE SET
           stance = excluded.stance, reason = excluded.reason, declared_at = excluded.declared_at`,
      )
      .run(s.libraryId, s.kind, s.stance, s.reason ?? null, s.now)
  }

  /** 선언을 거둔다 — 다시 «미선언»으로 돌아가 앱이 묻는다. */
  async clearOverheadStance(libraryId: string, kind: "FIXED" | "OPS"): Promise<void> {
    await this.db
      .prepare(`DELETE FROM overhead_stance WHERE library_id = ? AND kind = ?`)
      .run(libraryId, kind)
  }

  private async countListings(connectionId: string): Promise<number> {
    const r = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM marketplace_listing WHERE connection_id = ?`)
      .get(connectionId)
    return Number(r?.["n"] ?? 0)
  }

  /**
   * 청크 하나를 **트랜잭션 하나로** 적재한다 (ADR-001 조건 3).
   *
   * `source_key`가 겹치면 UPSERT다 (헌장 B-2) — 재가져오기가 원본을 갱신하되
   * `version`을 올리고 `batch_id`를 새 배치로 옮긴다. 조정은 행이 아니라
   * `(테이블, source_key, connection)`에 붙어 있으므로 영향받지 않는다 (B-3).
   */
  async loadChunk(
    table: FactTable,
    batch: BatchOpen,
    rows: readonly FactRow[],
  ): Promise<LoadStats> {
    if (!FACT_TABLES.includes(table)) throw new Error(`적재할 수 없는 테이블: ${table}`)
    if (rows.length === 0) return { inserted: 0, updated: 0 }

    const first = rows[0]!
    const bodyColumns = Object.keys(first)
    if (!bodyColumns.includes("id") || !bodyColumns.includes("source_key")) {
      throw new Error(`${table}: id와 source_key는 필수다`)
    }
    for (const c of bodyColumns) {
      if ((COMMON_COLUMNS as readonly string[]).includes(c)) {
        // 공통 컬럼은 리포지토리가 채운다. 호출자가 주면 두 진실이 생긴다.
        throw new Error(`공통 컬럼은 직접 넘길 수 없다: ${c}`)
      }
    }

    const sql = this.insertSql(table, bodyColumns)

    // 청크를 **한 번에** 넘긴다 — 행마다 `run()`을 부르면 원격 드라이버에서
    // #13 기준 80,137번의 왕복이 된다 (ADR-008). 청크당 1회로 떨어진다.
    //
    // 다만 행마다 배열 하나를 **그때그때 만들어 넘긴다.** 청크 전체를 배열로 모으면
    // 1,000행치가 동시에 살아 있게 되고, 그건 평탄화(ADR-007)로 없앤 종류의
    // 할당이 적재 쪽에서 되살아나는 것이다. 로컬 드라이버는 한 행씩 소비한다.
    const width = bodyColumns.length + COMMON_COLUMNS.length
    /**
     * ★ 첫 행에만 있는 컬럼 목록이 나머지 행을 조용히 잘라낸다 ★
     *
     * `bodyColumns`는 **첫 행에서만** 뽑는다(위). 뒤 행에 첫 행에 없던 키가 있으면
     * INSERT 문에 자리가 없어 그 값이 **아무 말 없이 사라진다.** 실측으로 확인된
     * 동작이다 — 첫 행에 `total_amount`가 없고 둘째 행에 5,555가 있으면 둘 다 0으로
     * 저장된다.
     *
     * 오늘 이 프로젝트의 호출부는 전부 균일한 키를 만들지만(매핑이 선언된 target을
     * 행마다 빠짐없이 채운다), 그건 **지금 그렇다**일 뿐이다. 조건부로 필드를 넣는
     * 호출부가 하나 생기는 날 이건 조용한 손실이 된다 (LOCK 6).
     *
     * 세는 것이 아니라 **세우는** 이유: 잘린 값은 «제외»가 아니라 «없던 일»이라
     * 기록할 자리조차 없다. 값이 사라지느니 적재가 멈추는 편이 낫다.
     */
    const known = new Set(bodyColumns)
    function* paramRows(): Generator<SqlValue[]> {
      for (const row of rows) {
        for (const k in row) {
          if (!known.has(k)) {
            throw new Error(
              `${table}: 행마다 컬럼이 다르다 — "${k}"는 첫 행에 없어 조용히 버려진다 ` +
                `(첫 행: ${bodyColumns.join(",")})`,
            )
          }
        }
        const p: SqlValue[] = new Array(width)
        for (let c = 0; c < bodyColumns.length; c++) p[c] = row[bodyColumns[c]!] ?? null
        // 공통 6컬럼 — 순서가 `COMMON_COLUMNS`와 정확히 같아야 한다.
        let k = bodyColumns.length
        p[k++] = batch.connectionId
        p[k++] = batch.id
        p[k++] = batch.libraryId
        p[k++] = 1 // version: 신규는 1, UPSERT 경로에서 기존값 + 1로 덮인다
        p[k++] = batch.startedAt // updated_at
        p[k] = batch.mappingVersion
        yield p
      }
    }

    return this.db.transaction(async () => {
      // 삽입/갱신 구분은 **청크 앞뒤의 행 수 차이**로 낸다.
      // 행마다 SELECT를 돌면 80,138행에서 그 자체가 병목이 된다.
      const before = await this.countRows(table, batch.connectionId)

      await this.db.runMany(sql, paramRows())

      // ★ `row_count`는 여기서 안 센다 — `addBatchRows`가 센다 ★
      // 이 함수는 «테이블에 몇 행 넣었나»만 안다. 그런데 사용자가 읽는 「가져온 행」은
      // **파일의 행 수**다. 한 파일 행이 여러 Fact 행이 되는 경우가 둘이나 있으므로
      // (품목 · 이중 기록) 테이블 적재 수를 더하면 그 숫자가 파일과 대조되지 않는다.

      const inserted = (await this.countRows(table, batch.connectionId)) - before
      return { inserted, updated: rows.length - inserted }
    })
  }

  /**
   * `source_key` → 그 행의 **실제 id**. 품목이 부모 주문을 가리키려면 필요하다.
   *
   * ─────────────────────────────────────────────────────────────
   * ★ 왜 id를 계산할 수 없는가 ★
   * `run.ts`는 적재하면서 id를 `${batch.id}-${table}-${순번}`으로 만든다. 그런데
   * UPSERT의 `DO UPDATE SET`에 `id`가 **없다** — 재가져오기에서 행은 **처음 들어올 때
   * 받은 id를 그대로 지킨다.** 그래서 두 번째 가져오기에서 방금 만든 id로 품목을
   * 걸면 존재하지 않는 부모를 가리키게 되고, FK가 켜져 있으므로 적재가 통째로 실패한다.
   *
   * 되돌아보면 그 «id 보존»은 조정(`adjustment`)이 행을 가리킬 수 있게 하는 성질이라
   * 바꿀 수 없다. 그러니 **묻는 쪽이 맞다.**
   *
   * ★ 바인딩 수를 나눠 묻는다 ★
   * SQLite의 `SQLITE_MAX_VARIABLE_NUMBER`는 빌드마다 다르고 옛 빌드는 999다.
   * 청크가 1,000행이면 한 번에 넣는 순간 그 빌드에서 터진다 — 우리 기기에서만
   * 통과하는 코드를 두지 않는다.
   * ─────────────────────────────────────────────────────────────
   */
  async idsBySourceKey(
    table: FactTable,
    connectionId: string,
    sourceKeys: readonly string[],
  ): Promise<Map<string, string>> {
    if (!FACT_TABLES.includes(table)) throw new Error(`알 수 없는 테이블: ${table}`)
    const out = new Map<string, string>()
    const unique = [...new Set(sourceKeys)]
    const CHUNK = 400
    for (let i = 0; i < unique.length; i += CHUNK) {
      const slice = unique.slice(i, i + CHUNK)
      const rows = await this.db
        .prepare(
          `SELECT id, source_key FROM ${table}
            WHERE connection_id = ? AND source_key IN (${slice.map(() => "?").join(",")})`,
        )
        .all(connectionId, ...slice)
      for (const r of rows) out.set(String(r["source_key"]), String(r["id"]))
    }
    return out
  }

  /**
   * `batch.row_count`를 올린다 — **파일에서 읽어낸 행 수**다.
   *
   * ★ 「Fact 행 수」가 아니다 ★ 세 표면이 이 값을 «가져온 행»으로 읽고, 사용자는
   * 그것을 파일 행 수와 대조한다(「적재 + 제외 = 파일 행」). 한 파일 행이 여러
   * Fact 행이 되는 경우가 둘이다 — 품목(주문 + 품목), 이중 기록(주문 + 클레임).
   * 테이블 적재 수를 더하면 160행 파일이 「301행」이 되고 대조가 깨진다.
   *
   * 그래서 **부르는 쪽이 «파일 행»을 센다.** 무엇이 한 행인지는 매핑이 알고
   * (`MappingResult.rowsLoaded`), 리포지토리는 그 판단을 하지 않는다.
   */
  async addBatchRows(batchId: string, n: number): Promise<void> {
    if (n === 0) return
    await this.db.prepare(`UPDATE batch SET row_count = row_count + ? WHERE id = ?`).run(n, batchId)
  }

  /**
   * 적재의 **분해**를 남긴다 — 「신규 + 갱신 + 병합 + 제외 = 파일 행」 (마이그레이션 007).
   *
   * `addBatchRows`와 나눠 둔 이유는 **세는 주체가 다르기 때문**이다. `row_count`는
   * «파일 행»이라 매핑이 세고(`rowsLoaded`), 신규·갱신은 저장이 세고(`loadChunk`),
   * 병합은 **둘 다 못 세서** 매핑이 키 충돌로 센다. 한 함수에 밀어 넣으면 그
   * 세 출처가 한 인자 목록에서 섞인다.
   */
  async addBatchLoadStats(
    batchId: string,
    s: { readonly inserted: number; readonly updated: number; readonly merged: number },
  ): Promise<void> {
    if (s.inserted === 0 && s.updated === 0 && s.merged === 0) return
    await this.db
      .prepare(
        `UPDATE batch SET inserted_count = inserted_count + ?,
                          updated_count  = updated_count  + ?,
                          merged_count   = merged_count   + ?
          WHERE id = ?`,
      )
      .run(s.inserted, s.updated, s.merged, batchId)
  }

  async recordExclusions(batchId: string, exclusions: readonly ExclusionRecord[]): Promise<void> {
    if (exclusions.length === 0) return
    await this.db.transaction(async () => {
      // 제외 행도 벌크로. 행마다 왕복하면 원격 드라이버에서 그대로 비용이 된다.
      await this.db.runMany(
        `INSERT INTO batch_exclusion (batch_id, row_index, reason, detail) VALUES (?,?,?,?)`,
        exclusions.map((e) => [batchId, e.rowIndex, e.reason, e.detail]),
      )
      await this.db
        .prepare(`UPDATE batch SET excluded_count = excluded_count + ? WHERE id = ?`)
        .run(exclusions.length, batchId)
    })
  }

  /**
   * 비치명 사건을 남긴다 — **`excluded_count`를 올리지 않는다** (마이그레이션 008).
   *
   * 그것이 `recordExclusions`와의 유일하고 결정적인 차이다. 이 행들은 적재됐으므로
   * 제외 카운터를 올리면 「신규 + 갱신 + 병합 + 제외 = 파일 행」이 그 자리에서
   * 깨진다 — 조용한 결손을 표면화하려다 항등식을 거짓으로 만드는 꼴이다.
   */
  async recordIssues(batchId: string, issues: readonly IssueRecord[]): Promise<void> {
    if (issues.length === 0) return
    // 제외와 달리 트랜잭션이 필요 없다 — 함께 갱신할 카운터가 없다.
    await this.db.runMany(
      `INSERT INTO batch_issue (batch_id, code, scope, row_index, detail) VALUES (?,?,?,?,?)`,
      issues.map((i) => [batchId, i.code, i.scope, i.rowIndex, i.detail]),
    )
  }

  // ─────────────────────────────────────────────────────────
  // 파일이 가진 열 — **매핑 이전의 사실** (마이그레이션 009)
  // ─────────────────────────────────────────────────────────

  /**
   * 「이 파일의 이 시트를 봤다」를 남긴다. **적재와 무관하게** 남는다.
   *
   * ★ 프로파일이 없어도 부른다 — 그게 이 함수의 존재 이유다 ★
   * 지금까지 프로파일 미일치는 「맞는 양식 없음」 한 문장으로 끝나고 기록이 0이라,
   * 같은 파일을 다시 넣어도 앱은 처음 보는 것처럼 굴었다. `profileId: null`은
   * 실패 표시가 아니라 **우리가 기록하려던 바로 그 사실**이다.
   *
   * 같은 `(라이브러리, 지문, 시트)`를 다시 보면 행을 늘리지 않고 갱신한다.
   * 열은 **통째로 갈아 끼운다** — 헤더 판정이 달라졌다면(시트를 다시 고름) 옛
   * 열이 남아 있는 편보다 없는 편이 정직하다.
   *
   * @returns `file_sighting.id` — 열이 매달린 자리
   */
  /**
   * ★ 이 파일이 **무엇이 됐나** (015 · ADR-023 결정 1) ★
   *
   * `file_sighting.batch_id`는 Fact 적재 하나만 잇는다. 원가 파일은 batch를 안 만들고
   * `cost_history`·`pending_cost`·`sku`를 만드는데, 그 사실을 **저장할 자리가
   * 없었다**(대기목록 8 — 「받을 값은 이미 있다」). 그래서 넣은 사람에게 13MB
   * 단가표가 기록에 한 줄도 없는 것처럼 보였다.
   *
   * **0도 저장한다.** 「0건 들어갔다」와 「안 해 봤다」는 다르다 (§22 — 부재는 0이
   * 아니고, 그 역도 참이다). 부르는 쪽이 셀 필요가 없다고 판단한 종류는 아예 안 넘긴다.
   *
   * ★★ 결과는 **마지막 실행의 것으로 갈아치운다** — 쌓지 않는다 ★★
   *
   * 처음엔 종류별 UPSERT였는데 시험이 잡았다: 같은 파일을 다시 넣으면 1회차의
   * `cost 35`가 남은 채 2회차의 `cost_skipped 35`가 **더해져서**, 장부가
   * 「원가 35건 넣음 · 35건 건너뜀」이라고 **두 실행을 섞어** 말했다.
   *
   * 「이 파일이 무엇이 됐나」는 **지금 상태**에 대한 질문이다. 2회차에서 전부
   * 건너뛴 것이 사실이고, 1회차에 넣었다는 것은 `cost_history` 쪽이 이미 안다.
   * 한 자리가 두 시점을 겹쳐 말하면 어느 쪽이 참인지 모르게 된다.
   *
   * (「몇 번 봤나」는 `file_sighting.seen_count`가 따로 센다 — 009.)
   */
  async recordOutcomes(
    sightingId: number,
    outcomes: readonly { readonly kind: string; readonly count: number }[],
    at: string,
  ): Promise<void> {
    if (outcomes.length === 0) return
    await this.db.transaction(async () => {
      await this.db.prepare(`DELETE FROM sighting_outcome WHERE sighting_id = ?`).run(sightingId)
      for (const o of outcomes) {
        await this.db
          .prepare(
            `INSERT INTO sighting_outcome (sighting_id, kind, count, at) VALUES (?,?,?,?)`,
          )
          .run(sightingId, o.kind, o.count, at)
      }
    })
  }

  async recordFileSighting(s: FileSightingRecord): Promise<number> {
    return this.db.transaction(async () => {
      await this.db
        .prepare(
          `INSERT INTO file_sighting
             (library_id, source_hash, source_name, source_bytes, container_format,
              sheet_index, sheet_name, header_row_index, column_count,
              profile_id, batch_id, first_seen_at, last_seen_at, seen_count)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)
           ON CONFLICT(library_id, source_hash, sheet_index) DO UPDATE SET
             -- 이름은 바뀔 수 있다 (이름만 바꿔 재가져오기 — 006). 마지막 이름을 쓴다.
             source_name      = excluded.source_name,
             sheet_name       = excluded.sheet_name,
             header_row_index = excluded.header_row_index,
             column_count     = excluded.column_count,
             -- 현재 판정으로 덮는다. 프로파일이 늘거나 바뀌면 답도 바뀌는 게 맞다.
             profile_id       = excluded.profile_id,
             -- ★ 배치는 덮지 않는다 ★ 적재가 **일어났다**는 것은 되돌릴 수 없는
             -- 사실이라, 뒤이은 «그냥 열어보기»가 그것을 NULL로 지우면 안 된다.
             batch_id         = COALESCE(excluded.batch_id, file_sighting.batch_id),
             last_seen_at     = excluded.last_seen_at,
             seen_count       = file_sighting.seen_count + ?`,
        )
        .run(
          s.libraryId,
          s.sourceHash,
          s.sourceName,
          s.sourceBytes,
          s.containerFormat,
          s.sheetIndex,
          s.sheetName,
          s.headerRowIndex,
          s.columns.length,
          s.profileId,
          s.batchId,
          s.at,
          s.at,
          s.countAsSeen === false ? 0 : 1,
        )

      // 드라이버 계약은 `lastInsertRowid`를 노출하지 않는다(`RunResult`는 `changes`
      // 뿐이다). UPSERT라 새 행인지 갱신인지도 갈리므로, 유일키로 되찾는 것이
      // 두 경우 모두에 맞는 유일한 방법이다.
      const row = await this.db
        .prepare(
          `SELECT id FROM file_sighting
            WHERE library_id = ? AND source_hash = ? AND sheet_index = ?`,
        )
        .get(s.libraryId, s.sourceHash, s.sheetIndex)
      const id = Number(row?.["id"])
      if (!Number.isInteger(id)) throw new Error("목격 기록을 되찾지 못했다")

      await this.db.prepare(`DELETE FROM file_column WHERE sighting_id = ?`).run(id)
      if (s.columns.length > 0) {
        await this.db.runMany(
          `INSERT INTO file_column
             (sighting_id, ordinal, header, sample_value, kind, kind_confidence, kind_reason)
           VALUES (?,?,?,?,?,?,?)`,
          s.columns.map((c) => [
            id,
            c.ordinal,
            c.header,
            c.sample,
            c.kind,
            c.confidence,
            c.reason,
          ]),
        )
      }
      return id
    })
  }

  /**
   * 리스팅 키로 리스팅 하나를 찾는다 — **기준 데이터가 상품에 닿는 유일한 다리.**
   *
   * 원가 파일은 SKU를 모르고 마켓의 상품번호만 안다. 그 번호가 곧 리스팅 키이므로,
   * 「리스팅을 찾아 그 SKU에 붙인다」가 성립한다. 없으면 `null`이고, **그것은
   * 오류가 아니다** — 아직 팔지 않아 리스팅이 없는 상품이 원가표에 있는 것은 정상이다.
   */
  async listingByKey(
    libraryId: string,
    listingKey: string,
  ): Promise<{ readonly id: string; readonly title: string; readonly skuId: string | null } | null> {
    const r = await this.db
      .prepare(
        `SELECT id, title, sku_id FROM marketplace_listing
          WHERE library_id = ? AND listing_key = ?
          LIMIT 1`,
      )
      .get(libraryId, listingKey)
    if (r === undefined) return null
    const sku = r["sku_id"]
    return {
      id: String(r["id"]),
      title: String(r["title"] ?? ""),
      skuId: sku === null || sku === undefined ? null : String(sku),
    }
  }

  /**
   * **파일에서 제외된 행의 총계** — 대시보드의 「일부 제외」 배너가 쓴다.
   *
   * ★ 왜 기간을 안 받는가 ★
   * 제외는 **파일의 성질**이지 달의 성질이 아니다. 한 파일의 행이 여러 달에
   * 걸치므로 기간으로 자르면 「7월에 3행 제외」 같은 말이 나오는데, 그 3이
   * 무엇의 3인지 아무도 설명할 수 없다. 그래서 배너 문구도 달을 말하지 않는다
   * (`linking`·`coverage`가 기간을 안 받는 것과 같은 판단).
   *
   * `undone` 배치는 세지 않는다 — 되돌린 파일의 제외는 지금 화면의 숫자와 무관하다.
   */
  async exclusionTotals(libraryId: string): Promise<{
    readonly files: number
    readonly rows: number
    readonly reasons: readonly { readonly reason: string; readonly count: number }[]
  }> {
    const head = await this.db
      .prepare(
        `SELECT COUNT(*) AS files, COALESCE(SUM(excluded_count), 0) AS rows
           FROM batch
          WHERE library_id = ? AND status = 'committed' AND excluded_count > 0`,
      )
      .get(libraryId)

    const reasons = await this.db
      .prepare(
        `SELECT e.reason AS reason, COUNT(*) AS count
           FROM batch_exclusion e
           JOIN batch b ON b.id = e.batch_id
          WHERE b.library_id = ? AND b.status = 'committed'
          GROUP BY e.reason
          ORDER BY count DESC`,
      )
      .all(libraryId)

    return {
      files: Number(head?.["files"] ?? 0),
      rows: Number(head?.["rows"] ?? 0),
      reasons: reasons.map((r) => ({
        reason: String(r["reason"] ?? ""),
        count: Number(r["count"] ?? 0),
      })),
    }
  }

  /** 이 라이브러리에서 본 파일들. 최근 본 것부터. */
  async fileSightings(libraryId: string, limit = 200): Promise<readonly Row[]> {
    return this.db
      .prepare(
        `SELECT id, source_hash, source_name, source_bytes, container_format,
                sheet_index, sheet_name, header_row_index, column_count,
                profile_id, batch_id, first_seen_at, last_seen_at, seen_count
           FROM file_sighting
          WHERE library_id = ?
          ORDER BY last_seen_at DESC, id DESC
          LIMIT ?`,
      )
      .all(libraryId, limit)
  }

  /** 목격 하나의 열 전부. **순번 순서다** — 화면이 파일과 같은 순서로 그려야 한다. */
  async fileColumns(sightingId: number): Promise<readonly Row[]> {
    return this.db
      .prepare(
        `SELECT ordinal, header, sample_value, kind, kind_confidence, kind_reason
           FROM file_column WHERE sighting_id = ? ORDER BY ordinal`,
      )
      .all(sightingId)
  }

  /**
   * 개인 프로파일 저장 — **`mapping_profile` 표의 첫 사용자** (계획 B2).
   *
   * 001부터 `source='user'` 칸이 파여 있었고 오늘까지 사용처 0이었다. 사용자가
   * 필드매핑 화면에서 확정한 파생판이 여기로 들어온다.
   *
   * ★ 버전은 `u1`·`u2`… **단조 증가**이고 기존 버전은 수정하지 않는다 (헌장 B-6) ★
   * batch가 `mapping_version=…@u1`을 기록하므로, u1을 고치면 그 batch의 해석
   * 이력이 거짓이 된다 — 재편집은 언제나 새 판이다. 다음 번호는 여기서 센다:
   * 파생(`deriveProfile`)이 지어내면 «다음 번호의 진실»이 두 곳이 된다.
   *
   * @returns 부여된 버전 문자열 (`u1` 등)
   */
  async saveUserProfile(profile: MappingProfile, now: string): Promise<string> {
    return this.db.transaction(async () => {
      const rows = await this.db
        .prepare(
          `SELECT version FROM mapping_profile
            WHERE pack_id = ? AND marketplace_key = ? AND doc_type = ? AND grain = ?
              AND source = 'user'`,
        )
        .all(profile.packId, profile.marketplaceKey, profile.docType, profile.grain)
      let max = 0
      for (const r of rows) {
        const m = /^u(\d+)$/.exec(String(r["version"]))
        if (m !== null) max = Math.max(max, Number(m[1]))
      }
      const version = `u${max + 1}`
      // 본문에도 같은 버전을 박는다 — `profileVersion(p)`이 batch의
      // `mapping_version`을 만들므로 행의 키와 본문이 갈리면 이력이 거짓이 된다.
      const stored: MappingProfile = { ...profile, version }
      await this.db
        .prepare(
          `INSERT INTO mapping_profile
             (version, pack_id, marketplace_key, doc_type, grain, definition, source, installed_at)
           VALUES (?, ?, ?, ?, ?, ?, 'user', ?)`,
        )
        .run(
          version,
          profile.packId,
          profile.marketplaceKey,
          profile.docType,
          profile.grain,
          JSON.stringify(stored),
          now,
        )
      return version
    })
  }

  /**
   * 저장된 개인 프로파일 전부 — **최신이 앞** (`mergeProfiles`가 그 순서를 가정한다).
   *
   * 본문이 JSON으로 안 읽히는 행은 **세어서 넘긴다** — 조용히 버리면 사용자의
   * 확정이 소리 없이 사라진 것이 되고(LOCK 6), 여기서 던지면 썩은 행 하나가
   * 앱 전체를 막는다. 의미 검증(`validateProfiles`)은 문(호출부)에서 한다 —
   * 저장 계층은 프로파일의 뜻을 모른다.
   */
  async userProfiles(): Promise<{
    readonly profiles: readonly MappingProfile[]
    readonly broken: number
  }> {
    const rows = await this.db
      .prepare(
        `SELECT definition, installed_at, version FROM mapping_profile
          WHERE source = 'user'
          ORDER BY installed_at DESC`,
      )
      .all()
    // 같은 시각에 저장된 두 판은 `installed_at`으로 못 가른다 — 번호로 가른다.
    // 문자열 정렬은 u10 < u2라 쓸 수 없다.
    const un = (v: SqlValue | undefined): number => Number(/^u(\d+)$/.exec(String(v))?.[1] ?? 0)
    const sorted = [...rows].sort((a, b) => {
      const at = String(b["installed_at"]).localeCompare(String(a["installed_at"]))
      return at !== 0 ? at : un(b["version"]) - un(a["version"])
    })
    const profiles: MappingProfile[] = []
    let broken = 0
    for (const r of sorted) {
      try {
        profiles.push(JSON.parse(String(r["definition"])) as MappingProfile)
      } catch {
        broken += 1
      }
    }
    return { profiles, broken }
  }

  async commitBatch(batchId: string, at: string): Promise<void> {
    const r = await this.db
      .prepare(`UPDATE batch SET status = 'committed', committed_at = ? WHERE id = ? AND status = 'open'`)
      .run(at, batchId)
    if (r.changes === 0) throw new Error(`커밋할 수 없는 배치: ${batchId}`)
  }

  /**
   * 되돌리기 (헌장 B-2 · ADR-004).
   *
   * "해당 batch 행 제거"는 한 행이 한 배치에만 속할 때만 맞다. UPSERT가 있으면
   * 한 행이 여러 배치를 거치므로 두 갈래로 나뉜다:
   *
   *   이 배치가 **갱신한** 행     → `row_shadow`의 이전 판으로 복원
   *   이 배치가 **신규 삽입한** 행 → 삭제
   *
   * 복원을 먼저 한다. 복원되면 `batch_id`가 이전 배치로 돌아가므로, 뒤이은
   * 삭제(`WHERE batch_id = ?`)가 그 행을 건드리지 않는다.
   *
   * 조정(`adjustment`)과 대사 확인(`recon_ack`)은 건드리지 않는다 — batch가
   * 아니라 `source_key`에 묶여 있기 때문이다 (B-3).
   *
   * @returns 삭제된 행 수 (복원된 행은 제외)
   */
  async undoBatch(batchId: string, at: string): Promise<number> {
    return this.db.transaction(async () => {
      await this.assertUndoable(batchId)

      // ★ 순서가 `DELETE_ORDER`인 이유는 그 상수의 주석에 있다 — 자식(품목)을
      //   부모(주문)보다 먼저 지우지 않으면 FK가 되돌리기를 통째로 막는다.
      let removed = 0
      for (const table of DELETE_ORDER) {
        await this.restoreShadowed(table, batchId)
        removed += (await this.db.prepare(`DELETE FROM ${table} WHERE batch_id = ?`).run(batchId))
          .changes
      }

      // 되돌린 뒤에는 어떤 그림자도 이 배치를 가리키지 않아야 한다 — 덮어쓴
      // 쪽으로도, 덮인 쪽으로도.
      //
      // `prev_batch_id` 조건이 필요한 이유: 복원 UPDATE가 `batch_id`를 B에서 A로
      // 되돌리는데, 그 UPDATE 자체가 그림자 트리거를 다시 발화시켜
      // (batch_id=A, prev_batch_id=B)인 거울상 항목을 만든다. 되돌리기 직전에
      // `assertUndoable`이 `prev_batch_id = B`가 없음을 확인했으므로, 지금
      // 남아 있는 그것은 전부 복원이 만든 것이다.
      await this.db
        .prepare(`DELETE FROM row_shadow WHERE batch_id = ? OR prev_batch_id = ?`)
        .run(batchId, batchId)
      /**
       * ★ 여기서 **기록을 지우지 않는다** (2026-08-16, 대열 4 ③-a) ★
       *
       * ─────────────────────────────────────────────────────────────
       * 전에는 `batch_exclusion`·`batch_issue` 행을 지우고 `row_count = 0`으로
       * 밀었다. 그런데 `excluded_count`는 남겼다. 실측하면 이렇게 나온다:
       *
       * ```
       * 되돌린 뒤:  제목 「0행 적재 · 2행 제외」   ← 총계는 남았다
       *             다이제스트 0줄                 ← 그 2가 무엇이었는지는 사라졌다
       * ```
       *
       * **총계와 명세가 서로 다른 시제를 갖게 됐다.** 둘 다 «그때»인데 하나만 지운
       * 것이고, 그것이 진짜 결함이다 — 「카운터가 남는다」가 아니라.
       *
       * ★ 그래서 어느 시제로 통일하나 — «그때»다 ★
       *
       *  1. `batch`는 이미 **이력 테이블**이다. `status`·`undone_at`을 갖는다.
       *  2. «지금»을 묻는 자리는 **따로 있다** — `ownedRows`(지금 이 배치가 소유한
       *     fact 행)가 조회 때마다 라이브로 계산된다. 즉 «지금»의 자리가 이미 있는데
       *     «그때»의 자리를 «지금»으로 덮고 있었다.
       *  3. **되돌린 뒤 다시 넣는 것이 정상 경로다** (ADR-004). 기록을 지우면
       *     「지난번엔 제외 2건이었는데 이번엔 5건」이라는 대조가 영영 불가능해진다.
       *     되돌리기는 **Fact를 되돌리는 것**이지 «그 파일을 넣었을 때 무슨 일이
       *     있었나»를 지우는 것이 아니다.
       *
       * 그래서 여기서 지우는 것은 **Fact 행과 그림자뿐**이다. `row_count`·
       * `excluded_count`·분해 카운터·제외 명세·사건 명세는 전부 남는다.
       * ─────────────────────────────────────────────────────────────
       */
      const r = await this.db
        .prepare(`UPDATE batch SET status = 'undone', undone_at = ? WHERE id = ?`)
        .run(at, batchId)
      // `assertUndoable`이 같은 트랜잭션 안에서 존재를 이미 확인했으므로 여기 걸릴
      // 일은 없다. 그래도 남겨 둔다 — 위 검사를 누가 옮기거나 지우면 여기가 잡는다.
      if (r.changes === 0) throw new Error(`되돌릴 수 없는 배치: ${batchId}`)
      return removed
    })
  }

  /**
   * 되돌릴 수 있는가 — **세 가지를 본다.**
   *
   * ─────────────────────────────────────────────────────────────
   * ★ `open` 배치의 undo는 «취소»이고, `committed` 배치의 undo는 «되돌리기»다 ★
   *
   * 같은 함수가 두 의미를 갖는다. 전자는 적재하다 만 것을 치우는 일이고 후자는
   * 이미 손익에 반영된 것을 물리는 일이다. **v1에서는 스키마를 나누지 않는다** —
   * `aborted_at`을 따로 두는 것은 실사용에서 둘을 구분해 보여줄 필요가 생긴
   * 뒤에 한다. 지금은 이 주석과 테스트가 의미를 진다 (2026-08-14 판정).
   * ─────────────────────────────────────────────────────────────
   */
  private async assertUndoable(batchId: string): Promise<void> {
    // ① 존재 — 앞으로 옮겼다. 전에는 맨 끝(UPDATE의 changes===0)에서 걸려서,
    //    거부되기 전에 DELETE들이 먼저 돌았다. 트랜잭션이 롤백해 주긴 했지만
    //    **안전이 «검사가 앞에 있어서»가 아니라 래핑에 걸려 있었다.** 이제 둘 다다.
    const b = await this.db.prepare(`SELECT status FROM batch WHERE id = ?`).get(batchId)
    if (!b) throw new Error(`되돌릴 수 없는 배치: ${batchId}`)

    // ② 상태 — 이미 되돌린 배치는 거부한다 (2026-08-14 판정).
    //
    // 두 번째 되돌리기는 **하는 일이 없으면서 `undone_at`만 덮어쓴다.** 최초로
    // 되돌린 시각은 감사 이력이고, 이 앱은 이력 덮어쓰기를 전부 금지해 왔다 —
    // 조정도 삭제도 기록으로 남기는 판에 되돌리기 시각만 예외일 이유가 없다.
    // `commitBatch`가 `AND status='open'`으로 막는 것과의 비대칭도 근거다.
    if (String(b["status"]) === "undone") {
      throw new Error(`이미 되돌린 배치다: ${batchId}`)
    }

    // ③ 순서 — 되돌리기는 행 단위로 LIFO다.
    //
    // 이 배치가 남긴 판 위에 다른 배치가 또 얹혀 있으면 되돌릴 수 없다 — 복원하면
    // 나중 배치의 데이터를 덮어쓰게 된다. 조용히 덮는 대신 거부한다 (헌장 A-5).
    const r = await this.db
      .prepare(
        `SELECT batch_id AS blocker FROM row_shadow WHERE prev_batch_id = ? LIMIT 1`,
      )
      .get(batchId)
    if (r) {
      throw new Error(
        `되돌릴 수 없다: 배치 ${String(r.blocker)}가 이 배치의 행을 덮어썼다. ` +
          `그쪽을 먼저 되돌려야 한다`,
      )
    }
  }

  /** 이 배치가 덮어쓴 행들을 이전 판으로 되돌린다. */
  private async restoreShadowed(table: FactTable, batchId: string): Promise<void> {
    const cols = await this.columnsOf(table)
    const assignments = cols
      .map((c) => `${c} = json_extract(s.prev_row_json, '$.${c}')`)
      .join(", ")
    await this.db
      .prepare(
        `UPDATE ${table} SET ${assignments}
           FROM (SELECT * FROM row_shadow WHERE batch_id = ? AND target_table = ?) AS s
          WHERE ${table}.connection_id = s.connection_id AND ${table}.source_key = s.source_key`,
      )
      .run(batchId, table)
  }

  private async columnsOf(table: FactTable): Promise<string[]> {
    const cached = this.columnCache.get(table)
    if (cached) return cached
    const cols = (await this.db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table)).map(
      (r) => String(r.name),
    )
    this.columnCache.set(table, cols)
    return cols
  }

  // ─────────────────────────────────────────────────────────
  // 조정 레이어 (헌장 B-3)
  // ─────────────────────────────────────────────────────────

  async addAdjustment(a: {
    libraryId: string
    connectionId: string
    table: AdjustmentTarget
    sourceKey: string
    field: string
    previousValue: SqlValue
    newValue: SqlValue
    reason: string
    createdAt: string
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO adjustment (library_id, target_table, target_source_key,
           target_connection_id, field, previous_value, new_value, reason, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        a.libraryId,
        a.table,
        a.sourceKey,
        a.connectionId,
        a.field,
        a.previousValue === null ? null : String(a.previousValue),
        a.newValue === null ? null : String(a.newValue),
        a.reason,
        a.createdAt,
      )
  }

  /** 한 행에 쌓인 조정 스택. 시간순이며 무효화된 것은 뺀다. */
  async adjustmentsFor(
    connectionId: string,
    table: AdjustmentTarget,
    sourceKey: string,
  ): Promise<Row[]> {
    return this.db
      .prepare(
        `SELECT id, field, previous_value, new_value, reason, created_at
           FROM adjustment
          WHERE target_connection_id = ? AND target_table = ? AND target_source_key = ?
            AND revoked_at IS NULL
          ORDER BY id`,
      )
      .all(connectionId, table, sourceKey)
  }

  /**
   * 조정 하나를 **무효화한다 — 지우지 않는다** (ADR-020 A6).
   *
   * 001의 주석이 정한 규율이다: 「조정을 되돌리는 것도 조정이다」. 화면에서
   * 사라지는 것은 `adjustmentsFor`가 `revoked_at IS NULL`로 거르기 때문이고,
   * DB에는 **누가 언제 무엇을 얹었다가 거뒀는지가 남는다.**
   *
   * 이미 무효화된 것은 다시 무효화하지 않는다 — 그러면 거둔 시각이 덮어써진다.
   */
  async revokeAdjustment(id: number, now: string): Promise<void> {
    await this.db
      .prepare(`UPDATE adjustment SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`)
      .run(now, id)
  }

  /**
   * 한 대상의 활성 조정을 **전부** 무효화한다 — 「원본으로 복원」.
   *
   * 한 문장이므로 한 번의 UPDATE다. 항목마다 따로 돌면 중간에 실패했을 때
   * 절반만 거둬진 스택이 남고, 그 합계는 사용자가 의도한 어느 쪽도 아니다.
   */
  async revokeAdjustmentsFor(
    connectionId: string,
    table: AdjustmentTarget,
    sourceKey: string,
    now: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `UPDATE adjustment SET revoked_at = ?
          WHERE target_connection_id = ? AND target_table = ? AND target_source_key = ?
            AND revoked_at IS NULL`,
      )
      .run(now, connectionId, table, sourceKey)
  }

  // ─────────────────────────────────────────────────────────
  // 묶음 (마이그레이션 013 · ADR-021) — 어느 파일들을 합쳐 볼 것인가
  // ─────────────────────────────────────────────────────────
  //
  // ★ 이 절의 메서드는 **조회 결과를 바꾸지 않는다** ★
  // 범위 필터는 `active_*` 뷰 안에 있고(013), 뷰가 `collection_active`를 읽는다.
  // 여기 있는 것은 그 표를 손보는 입구뿐이다 — 그래서 조회 51곳이 인자를 하나도
  // 더 받지 않는다. 필터를 «빠뜨릴 수 있는 자리»를 만들지 않는 것이 요점이다.
  //
  // 「전체」는 행이 아니다 — `collection_active`에 행이 없으면 전체다.

  /** 묶음 목록. 「전체」는 여기 없다 — 데이터가 아니라 화면의 항목이다. */
  async collections(libraryId: string): Promise<readonly CollectionRow[]> {
    const rows = await this.db
      .prepare(
        `SELECT c.id, c.name, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM collection_batch cb WHERE cb.collection_id = c.id) AS batch_count
           FROM collection c WHERE c.library_id = ? ORDER BY c.name`,
      )
      .all(libraryId)
    return rows.map((r) => ({
      id: String(r["id"]),
      name: String(r["name"]),
      batchCount: Number(r["batch_count"] ?? 0),
      createdAt: String(r["created_at"]),
      updatedAt: String(r["updated_at"]),
    }))
  }

  /**
   * 묶음을 만든다. **비어 있는 묶음도 만들 수 있다** — 고르기 전에 이름부터 짓는
   * 순서를 막지 않는다. 빈 묶음을 고르면 화면이 통째로 0인데, 그건 사고가 아니라
   * 사용자가 아직 아무것도 안 담은 상태다(그리고 화면이 그렇게 말해야 한다).
   */
  async createCollection(c: {
    id: string
    libraryId: string
    name: string
    batchIds?: readonly string[]
    now: string
  }): Promise<void> {
    const name = c.name.trim()
    if (name === "") throw new Error("묶음 이름이 비어 있다")
    return this.db.transaction(async () => {
      await this.db
        .prepare(
          `INSERT INTO collection (id, library_id, name, created_at, updated_at) VALUES (?,?,?,?,?)`,
        )
        .run(c.id, c.libraryId, name, c.now, c.now)
      await this.logCollection(c.libraryId, c.id, "created", null, name, c.now)
      for (const b of c.batchIds ?? []) await this.attach(c.libraryId, c.id, b, c.now)
    })
  }

  async renameCollection(id: string, name: string, now: string): Promise<void> {
    const trimmed = name.trim()
    if (trimmed === "") throw new Error("묶음 이름이 비어 있다")
    return this.db.transaction(async () => {
      const r = await this.db.prepare(`SELECT library_id FROM collection WHERE id = ?`).get(id)
      if (r === undefined) throw new Error(`없는 묶음이다: ${id}`)
      await this.db
        .prepare(`UPDATE collection SET name = ?, updated_at = ? WHERE id = ?`)
        .run(trimmed, now, id)
      await this.logCollection(String(r["library_id"]), id, "renamed", null, trimmed, now)
    })
  }

  /**
   * 묶음을 지운다. **파일은 하나도 안 지운다** — 묶음은 «어느 파일을 볼까»일 뿐이다
   * (ADR-021 「되돌리기와 반드시 가른다」). 지운 묶음이 활성이었으면 선택이 함께
   * 사라져 「전체」로 돌아간다 (013의 ON DELETE CASCADE).
   */
  async deleteCollection(id: string, now: string): Promise<void> {
    return this.db.transaction(async () => {
      const r = await this.db.prepare(`SELECT library_id, name FROM collection WHERE id = ?`).get(id)
      if (r === undefined) return // 이미 없다 — 두 번 눌러도 같은 결과다
      await this.db.prepare(`DELETE FROM collection WHERE id = ?`).run(id)
      await this.logCollection(
        String(r["library_id"]), id, "deleted", null, String(r["name"]), now,
      )
    })
  }

  /** 담기. 이미 든 것은 조용히 지나간다 — 「담아라」의 결과는 «들어 있다»이다. */
  async addToCollection(id: string, batchIds: readonly string[], now: string): Promise<number> {
    return this.db.transaction(async () => {
      const r = await this.db.prepare(`SELECT library_id FROM collection WHERE id = ?`).get(id)
      if (r === undefined) throw new Error(`없는 묶음이다: ${id}`)
      let n = 0
      for (const b of batchIds) n += (await this.attach(String(r["library_id"]), id, b, now)) ? 1 : 0
      if (n > 0) await this.touchCollection(id, now)
      return n
    })
  }

  /** 빼기. **계산에서만 뺀다** — 되돌리기와 다르다 (ADR-021). */
  async removeFromCollection(id: string, batchIds: readonly string[], now: string): Promise<number> {
    return this.db.transaction(async () => {
      const r = await this.db.prepare(`SELECT library_id FROM collection WHERE id = ?`).get(id)
      if (r === undefined) throw new Error(`없는 묶음이다: ${id}`)
      let n = 0
      for (const b of batchIds) {
        const had = await this.db
          .prepare(`SELECT 1 AS x FROM collection_batch WHERE collection_id = ? AND batch_id = ?`)
          .get(id, b)
        if (had === undefined) continue
        await this.db
          .prepare(`DELETE FROM collection_batch WHERE collection_id = ? AND batch_id = ?`)
          .run(id, b)
        await this.logCollection(String(r["library_id"]), id, "removed", b, null, now)
        n++
      }
      if (n > 0) await this.touchCollection(id, now)
      return n
    })
  }

  /** 이 묶음에 담긴 batch. */
  async collectionBatches(id: string): Promise<readonly string[]> {
    const rows = await this.db
      .prepare(`SELECT batch_id FROM collection_batch WHERE collection_id = ? ORDER BY added_at, batch_id`)
      .all(id)
    return rows.map((r) => String(r["batch_id"]))
  }

  /** 지금 보고 있는 묶음. `null`이면 **전체**다 (행 없음 = 미선언). */
  async activeCollection(libraryId: string): Promise<string | null> {
    const r = await this.db
      .prepare(`SELECT collection_id FROM collection_active WHERE library_id = ?`)
      .get(libraryId)
    return r === undefined ? null : String(r["collection_id"])
  }

  /**
   * 묶음을 고른다. `null`은 「전체」이고 **행을 지우는 것**으로 표현한다 —
   * 「전체를 골랐다」를 값으로 저장하지 않는다 (010·012 관례 · §22).
   */
  async setActiveCollection(
    libraryId: string,
    collectionId: string | null,
    now: string,
  ): Promise<void> {
    if (collectionId === null) {
      await this.db.prepare(`DELETE FROM collection_active WHERE library_id = ?`).run(libraryId)
      return
    }
    const r = await this.db.prepare(`SELECT 1 AS x FROM collection WHERE id = ?`).get(collectionId)
    // 없는 묶음을 고르면 화면이 통째로 빈다. 조용히 «전체»로 흘리지도 않는다 (LOCK 6).
    if (r === undefined) throw new Error(`없는 묶음이다: ${collectionId}`)
    await this.db
      .prepare(
        `INSERT INTO collection_active (library_id, collection_id, set_at) VALUES (?,?,?)
           ON CONFLICT (library_id) DO UPDATE SET collection_id = excluded.collection_id, set_at = excluded.set_at`,
      )
      .run(libraryId, collectionId, now)
  }

  /**
   * 이 batch가 **지금 보는 범위**에 드는가. 가져오기 결과가 «이 파일은 「7월 결산」에
   * 없습니다»라고 말할 수 있어야 한다 (ADR-021 「함정 — 새 파일이 조용히 빠진다」).
   */
  async batchInActiveScope(libraryId: string, batchId: string): Promise<boolean> {
    const active = await this.activeCollection(libraryId)
    if (active === null) return true // 전체
    const r = await this.db
      .prepare(`SELECT 1 AS x FROM collection_batch WHERE collection_id = ? AND batch_id = ?`)
      .get(active, batchId)
    return r !== undefined
  }

  /**
   * ★ 범위 **밖**을 보는 유일한 조회다 ★
   *
   * ADR-021의 태도는 「막지 않는다. **크기를 말한다**」이다 — 사용자가 파일을 빼서
   * 숫자를 예쁘게 만들 수 있고, 앱이 할 일은 막는 게 아니라 «뺀 것이 얼마인지»를
   * 보이는 데까지다. 그 문장을 쓰려면 **범위 밖을 한 번은 봐야 한다.**
   *
   * 그래서 `all`만 `fact_order`를 직접 읽는다. 그 예외를 여기 한 곳에 가둔다 —
   * `inScope`는 `active_order` 뷰를 그대로 쓰므로 두 수가 **같은 규칙**으로 나온다.
   *
   * 기간을 안 받는다. 가져오기 기록 화면이 기간을 안 받기 때문이다(«7월 파일을
   * 언제 넣었나»는 8월을 봐도 답이 같다). 그래서 이 수는 **전 기간**이고,
   * 화면 문구도 그렇게 말해야 한다.
   */
  async scopeRevenue(libraryId: string): Promise<{ all: number; inScope: number }> {
    const all = await this.db
      .prepare(
        `SELECT COALESCE(SUM(o.total_amount),0) AS s FROM fact_order o
           JOIN batch b ON b.id = o.batch_id
          WHERE o.library_id = ? AND b.status = 'committed'`,
      )
      .get(libraryId)
    const inScope = await this.db
      .prepare(`SELECT COALESCE(SUM(total_amount),0) AS s FROM active_order WHERE library_id = ?`)
      .get(libraryId)
    return { all: Number(all?.["s"] ?? 0), inScope: Number(inScope?.["s"] ?? 0) }
  }

  /**
   * 광고 캠페인 한 줄 = 한 캠페인. 광고비 탭의 표가 쓴다.
   *
   * ★ 왜 캠페인으로 접는가 ★ `fact_ad_spend`는 **일자 × 캠페인**이라 실측에서
   * 80,137행인데 고유 캠페인은 **8개**다. 8만 행을 화면에 흘리면 아무도 못 읽고
   * LOCK 5(집계는 SQL에 위임)에도 어긋난다.
   *
   * ★ 배분 3갈래를 여기서도 센다 ★ `snapshot.ts`의 `adSplit`과 **같은 규칙**을
   * 캠페인 단위로 되풀이한다 (ADR-022). 총계만 세 갈래로 알면 사용자는 「어느
   * 캠페인을 손보면 되나」를 모른다 — 처방이 캠페인마다 다르기 때문이다.
   * 조인에 `link_state`를 걸지 않는 이유도 그쪽과 같다: 걸면 미연결이
   * 「리스팅 자체가 없다」로 세어져 처방이 뒤바뀐다.
   *
   * `campaign_key`만으로 묶지 않고 **연결과 함께** 묶는다 — 다른 마켓이 같은
   * 캠페인 키를 쓰면 두 채널의 돈이 한 줄로 합쳐진다.
   */
  async adCampaigns(
    libraryId: string,
    period: { from: string; to: string },
  ): Promise<readonly Row[]> {
    return this.db
      .prepare(
        `SELECT a.connection_id                    AS connection_id,
                COALESCE(c.display_name, a.connection_id) AS channel,
                a.campaign_key                     AS campaign_key,
                MAX(a.campaign_name)               AS name,
                MAX(a.campaign_type)               AS type,
                COALESCE(SUM(a.spend_amount),0)    AS spend,
                COALESCE(SUM(a.clicks),0)          AS clicks,
                COALESCE(SUM(a.conversion_amount),0) AS conv_rev,
                COALESCE(SUM(CASE WHEN ml.link_state = 'linked' AND ml.sku_id IS NOT NULL
                                  THEN a.spend_amount ELSE 0 END),0) AS direct,
                COALESCE(SUM(CASE WHEN a.listing_key IS NULL
                                  THEN a.spend_amount ELSE 0 END),0) AS no_key,
                COALESCE(SUM(CASE WHEN a.listing_key IS NOT NULL AND ml.id IS NULL
                                  THEN a.spend_amount ELSE 0 END),0) AS no_listing,
                COALESCE(SUM(CASE WHEN ml.id IS NOT NULL
                                   AND NOT (ml.link_state = 'linked' AND ml.sku_id IS NOT NULL)
                                  THEN a.spend_amount ELSE 0 END),0) AS no_link
           FROM active_ad_spend a
           LEFT JOIN marketplace_listing ml
                  ON ml.connection_id = a.connection_id
                 AND ml.listing_key = a.listing_key
           LEFT JOIN connection c ON c.id = a.connection_id
          WHERE a.library_id = ?
            AND a.spent_on >= ? AND a.spent_on < date(?, '+1 day')
          GROUP BY a.connection_id, a.campaign_key
          ORDER BY spend DESC`,
      )
      .all(libraryId, period.from, period.to)
  }

  /** 묶음 변경 이력 — append-only. 최신이 먼저 온다. */
  async collectionEvents(libraryId: string, limit = 200): Promise<readonly Row[]> {
    return this.db
      .prepare(
        `SELECT id, collection_id, kind, batch_id, name, at FROM collection_event
          WHERE library_id = ? ORDER BY at DESC, id DESC LIMIT ?`,
      )
      .all(libraryId, limit)
  }

  /** 담기 한 건. 이미 있으면 `false` — 이력도 안 쌓는다(같은 사실을 두 번 적지 않는다). */
  private async attach(
    libraryId: string,
    collectionId: string,
    batchId: string,
    now: string,
  ): Promise<boolean> {
    const had = await this.db
      .prepare(`SELECT 1 AS x FROM collection_batch WHERE collection_id = ? AND batch_id = ?`)
      .get(collectionId, batchId)
    if (had !== undefined) return false
    await this.db
      .prepare(`INSERT INTO collection_batch (collection_id, batch_id, added_at) VALUES (?,?,?)`)
      .run(collectionId, batchId, now)
    await this.logCollection(libraryId, collectionId, "added", batchId, null, now)
    return true
  }

  private async touchCollection(id: string, now: string): Promise<void> {
    await this.db.prepare(`UPDATE collection SET updated_at = ? WHERE id = ?`).run(now, id)
  }

  private async logCollection(
    libraryId: string,
    collectionId: string,
    kind: string,
    batchId: string | null,
    name: string | null,
    at: string,
  ): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO collection_event (library_id, collection_id, kind, batch_id, name, at)
         VALUES (?,?,?,?,?,?)`,
      )
      .run(libraryId, collectionId, kind, batchId, name, at)
  }

  // ─────────────────────────────────────────────────────────
  // 조회 — 범위를 받는 것만 있다 (헌장 B-2 "활성 데이터만")
  // ─────────────────────────────────────────────────────────

  /**
   * ★ `BETWEEN`을 쓰지 않는다 ★
   *
   * 날짜 컬럼은 `YYYY-MM-DD`일 수도 `YYYY-MM-DDTHH:MM:SS`일 수도 있다 —
   * 마켓 양식이 정한다. ESM 주문 파일이 실제로 시각을 담아 온다.
   *
   * 그런데 SQLite의 비교는 **문자열 비교**라 `BETWEEN ? AND '2026-07-31'`은
   * `'2026-07-31T16:41:20'`을 **범위 밖으로 판정한다.** 접두가 같고 뒤가 더
   * 길면 사전순으로 뒤에 오기 때문이다.
   *
   * 그 결과는 **기간의 마지막 날이 통째로 사라지는 것**이다. 실측(2026-08-12):
   * ESM 7월 주문 155건 중 7월 31일 3건(97,600원)이 조용히 빠져 총매출이
   * 8,285,200 → 8,187,600으로 나왔다. 헌장 A-5가 "최악"이라 부른 종류다.
   *
   * 그래서 **끝을 다음 날 0시 미만**으로 잡는다. 바닥값(`2026-07-31`)과
   * 시각값(`2026-07-31T16:41:20`) 둘 다 올바르게 포함되고, 인덱스도 탄다
   * (`substr()`로 자르면 인덱스를 못 쓴다). 경계 의미는 ADR-009 ④와 같다 —
   * 양끝 포함, KST 자정.
   */
  private rangeClause(dateColumn: string): string {
    return `${dateColumn} >= ? AND ${dateColumn} < date(?, '+1 day')`
  }

  /**
   * 기간 범위로만 조회한다. **범위 없는 전체 조회는 제공하지 않는다** —
   * 그런 함수가 없다는 사실이 합격 기준 4의 증명이다.
   */
  async countInRange(
    view: string,
    libraryId: string,
    dateColumn: string,
    from: string,
    to: string,
  ): Promise<number> {
    this.assertActiveView(view)
    this.assertIdentifier(dateColumn)
    const r = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM ${view} WHERE library_id = ? AND ${this.rangeClause(dateColumn)}`)
      .get(libraryId, from, to)
    return Number(r?.n ?? 0)
  }

  /** 집계는 SQL에 위임한다 (헌장 B-2) — 행을 올려 자바스크립트에서 더하지 않는다. */
  async sumInRange(
    view: string,
    column: string,
    libraryId: string,
    dateColumn: string,
    from: string,
    to: string,
  ): Promise<number> {
    this.assertActiveView(view)
    this.assertIdentifier(column)
    this.assertIdentifier(dateColumn)
    const r = await this.db
      .prepare(
        `SELECT COALESCE(SUM(${column}), 0) AS s FROM ${view}
          WHERE library_id = ? AND ${this.rangeClause(dateColumn)}`,
      )
      .get(libraryId, from, to)
    return Number(r?.s ?? 0)
  }

  /**
   * 같은 지문의 배치를 찾는다 — **같은 바이트·다른 이름** 판정 (마이그레이션 006).
   *
   * ★ 막지 않는다. 알린다 ★
   * 같은 파일을 다시 넣는 것이 언제나 틀린 것은 아니다 — 되돌린 뒤 재적재가 그렇다.
   * 그래서 확인 단계의 **고지**가 되고, 검문이 되지 않는다 (§22 금지 조항 계열).
   *
   * 되돌린 배치(`status='undone'`)도 함께 준다. 화면이 «이미 들어왔지만 되돌렸다»와
   * «지금 살아 있다»를 갈라 말할 수 있어야 한다.
   */
  async batchesWithHash(libraryId: string, hash: string): Promise<readonly Row[]> {
    return this.db
      .prepare(
        `SELECT id, source_name, status, row_count, started_at, committed_at, undone_at
           FROM batch
          WHERE library_id = ? AND source_hash = ?
          ORDER BY started_at DESC`,
      )
      .all(libraryId, hash)
  }

  async batchStatus(batchId: string): Promise<Row | undefined> {
    return this.db.prepare(`SELECT * FROM batch WHERE id = ?`).get(batchId)
  }

  /**
   * 가져오기 이력 — **목록 조회.** `batchStatus`(한 건)의 확장이 아니라 신설이다.
   *
   * ★ 되돌리기 버튼의 3상태가 여기서 결정된다 ★
   * 화면이 «되돌릴 수 있나»를 스스로 판정하면 `assertUndoable`과 두 벌이 되고,
   * 그 둘은 언젠가 갈린다. 그래서 **같은 신호(`row_shadow`)를 여기서 세어** 준다:
   *
   * | | |
   * |---|---|
   * | `takenOverRows > 0` | 잠김 — 이후 배치가 이 배치의 행을 가져갔다 |
   * | `status === 'undone'` | 이미 되돌림 |
   * | 그 외 | 가능 |
   *
   * `ownedRows`·`restoresRows`는 «되돌리면 무엇이 일어나나»를 미리 말하기 위한
   * 것이다 — 확인 다이얼로그가 «행 N개가 사라지고 M개가 이전 판으로 돌아갑니다»를
   * 지어내지 않고 말할 수 있어야 한다 (헌장 A-5).
   */
  /**
   * ★ 통(通)의 목록 — **넣은 파일은 전부 한 줄** (015 · ADR-023 결정 1) ★
   *
   * 「가져오기 기록」이 `batch`만 읽어서 **원가 파일이 한 줄도 안 나왔다.** 기준
   * 데이터는 batch를 만들지 않기 때문이다 — 결함이 아니라 batch의 성질이다
   * (append-only · 되돌리기 단위 · 연결에 매달림 — LOCK 2).
   *
   * 여기서 돌려주는 것은 **파일 × 시트**다(009의 키). 배치가 붙었으면 그 id를 함께
   * 주고, 배치가 담는 수(행 수·되돌리기)는 **여기서 다시 세지 않는다** —
   * `batchHistory`가 이미 그 일을 하고 두 곳이 같은 수를 세면 갈린다.
   */
  /**
   * ★ 파싱된 표의 한 블록을 담는다 (016 · ADR-027) ★
   *
   * **갈아치우기다.** 같은 목격의 같은 시작 행이 두 블록이면 페이지가 두 번 그려진다 —
   * 재가져오기가 쌓이지 않게 하는 것은 015 `recordOutcomes`와 같은 판단이다.
   */
  async putSheetBlock(sightingId: number, block: SheetBlock): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO sheet_block (sighting_id, first_row, row_count, gz)
         VALUES (?,?,?,?)
         ON CONFLICT(sighting_id, first_row) DO UPDATE SET
           row_count = excluded.row_count,
           gz        = excluded.gz`,
      )
      .run(sightingId, block.firstRow, block.rowCount, block.gz)
  }

  /**
   * 이 목격의 보관된 표에서 **한 페이지**를 꺼낸다.
   *
   * ★ 겹치는 블록만 읽는다 (LOCK 5) ★ `WHERE`로 잘라서 가져온다 — 전 블록을 SELECT해
   * 놓고 JS로 거르면 8만 행짜리 파일에서 그 자체가 전체 적재다.
   */
  async sheetPage(
    sightingId: number,
    offset: number,
    limit: number,
  ): Promise<{ readonly rows: readonly (readonly SheetCell[])[]; readonly total: number }> {
    const totalRow = await this.db
      .prepare(`SELECT COALESCE(SUM(row_count), 0) AS n FROM sheet_block WHERE sighting_id = ?`)
      .get(sightingId)
    const total = Number(totalRow?.["n"] ?? 0)
    if (limit <= 0 || total === 0) return { rows: [], total }

    const raw = await this.db
      .prepare(
        `SELECT first_row, row_count, gz FROM sheet_block
          WHERE sighting_id = ?
            AND first_row < ?
            AND first_row + row_count > ?
          ORDER BY first_row`,
      )
      .all(sightingId, offset + limit, offset)

    const blocks: SheetBlock[] = raw.map((r) => ({
      firstRow: Number(r["first_row"] ?? 0),
      rowCount: Number(r["row_count"] ?? 0),
      gz: String(r["gz"] ?? ""),
    }))
    return { rows: await readPage(blocks, offset, limit), total }
  }

  /** 이 목격에 보관된 표가 몇 행인가. 0이면 «아직 안 담았다»이다. */
  async sheetRowCount(sightingId: number): Promise<number> {
    const r = await this.db
      .prepare(`SELECT COALESCE(SUM(row_count), 0) AS n FROM sheet_block WHERE sighting_id = ?`)
      .get(sightingId)
    return Number(r?.["n"] ?? 0)
  }

  async intakeHistory(libraryId: string): Promise<readonly IntakeHistoryRow[]> {
    const rows = await this.db
      .prepare(
        `SELECT s.id, s.source_hash, s.source_name, s.sheet_name, s.sheet_index,
                s.profile_id, s.batch_id, s.first_seen_at, s.last_seen_at, s.seen_count,
                s.column_count
           FROM file_sighting s
          WHERE s.library_id = ?
          ORDER BY s.last_seen_at DESC, s.id DESC`,
      )
      .all(libraryId)

    const outRows = await this.db
      .prepare(
        `SELECT o.sighting_id AS sid, o.kind, o.count
           FROM sighting_outcome o
           JOIN file_sighting s ON s.id = o.sighting_id
          WHERE s.library_id = ?`,
      )
      .all(libraryId)

    const byId = new Map<number, Record<string, number>>()
    for (const r of outRows) {
      const sid = Number(r["sid"] ?? 0)
      const per = byId.get(sid) ?? {}
      per[String(r["kind"] ?? "")] = Number(r["count"] ?? 0)
      byId.set(sid, per)
    }

    return rows.map((r): IntakeHistoryRow => {
      const id = Number(r["id"] ?? 0)
      return {
        id,
        sourceHash: String(r["source_hash"] ?? ""),
        sourceName: String(r["source_name"] ?? ""),
        sheetName: r["sheet_name"] == null ? null : String(r["sheet_name"]),
        sheetIndex: Number(r["sheet_index"] ?? 0),
        profileId: r["profile_id"] == null ? null : String(r["profile_id"]),
        batchId: r["batch_id"] == null ? null : String(r["batch_id"]),
        firstSeenAt: String(r["first_seen_at"] ?? ""),
        lastSeenAt: String(r["last_seen_at"] ?? ""),
        seenCount: Number(r["seen_count"] ?? 1),
        columnCount: Number(r["column_count"] ?? 0),
        outcomes: byId.get(id) ?? {},
      }
    })
  }

  async batchHistory(libraryId: string): Promise<readonly BatchHistoryRow[]> {
    // Fact 테이블 목록에서 UNION을 만든다 — 테이블이 늘면 자동으로 따라온다.
    // (ADR-004 재검토 트리거 3의 «빠뜨리면 그 테이블만 조용히 옛 동작» 교훈)
    const ownedUnion = FACT_TABLES.map(
      (t) => `SELECT batch_id, '${t}' AS t FROM ${t} WHERE library_id = ?`,
    ).join(" UNION ALL ")

    const ownedRows = await this.db
      .prepare(
        `SELECT batch_id AS b, t, COUNT(*) AS n FROM (${ownedUnion}) GROUP BY batch_id, t`,
      )
      .all(...(FACT_TABLES.map(() => libraryId) as SqlValue[]))

    const owned = new Map<string, Record<string, number>>()
    for (const r of ownedRows) {
      const b = String(r["b"] ?? "")
      const per = owned.get(b) ?? {}
      per[String(r["t"] ?? "")] = Number(r["n"] ?? 0)
      owned.set(b, per)
    }

    const rows = await this.db
      .prepare(
        `SELECT b.id, b.connection_id, COALESCE(c.display_name, '') AS channel,
                b.source_name, b.sheet_name, b.mapping_version, b.status,
                b.started_at, b.committed_at, b.undone_at, b.row_count, b.excluded_count,
                (SELECT COUNT(*) FROM row_shadow s WHERE s.batch_id = b.id)      AS restores,
                (SELECT COUNT(*) FROM row_shadow s WHERE s.prev_batch_id = b.id) AS taken,
                (SELECT s.batch_id FROM row_shadow s WHERE s.prev_batch_id = b.id LIMIT 1) AS blocker
           FROM batch b LEFT JOIN connection c ON c.id = b.connection_id
          WHERE b.library_id = ?
          ORDER BY b.started_at DESC, b.id DESC`,
      )
      .all(libraryId)

    const nameOf = new Map(rows.map((r) => [String(r["id"] ?? ""), r]))

    return rows.map((r): BatchHistoryRow => {
      const id = String(r["id"] ?? "")
      const blockerId = r["blocker"] == null ? null : String(r["blocker"])
      const blocker = blockerId === null ? undefined : nameOf.get(blockerId)
      return {
        id,
        connectionId: String(r["connection_id"] ?? ""),
        channel: String(r["channel"] ?? ""),
        sourceName: String(r["source_name"] ?? ""),
        sheetName: r["sheet_name"] == null ? null : String(r["sheet_name"]),
        mappingVersion: String(r["mapping_version"] ?? ""),
        status: String(r["status"] ?? ""),
        startedAt: String(r["started_at"] ?? ""),
        committedAt: r["committed_at"] == null ? null : String(r["committed_at"]),
        undoneAt: r["undone_at"] == null ? null : String(r["undone_at"]),
        rowCount: Number(r["row_count"] ?? 0),
        excludedCount: Number(r["excluded_count"] ?? 0),
        ownedByTable: owned.get(id) ?? {},
        ownedRows: Object.values(owned.get(id) ?? {}).reduce((a, b) => a + b, 0),
        restoresRows: Number(r["restores"] ?? 0),
        takenOverRows: Number(r["taken"] ?? 0),
        blockedBy:
          blockerId === null
            ? null
            : {
                id: blockerId,
                // 화면은 batch id를 내보내지 않는다 (헌장 C-4). 사람이 알아보는
                // 것은 **파일 이름과 시각**이므로 그걸 함께 들려 보낸다.
                sourceName: blocker ? String(blocker["source_name"] ?? "") : "",
                at: blocker ? String(blocker["committed_at"] ?? blocker["started_at"] ?? "") : null,
              },
      }
    })
  }

  /**
   * 배치 하나의 요약 — **가져오기가 끝난 뒤 화면이 보여줄 것 전부.**
   *
   * 제외를 사유별로 세는 것이 요점이다. 「80,137행 적재」만 말하고 제외 3건을
   * 두고 오면 그게 곧 조용한 실패다 (LOCK 6). 사유별로 갈라야 사용자가
   * "합계 행이 걸러진 것"과 "읽다 실패한 것"을 구분할 수 있다.
   */
  /**
   * ★ 이 batch가 넣은 **행**을 읽는다 (2026-08-21) ★
   *
   * ─────────────────────────────────────────────────────────────
   * 지금까지 `batch_id`로 Fact 행에 닿는 문장은 **DELETE 하나뿐**이었다(되돌리기).
   * 즉 앱은 넣은 것을 지울 줄만 알고 **보여줄 줄은 몰랐다** — 사용자가 물은
   * *"가져오기로 가져온 것들 어디서 테이블을 볼 수 있다는 거야?"*가 그 자리다.
   *
   * ★ 원본 파일이 아니다 ★ 적재 후에 남는 것은 앱이 **해석한** Fact 행이고,
   * `batch.source_bytes`는 파일 크기지 내용이 아니다. 원본 그대로는 적재 **전**의
   * 격자(`import-grid`)가 담당한다 — 둘을 같은 말로 부르면 사용자가 「내 파일을
   * 다시 본다」고 기대했다가 Canonical 필드를 만난다.
   *
   * ★ LOCK 5 ★ 8만 행 batch가 정기 입력이라 **페이징이 필수**다. 전량을 세는
   * `total`은 인덱스(`idx_*_batch`)가 받아 준다 — 5개 Fact 표 전부에 있다.
   *
   * ★ 내부 키를 내보내지 않는다 (헌장 C-4) ★ `SELECT *`가 아니라 **거부 목록을
   * 뺀 컬럼**만 고른다. 허용 목록(전용 필드 등록부)으로 하지 않은 이유는
   * `discount_amount`처럼 표에는 있는데 등록부에 없는 열이 실재하기 때문이다 —
   * 허용 목록이면 그 값이 조용히 사라진다 (LOCK 6).
   * ─────────────────────────────────────────────────────────────
   */
  async batchRows(
    batchId: string,
    table: FactTable,
    limit: number,
    offset: number,
  ): Promise<BatchRowPage> {
    const cols = (
      await this.db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table)
    )
      .map((r) => String((r as Record<string, unknown>)["name"]))
      .filter((c) => !HIDDEN_ROW_COLUMNS.has(c))

    const total = Number(
      ((await this.db
        .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE batch_id = ?`)
        .get(batchId)) as Record<string, unknown> | undefined)?.["n"] ?? 0,
    )
    if (total === 0 || cols.length === 0) return { columns: [], rows: [], total }

    // 정렬은 `rowid` — 적재된 순서다. 「파일에서 몇 번째였나」에 가장 가까운 값이고,
    // 정렬 키를 안 주면 SQLite가 순서를 보장하지 않아 페이지마다 행이 섞인다.
    const raw = await this.db
      .prepare(
        `SELECT ${cols.join(", ")} FROM ${table}
          WHERE batch_id = ? ORDER BY rowid LIMIT ? OFFSET ?`,
      )
      .all(batchId, limit, offset)

    return {
      columns: cols,
      rows: raw.map((r) =>
        cols.map((c) => {
          const v = (r as Record<string, unknown>)[c]
          return v === null || v === undefined ? null : (v as string | number)
        }),
      ),
      total,
    }
  }

  async batchDigest(batchId: string): Promise<BatchDigest | undefined> {
    const b = await this.db
      .prepare(
        `SELECT id, source_name, container_format, sheet_name, status,
                row_count, excluded_count, started_at, committed_at,
                inserted_count, updated_count, merged_count
           FROM batch WHERE id = ?`,
      )
      .get(batchId)
    if (!b) return undefined

    const rows = await this.db
      .prepare(
        `SELECT reason, COUNT(*) AS c FROM batch_exclusion
          WHERE batch_id = ? GROUP BY reason ORDER BY c DESC, reason`,
      )
      .all(batchId)

    /**
     * ★ 사건은 **행 수**로 센다 — 기록 수가 아니다 (마이그레이션 008) ★
     *
     * 한 행이 사유 둘을 겪으면 기록은 둘이지만 온전하지 않은 행은 하나다.
     * 그래서 사유별도 `COUNT(DISTINCT row_index)`이고, 합계는 **따로 묻는다** —
     * 사유별 합은 겹치는 행을 두 번 세므로 총계가 되지 못한다.
     */
    const issueRows = await this.db
      .prepare(
        `SELECT code, COUNT(DISTINCT row_index) AS n FROM batch_issue
          WHERE batch_id = ? AND scope = 'row' GROUP BY code ORDER BY n DESC, code`,
      )
      .all(batchId)
    const incomplete = await this.db
      .prepare(
        `SELECT COUNT(DISTINCT row_index) AS n FROM batch_issue
          WHERE batch_id = ? AND scope = 'row'`,
      )
      .get(batchId)
    // 파일 사건은 수가 적다(컬럼 수가 상한이다). 뭉치지 않고 그대로 낸다.
    const fileIssues = await this.db
      .prepare(
        `SELECT code, detail FROM batch_issue
          WHERE batch_id = ? AND scope = 'file' ORDER BY code, detail`,
      )
      .all(batchId)

    return {
      id: String(b["id"]),
      sourceName: String(b["source_name"]),
      containerFormat: String(b["container_format"]),
      sheetName: b["sheet_name"] == null ? null : String(b["sheet_name"]),
      status: String(b["status"]),
      rowCount: Number(b["row_count"] ?? 0),
      excludedCount: Number(b["excluded_count"] ?? 0),
      startedAt: String(b["started_at"]),
      committedAt: b["committed_at"] == null ? null : String(b["committed_at"]),
      exclusionsByReason: rows.map((r) => ({
        reason: String(r["reason"]),
        count: Number(r["c"] ?? 0),
      })),
      inserted: Number(b["inserted_count"] ?? 0),
      updated: Number(b["updated_count"] ?? 0),
      merged: Number(b["merged_count"] ?? 0),
      incompleteRows: Number(incomplete?.["n"] ?? 0),
      issuesByCode: issueRows.map((r) => ({
        code: String(r["code"]),
        rows: Number(r["n"] ?? 0),
      })),
      fileIssues: fileIssues.map((r) => ({
        code: String(r["code"]),
        detail: String(r["detail"]),
      })),
    }
  }

  // ─────────────────────────────────────────────────────────

  /**
   * UPSERT SQL. **문장 핸들이 아니라 문자열을 캐시한다** — 벌크 적재는
   * `runMany(sql, rows)`로 내려가므로 준비는 드라이버 쪽 몫이다 (ADR-008).
   */
  private insertSql(table: FactTable, bodyColumns: readonly string[]): string {
    const key = `${table}:${bodyColumns.join(",")}`
    const cached = this.insertCache.get(key)
    if (cached) return cached

    for (const c of bodyColumns) this.assertIdentifier(c)
    const all = [...bodyColumns, ...COMMON_COLUMNS]
    const placeholders = all.map(() => "?").join(",")
    // 재가져오기는 원본을 갱신하고 version을 올린다. 조정은 별도 테이블이라
    // 여기서 사라지지 않는다.
    const updates = [
      ...bodyColumns.filter((c) => c !== "id" && c !== "source_key").map((c) => `${c} = excluded.${c}`),
      "batch_id = excluded.batch_id",
      "updated_at = excluded.updated_at",
      "mapping_version = excluded.mapping_version",
      `version = ${table}.version + 1`,
    ].join(", ")

    const stmt = `INSERT INTO ${table} (${all.join(",")}) VALUES (${placeholders})
       ON CONFLICT (connection_id, source_key) DO UPDATE SET ${updates}`
    this.insertCache.set(key, stmt)
    return stmt
  }

  private async countRows(table: FactTable, connectionId: string): Promise<number> {
    const r = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE connection_id = ?`)
      .get(connectionId)
    return Number(r?.n ?? 0)
  }

  /** 조회는 활성 뷰로만. Fact 테이블 직접 조회를 막는다. */
  private assertActiveView(view: string): void {
    if (!/^active_[a-z_]+$/.test(view)) {
      throw new Error(`조회는 active_* 뷰로만 한다: ${view}`)
    }
  }

  private assertIdentifier(name: string): void {
    if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`허용되지 않는 식별자: ${name}`)
  }
}
