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

import type { Driver, Row, SqlValue, Statement } from "./driver.js"

/** 적재 가능한 Fact 테이블. 여기 없는 이름은 적재할 수 없다. */
export const FACT_TABLES = [
  "fact_order",
  "fact_order_item",
  "fact_settlement",
  "fact_claim",
  "fact_ad_spend",
] as const

export type FactTable = (typeof FACT_TABLES)[number]

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
  private readonly insertCache = new Map<string, Statement>()

  constructor(private readonly db: Driver) {}

  // ─────────────────────────────────────────────────────────
  // 배치 수명주기 (헌장 B-2)
  // ─────────────────────────────────────────────────────────

  openBatch(b: BatchOpen): void {
    this.db
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
   * 청크 하나를 **트랜잭션 하나로** 적재한다 (ADR-001 조건 3).
   *
   * `source_key`가 겹치면 UPSERT다 (헌장 B-2) — 재가져오기가 원본을 갱신하되
   * `version`을 올리고 `batch_id`를 새 배치로 옮긴다. 조정은 행이 아니라
   * `(테이블, source_key, connection)`에 붙어 있으므로 영향받지 않는다 (B-3).
   */
  loadChunk(table: FactTable, batch: BatchOpen, rows: readonly FactRow[]): LoadStats {
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

    const stmt = this.insertStatement(table, bodyColumns)

    return this.db.transaction(() => {
      // 삽입/갱신 구분은 **청크 앞뒤의 행 수 차이**로 낸다.
      // 행마다 SELECT를 돌면 80,138행에서 그 자체가 병목이 된다.
      const before = this.countRows(table, batch.connectionId)

      for (const row of rows) {
        stmt.run(
          ...bodyColumns.map((c) => row[c] ?? null),
          // 공통 6컬럼 — 순서가 `COMMON_COLUMNS`와 정확히 같아야 한다.
          batch.connectionId,
          batch.id,
          batch.libraryId,
          1, // version: 신규는 1, UPSERT 경로에서 기존값 + 1로 덮인다
          batch.startedAt, // updated_at
          batch.mappingVersion,
        )
      }

      this.db
        .prepare(`UPDATE batch SET row_count = row_count + ? WHERE id = ?`)
        .run(rows.length, batch.id)

      const inserted = this.countRows(table, batch.connectionId) - before
      return { inserted, updated: rows.length - inserted }
    })
  }

  recordExclusions(batchId: string, exclusions: readonly ExclusionRecord[]): void {
    if (exclusions.length === 0) return
    const stmt = this.db.prepare(
      `INSERT INTO batch_exclusion (batch_id, row_index, reason, detail) VALUES (?,?,?,?)`,
    )
    this.db.transaction(() => {
      for (const e of exclusions) stmt.run(batchId, e.rowIndex, e.reason, e.detail)
      this.db
        .prepare(`UPDATE batch SET excluded_count = excluded_count + ? WHERE id = ?`)
        .run(exclusions.length, batchId)
    })
  }

  commitBatch(batchId: string, at: string): void {
    const r = this.db
      .prepare(`UPDATE batch SET status = 'committed', committed_at = ? WHERE id = ? AND status = 'open'`)
      .run(at, batchId)
    if (r.changes === 0) throw new Error(`커밋할 수 없는 배치: ${batchId}`)
  }

  /**
   * 되돌리기 = **해당 batch 행 제거** (헌장 B-2).
   *
   * 조정(`adjustment`)과 대사 확인(`recon_ack`)은 건드리지 않는다 — batch가
   * 아니라 `source_key`에 묶여 있기 때문이다. 같은 파일을 다시 가져오면
   * 조정이 그대로 되살아난다 (B-3).
   */
  undoBatch(batchId: string, at: string): number {
    return this.db.transaction(() => {
      let removed = 0
      for (const table of FACT_TABLES) {
        removed += this.db.prepare(`DELETE FROM ${table} WHERE batch_id = ?`).run(batchId).changes
      }
      this.db.prepare(`DELETE FROM batch_exclusion WHERE batch_id = ?`).run(batchId)
      const r = this.db
        .prepare(`UPDATE batch SET status = 'undone', undone_at = ?, row_count = 0 WHERE id = ?`)
        .run(at, batchId)
      if (r.changes === 0) throw new Error(`되돌릴 수 없는 배치: ${batchId}`)
      return removed
    })
  }

  // ─────────────────────────────────────────────────────────
  // 조정 레이어 (헌장 B-3)
  // ─────────────────────────────────────────────────────────

  addAdjustment(a: {
    libraryId: string
    connectionId: string
    table: FactTable
    sourceKey: string
    field: string
    previousValue: SqlValue
    newValue: SqlValue
    reason: string
    createdAt: string
  }): void {
    this.db
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
  adjustmentsFor(connectionId: string, table: FactTable, sourceKey: string): Row[] {
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
   * 기간 범위로만 조회한다. **범위 없는 전체 조회는 제공하지 않는다** —
   * 그런 함수가 없다는 사실이 합격 기준 4의 증명이다.
   */
  countInRange(view: string, libraryId: string, dateColumn: string, from: string, to: string): number {
    this.assertActiveView(view)
    this.assertIdentifier(dateColumn)
    const r = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM ${view} WHERE library_id = ? AND ${dateColumn} BETWEEN ? AND ?`,
      )
      .get(libraryId, from, to)
    return Number(r?.n ?? 0)
  }

  /** 집계는 SQL에 위임한다 (헌장 B-2) — 행을 올려 자바스크립트에서 더하지 않는다. */
  sumInRange(
    view: string,
    column: string,
    libraryId: string,
    dateColumn: string,
    from: string,
    to: string,
  ): number {
    this.assertActiveView(view)
    this.assertIdentifier(column)
    this.assertIdentifier(dateColumn)
    const r = this.db
      .prepare(
        `SELECT COALESCE(SUM(${column}), 0) AS s FROM ${view}
          WHERE library_id = ? AND ${dateColumn} BETWEEN ? AND ?`,
      )
      .get(libraryId, from, to)
    return Number(r?.s ?? 0)
  }

  batchStatus(batchId: string): Row | undefined {
    return this.db.prepare(`SELECT * FROM batch WHERE id = ?`).get(batchId)
  }

  // ─────────────────────────────────────────────────────────

  private insertStatement(table: FactTable, bodyColumns: readonly string[]): Statement {
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

    const stmt = this.db.prepare(
      `INSERT INTO ${table} (${all.join(",")}) VALUES (${placeholders})
       ON CONFLICT (connection_id, source_key) DO UPDATE SET ${updates}`,
    )
    this.insertCache.set(key, stmt)
    return stmt
  }

  private countRows(table: FactTable, connectionId: string): number {
    const r = this.db
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
