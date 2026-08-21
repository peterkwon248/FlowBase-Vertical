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
 * ★ 세 갈래다 — 2026-08-21에 하나가 늘었다 (ADR-025) ★
 *
 * ```
 * 타깃이 signed   →  그대로 저장한다              부호가 **정보**다 (net_amount)
 * 프로파일 선언    →  절대값 + **바꿨다고 말한다**   (조용한 변환 ❌)
 * 선언 없음       →  **제외 + 말한다**             (조용한 적재 ❌)
 * ```
 *
 * 선언 없는 음수에 `abs`를 씌우면 **반품이 판매가 되고 손실이 이익이 된다.**
 * 그 판단은 그대로 옳다. 그런데 원래 이 파일은 그 대안을 «값을 그대로 두고 **적재**»로
 * 적었고, **거기가 틀렸다** — 음수가 Fact에 들어가면 `SUM()`이 조용히 틀린다.
 * ADR-009 ②가 막으려던 것이 정확히 그것이다.
 *
 * 빠져 있던 셋째 길이 **제외하고 표시한다**였다. LOCK 6이 요구하는 것은
 * 「고쳐라」도 「죽어라」도 아니고 **「읽지 못한 것은 제외하고 제외를 표시하라」**다.
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

  it("★★ 선언이 없으면 **값을 지어내지도, 적재하지도 않는다** — 제외하고 말한다 ★★", () => {
    const r = run(false, [["A1", -12345, 1]])

    const e = r.errors.find((x) => x.code === "sign_undeclared")
    expect(e, "모르면 모른다고 말한다").toBeDefined()
    expect(ISSUE_KINDS.sign_undeclared.fatal, "적재하면 SUM()이 조용히 틀린다 (ADR-025)").toBe(true)
    expect(r.rows, "행이 남아 있다 — 음수가 Fact로 들어간다").toHaveLength(0)
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
  it("[합성] 음수 수량도 제외한다 — abs를 씌우면 반품이 판매가 되고, 넣으면 합이 틀린다", () => {
    const r = run(true, [["A1", 1000, -3]])
    const e = r.errors.find((x) => x.code === "sign_undeclared" && x.field === "quantity")
    expect(e, "음수 수량이 조용히 지나가지 않는다").toBeDefined()
    expect(r.rows, "수량에 선언이 없으므로 이 행은 안 들어간다").toHaveLength(0)
  })

  it("한 행에 둘이 겹쳐도 각각 보고된다 — 그리고 치명 하나면 행이 빠진다", () => {
    const r = run(true, [["A1", -500, -2]])
    expect(r.errors.filter((x) => x.code === "sign_normalized")).toHaveLength(1)
    expect(r.errors.filter((x) => x.code === "sign_undeclared")).toHaveLength(1)
    // 보고는 둘 다 남는다 — 사람이 **무엇을 고쳐야 하는지** 알아야 하기 때문이다.
    // 그러나 행은 안 들어간다: 수량 쪽 선언이 없다.
    expect(r.rows).toHaveLength(0)
  })
})

/**
 * ★★ `signed` 타깃 — 부호가 **정보**인 유일한 자리 (ADR-025) ★★
 *
 * `net_amount`의 음수는 「이번 달은 마켓에 갚는다」는 뜻이다. `abs()`를 걸면
 * **빚이 수입으로 뒤집히고**, 받은 적 없는 지급액이 화면에 뜬다. 그리고 정산
 * 항등식(`지급액 =? 판매액 − 수수료 − VAT − 배송비`)이 **우리 버그를 파일 탓으로**
 * 지목한다 — 화면이 마켓 정산서를 틀렸다고 말하는데 틀린 건 우리다.
 *
 * 실파일에 음수 0건이라(2026-08-21 실측) 여기가 유일한 검증 자리다.
 */
describe("[합성] signed 타깃 — 부호가 정보인 자리는 그대로 둔다 (ADR-025)", () => {
  const netProfile = (signPolicy: boolean): MappingProfile =>
    ({
      ...profile(false),
      fieldMappings: [
        { target: "order_source_key", source: "주문번호", kind: "identifier" },
        signPolicy
          ? { target: "net_amount", source: "공제금액", kind: "number", signPolicy: "magnitude" }
          : { target: "net_amount", source: "공제금액", kind: "number" },
      ],
    }) as unknown as MappingProfile

  const runNet = (signPolicy: boolean, v: number) =>
    mapRows(netProfile(signPolicy), HEADERS, chunkOf([["A1", v, 1]]), {
      fileName: "f.xlsx",
      fileNameCaptures: {},
      keyState: newKeyState(),
    }, 0)

  it("★ 음수 정산이 **그대로 저장되고 행도 살아 있다** ★", () => {
    const r = runNet(false, -50_000)
    expect(r.rows, "「마켓에 갚는 달」이 통째로 제외되면 그 달이 화면에서 사라진다").toHaveLength(1)
    expect(r.rows[0]!.fields["net_amount"], "abs()는 빚을 수입으로 뒤집는다").toBe(-50_000)
  })

  it("말도 안 한다 — 선언된 통과라 «부호 미선언»이 아니다", () => {
    const r = runNet(false, -50_000)
    expect(
      r.errors.filter((x) => x.code.startsWith("sign_")),
      "정상인 것을 문제로 보고하면 진짜 문제가 묻힌다",
    ).toHaveLength(0)
  })

  it("★ 프로파일이 뒤집으려 해도 **타깃 사전이 이긴다** (결정 1) ★", () => {
    // 검증기가 이 선언 자체를 거부하지만(결정 2), 검증을 지나쳐 들어와도 매퍼가 막는다.
    const r = runNet(true, -50_000)
    expect(r.rows[0]!.fields["net_amount"], "프로파일 선언이 사전을 이기면 안 된다").toBe(-50_000)
  })

  it("양수 정산은 여느 때와 같다", () => {
    const r = runNet(false, 50_000)
    expect(r.rows[0]!.fields["net_amount"]).toBe(50_000)
    expect(r.errors.filter((x) => x.code.startsWith("sign_"))).toHaveLength(0)
  })
})
