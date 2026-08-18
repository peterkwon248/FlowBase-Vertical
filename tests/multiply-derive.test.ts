/**
 * `derive.from === "multiply"` — **라인 금액이 파일에 없는 양식**을 위한 곱.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 생겼나 ★
 *
 * 자사몰 주문 파일에는 라인 금액 열이 없다. `판매가`(단가)와 `상품수량`만 있고,
 * `총 품목 금액`은 **주문 단위 합계**다. 그래서:
 *
 *   총 품목 금액을 쓰면   → 다품목 주문의 두 줄이 각각 주문 총액을 갖는다 (겹침)
 *   판매가만 쓰면         → 수량 2개짜리가 한 개 값으로 들어간다 (과소)
 *
 * 실측 검증 문장 (픽스처 #9 · 1,197행 / 주문 1,071건):
 *   주문 단위로 묶으면 `Σ(판매가 × 상품수량) == 총 품목 금액`이 **1,054건 일치**.
 *   어긋나는 17건 = 취소로 총액 0인 16건 + 옵션 추가금 1건.
 *
 * ★ 마켓을 모른다 (LOCK 4) ★ core에 있는 것은 곱셈뿐이고, 무엇을 곱할지는
 * 프로파일이 정한다. 그래서 이 테스트도 **합성 데이터**로 규칙만 잰다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { mapRows, newKeyState, type MappingProfile } from "../src/core/import/mapping/index.js"
import { KIND_NULL, KIND_NUMBER, KIND_TEXT, type NormalizedChunk, type RawCell } from "../src/core/import/types.js"

type Row = readonly (string | number | null)[]

/** 합성 청크. `tests/row-routing.test.ts`와 같은 모양이다 — 파서를 안 부른다. */
function chunkOf(rows: readonly Row[], width: number): NormalizedChunk {
  const rowCount = rows.length
  const kinds = new Uint8Array(rowCount * width)
  const values: (string | number | null)[] = new Array(rowCount * width).fill(null)
  const raws: RawCell[] = new Array(rowCount * width).fill(null)
  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < width; c++) {
      const v = rows[r]![c] ?? null
      const i = r * width + c
      values[i] = v
      raws[i] = v
      kinds[i] = v === null ? KIND_NULL : typeof v === "number" ? KIND_NUMBER : KIND_TEXT
    }
  }
  const rowIndices = Int32Array.from({ length: rowCount }, (_, i) => i)
  return { sheetIndex: 0, startRow: 0, rowIndices, isLast: true, width, rowCount, kinds, values, raws }
}

const HEADERS = ["주문번호", "판매가", "수량", "날짜"]

const PROFILE = {
  $schema: "flowbase/mapping-profile@1",
  id: "t/order/order-line",
  version: "1",
  packId: "t",
  marketplaceKey: "t",
  docType: "order",
  grain: "order-line",
  targetTable: "fact_order",
  label: "합성",
  displayName: "합성",
  recognitionRules: { containerFormats: ["xlsx"], requiredHeaders: [], headerMatch: "all", minConfidence: 0 },
  extractionRules: { sheetSelector: { kind: "firstData" }, headerRowHint: 1 },
  sourceKey: { strategy: "natural", columns: ["주문번호"] },
  fieldMappings: [
    { target: "ordered_at", source: "날짜", kind: "date", required: true },
    { target: "status", kind: "text", derive: { from: "constant", value: "PAID" } },
    {
      target: "total_amount",
      kind: "number",
      default: 0,
      derive: { from: "multiply", columns: ["판매가", "수량"] },
    },
  ],
} as unknown as MappingProfile

function run(rows: readonly Row[], headers: readonly string[] = HEADERS) {
  return mapRows(
    PROFILE,
    [...headers],
    chunkOf(rows, headers.length),
    { fileName: "t.xlsx", fileNameCaptures: {}, keyState: newKeyState() },
    0,
  )
}

