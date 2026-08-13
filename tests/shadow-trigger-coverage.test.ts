import { describe, it, expect } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { FACT_TABLES } from "../src/core/store/repository.js"

/**
 * G-1 — 그림자 트리거가 컬럼을 하나도 빠뜨리지 않는가.
 *
 * `002-row-shadow.sql`의 트리거는 `json_object('id', OLD.id, ...)`로 컬럼을
 * **손으로 열거**한다. SQLite에는 "행 전체를 JSON으로" 같은 함수가 없어서 다른
 * 방법이 없다.
 *
 * 그래서 위험이 하나 생긴다: 나중 마이그레이션이 Fact 테이블에 컬럼을 추가하면서
 * 트리거 갱신을 잊으면, 그 컬럼은 **스냅샷에서 조용히 빠지고** 되돌리기 복원 때
 * 값이 사라진다. 에러도 경고도 없이 데이터만 없어진다 — 헌장 A-5가 금지하는
 * 실패의 전형이다.
 *
 * 이 테스트가 그 사고를 커밋 시점에 막는다. 컬럼을 추가하고 트리거를 안 고치면
 * CI가 깨진다.
 */

async function fresh(): Promise<Driver> {
  const db = openNodeDriver()
  await migrate(db)
  return db
}

async function columnsOf(db: Driver, table: string): Promise<string[]> {
  const rows = await db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table)
  return rows.map((r) => String(r.name))
}

