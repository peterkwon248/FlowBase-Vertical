/**
 * [합성 + 실측] **안 받은 컬럼에 돈이 실리면 말한다** (조사 2.13 · LOCK 6).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 오늘까지 안 터졌나 — 그리고 왜 합성이어야 하나 ★
 *
 * 11번가 정산 59컬럼 중 8개만 받는다. 나머지 51개는 `unmappedColumnCount`라는
 * **수 하나**로 뭉개져서, 그 수는 「51개를 못 읽었다」는 말은 해도 **「그중에 돈이
 * 있었나」는 영영 못 한다.**
 *
 * 조용했던 이유는 우연이다 — 2026-08-21 실측에서 배송비 계열 6컬럼이 **전부 0**이다.
 * 도서산간 주문이 실제로 생기는 달에 그 금액은 소리 없이 사라진다.
 *
 * 그래서 실제 픽스처로는 **가드가 무는지 알 수 없다.** 합성으로 값을 넣어 확인한다
 * (작업 리듬 3 — 가드를 부러뜨려 본다).
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 왜 「미매핑 숫자 컬럼 전부」가 아닌가 ★
 * 같은 파일에서 `NO`(8,256) · `수량`(137) · `판매가`(4,778,100) · `서비스이용료(상품)`
 * (410,428)도 미매핑 숫자다. 전부 감시하면 **매 파일마다 열 줄이 울린다.** 그중
 * 대부분은 이미 집계에 든 것이라 잃은 돈이 아니다 — 실측으로 확인했다:
 *
 * ```
 * 판매금액합계 4,969,100 = 판매가 4,778,100 + 옵션가 191,000
 * 공제금액합계 1,130,702 = 서비스이용료(상품) 410,428 + 할인쿠폰이용료 676,000
 *                        + 복수구매할인비용 25,000 + 후불광고비 19,274
 * ```
 *
 * 상시 오탐은 사람이 오류 목록 자체를 안 보게 만든다(같은 프로파일의 vat_amount note가
 * 이미 그 판단을 했다). 그래서 **프로파일이 지목한 것만** 본다.
 */

import { describe, it, expect } from "vitest"
import { mapRows, newKeyState, type MappingProfile } from "../src/core/import/mapping/index.js"
import { KIND_NULL, KIND_NUMBER, KIND_TEXT } from "../src/core/import/types.js"
import type { NormalizedChunk, RawCell } from "../src/core/import/types.js"
import { ISSUE_KINDS, scopeOf, isFatal } from "../src/core/import/issues.js"
import { readFileSync } from "node:fs"

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

const HEADERS = ["주문번호", "정산금액", "도서산간배송비", "반품선결제배송비", "수량"]

const profile = (watch: readonly string[]): MappingProfile =>
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
    recognitionRules: {
      containerFormats: ["xlsx"],
      requiredHeaders: HEADERS,
      headerMatch: "all",
      minConfidence: 0.5,
    },
    extractionRules: { sheetSelector: { kind: "first" } },
    sourceKey: { strategy: "natural", columns: ["주문번호"] },
    fieldMappings: [
      { target: "order_source_key", source: "주문번호", kind: "identifier" },
      { target: "net_amount", source: "정산금액", kind: "number", default: 0 },
    ],
    unmappedColumns: { policy: "keep-count", watch },
  }) as unknown as MappingProfile

const run = (p: MappingProfile, rows: readonly (readonly (string | number | null)[])[]) =>
  mapRows(p, HEADERS, chunkOf(rows), { fileName: "t.xlsx", fileNameCaptures: {}, keyState: newKeyState() }, 0)

const WATCH = ["도서산간배송비", "반품선결제배송비"]

