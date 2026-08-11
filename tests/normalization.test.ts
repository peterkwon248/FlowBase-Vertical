import { describe, it, expect } from "vitest"
import { normalizeValue, inferColumnKind } from "../src/core/import/normalization/index.js"
import type { RawRow } from "../src/core/import/types.js"

const v = (raw: Parameters<typeof normalizeValue>[0]) => normalizeValue(raw)

describe("Normalization — 대조표의 정답 샘플", () => {
  it('"0원" → 0', () => {
    expect(v("0원")).toMatchObject({ kind: "number", value: 0 })
  })

  it('"3,000원" → 3000', () => {
    expect(v("3,000원")).toMatchObject({ kind: "number", value: 3000 })
  })

  it('"100.0%" → 1.0', () => {
    expect(v("100.0%")).toMatchObject({ kind: "percent", value: 1 })
  })

  it('"12.4%" → 0.124', () => {
    expect(v("12.4%").value).toBeCloseTo(0.124, 10)
  })

  it('"-" → null', () => {
    expect(v("-")).toMatchObject({ kind: "null", value: null })
  })

  it('"" → null', () => {
    expect(v("")).toMatchObject({ kind: "null", value: null })
  })

  it("날짜 4종을 읽는다", () => {
    for (const s of ["2026-07-01", "2026/07/01", "2026.07.01", "20260701"]) {
      expect(v(s), s).toMatchObject({ kind: "date", value: "2026-07-01" })
    }
    expect(v("2026-07-01 00:00")).toMatchObject({ kind: "date", value: "2026-07-01T00:00:00" })
  })

  it("달력에 없는 날짜를 날짜로 만들지 않는다", () => {
    expect(v("20261345").kind).not.toBe("date")
  })

  it("원본을 항상 남긴다", () => {
    expect(v("3,000원").raw).toBe("3,000원")
  })
})

describe("Normalization — 식별자 (대조표 함정 #3)", () => {
  const column = (header: string, values: unknown[]) => {
    const rows: RawRow[] = values.map((x) => [x as never])
    return inferColumnKind(header, rows, 0)
  }

  it("주문번호 컬럼을 identifier로 잡는다", () => {
    const inf = column("주문번호", ["20260804119", "20260804120", "20260804121"])
    expect(inf.kind).toBe("identifier")
    expect(normalizeValue("20260804119", { kind: inf.kind })).toMatchObject({
      kind: "identifier",
      value: "20260804119",
    })
  })

  it("엑셀이 숫자로 만들어버린 주문번호도 문자열로 되돌린다", () => {
    // #8의 주문번호는 실제로 number 4474428070으로 들어온다.
    const inf = column("주문번호", [4474428070, 4474428071, 4474428072])
    expect(inf.kind).toBe("identifier")
    expect(normalizeValue(4474428070, { kind: "identifier" })).toMatchObject({
      kind: "identifier",
      value: "4474428070",
    })
  })

  it("앞자리 0은 헤더 힌트 없이도 지킨다", () => {
    expect(column("코드값없음", ["0012", "0034"]).kind).toBe("identifier")
    expect(v("0012")).toMatchObject({ kind: "identifier", value: "0012" })
  })

  it("안전 정수를 넘는 숫자 문자열은 식별자로 남긴다", () => {
    // 12345678901234567890을 Number로 바꾸면 값이 달라진다.
    expect(v("12345678901234567890")).toMatchObject({ kind: "identifier" })
  })

  it('"개수"·"금액"이 붙은 컬럼은 번호가 들어가도 숫자다', () => {
    expect(column("주문 품목 개수", [1, 2, 3]).kind).toBe("number")
    expect(column("총 결제 금액", [10000, 9900]).kind).toBe("number")
  })

  it("운송장번호를 식별자로 잡는다", () => {
    expect(column("운송장번호", ["462731921175", "462731921186"]).kind).toBe("identifier")
  })
})

describe("Normalization — 컬럼 추론", () => {
  const col = (header: string, values: unknown[]) =>
    inferColumnKind(header, values.map((x) => [x as never]) as RawRow[], 0).kind

  it("퍼센트 컬럼", () => {
    expect(col("아이템위너 비율(%)", ["100.0%", "0.0%", "50.0%"])).toBe("percent")
  })

  it("날짜 컬럼", () => {
    expect(col("결제완료일", ["2026/07/31", "2026/07/30"])).toBe("date")
  })

  it("텍스트 컬럼", () => {
    expect(col("상품명", ["머레이 충전기", "파인큐브 거리측정기"])).toBe("text")
  })

  it("표본이 없으면 단정하지 않는다", () => {
    expect(inferColumnKind("빈컬럼", [[null], [null]] as RawRow[], 0).kind).toBe("null")
  })
})
