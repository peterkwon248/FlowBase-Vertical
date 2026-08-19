/**
 * 블록 리더 — **표가 아닌 파일을 받아낸다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 실파일이 만든 요구 (2026-08-19) ★
 *
 * 사용자의 실제 원가표(13MB · 15시트)가 표가 아니었다. 7행이 한 상품인 카드
 * 레이아웃이고 헤더 행이 없다. 실측:
 *
 * ```
 * 상품 블록      200개        7행 주기 이탈 0개 (완전히 규칙적)
 * 원가 라벨      181개        나머지 11개는 라벨만 없고 값은 늘 그 자리에 있다
 * 좌표 일치율     원가 99% · 권장소비자가 100% · 모델명 90%
 * ```
 *
 * 그래서 두 단계다: **라벨로 읽고, 라벨이 자리를 가르치고, 라벨 없는 블록은
 * 그 자리에서 읽는다.** 아래 픽스처는 그 실측 모양을 그대로 축소한 것이다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { readBlocks, type BlockReadRule } from "../src/core/import/extraction/blocks.js"
import type { RawRow } from "../src/core/import/types.js"
import { matchProfiles, type MappingProfile } from "../src/core/import/mapping/index.js"

const RULE: BlockReadRule = {
  anchorColumn: 0,
  anchorAs: "품명",
  fields: [
    { label: "모델명", as: "모델명" },
    { label: "원가", as: "원가" },
  ],
}

/** 실측 모양 그대로: 라벨과 값 사이에 병합 빈칸이 끼고, 한 상품이 7행이다. */
const block = (
  name: string,
  model: string | null,
  cost: string | number | null,
  o: { costLabel?: boolean } = {},
): RawRow[] => [
  [name, null, model === null ? null : "모델명", model, "권장소비자가", null, 42900, null,
    o.costLabel === false ? null : "원가", cost, null, 100],
  [null, null, "구성품"],
  [null, null, "옵션/색상", "블랙", "온라인 판매가", null, 24800, null, "재고"],
  [null, null, "특징", "5000mAh"],
  [null, null, null, null, "Special partner", null, 13000, null, "비고", "빅셀러"],
  [],
  [],
]

/** 앞 2행은 배너다 — 실파일에도 있다. */
const banner: RawRow[] = [
  ["품명", "이미지", "스팩", null, null, null, null, null, "머레이 직원 공유"],
  [null, null, null, null, "구분", null, "단가 (VAT 포함)"],
]

const sheet = (...blocks: RawRow[][]): RawRow[] => [...banner, ...blocks.flat()]

describe("블록 리더 — 카드를 표로 편다", () => {
  it("★ 7행이 한 상품이 된다 — 주기를 스스로 판정한다 ★", () => {
    const r = readBlocks(
      sheet(block("워치독", "MW-DOC", 9200), block("무선충전", "M-DOC", 13300)),
      RULE,
    )
    expect(r.period).toBe(7)
    expect(r.irregular).toBe(0)
    expect(r.blocks).toBe(2)
    expect(r.header).toEqual(["품명", "모델명", "원가"])
    expect(r.rows).toEqual([
      ["워치독", "MW-DOC", 9200],
      ["무선충전", "M-DOC", 13300],
    ])
  })

  it("병합으로 라벨과 값 사이가 벌어져도 찾는다", () => {
    // 실파일의 `권장소비자가`(4열) → 값(6열)이 그 모양이다. 한 칸 건너뛴다.
    const rows = sheet(block("A", "M-1", null), block("B", "M-2", 8800))
    // A의 원가 값을 한 칸 더 밀어 둔다 (9는 비고 10에 값)
    ;(rows[2] as unknown[])[9] = null
    ;(rows[2] as unknown[])[10] = 555
    const r = readBlocks(rows, { ...RULE, maxSpan: 3 })
    expect(r.rows[0]![2]).toBe(555)
  })

  it("★ 거리로 막는다 — 값이 빈 라벨이 **옆 필드를 집어오지 않는다** ★", () => {
    // 「원가」가 비었는데 끝까지 훑으면 그 오른쪽의 `카톤(100)`을 원가로 읽는다.
    const rows = sheet(block("A", "M-1", null), block("B", "M-2", null))
    const r = readBlocks(rows, { ...RULE, maxSpan: 1, positionConfidence: 1 })
    expect(r.rows[0]![2], "카톤 수량을 원가로 집었다").toBeNull()
    expect(r.missing["원가"]).toBe(2)
  })

  it("다음 라벨을 값으로 읽지 않는다", () => {
    const rows = sheet(block("A", null, 9200))
    // 「모델명」 라벨은 있는데 값이 비고 바로 옆이 다음 라벨인 경우
    ;(rows[2] as unknown[])[2] = "모델명"
    ;(rows[2] as unknown[])[3] = null
    ;(rows[2] as unknown[])[4] = "원가"
    const r = readBlocks([...rows, ...block("B", "M-2", 100)], {
      ...RULE,
      positionConfidence: 1,
    })
    expect(r.rows[0]![1], "다음 라벨을 모델명 값으로 읽었다").not.toBe("원가")
  })
})

