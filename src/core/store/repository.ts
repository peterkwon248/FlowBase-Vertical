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
  readonly sourceSha256?: string
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
  // 배치 수명주기 (헌장 B-2)
  // ─────────────────────────────────────────────────────────

  async openBatch(b: BatchOpen): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes,
           source_sha256, container_format, sheet_name, mapping_version, status,
           row_count, excluded_count, started_at)
         VALUES (?,?,?,?,?,?,?,?,?, 'open', 0, 0, ?)`,
      )
      .run(
        b.id,
        b.libraryId,
        b.connectionId,
        b.sourceName,
        b.sourceBytes,
        b.sourceSha256 ?? null,
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
    function* paramRows(): Generator<SqlValue[]> {
      for (const row of rows) {
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

      await this.db
        .prepare(`UPDATE batch SET row_count = row_count + ? WHERE id = ?`)
        .run(rows.length, batch.id)

      const inserted = (await this.countRows(table, batch.connectionId)) - before
      return { inserted, updated: rows.length - inserted }
    })
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

      let removed = 0
      for (const table of FACT_TABLES) {
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
      const r = await this.db
        .prepare(`UPDATE batch SET status = 'undone', undone_at = ?, row_count = 0 WHERE id = ?`)
        .run(at, batchId)
      if (r.changes === 0) throw new Error(`되돌릴 수 없는 배치: ${batchId}`)
      return removed
    })
  }

  /**
   * 되돌리기는 행 단위로 LIFO다.
   *
   * 이 배치가 남긴 판 위에 다른 배치가 또 얹혀 있으면 되돌릴 수 없다 — 복원하면
   * 나중 배치의 데이터를 덮어쓰게 된다. 조용히 덮는 대신 거부한다 (헌장 A-5).
   */
  private async assertUndoable(batchId: string): Promise<void> {
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

  async batchStatus(batchId: string): Promise<Row | undefined> {
    return this.db.prepare(`SELECT * FROM batch WHERE id = ?`).get(batchId)
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
