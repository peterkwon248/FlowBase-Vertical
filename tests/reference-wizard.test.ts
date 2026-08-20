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
import { importVals, referenceRows, refTargetSheets, refBlockedSheetCount, roleField, roleWhy, EMPTY_WIZARD } from "../src/app/import.js"
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
    autoSelected: null,
    header: { rowIndex: 0, columns: [...headers], confidence: 1 },
    sample: [["A1", "머그컵", "M-1", "3200", "0", "주방", "M-1"]],
    // 표본 행의 **물리 행 번호**. 격자가 이걸로 파일 좌표를 그린다 — 헤더가 0행이니
    // 첫 데이터 행은 1행이다. 없으면 그 행은 격자에 서지 않는다.
    sampleRowIndices: [1],
    sampleExcluded: [],
    columns: [],
    judge: { verdicts: [], tierCounts: { alias: 0, identity: 0, candidate: 0, unknown: 0 } },
    identities: [],
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

  it("★ 결과가 나오면 «멈출 수 있다» 경고를 내린다 — 기준 경로는 digest가 아니라 refResult다 ★", () => {
    // 기준 경로는 digest를 끝내 안 채운다. digest만 보면 13MB 단가표의 결과
    // 화면 위에 프리즈 경고가 영영 남는다 (ADR-019에서 잡은 결함).
    const a = analysisOf(COST, COST_HEADERS)
    const running = vals({ ...EMPTY_WIZARD, analysis: a, bigFile: true })
    expect(running.impBig, "실행 전에는 떠야 한다").toBe(true)
    const done = vals({
      ...EMPTY_WIZARD,
      analysis: a,
      bigFile: true,
      refResult: {
        inserted: 1, skipped: 0, replaced: 0, unmatched: 0, createdSkus: 0, badRows: 0,
        excluded: [], warnings: [], unmatchedSample: [], stashed: 0, bridged: 0, kind: "COGS",
        perSheet: [], conflicts: [], conflictCount: 0,
      } as never,
    })
    expect(done.impBig, "결과가 나왔는데 경고가 남았다").toBe(false)
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
    warnings: [],
    unmatchedSample: ["A1", "A2", "A3"],
    stashed: 171,
    bridged: 0,
    kind: "COGS",
    perSheet: [],
    conflicts: [],
    conflictCount: 0,
  }

  it("★ «못 찾음»은 경고색이 아니다 — 정상인 것을 빨갛게 칠하지 않는다 ★", () => {
    const rows = referenceRows(base)
    const miss = rows.find((r) => r.label.includes("상품을 아직 못 찾음"))
    expect(miss, "못 찾은 건수를 말하지 않는다").toBeDefined()
    expect(miss!.value).toBe("171건")
    expect(miss!.color, "정상인 결과에 오류색을 쓰면 멀쩡한 파일을 고치려 든다").not.toBe(
      "var(--pnl-neg)",
    )
  })

  /**
   * ★ 「팔리면 그때 붙습니다」는 **거짓이었다** (2026-08-20) ★
   * 매출 파일을 나중에 넣어도 `run.ts`는 `pending_cost`를 다시 훑지 않는다.
   * 그 문장을 읽은 사용자는 **영영 안 오는 것을 기다린다.** 다시 들어오면 붉어진다.
   */
  it("★ 기다리면 저절로 붙는다고 말하지 않는다 ★", () => {
    const labels = referenceRows(base).map((r) => r.label).join("\n")
    expect(labels, "자동으로 붙는 것처럼 말한다").not.toMatch(/팔리면 그때|기다리면|나중에 붙/)
  })

  /**
   * 대기실은 **사람이 눌러야** 비워진다(ADR-016). 어디를 눌러야 하는지 말하지 않으면
   * 「171건」은 손댈 수 없는 수다. 시트가 하나뿐이면 시트별 절이 안 나와서
   * 이 수가 화면에서 통째로 사라지고 있었다.
   */
  it("★ 대기실 건수와 갈 곳을 합계에서 말한다 (시트 1개여도) ★", () => {
    const rows = referenceRows(base)
    const stash = rows.find((r) => r.label.includes("대기실"))
    expect(stash, "대기실에 넣어 둔 건수를 합계에서 말하지 않는다").toBeDefined()
    expect(stash!.value).toBe("171건")
    expect(stash!.label, "어느 화면으로 가야 하는지 말하지 않는다").toMatch(/원가 대기/)
  })

  /**
   * 「상품번호」라고 부르면 안 된다 — 카드형 단가표의 다리는 **품명**이라
   * 그 파일에는 상품번호 열이 아예 없다. 없는 열 이름으로 사람을 헤매게 한다.
   */
  it("★ 없는 열 이름(「상품번호」)으로 부르지 않는다 ★", () => {
    const labels = referenceRows({ ...base, badRows: 3 }).map((r) => r.label).join("\n")
    expect(labels, "이 파일에 없는 열 이름을 부른다").not.toMatch(/상품번호/)
  })

  /**
   * 넣기 **전**에만 말하던 문장이다(`impRefer`의 조건이 `refResult === null`).
   * 정작 「기록에 없네?」를 겪는 시점은 결과가 뜬 **뒤**다.
   * 대기목록 8(파일 접수 장부)이 닫히면 이 줄과 이 시험을 함께 지운다.
   */
  it("★ 결과 화면이 「기록에 안 남는다」를 말한다 ★", () => {
    const labels = referenceRows(base).map((r) => r.label).join("\n")
    expect(labels, "넣고 나서 기록에서 찾을 사람에게 아무 말도 안 한다").toMatch(
      /「가져오기 기록」에 남지 않습니다/,
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

  it("★ 실패한 시트는 빨갛게, 사유와 함께 — warnings에 묻으면 아무도 못 본다 ★", () => {
    const rows = referenceRows({
      ...base,
      perSheet: [
        { sheetIndex: 0, sheetName: "공유정보", inserted: 0, skipped: 0, replaced: 0, unmatched: 0, stashed: 0, bridged: 0, createdSkus: 0, badRows: 0, excludedCount: 0, failed: "블록을 찾지 못했다" },
        { sheetIndex: 1, sheetName: "충전기", inserted: 35, skipped: 0, replaced: 0, unmatched: 171, stashed: 171, bridged: 0, createdSkus: 35, badRows: 0, excludedCount: 0, failed: null },
      ],
    })
    const failed = rows.find((r) => r.label.includes("넣지 못함"))
    expect(failed, "실패 시트가 다이제스트에 없다").toBeDefined()
    expect(failed!.label).toContain("공유정보")
    expect(failed!.value).toContain("블록을 찾지 못했다")
    expect(failed!.color).toBe("var(--pnl-neg)")
    // 성공한 시트도 시트별 줄이 선다 — 「어느 시트가 몇 건」이 사라지지 않는다
    const ok = rows.find((r) => r.label.includes("「충전기」"))
    expect(ok?.value).toContain("반영 35")
  })

  it("★ 시트 간 금액 충돌 — 몇 건인지와 어느 값이 남았는지를 말한다 ★", () => {
    const rows = referenceRows({
      ...base,
      conflictCount: 2,
      conflicts: [
        { where: "pending", key: "쿨매트", prior: 7700, next: 8800, kept: 8800 },
        { where: "cost", key: "워치독", prior: 9200, next: 9900, kept: 9200 },
      ],
    })
    const head = rows.find((r) => r.label.includes("다른 금액"))
    expect(head, "충돌 건수가 다이제스트에 없다").toBeDefined()
    expect(head!.value).toBe("2건")
    const sample = rows.find((r) => r.label.includes("어긋난 자리"))
    expect(sample!.value).toContain("쿨매트")
    expect(sample!.value).toContain("8,800원 남음")
  })
})

/**
 * ★ 「일치한 시트 전부 넣기」 — 기본 체크된 초안 (ADR-019 B4 · §18-B) ★
 *
 * 사건 파일은 같은 양식으로 100% 매칭된 카드 시트가 14장이었다 — 시트 하나씩
 * 14번 넣는 것이 유일한 길이었다. 토글은 «자동 판정 결과를 체크 상태의 초안으로
 * 제시하고, 확정은 사람이 누른다»는 §18-B의 이행이다.
 */
describe("일치한 시트 전부 넣기 — 대상 계산과 토글", () => {
  const COST_HIT = { profile: COST, confidence: 1, evidence: [] }
  const ESM_HIT = { profile: ESM, confidence: 1, evidence: [] }
  const COST_BLOCKED = { profile: COST, confidence: 1, evidence: [], blockedBy: { missingCaptures: ["기간"] } }

  /** 시트 4장: 0 = 고른 원가 · 1 = 같은 양식 · 2 = 다른 양식이 1순위 · 3 = 같은 양식이지만 막힘 */
  const multiA = (): ImportAnalysis => {
    const a = analysisOf(COST, COST_HEADERS)
    return {
      ...a,
      sheets: [
        { index: 0, name: "원가A", physicalRowCount: 100, columnCount: 7, reason: "100행", formulaRatio: null },
        { index: 1, name: "원가B", physicalRowCount: 90, columnCount: 7, reason: "90행", formulaRatio: null },
        { index: 2, name: "매출", physicalRowCount: 80, columnCount: 7, reason: "80행", formulaRatio: null },
        { index: 3, name: "막힘", physicalRowCount: 70, columnCount: 7, reason: "70행", formulaRatio: null },
      ],
      sheetMatches: [
        { sheetIndex: 0, sheetName: "원가A", profiles: a.profiles },
        { sheetIndex: 1, sheetName: "원가B", profiles: [COST_HIT] },
        // 다른 양식이 더 높은 순위 — 같은 양식이 2순위로 붙어 있어도 쓸려 들어가면 안 된다
        { sheetIndex: 2, sheetName: "매출", profiles: [ESM_HIT, COST_HIT] },
        { sheetIndex: 3, sheetName: "막힘", profiles: [COST_BLOCKED] },
      ],
    } as unknown as ImportAnalysis
  }

  it("★ 대상 = 고른 시트 + 1순위가 같은 양식인 시트뿐 — 오름차순 ★", () => {
    const a = multiA()
    expect(refTargetSheets(a, COST.id)).toEqual([0, 1])
    // 같은 양식인데 파일명 문제로 막힌 시트는 세어 말한다 — 조용히 사라지지 않는다
    expect(refBlockedSheetCount(a, COST.id)).toBe(1)
  })

  it("토글과 버튼이 개수를 말한다 — 끄면 고른 시트 하나 (현행과 동일)", () => {
    const on = vals({ ...EMPTY_WIZARD, analysis: multiA(), effectiveFrom: "2026-01-01" })
    expect(on.impAllSheets).toBe(true)
    expect(on.impAllSheetsLabel).toContain("2개 전부 넣기")
    expect(on.impAllSheetsLabel, "막힌 시트를 말하지 않는다").toContain("빠진 시트 1개")
    expect(on.impRunLabel).toBe("확인하고 기준 데이터에 넣기 — 2개 시트")

    const off = vals({ ...EMPTY_WIZARD, analysis: multiA(), effectiveFrom: "2026-01-01", allSheets: false })
    expect(off.impAllSheets).toBe(false)
    expect(off.impRunLabel).toBe("확인하고 기준 데이터에 넣기")
  })

  it("결과가 나오면 토글은 숨는다 — 적용일 입력과 같은 패턴", () => {
    const done: ReferenceRunResult = {
      inserted: 1, skipped: 0, replaced: 0, unmatched: 0, createdSkus: 0, badRows: 0,
      excluded: [], warnings: [], unmatchedSample: [], stashed: 0, bridged: 0,
      kind: "COGS", perSheet: [], conflicts: [], conflictCount: 0,
    }
    const v = vals({
      ...EMPTY_WIZARD,
      analysis: multiA(),
      effectiveFrom: "2026-01-01",
      refResult: done,
    })
    expect(v.impAllSheetsLabel).toBe("")
  })

  it("사실(fact) 경로에는 토글이 없다 — 이 결정은 기준 경로 한정이다 (ADR-019)", () => {
    const a = analysisOf(ESM, ["주문번호", "상품번호", "상품명", "진행상태", "구매금액", "결제일", "주문순번"])
    const v = vals({ ...EMPTY_WIZARD, analysis: a })
    expect(v.impAllSheetsLabel).toBe("")
  })

  it("매칭 시트가 하나뿐이면 토글이 없다 — 물을 것이 없다", () => {
    const v = vals({ ...EMPTY_WIZARD, analysis: analysisOf(COST, COST_HEADERS), effectiveFrom: "2026-01-01" })
    expect(v.impAllSheetsLabel).toBe("")
    expect(v.impRunLabel).toBe("확인하고 기준 데이터에 넣기")
  })
})
