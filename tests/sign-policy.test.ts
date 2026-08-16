/**
 * [합성] `signPolicy` 집행 — **선언이 있으면 바꾸고, 없으면 손대지 않는다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 오늘까지 안 터졌나 ★
 * 프로파일 11곳이 `signPolicy: "magnitude"`를 선언해 뒀는데 **읽는 코드가 0곳**이었다
 * (ADR-009 ②의 집행자 부재). 그래도 조용했던 이유는 **오늘 픽스처 4종에 음수 금액이
 * 0건**이기 때문이다 — 우연히 안 터지는 중이었다.
 *
 * 그래서 이 파일은 전부 합성이다. 답하는 것은 «분기가 살아 있는가»뿐이고
 * «얼마인가»는 답하지 않는다 (ADR-007 경계).
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 두 갈래가 반대 방향인 것이 요점이다 ★
 *
 * ```
 * 선언 있음  →  절대값으로 바꾼다 + **바꿨다고 말한다**   (조용한 변환 ❌)
 * 선언 없음  →  값을 그대로 둔다   + **모른다고 말한다**   (조용한 추측 ❌)
 * ```
 *
 * 선언 없는 음수에 `abs`를 씌우면 **반품이 판매가 되고 손실이 이익이 된다.**
 * 값을 바꾸는 것이 «안전한 기본값»처럼 보이지만 그 반대다.
 */

import { describe, it, expect } from "vitest"
import { mapRows, newKeyState, type MappingProfile } from "../src/core/import/mapping/index.js"
import { KIND_NULL, KIND_NUMBER, KIND_TEXT } from "../src/core/import/types.js"
import type { NormalizedChunk, RawCell } from "../src/core/import/types.js"
import { ISSUE_KINDS } from "../src/core/import/issues.js"

function chunkOf(rows: readonly (readonly (string | number | null)[])[]): NormalizedChunk {
  const rowCount = rows.length
  const width = rows[0]?.length ?? 0
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

const HEADERS = ["주문번호", "공제금액", "수량"]

const profile = (declare: boolean): MappingProfile =>
  ({
    id: "t/settle",
    version: "1",
    packId: "test",
    marketplaceKey: "mk",
    docType: "settlement",
    grain: "order-line",
    targetTable: "fact_settlement",
    label: "합성",
    displayName: "합성 채널",
    recognitionRules: { containerFormats: ["xlsx"], requiredHeaders: HEADERS, headerMatch: "all", minConfidence: 0.5 },
    extractionRules: { sheetSelector: { kind: "first" } },
    sourceKey: { strategy: "natural", columns: ["주문번호"] },
    fieldMappings: [
      { target: "order_source_key", source: "주문번호", kind: "identifier" },
      declare
        ? { target: "fee_amount", source: "공제금액", kind: "number", signPolicy: "magnitude" }
        : { target: "fee_amount", source: "공제금액", kind: "number" },
      { target: "quantity", source: "수량", kind: "number" },
    ],
  }) as unknown as MappingProfile

const run = (declare: boolean, rows: readonly (readonly (string | number | null)[])[]) =>
  mapRows(profile(declare), HEADERS, chunkOf(rows), { fileName: "f.xlsx", fileNameCaptures: {}, keyState: newKeyState() }, 0)

describe("[합성] signPolicy — 선언이 집행을 정한다", () => {
  it("선언이 있으면 절대값으로 바꾸고 **바꿨다고 말한다**", () => {
    const r = run(true, [["A1", -12345, 1]])
    expect(r.rows[0]!.fields["fee_amount"], "저장은 양수다 (ADR-009 ②)").toBe(12345)

    const e = r.errors.find((x) => x.code === "sign_normalized")
    expect(e, "값을 바꿨으면 반드시 말한다 — 조용한 변환은 조용한 거짓이다").toBeDefined()
    expect(e!.field).toBe("fee_amount")
    expect(e!.reason, "무엇이 무엇으로 바뀌었는지 남는다").toContain("-12345")
    expect(ISSUE_KINDS.sign_normalized.fatal, "행은 적재된다").toBe(false)
  })

  it("★ 선언이 없으면 **손대지 않는다** — 그게 안전한 쪽이다 ★", () => {
    const r = run(false, [["A1", -12345, 1]])
    expect(r.rows[0]!.fields["fee_amount"], "값을 지어내지 않는다").toBe(-12345)

    const e = r.errors.find((x) => x.code === "sign_undeclared")
    expect(e, "모르면 모른다고 말한다").toBeDefined()
    expect(ISSUE_KINDS.sign_undeclared.fatal, "행은 적재된다 — 버리지 않는다").toBe(false)
  })

  it("양수는 아무 말도 하지 않는다 — 0이면 말하지 않는다의 그 규율", () => {
    for (const declare of [true, false]) {
      const r = run(declare, [["A1", 12345, 1]])
      expect(r.errors.filter((x) => x.code.startsWith("sign_")), `declare=${declare}`).toHaveLength(0)
    }
  })

  /**
   * ★ 음수 수량 (D) — 같은 계열이다 ★
   * 반품이 음수 수량으로 오는 양식이 생기면, 절대값을 씌우는 순간 **반품이 판매가
   * 된다.** 수량에는 부호 규칙이 선언돼 있지 않으므로 값을 그대로 두고 알린다.
   */
  it("[합성] 음수 수량도 손대지 않고 알린다 — abs를 씌우면 반품이 판매가 된다", () => {
    const r = run(true, [["A1", 1000, -3]])
    expect(r.rows[0]!.fields["quantity"], "수량은 선언이 없으므로 그대로다").toBe(-3)
    const e = r.errors.find((x) => x.code === "sign_undeclared" && x.field === "quantity")
    expect(e, "음수 수량이 조용히 지나가지 않는다").toBeDefined()
  })

  it("한 행에 둘이 겹쳐도 각각 보고된다", () => {
    const r = run(true, [["A1", -500, -2]])
    expect(r.errors.filter((x) => x.code === "sign_normalized")).toHaveLength(1)
    expect(r.errors.filter((x) => x.code === "sign_undeclared")).toHaveLength(1)
    expect(r.rows[0]!.fields["fee_amount"]).toBe(500)
    expect(r.rows[0]!.fields["quantity"]).toBe(-2)
  })
})
