/**
 * 기준 데이터 위저드 — **원가를 넣는 문이 화면에 열려 있는가.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ core는 이미 되는데 화면이 안 되면 «안 되는 것»이다 ★
 *
 * `run-reference.ts`와 `tests/reference-import.test.ts`는 원가가 들어가고 손익이
 * 움직인다는 것을 증명했다. 그러나 그 문은 **코드에만** 있었다 — 사용자가 파일을
 * 끌어다 놓으면 위저드가 ① 모든 컬럼을 «이 프로파일이 쓰지 않는 컬럼»이라 말하고
 * ② 적용일을 묻지 않고 ③ 사실 경로로 흘려보내 터졌다.
 *
 * 이 파일이 그 세 자리를 잰다. 화면 문구를 시험하는 것이 사소해 보이지만, 여기서
 * 틀리면 사용자는 **멀쩡한 파일을 못 넣고 이유도 모른다.**
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { columnRoles, matchProfiles, type MappingProfile } from "../src/core/import/mapping/index.js"
import { importVals, referenceRows, roleField, roleWhy, EMPTY_WIZARD } from "../src/app/import.js"
import { emptyVals } from "../src/app/generated/vals.js"
import type { ImportAnalysis } from "../src/core/import/analyze.js"
import type { ReferenceRunResult } from "../src/core/import/run-reference.js"

const read = (n: string): MappingProfile =>
  JSON.parse(readFileSync(`src/packs/kr-marketplace/profiles/${n}`, "utf-8")) as MappingProfile

const COST = read("cost-master@1.json")
const ESM = read("esm-order@1.json")

/** 원가표의 실측 7열 (픽스처 #3 「상품별원가 raw」). */
const COST_HEADERS = ["상품번호", "상품명", "모델명", "원가", "배송비", "카테고리", "Model"]

/** 위저드에 먹일 최소 분석 결과 — 파일을 열지 않고 모양만 만든다. */
function analysisOf(profile: MappingProfile, headers: readonly string[]): ImportAnalysis {
  const match = matchProfiles([profile], {
    containerFormat: "xlsx",
    headers,
    fileName: "원가표.xlsx",
  })
  return {
    fileName: "원가표.xlsx",
    byteLength: 1234,
    format: "xlsx",
    contentHash: "hash",
    identityNotes: [],
    sheets: [{ index: 0, name: "상품별원가 raw", physicalRowCount: 253, columnCount: headers.length, reason: "253행", formulaRatio: null }],
    sheetIndex: 0,
    sheetMatches: [{ sheetIndex: 0, sheetName: "상품별원가 raw", profiles: match }],
    suggestedSheetIndex: 0,
    header: { rowIndex: 0, columns: [...headers], confidence: 1 },
    sample: [["A1", "머그컵", "M-1", "3200", "0", "주방", "M-1"]],
    sampleExcluded: [],
    columns: [],
    profiles: match,
  } as unknown as ImportAnalysis
}

const vals = (state: Parameters<typeof importVals>[1]) => {
  const v = emptyVals()
  importVals(v, state)
  return v
}