describe("★ 라벨이 자리를 가르친다 — 라벨 없는 블록을 살린다 ★", () => {
  it("라벨만 빠진 블록도 값을 읽어낸다", () => {
    // 실측: 200블록 중 11개가 「원가」 라벨 셀만 비어 있고 값은 늘 그 자리였다.
    const rows = sheet(
      block("A", "M-1", 9200),
      block("B", "M-2", 8800),
      block("C", "M-3", 7700),
      block("D", "M-4", 6600, { costLabel: false }),
    )
    const r = readBlocks(rows, RULE)
    expect(r.rows[3]![2], "라벨이 없다고 값을 버렸다").toBe(6600)
    expect(r.byLabel["원가"]).toBe(3)
    expect(r.byPosition["원가"], "추론으로 읽은 것을 따로 세지 않는다").toBe(1)
    expect(r.missing["원가"]).toBe(0)
    expect(r.learned["원가"]).toEqual({ rowOffset: 0, column: 9 })
  })

  it("★ 자리가 흔들리면 **안 배운다** — 엉뚱한 칸을 원가로 집느니 비워 둔다 ★", () => {
    // 두 블록의 원가 위치가 서로 다르면 일치율이 50%다. 기본 문턱(0.9) 아래다.
    const a = block("A", "M-1", 9200)
    const b = block("B", "M-2", null)
    ;(b[2] as unknown[])[8] = "원가"
    ;(b[2] as unknown[])[9] = 8800
    const rows = sheet(a, b, block("C", "M-3", null, { costLabel: false }))
    const r = readBlocks(rows, RULE)
    expect(r.learned["원가"], "흔들리는 자리를 배웠다").toBeNull()
    expect(r.rows[2]![2]).toBeNull()
  })

  it("배운 자리에 라벨이 앉아 있으면 안 읽는다 — 배치가 밀린 블록이다", () => {
    const rows = sheet(
      block("A", "M-1", 9200),
      block("B", "M-2", 8800),
      block("C", "M-3", 7700),
      // D는 배치가 밀려 배운 자리(0,9)에 **라벨 글자**가 앉아 있다.
      block("D", "M-4", "원가", { costLabel: false }),
    )
    // 오른쪽 칸을 비워 라벨 스캔이 값을 못 찾게 한다 — 그래야 2차(자리)로 내려온다.
    ;(rows[2 + 21] as unknown[])[11] = null
    const r = readBlocks(rows, RULE)
    expect(r.rows[3]![2], "라벨 글자를 원가로 읽었다").toBeNull()
    expect(r.missing["원가"]).toBe(1)
  })
})