async function triggerSqlFor(db: Driver, table: string): Promise<string | undefined> {
  const r = await db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='trigger' AND tbl_name = ?`)
    .get(table)
  return r?.sql === undefined || r.sql === null ? undefined : String(r.sql)
}

/** `json_object('a', OLD.a, 'b', OLD.b, …)`에서 키 이름만 뽑는다. */
function jsonObjectKeys(triggerSql: string): string[] {
  const start = triggerSql.indexOf("json_object(")
  if (start < 0) return []
  return [...triggerSql.slice(start).matchAll(/'([a-z_][a-z0-9_]*)'\s*,\s*OLD\./g)].map(
    (m) => m[1]!,
  )
}

describe("G-1 — 그림자 트리거 컬럼 커버리지", () => {
  it("모든 Fact 테이블에 그림자 트리거가 있다", async () => {
    const db = await fresh()
    const missing: string[] = []
    for (const t of FACT_TABLES) {
      if ((await triggerSqlFor(db, t)) === undefined) missing.push(t)
    }
    expect(
      missing.join(", "),
      "Fact 테이블을 추가하고 그림자 트리거를 빠뜨렸다 (ADR-004 재검토 트리거 3)",
    ).toBe("")
    await db.close()
  })

  it("트리거의 json_object가 테이블 컬럼 전부를 담는다", async () => {
    const db = await fresh()
    const problems: string[] = []

    for (const table of FACT_TABLES) {
      const sql = await triggerSqlFor(db, table)
      if (sql === undefined) continue // 위 테스트가 따로 잡는다

      const columns = await columnsOf(db, table)
      const captured = jsonObjectKeys(sql)

      const notCaptured = columns.filter((c) => !captured.includes(c))
      if (notCaptured.length > 0) {
        problems.push(
          `${table}: 스냅샷에서 빠진 컬럼 ${notCaptured.join("·")} ` +
            `— 되돌리기 복원 때 이 값이 사라진다`,
        )
      }

      // 반대 방향도 본다. 사라진 컬럼을 트리거가 계속 참조하면 마이그레이션이
      // 실패하거나(즉시) 엉뚱한 값이 들어간다.
      const stale = captured.filter((c) => !columns.includes(c))
      if (stale.length > 0) {
        problems.push(`${table}: 트리거가 없는 컬럼을 참조한다 ${stale.join("·")}`)
      }
    }

    expect(problems.join("\n")).toBe("")
    await db.close()
  })

  it("스냅샷 키와 OLD 참조가 같은 컬럼을 가리킨다", async () => {
    // `'total_amount', OLD.status`처럼 키와 값이 어긋나면 복원이 값을 뒤바꾼다.
    // 위 테스트는 키 이름만 보므로 이 짝이 맞는지는 여기서 확인한다.
    const db = await fresh()
    const problems: string[] = []

    for (const table of FACT_TABLES) {
      const sql = await triggerSqlFor(db, table)
      if (sql === undefined) continue
      const start = sql.indexOf("json_object(")
      const pairs = [
        ...sql.slice(start).matchAll(/'([a-z_][a-z0-9_]*)'\s*,\s*OLD\.([a-z_][a-z0-9_]*)/g),
      ]
      for (const [, key, ref] of pairs) {
        if (key !== ref) problems.push(`${table}: '${key}' ← OLD.${ref}`)
      }
    }

    expect(problems.join("\n")).toBe("")
    await db.close()
  })

  it("실제로 전 컬럼이 복원된다 — 값 하나하나 대조", async () => {
    // 정적 검사만으로는 부족하다. 실제로 넣고 덮고 되돌려서 전 컬럼을 비교한다.
    const db = await fresh()
    await db.prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`).run("L", "기본", "t0")
    await db.prepare(
      `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    ).run("C", "L", "pack", "mk", "연결", "CONNECTED", "t0", "t0")

    const openBatch = (id: string) =>
      db
        .prepare(
          `INSERT INTO batch (id, library_id, connection_id, source_name, source_bytes,
             container_format, mapping_version, status, row_count, excluded_count, started_at)
           VALUES (?,?,?,?,?,?,?, 'committed', 0, 0, ?)`,
        )
        .run(id, "L", "C", `${id}.xlsx`, 1, "xlsx", "v1", "t")

    openBatch("A")
    openBatch("B")

    // A판 — 모든 컬럼에 서로 다른 값을 넣어 뒤바뀜도 잡히게 한다.
    await db.prepare(
      `INSERT INTO fact_ad_spend (id, connection_id, batch_id, library_id, version, updated_at,
         mapping_version, source_key, campaign_key, campaign_name, spent_on, campaign_type,
         impressions, clicks, spend_amount, conversions, conversion_amount)
       VALUES ('ad-1','C','A','L',1,'t1','v1','SK-1','CK-1','캠페인 A','2026-07-01','GROWTH',
               111,222,333,444,555)`,
    ).run()
    const before = await db.prepare(`SELECT * FROM fact_ad_spend WHERE source_key='SK-1'`).get()!

    // B가 덮는다 — 전 컬럼을 다른 값으로.
    await db.prepare(
      `UPDATE fact_ad_spend SET batch_id='B', version=2, updated_at='t2', mapping_version='v2',
         campaign_key='CK-9', campaign_name='캠페인 B', spent_on='2026-08-01', campaign_type='NEW',
         impressions=999, clicks=888, spend_amount=777, conversions=666, conversion_amount=NULL
       WHERE source_key='SK-1'`,
    ).run()

    // 그림자에서 복원.
    const cols = await columnsOf(db, "fact_ad_spend")
    await db.prepare(
      `UPDATE fact_ad_spend SET ${cols.map((c) => `${c} = json_extract(s.prev_row_json, '$.${c}')`).join(", ")}
         FROM (SELECT * FROM row_shadow WHERE batch_id='B' AND target_table='fact_ad_spend') AS s
        WHERE fact_ad_spend.connection_id = s.connection_id AND fact_ad_spend.source_key = s.source_key`,
    ).run()

    const after = (await db.prepare(`SELECT * FROM fact_ad_spend WHERE source_key='SK-1'`).get())!
    for (const c of cols) {
      expect(after[c], `${c}가 복원되지 않았다`).toBe(before![c])
    }
    await db.close()
  })
})
