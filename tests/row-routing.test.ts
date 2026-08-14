/**
 * 행 라우팅 — 한 파일 안에서 주문과 클레임을 가른다.
 *
 * ESM 주문통합검색은 `진행상태` 한 컬럼으로 둘이 섞여 있다. 전부 `fact_order`로
 * 넣으면 **취소·반품·환불이 매출로 잡힌다** — 실측으로 388,700원이 그랬다.
 *
 * 프로파일을 둘로 쪼개지 않는 이유는 Recognition의 모호함이다. 같은 파일에
 * 프로파일 둘이 매칭되면 어느 것을 고를지 파일만 보고는 알 수 없다.
 * 그래서 프로파일 하나 안에서 가르고 **batch도 하나**다.
 */

import { describe, it, expect } from "vitest"
import { mapRows, newKeyState, type MappingProfile } from "../src/core/import/mapping/index.js"
import { KIND_NULL, KIND_NUMBER, KIND_TEXT } from "../src/core/import/types.js"
import type { NormalizedChunk, RawCell } from "../src/core/import/types.js"

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
  // 합성 청크라 합계·빈 행이 없다 — 물리 행과 데이터 행이 1:1이다
  const rowIndices = Int32Array.from({ length: rowCount }, (_, i) => i)
  return { sheetIndex: 0, startRow: 0, rowIndices, isLast: true, width, rowCount, kinds, values, raws }
}

const HEADERS = ["진행상태", "주문번호", "결제일", "구매금액"]

const PROFILE: MappingProfile = {
  id: "t/order",
  version: "1",
  packId: "test",
  marketplaceKey: "esm",
  docType: "order",
  grain: "order-line",
  targetTable: "fact_order",
  label: "테스트",
  displayName: "테스트 채널",
  recognitionRules: { containerFormats: ["xlsx"], requiredHeaders: [], headerMatch: "all", minConfidence: 0 },
  extractionRules: { sheetSelector: { kind: "firstData" } },
  sourceKey: { strategy: "natural", columns: ["주문번호"] },
  fieldMappings: [
    { target: "ordered_at", source: "결제일", kind: "date", required: true },
    { target: "status", source: "진행상태", kind: "text", required: true },
    { target: "total_amount", source: "구매금액", kind: "number", default: 0 },
  ],
  rowRouting: {
    column: "진행상태",
    knownValues: ["송금완료", "구매결정완료", "취소완료", "반품완료", "환불완료", "구매거부취소"],
    routes: [
      {
        match: ["취소완료", "반품완료", "환불완료", "구매거부취소"],
        targetTable: "fact_claim",
        fieldMappings: [
          { target: "order_source_key", source: "주문번호", kind: "identifier" },
          {
            target: "claim_type",
            source: "진행상태",
            kind: "enum",
            required: true,
            valueMap: {
              취소완료: "CANCEL",
              구매거부취소: "CANCEL",
              반품완료: "RETURN",
              환불완료: "REFUND",
            },
          },
          { target: "claimed_at", source: "결제일", kind: "date", required: true },
          { target: "date_precision", kind: "text", derive: { from: "constant", value: "proxy" } },
          { target: "amount", source: "구매금액", kind: "number", default: 0 },
        ],
      },
    ],
  },
  validationRules: [],
}

const CTX = { fileName: "esm.xlsx", fileNameCaptures: {} }
const run = (rows: readonly (readonly (string | number | null)[])[]) =>
  mapRows(PROFILE, HEADERS, chunkOf(rows), { ...CTX, keyState: newKeyState() })