describe("기준 데이터 위저드 — 원가", () => {
  it("★ 확인 표가 «쓰지 않는 컬럼»이라고 거짓말하지 않는다 ★", () => {
    // 원가 프로파일은 `fieldMappings`가 **비어 있다**. 그래서 `columnRoles`가
    // `reference`를 안 읽으면 7열 전부가 «이 프로파일이 쓰지 않는 컬럼»이 된다 —
    // 실제로는 셋을 읽고 그중 둘이 없으면 한 행도 못 넣는데도 (결함 53의 계보).
    const { byColumn } = columnRoles(COST)
    expect(byColumn.get("상품번호")?.roles).toContain("listing-key")
    expect(byColumn.get("원가")?.roles).toContain("reference-amount")
    expect(byColumn.get("상품명")?.roles).toContain("listing-title")
    // 안 읽는 열은 정말로 안 읽는다 — 다 읽는 척하지 않는다
    expect(byColumn.has("배송비")).toBe(false)
  })

  it("금액 컬럼은 **어디에 들어가는지**를 사람 말로 말한다", () => {
    const u = columnRoles(COST).byColumn.get("원가")!
    expect(u.target, "코드값(COGS)이 화면에 나가면 안 된다").toBe("매입원가")
    expect(u.required).toBe(true)
    expect(roleWhy(u.roles, true)).toContain("batch가 아니라 이력으로")
  })

  it("역할 이름이 «저장 안 함»으로 떨어지지 않는다", () => {
    expect(roleField(["reference-amount"])).not.toBe("저장 안 함")
  })

  it("★ 적용일을 **묻는다** — 파일에 없는 값이라 지어낼 수 없다 ★", () => {
    const v = vals({ ...EMPTY_WIZARD, analysis: analysisOf(COST, COST_HEADERS), effectiveFrom: "2026-01-01" })
    expect(v.impRefer, "적용일 블록이 안 뜬다").toBe(true)
    expect(v.impReferDate).toBe("2026-01-01")
    expect(v.impReferNote).toContain("매입원가")
    // batch가 아니라는 사실을 말해야 사용자가 「가져오기 기록」에서 헤매지 않는다
    expect(v.impReferNote).toContain("가져오기 기록")
  })

  it("★ 적용일이 비면 못 누른다 — 조용히 오늘로 채우면 그게 지어낸 값이다 ★", () => {
    const a = analysisOf(COST, COST_HEADERS)
    expect(vals({ ...EMPTY_WIZARD, analysis: a, effectiveFrom: "" }).impCanRun).toBe(false)
    expect(vals({ ...EMPTY_WIZARD, analysis: a, effectiveFrom: "2026-3-1" }).impCanRun).toBe(false)
    expect(vals({ ...EMPTY_WIZARD, analysis: a, effectiveFrom: "2026-03-01" }).impCanRun).toBe(true)
  })

  it("★ UPSERT 안내가 기준 데이터에 그대로 뜨지 않는다 — 규칙이 다르다 ★", () => {
    // 사실 경로: 같은 `source_key`면 갱신 · 다시 넣으면 새 batch.
    // 기준 데이터: 키가 (SKU · 종류 · 적용일)이고 같으면 **건너뛴다.**
    // 사실 경로의 문장을 두면 «다시 넣으면 갱신되겠지» 하고 값을 고쳐 다시 넣는데
    // 아무 일도 일어나지 않는다. 화면을 렌더해 보고 잡은 자리다.
    const v = vals({
      ...EMPTY_WIZARD,
      analysis: analysisOf(COST, COST_HEADERS),
      effectiveFrom: "2026-01-01",
    })
    expect(v.impDupNote).not.toContain("source_key")
    expect(v.impDupNote).not.toContain("UPSERT")
    expect(v.impDupNote, "고치는 방법을 말하지 않으면 막다른 문장이다").toContain("적용일을 다르게")
  })

  it("실행 버튼이 **batch라고 말하지 않는다** (LOCK 2·10)", () => {
    const v = vals({ ...EMPTY_WIZARD, analysis: analysisOf(COST, COST_HEADERS), effectiveFrom: "2026-01-01" })
    expect(v.impRunLabel).toBe("확인하고 기준 데이터에 넣기")
  })

  it("★ 사실 파일에는 적용일을 묻지 않는다 — 없는 질문이다 ★", () => {
    // 주문 파일은 행마다 날짜를 들고 온다. 거기 대고 «언제부터»를 물으면
    // 사용자는 그 날짜가 무엇을 덮는지 알 수 없다.
    const a = analysisOf(ESM, ["주문번호", "상품번호", "상품명", "진행상태", "구매금액", "결제일", "주문순번"])
    const v = vals({ ...EMPTY_WIZARD, analysis: a })
    expect(v.impRefer).toBe(false)
    expect(v.impRunLabel).toBe("확인하고 가져오기")
    // 사실 경로의 UPSERT 안내는 **그대로 남아야 한다** — 여기서는 그게 참이다
    expect(v.impDupNote).toContain("UPSERT")
  })
})

describe("기준 데이터 결과 — 못 찾은 것을 실패로 부르지 않는다", () => {
  const base: ReferenceRunResult = {
    inserted: 35,
    skipped: 0,
    replaced: 0,
    unmatched: 171,
    createdSkus: 35,
    badRows: 0,
    excluded: [],
    header: { rowIndex: 0, columns: [], confidence: 1 } as never,
    sheet: { index: 0, name: "상품별원가 raw" } as never,
    warnings: [],
    unmatchedSample: ["A1", "A2", "A3"],
    kind: "COGS",
  }

  it("★ «못 찾음»은 경고색이 아니다 — 정상인 것을 빨갛게 칠하지 않는다 ★", () => {
    const rows = referenceRows(base)
    const miss = rows.find((r) => r.label.includes("아직 판 적이 없어"))
    expect(miss, "못 찾은 건수를 말하지 않는다").toBeDefined()
    expect(miss!.value).toBe("171건")
    expect(miss!.color, "정상인 결과에 오류색을 쓰면 멀쩡한 파일을 고치려 든다").not.toBe(
      "var(--pnl-neg)",
    )
  })

  it("무엇이 안 붙었는지 말한다 — 「171건」만으로는 손댈 수 없다", () => {
    const rows = referenceRows(base)
    expect(rows.some((r) => r.value.includes("A1"))).toBe(true)
  })

  it("★ 읽지 못한 행은 **오류색**이다 — 이건 진짜 결손이다 ★", () => {
    const rows = referenceRows({ ...base, badRows: 4 })
    const bad = rows.find((r) => r.label.includes("금액을 못 읽음"))
    expect(bad?.color).toBe("var(--pnl-neg)")
  })

  it("SKU를 새로 만든 사실을 남긴다 — 되돌릴 수 없는 일이다", () => {
    expect(referenceRows(base).some((r) => r.label.includes("SKU"))).toBe(true)
  })

  it("결과 제목이 종류를 사람 말로 부른다", () => {
    const v = emptyVals()
    importVals(v, {
      ...EMPTY_WIZARD,
      analysis: analysisOf(COST, COST_HEADERS),
      effectiveFrom: "2026-01-01",
      refResult: base,
    })
    expect(v.impDone, "결과 화면이 안 뜬다").toBe(true)
    expect(v.impDigestTitle).toContain("매입원가")
    expect(v.impDigestTitle).toContain("35건")
    // 결과가 나오면 적용일 블록은 물러난다 — 이미 정해진 값을 다시 묻지 않는다
    expect(v.impRefer).toBe(false)
    expect(v.impCanRun).toBe(false)
  })
})
