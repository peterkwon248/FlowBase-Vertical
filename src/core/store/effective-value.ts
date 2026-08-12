/**
 * 유효값 계산 — **원본 + 조정 스택** (헌장 B-3).
 *
 * ★ 캐스팅 규칙이 여기 한 곳에만 있다 ★
 * `adjustment.previous_value`/`new_value`는 TEXT다. 필드마다 타입이 다르므로
 * (금액은 INTEGER, 날짜·상태는 TEXT) 한 컬럼에 담으려면 문자열로 통일할 수밖에 없다.
 *
 * 그래서 읽을 때 되돌려야 하는데, 그 변환이 호출부마다 흩어지면 어떤 화면은
 * `"1200"`을 문자열로, 어떤 화면은 숫자로 다루게 된다. 금액에서 그 차이는
 * 정렬이 깨지거나 합계가 문자열 연결이 되는 형태로 나타난다.
 *
 * **대상 컬럼의 선언 타입을 기준으로 삼는다.** 스키마가 유일한 진실이므로
 * 별도 메타데이터를 두지 않아도 되고, 컬럼 타입을 바꾸면 캐스팅도 따라간다.
 */

import type { Driver, Row, SqlValue } from "./driver.js"

export interface AdjustmentEntry {
  readonly field: string
  readonly new_value: SqlValue
}

/** 컬럼명 → SQLite 선언 타입 (`INTEGER` · `TEXT` · `REAL` …). */
export type ColumnTypes = Readonly<Record<string, string>>

export async function columnTypesOf(db: Driver, table: string): Promise<ColumnTypes> {
  const out: Record<string, string> = {}
  for (const r of await db.prepare(`SELECT name, type FROM pragma_table_info(?)`).all(table)) {
    out[String(r.name)] = String(r.type).toUpperCase()
  }
  return out
}

/**
 * 저장된 문자열을 대상 컬럼의 타입으로 되돌린다.
 *
 * 되돌릴 수 없으면 **원본 문자열을 그대로 둔다.** 조용히 0이나 NaN으로 바꾸면
 * 그게 곧 조용히 틀린 숫자다 (헌장 A-5).
 */
export function castToColumn(value: SqlValue, declaredType: string | undefined): SqlValue {
  if (value === null || value === undefined) return null
  if (declaredType === undefined) return value

  switch (declaredType) {
    case "INTEGER": {
      if (typeof value === "number") return Number.isInteger(value) ? value : Math.round(value)
      const n = Number(value)
      return Number.isFinite(n) ? Math.round(n) : value
    }
    case "REAL": {
      const n = Number(value)
      return Number.isFinite(n) ? n : value
    }
    default:
      return typeof value === "string" ? value : String(value)
  }
}

/**
 * 원본 행에 조정 스택을 시간순으로 얹는다.
 *
 * 원본은 바뀌지 않는다 — 새 객체를 만든다. 어느 필드가 조정됐는지도 함께
 * 돌려주므로 화면이 "조정됨" 표시를 붙일 수 있다.
 */
export function applyAdjustments(
  original: Row,
  adjustments: readonly AdjustmentEntry[],
  types: ColumnTypes,
): { value: Row; adjustedFields: readonly string[] } {
  if (adjustments.length === 0) return { value: original, adjustedFields: [] }

  const value: Record<string, SqlValue> = { ...original }
  const adjusted = new Set<string>()

  for (const a of adjustments) {
    // 스키마에 없는 필드에 대한 조정은 무시하지 않고 남긴다 — 컬럼이 사라졌다는
    // 사실 자체가 정보다. 다만 유효값에는 얹지 않는다.
    if (!(a.field in value)) continue
    value[a.field] = castToColumn(a.new_value, types[a.field])
    adjusted.add(a.field)
  }

  return { value, adjustedFields: [...adjusted] }
}