const amounts = (r: ReturnType<typeof run>): unknown[] =>
  (r.byTable.get("fact_order") ?? []).map((x) => x.fields["total_amount"])

describe("derive multiply — 단가 × 수량", () => {
  it("★ 라인 금액을 만든다 — 수량이 곱해진다", () => {
    const r = run([
      ["A-1", 7000, 2, "2026-07-01"],
      ["A-2", 12500, 1, "2026-07-01"],
    ])
    expect(amounts(r)).toEqual([14000, 12500])
    expect(r.errors).toHaveLength(0)
  })

  it("수량이 0이면 0이다 — 곱은 곱이다", () => {
    const r = run([["A-1", 7000, 0, "2026-07-01"]])
    expect(amounts(r)).toEqual([0])
  })

  it("★ 열이 하나라도 없으면 0으로 만들지 않는다 — 0은 「안 팔렸다」로 읽힌다 ★", () => {
    // 「수량」이 없는 파일. 곱의 일부만으로 값을 지어내면 매출이 조용히 줄어든다.
    const r = run([["A-1", 7000, "2026-07-01"]], ["주문번호", "판매가", "날짜"])
    expect(amounts(r), "부분곱(7000)이 들어갔다").not.toEqual([7000])
    // 값이 없으면 선언된 default로 간다 — 그건 프로파일의 선택이고, 조용하지 않다
    expect(r.errors.some((e) => e.code === "missing_column")).toBe(true)
  })

  it("없는 컬럼은 **컬럼당 한 번만** 보고한다 — 8만 행이면 8만 건이 된다", () => {
    const r = run(
      Array.from({ length: 50 }, (_, i) => [`A-${i}`, 7000, "2026-07-01"] as Row),
      ["주문번호", "판매가", "날짜"],
    )
    expect(r.errors.filter((e) => e.code === "missing_column")).toHaveLength(1)
  })

  it("숫자가 아닌 값이 섞이면 그 행만 값이 서지 않는다 — 나머지는 정상이다", () => {
    const r = run([
      ["A-1", 7000, 2, "2026-07-01"],
      ["A-2", "확인필요", 1, "2026-07-01"],
      ["A-3", 5000, 3, "2026-07-01"],
    ])
    const got = amounts(r)
    expect(got[0]).toBe(14000)
    expect(got[2]).toBe(15000)
    expect(got[1], "읽히지 않은 값이 곱을 통과했다").not.toBe(7000)
  })

  it("★ 주문 행과 품목 행이 **같은 곱**을 쓴다 — 두 표의 금액이 갈릴 수 없다", () => {
    const withItem = {
      ...PROFILE,
      listing: { grain: "product", keyColumns: ["주문번호"], titleColumns: ["주문번호"] },
      orderItem: {
        fieldMappings: [
          { target: "quantity", source: "수량", kind: "number", default: 1 },
          {
            target: "gross_amount",
            kind: "number",
            default: 0,
            derive: { from: "multiply", columns: ["판매가", "수량"] },
          },
        ],
      },
    } as unknown as MappingProfile

    const r = mapRows(
      withItem,
      [...HEADERS],
      chunkOf([["A-1", 7000, 2, "2026-07-01"]], HEADERS.length),
      { fileName: "t.xlsx", fileNameCaptures: {}, keyState: newKeyState() },
      0,
    )
    // 품목은 `byTable`이 아니라 `items`로 나온다 — `runImport`가 부모 id를 알아야
    // `fact_order_item` 행이 되기 때문이다(리스팅·주문이 먼저 들어가야 한다).
    const order = r.byTable.get("fact_order")?.[0]?.fields["total_amount"]
    const item = r.items[0]?.fields["gross_amount"]
    expect(order).toBe(14000)
    expect(r.items, "품목이 만들어지지 않았다").toHaveLength(1)
    expect(item, "품목 금액이 주문 금액과 다르다").toBe(order)
  })
})