describe("★ 틀리게 읽느니 거부한다 (LOCK 6) ★", () => {
  it("주기가 고르지 않으면 던진다 — 앞 상품의 값이 뒤에 붙는다", () => {
    // 블록 하나만 5행이면 그 뒤가 통째로 밀린다. 숫자는 나오는데 전부 틀린다.
    const short = block("B", "M-2", 8800).slice(0, 5)
    expect(() =>
      readBlocks(sheet(block("A", "M-1", 9200), short, block("C", "M-3", 7700)), RULE),
    ).toThrow(/주기가 고르지 않다/)
  })

  it("이탈을 봐줄 수 있게 문턱을 열어 둔다 — 마지막 블록이 짧은 것은 흔하다", () => {
    const short = block("C", "M-3", 7700).slice(0, 5)
    const rows = sheet(
      block("A", "M-1", 9200),
      block("B", "M-2", 8800),
      short,
      block("D", "M-4", 6600),
    )
    const r = readBlocks(rows, { ...RULE, maxIrregular: 0.7 })
    expect(r.blocks).toBe(4)
    expect(r.rows[2]![2]).toBe(7700)
  })

  it("앵커가 2개 미만이면 카드 레이아웃이 아니다 — 던진다", () => {
    expect(() => readBlocks(sheet(block("A", "M-1", 9200)), RULE)).toThrow(/블록을 찾지 못했다/)
    expect(() => readBlocks(banner, RULE)).toThrow(/블록을 찾지 못했다/)
  })

  it("★ 못 찾은 것을 **센다** — 조용히 빈칸으로 두지 않는다 ★", () => {
    const rows = sheet(
      block("A", "M-1", 9200),
      block("B", null, 8800),
      block("C", null, 7700),
      block("D", null, 6600),
    )
    const r = readBlocks(rows, RULE)
    expect(r.missing["모델명"]).toBe(3)
    expect(r.missing["원가"]).toBe(0)
  })
})

describe("판정 — **헤더 행이 없는 파일**을 알아본다", () => {
  const CARD: MappingProfile = {
    $schema: "flowbase/mapping-profile@1",
    id: "seller/cost/card",
    version: "1",
    packId: "kr-marketplace",
    marketplaceKey: "seller",
    docType: "cost",
    grain: "product-card",
    targetTable: "cost_history",
    label: "단가표 (카드형)",
    displayName: "내 단가표",
    recognitionRules: {
      containerFormats: ["xlsx"],
      requiredHeaders: [],
      headerMatch: "all",
      minConfidence: 0.8,
      requiredCellTexts: ["모델명", "권장소비자가"],
    },
    extractionRules: { sheetSelector: { kind: "firstData" } },
    sourceKey: { strategy: "natural", columns: ["품명"] },
    fieldMappings: [],
    validationRules: [],
  } as unknown as MappingProfile

  const ctx = (cellTexts: string[]) => ({
    containerFormat: "xlsx",
    headers: [] as string[],
    fileName: "단가표.xlsx",
    cellTexts,
  })

  it("★ 헤더가 0개인데 붙는다 — 라벨이 지문이다 ★", () => {
    // 카드 레이아웃에는 헤더 행이 없다. `requiredHeaders`로는 원리적으로 못 맞춘다.
    const m = matchProfiles([CARD], ctx(["품명", "모델명", "권장소비자가", "원가"]))
    expect(m).toHaveLength(1)
    expect(m[0]!.confidence).toBe(1)
    expect(m[0]!.evidence.join(" ")).toContain("라벨 2개 일치")
  })

  it("라벨이 하나라도 없으면 안 붙는다", () => {
    expect(matchProfiles([CARD], ctx(["품명", "모델명"]))).toHaveLength(0)
  })

  it("셀 텍스트를 안 주면 안 붙는다 — 조용히 통과시키지 않는다", () => {
    const m = matchProfiles([CARD], {
      containerFormat: "xlsx",
      headers: [],
      fileName: "x.xlsx",
    })
    expect(m).toHaveLength(0)
  })

  it("★ 지문이 없는 프로파일은 신뢰도 0이다 — 아무 파일에나 붙지 않는다 ★", () => {
    const naked = {
      ...CARD,
      recognitionRules: { ...CARD.recognitionRules, requiredCellTexts: undefined },
    } as unknown as MappingProfile
    expect(matchProfiles([naked], ctx(["아무거나"]))).toHaveLength(0)
  })
})
