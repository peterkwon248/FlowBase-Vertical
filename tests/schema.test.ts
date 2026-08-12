import { describe, it, expect } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate, loadMigrations } from "../src/core/store/migrate.js"

/** 헌장 B-1 — Fact 행 공통 컬럼 6종. 소급 추가 불가 항목이다. */
const REQUIRED_FACT_COLUMNS = [
  "connection_id",
  "batch_id",
  "library_id",
  "version",
  "updated_at",
  "mapping_version",
] as const

function fresh(): Driver {
  const db = openNodeDriver()
  migrate(db)
  return db
}

function tableNames(db: Driver, prefix: string): string[] {
  return (
    db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ?`)
      .all(`${prefix}%`) as { name: string }[]
  ).map((r) => String(r.name))
}

function columnsOf(db: Driver, table: string): string[] {
  return (
    db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table) as { name: string }[]
  ).map((r) => String(r.name))
}

describe("스키마 — 헌장 B부 대조", () => {
  it("마이그레이션이 파일 수만큼 적용된다", () => {
    const db = fresh()
    const applied = db.prepare("SELECT COUNT(*) AS n FROM schema_migration").get() as { n: number }
    // 파일을 추가하고 적용을 잊으면 여기서 어긋난다.
    expect(Number(applied.n)).toBe(loadMigrations().length)
    db.close()
  })

  it("B-1: 모든 Fact 테이블이 공통 6컬럼을 갖는다", () => {
    const db = fresh()
    const facts = tableNames(db, "fact_")
    // Fact 테이블이 실제로 있어야 한다 — 빈 목록을 통과시키지 않는다.
    expect(facts.length).toBeGreaterThanOrEqual(5)

    const missing: string[] = []
    for (const t of facts) {
      const cols = columnsOf(db, t)
      for (const required of REQUIRED_FACT_COLUMNS) {
        if (!cols.includes(required)) missing.push(`${t}.${required}`)
      }
    }
    expect(missing.join(", ")).toBe("")
    db.close()
  })

  it("B-2: source_key가 연결 단위로 유일하다 (UPSERT 근거)", () => {
    const db = fresh()
    for (const t of tableNames(db, "fact_")) {
      const idx = db
        .prepare(`SELECT name FROM pragma_index_list(?) WHERE "unique" = 1`)
        .all(t) as { name: string }[]
      const uniqueCols = idx.flatMap(
        (i) =>
          (
            db.prepare(`SELECT name FROM pragma_index_info(?)`).all(i.name) as { name: string }[]
          ).map((c) => c.name),
      )
      expect(uniqueCols, `${t}에 (connection_id, source_key) 유일 제약이 없다`).toEqual(
        expect.arrayContaining(["connection_id", "source_key"]),
      )
    }
    db.close()
  })

  it("B-8: 스키마에 마켓 이름이 없다", () => {
    const db = fresh()
    const sql = (
      db.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL").all() as { sql: string }[]
    )
      .map((r) => r.sql)
      .join("\n")
      .toLowerCase()

    // core는 마켓을 모른다. 이 단어들이 스키마에 있으면 경계가 깨진 것이다.
    const banned = [
      "쿠팡",
      "네이버",
      "지마켓",
      "g마켓",
      "옥션",
      "11번가",
      "coupang",
      "gmarket",
      "auction",
    ]
    for (const word of banned) {
      expect(sql.includes(word), `스키마에 "${word}"가 있다`).toBe(false)
    }
    db.close()
  })

  it("B-3: 조정은 배치가 아니라 행에 붙는다", () => {
    const db = fresh()
    const cols = columnsOf(db, "adjustment")
    // batch_id로 묶이면 되돌리기 때 조정이 함께 사라진다.
    expect(cols).not.toContain("batch_id")
    expect(cols).toEqual(
      expect.arrayContaining([
        "target_table",
        "target_source_key",
        "target_connection_id",
        "field",
      ]),
    )
    db.close()
  })

  it("B-3: 대사 확인이 조정과 별개 저장소다", () => {
    const db = fresh()
    expect(tableNames(db, "recon_ack")).toContain("recon_ack")
    db.close()
  })

  it("B-5: 원가·연결·조정이 각각 하나의 저장소다", () => {
    const db = fresh()
    const all = tableNames(db, "")
    // 목업의 분열(costAdds/costQuick · linked/linkedHere · adjust/setAdj)이
    // 스키마에 재현되지 않았는지 본다.
    expect(all.filter((t) => t.includes("cost"))).toEqual(["cost_history"])
    expect(all.filter((t) => t.includes("adjust"))).toEqual(["adjustment"])
    expect(all.filter((t) => t.includes("listing"))).toEqual(["marketplace_listing"])
    db.close()
  })

  it("연결 상태가 핸드오프 §6-1의 7종뿐이다", () => {
    const db = fresh()
    const sql = (
      db.prepare("SELECT sql FROM sqlite_master WHERE name='connection'").get() as { sql: string }
    ).sql
    for (const s of [
      "CONNECTED",
      "SYNCING",
      "ERROR",
      "EXPIRED",
      "REAUTH_REQUIRED",
      "DISCONNECTED",
      "FORMAT_CHANGED",
    ]) {
      expect(sql).toContain(s)
    }
    db.close()
  })

  it("금액이 정수다 — 부동소수로 원을 담지 않는다", () => {
    const db = fresh()
    const offenders: string[] = []
    for (const t of [...tableNames(db, "fact_"), "cost_history"]) {
      const cols = db.prepare(`SELECT name, type FROM pragma_table_info(?)`).all(t) as {
        name: string
        type: string
      }[]
      for (const c of cols) {
        if (/amount|spend|price|cost/i.test(c.name) && c.type.toUpperCase() !== "INTEGER") {
          offenders.push(`${t}.${c.name}:${c.type}`)
        }
      }
    }
    expect(offenders.join(", ")).toBe("")
    db.close()
  })

  it("활성 뷰가 커밋된 배치만 보여준다", () => {
    const db = fresh()
    const views = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='view'").all() as {
      name: string
      sql: string
    }[]
    expect(views.length).toBeGreaterThanOrEqual(5)
    for (const v of views) {
      expect(v.sql, `${v.name}이 배치 상태를 거르지 않는다`).toContain("committed")
    }
    db.close()
  })
})