describe("안 받은 컬럼에 돈이 실리면 말한다 (조사 2.13)", () => {
  it("사건 코드가 닫힌 집합에 등재돼 있다 — 비치명 · 파일 사건", () => {
    expect(ISSUE_KINDS).toHaveProperty("unmapped_money")
    // 행은 적재된다. 잃은 것은 금액이지 행이 아니다.
    expect(isFatal("unmapped_money")).toBe(false)
    // 「컬럼 하나가 전 행에서 빈다」를 행 사건으로 세면 141분의 1로 줄어
    // «거의 괜찮다»처럼 보인다 (008 scope).
    expect(scopeOf("unmapped_money")).toBe("file")
  })

  it("★ 값이 0이면 조용하다 — 오늘 픽스처가 바로 그 상태다 ★", () => {
    const r = run(profile(WATCH), [
      ["A1", 1000, 0, 0, 1],
      ["A2", 2000, 0, 0, 1],
    ])
    expect(r.watchedNonZero.size, "0인데 울리면 상시 오탐이 된다").toBe(0)
  })

  it("★★ 0이 아니면 **문다** — 컬럼마다 금액을 합쳐서 ★★", () => {
    const r = run(profile(WATCH), [
      ["A1", 1000, 3000, 0, 1],
      ["A2", 2000, 2500, 700, 1],
    ])
    expect(r.watchedNonZero.get("도서산간배송비")).toBe(5500)
    expect(r.watchedNonZero.get("반품선결제배송비")).toBe(700)
    // 행은 적재된다 — 금액이 안 들어갈 뿐이다
    expect(r.rowsLoaded).toBe(2)
  })

  it("음수도 «있다»로 센다 — 반품 배송비는 음수로 올 수 있다", () => {
    const r = run(profile(WATCH), [["A1", 1000, -1200, 0, 1]])
    expect(r.watchedNonZero.get("도서산간배송비"), "부호로 상쇄돼 사라지면 안 된다").toBe(1200)
  })

  it("★ 이미 매핑된 컬럼은 watch에 있어도 안 운다 — 선언이 둘로 갈리는 자리를 코드가 닫는다 ★", () => {
    // `정산금액`은 net_amount로 받고 있다. 프로파일이 실수로 watch에 남겨 둬도
    // 「안 받았다」고 말하면 안 된다 — 정상 적재를 두고 우는 것이 상시 오탐이다.
    const r = run(profile(["정산금액", "도서산간배송비"]), [["A1", 9999, 100, 0, 1]])
    expect(r.watchedNonZero.has("정산금액")).toBe(false)
    expect(r.watchedNonZero.get("도서산간배송비")).toBe(100)
  })

  it("파일에 없는 컬럼을 지목해도 조용하다 — 그건 `missing_column`의 일이다", () => {
    const r = run(profile(["해외취소배송비"]), [["A1", 1000, 0, 0, 1]])
    expect(r.watchedNonZero.size).toBe(0)
  })
})

describe("11번가 정산 프로파일이 실제로 지목하고 있다", () => {
  /**
   * 선언과 코드가 갈리지 않게 못박는다. 프로파일이 `watch`를 잃어버리면
   * **가드는 살아 있는데 볼 것이 없어져** 조용해진다 — 가장 알아채기 어려운 고장이다.
   */
  it("배송비 계열 다섯을 지목한다 (선결제배송비는 이미 매핑돼 빠졌다)", () => {
    const p = JSON.parse(
      readFileSync("src/packs/kr-marketplace/profiles/11st-settlement@1.json", "utf8"),
    ) as {
      unmappedColumns?: { watch?: string[] }
      fieldMappings: { target: string; source?: string }[]
    }
    const watch = p.unmappedColumns?.watch ?? []
    expect(watch).toEqual([
      "도서산간배송비",
      "구매자부담 반품/교환배송비",
      "반품선결제배송비",
      "반품도서산간배송비",
      "해외취소배송비",
    ])
    // 지목한 것이 매핑된 것과 겹치면 상시 오탐이다 — 코드도 막지만 선언에서도 막는다
    const mapped = new Set(p.fieldMappings.map((m) => m.source).filter(Boolean))
    for (const w of watch) expect(mapped.has(w), `${w}는 이미 매핑돼 있다`).toBe(false)
    // 선결제배송비는 shipping_amount로 받고 있으므로 목록에 **없어야** 한다
    expect(watch).not.toContain("선결제배송비")
    expect(mapped.has("선결제배송비")).toBe(true)
  })
})
