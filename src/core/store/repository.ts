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
/**
 * ★ 타입만 가져온다 ★ `core/import`는 이 파일을 값으로 import하므로, 값을 되가져오면
 * 순환이 된다. `import type`은 컴파일에서 지워져 런타임 간선이 생기지 않는다.
 *
 * 유니온을 여기 다시 적지 않는 이유: `batch_exclusion.reason`이 그렇게 두 벌이 됐고
 * 001의 주석이 «파이프라인과 같은 집합»이라고 사람에게 부탁하고 있다. `code`는 SQL에
 * CHECK가 없어(008 참조) **이 타입이 유일한 잠금**이라 부탁으로 둘 수 없다.
 */
import type { IssueCode } from "../import/issues.js"

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
  /** 적재 당시 센 행. 되돌리면 0이 된다. */
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
            `UPDATE cost_history SET amount = ?, note = ?, entered_at = ?, entered_by = ?
              WHERE id = ?`,
          )
          .run(c.amount, c.note ?? null, c.now, c.enteredBy ?? "user", Number(prior["id"]))
        return { inserted: false, replaced: true, previous }
      }

      await this.db
        .prepare(
          `INSERT INTO cost_history
             (library_id, sku_id, kind, amount, effective_from, note, entered_at, entered_by)
           VALUES (?,?,?,?,?,?,?,?)`,
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
        )
      return { inserted: true, replaced: false, previous: null }
    })
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
      await this.db.prepare(`DELETE FROM batch_exclusion WHERE batch_id = ?`).run(batchId)
      // 사건 기록도 함께 지운다 — 되돌린 배치에는 적재된 행이 없으므로 «그 행이
      // 온전하지 않다»는 주석만 남을 자리가 없다. 제외와 **같은 줄에 둔다**:
      // 되돌리기가 기록은 지우면서 `excluded_count`는 남기는 비대칭(대열 4의 선두)을
      // 고칠 때, 두 테이블이 떨어져 있으면 한쪽만 고치게 된다.
      await this.db.prepare(`DELETE FROM batch_issue WHERE batch_id = ?`).run(batchId)
      const r = await this.db
        .prepare(`UPDATE batch SET status = 'undone', undone_at = ?, row_count = 0 WHERE id = ?`)
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
    table: FactTable
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
  async adjustmentsFor(connectionId: string, table: FactTable, sourceKey: string): Promise<Row[]> {
    return this.db
      .prepare(
        `SELECT field, previous_value, new_value, reason, created_at
           FROM adjustment
          WHERE target_connection_id = ? AND target_table = ? AND target_source_key = ?
            AND revoked_at IS NULL
          ORDER BY id`,
      )
      .all(connectionId, table, sourceKey)
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
