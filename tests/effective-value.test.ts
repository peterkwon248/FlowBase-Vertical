import { describe, it, expect } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate.js"
import {
  applyAdjustments,
  castToColumn,
  columnTypesOf,
} from "../src/core/store/effective-value.js"

describe("유효값 = 원본 + 조정 스택 (헌장 B-3)", () => {
  it("금액 조정이 숫자로 돌아온다 — 문자열로 새지 않는다", () => {
    const db = openNodeDriver()
    migrate(db)
    const types = columnTypesOf(db, "fact_order")
    expect(types.total_amount).toBe("INTEGER")

    const { value, adjustedFields } = applyAdjustments(
      { source_key: "SK-1", total_amount: 1000, status: "PAID" },
      // 조정 테이블은 TEXT로 저장하므로 문자열로 돌아온다.
      [{ field: "total_amount", new_value: "1200" }],
      types,
    )
    expect(value.total_amount).toBe(1200)
    expect(typeof value.total_amount).toBe("number")
    expect(adjustedFields).toEqual(["total_amount"])
    db.close()
  })

  it("스택이 시간순으로 얹혀 마지막이 이긴다", () => {
    const types = { total_amount: "INTEGER" }
    const { value } = applyAdjustments({ total_amount: 1000 }, [
      { field: "total_amount", new_value: "1200" },
      { field: "total_amount", new_value: "1300" },
      { field: "total_amount", new_value: "1250" },
    ], types)
    expect(value.total_amount).toBe(1250)
  })

  it("원본을 변형하지 않는다", () => {
    const original = { total_amount: 1000 }
    applyAdjustments(original, [{ field: "total_amount", new_value: "9999" }], {
      total_amount: "INTEGER",
    })
    expect(original.total_amount).toBe(1000)
  })

  it("숫자로 못 읽는 값은 원문을 남긴다 — 0으로 만들지 않는다", () => {
    expect(castToColumn("측정불가", "INTEGER")).toBe("측정불가")
    expect(castToColumn(null, "INTEGER")).toBeNull()
  })

  it("TEXT 컬럼은 문자열로 유지된다", () => {
    const { value } = applyAdjustments({ status: "PAID" }, [
      { field: "status", new_value: "SHIPPED" },
    ], { status: "TEXT" })
    expect(value.status).toBe("SHIPPED")
  })

  it("스키마에 없는 필드는 유효값에 얹지 않는다", () => {
    const { value, adjustedFields } = applyAdjustments({ total_amount: 1000 }, [
      { field: "없어진컬럼", new_value: "x" },
    ], { total_amount: "INTEGER" })
    expect(value).toEqual({ total_amount: 1000 })
    expect(adjustedFields).toEqual([])
  })

  it("조정이 없으면 원본을 그대로 돌려준다", () => {
    const original = { total_amount: 1000 }
    const { value, adjustedFields } = applyAdjustments(original, [], { total_amount: "INTEGER" })
    expect(value).toBe(original)
    expect(adjustedFields).toEqual([])
  })
})