describe("행 라우팅 — 주문과 클레임을 가른다", () => {
  it("★ 클레임 행은 fact_order에 들어가지 않는다 ★", () => {
    const r = run([
      ["송금완료", "A1", "2026-07-05T10:00:00", 10_000],
      ["취소완료", "A2", "2026-07-06T10:00:00", 20_000],
      ["반품완료", "A3", "2026-07-07T10:00:00", 30_000],
      ["구매결정완료", "A4", "2026-07-08T10:00:00", 40_000],
    ])

    const orders = r.byTable.get("fact_order") ?? []
    const claims = r.byTable.get("fact_claim") ?? []
    expect(orders).toHaveLength(2)
    expect(claims).toHaveLength(2)

    // 매출에 클레임 금액이 섞이지 않는다.
    const revenue = orders.reduce((a, o) => a + Number(o.fields.total_amount), 0)
    expect(revenue).toBe(50_000)
    const claimed = claims.reduce((a, c) => a + Number(c.fields.amount), 0)
    expect(claimed).toBe(50_000)
  })

  it("한 batch 안에서 갈린다 — rows는 기본 경로만, byTable이 전부다", () => {
    const r = run([
      ["송금완료", "A1", "2026-07-05", 10_000],
      ["환불완료", "A2", "2026-07-06", 20_000],
    ])
    // `rows`만 보고 적재하면 클레임 행을 통째로 놓친다.
    expect(r.rows).toHaveLength(1)
    expect([...r.byTable.keys()].sort()).toEqual(["fact_claim", "fact_order"])
  })

  it("valueMap이 진행상태를 스키마의 CHECK 값으로 옮긴다", () => {
    const r = run([
      ["취소완료", "A1", "2026-07-05", 1],
      ["구매거부취소", "A2", "2026-07-05", 1],
      ["반품완료", "A3", "2026-07-05", 1],
      ["환불완료", "A4", "2026-07-05", 1],
    ])
    const types = (r.byTable.get("fact_claim") ?? []).map((c) => c.fields.claim_type)
    expect(types).toEqual(["CANCEL", "CANCEL", "RETURN", "REFUND"])
  })

  it("★ 모르는 진행상태가 매출로 조용히 들어가지 않는다 ★", () => {
    // 마켓이 "부분취소완료" 같은 상태를 새로 만들면 어느 route에도 안 걸려
    // 기본 경로(매출)로 간다. 그게 바로 클레임이 매출로 잡히는 사고다.
    // 행은 버리지 않되 **모르는 상태가 왔다는 사실**을 남긴다.
    const r = run([["부분취소완료", "A1", "2026-07-05", 1]])
    expect(r.errors.map((e) => e.reason)).toContainEqual(
      expect.stringContaining("알 수 없는 진행상태"),
    )
  })

  it("valueMap에 없는 값이 클레임 경로로 오면 적재하지 않는다", () => {
    // match에는 있는데 valueMap에서 빠뜨린 경우 — 프로파일 작성 실수다.
    const broken: MappingProfile = {
      ...PROFILE,
      rowRouting: {
        ...PROFILE.rowRouting!,
        routes: [
          {
            ...PROFILE.rowRouting!.routes[0]!,
            match: [...PROFILE.rowRouting!.routes[0]!.match, "부분환불"],
          },
        ],
      },
    }
    const r = mapRows(broken, HEADERS, chunkOf([["부분환불", "A1", "2026-07-05", 1]]), {
      ...CTX,
      keyState: newKeyState(),
    })
    expect(r.byTable.get("fact_claim") ?? []).toHaveLength(0)
    expect(r.errors.map((e) => e.reason)).toContainEqual(expect.stringContaining("사전에 없는 값"))
  })

  it("클레임은 date_precision='proxy'를 달고 나온다 (ADR-009 ①-보완)", () => {
    const r = run([["반품완료", "A1", "2026-07-05T11:22:33", 5_000]])
    const c = (r.byTable.get("fact_claim") ?? [])[0]!
    expect(c.fields.date_precision).toBe("proxy")
    // 결제일을 프록시로 쓴다 — 파일에 클레임 일자가 없기 때문이다.
    expect(c.fields.claimed_at).toBe("2026-07-05T11:22:33")
  })

  it("날짜가 아예 없는 클레임은 적재되지 않고 오류로 남는다", () => {
    // 결제 전 취소 — 시간 축에 놓을 수 없으므로 아무 달에나 넣지 않는다.
    const r = run([["취소완료", "A1", null, 1_000]])
    expect(r.byTable.get("fact_claim") ?? []).toHaveLength(0)
    expect(r.errors.some((e) => e.field === "claimed_at")).toBe(true)
  })

  it("미매핑 컬럼은 모든 경로의 합집합으로 센다", () => {
    // 클레임 경로에서만 쓰는 컬럼을 "버렸다"고 세면 숫자가 거짓말을 한다.
    const r = run([["송금완료", "A1", "2026-07-05", 1]])
    expect(r.unmappedColumnCount).toBe(0)
  })

  it("라우팅이 없는 프로파일은 전부 기본 경로로 간다", () => {
    // `rowRouting: undefined`가 아니라 **키를 뺀다** — 선택 속성에 undefined를
    // 넣는 것과 없는 것은 다르다 (exactOptionalPropertyTypes).
    const { rowRouting: _omit, ...plain } = PROFILE
    const r = mapRows(plain as MappingProfile, HEADERS, chunkOf([["취소완료", "A1", "2026-07-05", 1]]), {
      ...CTX,
      keyState: newKeyState(),
    })
    expect(r.rows).toHaveLength(1)
    expect(r.byTable.get("fact_claim")).toBeUndefined()
  })
})
