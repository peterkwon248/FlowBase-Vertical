/**
 * 되돌리기 그림자 — **표에 있는 컬럼은 전부 그림자에 실린다** (ADR-004).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 생겼나 (2026-08-20) ★
 *
 * 002의 `shadow_*` 트리거는 `json_object('id', OLD.id, 'connection_id', …)`처럼
 * **컬럼을 하나씩 손으로 나열한다.** SQLite는 트리거 본문을 텍스트로 보관하므로
 * `ALTER TABLE … ADD COLUMN`이 트리거를 **갱신하지 않는다.**
 *
 * 그래서 컬럼을 늘리고 트리거를 안 고치면 이런 일이 난다:
 *
 *   재가져오기로 UPSERT → 옛 행이 그림자로 밀려남 → 되돌리기 → **새 컬럼만 NULL로 복원**
 *
 * 값이 조용히 사라지고 아무도 모른다. ADR-004가 지키려는 것이 정확히 그 자리다.
 *
 * ★ 이 시험은 실제로 내 오타를 잡을 자리였다 ★
 * 014를 쓰면서 `'conversions', OLD.conversion_amount`로 적었다 — 두 컬럼을 한
 * 값으로 복원하는 오타다. 눈으로 잡았지만, 눈은 다음번에 못 잡는다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"

/** 그림자를 남기는 Fact 표 — `row_shadow`를 쓰는 전부다. */
const SHADOWED = [
  "fact_order",
  "fact_order_item",
  "fact_settlement",
  "fact_claim",
  "fact_ad_spend",
] as const

async function open() {
  const db = openNodeDriver(":memory:")
  await migrate(db)
  return db
}

describe("되돌리기 그림자 — 컬럼이 새지 않는다", () => {
  it("★ 표의 모든 컬럼이 그림자 트리거에 있다 ★", async () => {
    const db = await open()
    try {
      const missing: string[] = []
      for (const table of SHADOWED) {
        const cols = (await db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table)).map(
          (r) => String((r as Record<string, unknown>)["name"]),
        )
        const trg = String(
          (
            await db
              .prepare(`SELECT sql FROM sqlite_master WHERE type='trigger' AND name=?`)
              .get(`shadow_${table}`)
          )?.["sql"] ?? "",
        )
        expect(trg, `${table}의 그림자 트리거가 없다`).not.toBe("")
        for (const c of cols) {
          if (!trg.includes(`'${c}'`)) missing.push(`${table}.${c}`)
        }
      }
      expect(
        missing,
        "그림자에 안 실리는 컬럼이다 — 되돌리면 이 값이 NULL로 복원된다 (ADR-004)",
      ).toEqual([])
    } finally {
      await db.close()
    }
  })

  /**
   * ★ 「있다」로는 부족하다 — **제 짝에서 읽는지**를 본다 ★
   * `'conversions', OLD.conversion_amount`처럼 이름은 다 있는데 **값이 엇갈린**
   * 오타는 위 검사를 그냥 통과한다. 그래서 `'X', OLD.X` 짝을 직접 본다.
   */
  it("★ `'컬럼', OLD.컬럼` 짝이 어긋나지 않는다 ★", async () => {
    const db = await open()
    try {
      const crossed: string[] = []
      for (const table of SHADOWED) {
        const trg = String(
          (
            await db
              .prepare(`SELECT sql FROM sqlite_master WHERE type='trigger' AND name=?`)
              .get(`shadow_${table}`)
          )?.["sql"] ?? "",
        )
        /**
         * ★ `json_object(...)` **안쪽만** 본다 ★ 그 앞의
         * `VALUES (NEW.batch_id, 'fact_order', OLD.connection_id, …)`에서
         * 「표 이름 리터럴 + 다음 인자」가 짝처럼 보인다 — 처음 쓴 정규식이
         * 그 다섯 자리를 전부 «어긋남»으로 신고했다. 시험이 거짓 경보를 내면
         * 다음 사람이 시험을 끄지 코드를 안 고친다.
         */
        const body = /json_object\(([\s\S]*?)\)\s*,\s*datetime/.exec(trg)?.[1] ?? ""
        expect(body, `${table}의 그림자에 json_object 본문이 없다`).not.toBe("")
        for (const m of body.matchAll(/'([a-z_]+)',\s*OLD\.([a-z_]+)/g)) {
          if (m[1] !== m[2]) crossed.push(`${table}: '${m[1]}' ← OLD.${m[2]}`)
        }
      }
      expect(crossed, "그림자가 엉뚱한 컬럼에서 값을 읽는다 — 복원이 값을 바꿔치기한다").toEqual([])
    } finally {
      await db.close()
    }
  })
})
