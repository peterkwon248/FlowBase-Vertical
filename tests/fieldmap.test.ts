/**
 * 필드 매핑 화면 — **양식 사전이 화면에 서고(B1), 고른 것이 저장으로 간다(B2).**
 *
 * B1: 읽기 배선. B2: 드롭다운 초안·잠금·확인 배너. §20 게이트 안의 것(diff*·cf*)은
 * 여기 없다 — 게이트 준수는 wiring 컷이 기계적으로 지킨다.
 */

import { describe, expect, it } from "vitest"
import { fieldmapVals, fieldOptions, parsePick, type FieldmapActions, type FieldmapForm, type FieldmapView } from "../src/app/fieldmap.js"
import { importVals, EMPTY_WIZARD } from "../src/app/import.js"
import { emptyVals } from "../src/app/generated/vals.js"
import { loadProfiles } from "../src/packs/kr-marketplace/profiles/index.js"
import { profileVersion } from "../src/core/import/mapping/index.js"
import { buildAliasIndex, judgeColumns } from "../src/core/import/judge.js"
import type { ColumnSighting } from "../src/core/import/columns.js"
import type { ImportAnalysis } from "../src/core/import/analyze.js"

const PROFILES = loadProfiles()
const P11 = PROFILES.find((p) => p.id === "11st/settlement/order-line")!

const col = (ordinal: number, header: string, kind: ColumnSighting["kind"], sample = "표본"): ColumnSighting => ({
  ordinal,
  header,
  sample,
  kind,
  confidence: 0.9,
  reason: "t",
})

const builtin = (columns: ColumnSighting[] = []): FieldmapForm => ({
  key: profileVersion(P11),
  name: `${P11.displayName} · ${P11.label}`,
  marketplaceKey: P11.marketplaceKey,
  docType: P11.docType,
  dest: P11.targetTable,
  source: "builtin",
  seenCount: columns.length > 0 ? 1 : 0,
  lastSeenAt: columns.length > 0 ? "2026-08-18T00:00:00" : null,
  columns,
  judge: null,
  profile: P11,
})

const unknownForm = (columns: ColumnSighting[]): FieldmapForm => ({
  key: "file:hash:0",
  name: "모르는파일.xlsx — Sheet1",
  marketplaceKey: "?",
  docType: "?",
  dest: "미정",
  source: "unknown",
  seenCount: 2,
  lastSeenAt: "2026-08-19T00:00:00",
  columns,
  judge: judgeColumns(columns, buildAliasIndex(PROFILES)),
  profile: null,
})

const render = (view: FieldmapView, sel: string | null = null) => {
  const vals = emptyVals()
  fieldmapVals(vals, view, sel)
  return vals
}

describe("양식 목록", () => {
  it("내장과 미확인이 한 목록에 서고, 배지는 미확인 수다", () => {
    const v = render({ forms: [builtin(), unknownForm([col(0, "완전 미지의 열", "text")])] })
    expect(v.fmList).toHaveLength(2)
    expect((v.fmList[0] as { state: string }).state).toBe("내장")
    expect((v.fmList[1] as { state: string }).state).toBe("미확인")
    expect(v.fmBadge).toBe("1")
  })

  it("미확인이 없으면 배지가 없다 — 0을 달지 않는다", () => {
    expect(render({ forms: [builtin()] }).fmBadge).toBe("")
  })

  it("목격 통계가 사람 말로 붙는다 · 없으면 없다고 말한다", () => {
    const v = render({ forms: [builtin([col(0, "주문번호", "identifier")]), builtin()] })
    expect((v.fmList[0] as { meta: string }).meta).toContain("본 파일 1")
    expect((v.fmList[1] as { meta: string }).meta).toBe("아직 파일을 본 적 없음")
  })
})

describe("내장 양식의 표 — 선언이 우선이다", () => {
  it("★ 위저드 확인 표와 같은 어휘 — conf는 «선언»이지 %가 아니다 ★", () => {
    const v = render({ forms: [builtin([col(0, "주문번호", "identifier"), col(1, "낯선열", "text")])] })
    const rows = v.fmCols as { header: string; field: string; conf: string; why: string }[]
    expect(rows[0]!.field).toBe("order_source_key")
    expect(rows[0]!.conf).toBe("선언")
    expect(rows[1]!.conf).toBe("—")
    expect(rows[1]!.why).toContain("쓰지 않는 컬럼")
  })

  it("목격이 없으면 선언만으로 표를 그린다 — 빈 화면이 아니다", () => {
    const v = render({ forms: [builtin()] })
    expect((v.fmCols as unknown[]).length).toBeGreaterThan(5)
    expect(v.fmSummary).toContain("선언")
  })
})

describe("미확인 양식의 표 — 판정 4단이 말한다 (ADR-017)", () => {
  it("★ 별칭 확정 열은 target과 문장을 들고, 요약이 4단을 센다 ★", () => {
    const v = render(
      { forms: [unknownForm([col(0, "정산금액", "number"), col(1, "낯선열", "text")])] },
      "file:hash:0",
    )
    const rows = v.fmCols as { field: string; conf: string; why: string }[]
    expect(rows[0]!.field).toBe("net_amount")
    expect(rows[0]!.conf).toBe("확정")
    expect(rows[0]!.why).toContain("net_amount")
    expect(rows[1]!.conf).toBe("모름")
    expect(v.fmSummary).toBe("확정 1 · 증명 0 · 후보 0 · 모름 1")
    expect(v.fmWarn, "미확인 양식인데 경고 배너가 없다").toBe(true)
  })

  it("여러 뜻인 이름은 후보들이 «?»로 나열된다 — 하나를 고르지 않는다", () => {
    const v = render({ forms: [unknownForm([col(0, "구매금액", "number")])] }, "file:hash:0")
    const row = (v.fmCols as { field: string; conf: string }[])[0]!
    expect(row.conf).toBe("후보")
    expect(row.field).toContain("?")
    expect(row.field).toContain("total_amount")
  })
})

describe("드롭다운 — 등록부의 뜻풀이 (B2가 켤 완성본)", () => {
  it("현재 값 + 뜻풀이 26종 + «쓰지 않음»이 전부 있다", () => {
    const opts = fieldOptions(["order_source_key"])
    expect(opts).toContain("order_source_key")
    expect(opts.some((o) => o.startsWith("total_amount — "))).toBe(true)
    expect(opts).toContain("이 열은 쓰지 않음")
    expect(opts.filter((o) => o.includes(" — ")).length).toBeGreaterThanOrEqual(26)
  })
})

describe("B2 — 초안·잠금·확인 배너", () => {
  const draw = (draft: ReadonlyMap<string, string | null>, act?: Partial<FieldmapActions>) => {
    const vals = emptyVals()
    fieldmapVals(
      vals,
      { forms: [builtin()] },
      null,
      { pick: () => {}, onPick: () => {}, confirm: () => {}, ...act },
      draft,
    )
    return vals
  }

  it("드롭다운 값 해석 — 등록부에 있는 것만 초안이 된다 (parsePick)", () => {
    expect(parsePick("total_amount — 주문 총액 — 구매자가 결제한 금액")).toEqual({
      kind: "target",
      target: "total_amount",
    })
    expect(parsePick("이 열은 쓰지 않음")).toEqual({ kind: "none" })
    expect(parsePick("저장 안 함")).toEqual({ kind: "none" })
    expect(parsePick("행 식별에 참여")).toEqual({ kind: "ignore" })
    expect(parsePick("totl_amount — 오타")).toEqual({ kind: "ignore" })
  })

  it("★ 구조 역할 열은 잠기고, field뿐인 열과 미매핑 열은 산다 ★", () => {
    const vals = draw(new Map())
    const rows = vals.fmCols as { header: string; locked: boolean }[]
    const by = new Map(rows.map((r) => [r.header, r.locked]))
    expect(by.get("주문번호"), "행 식별 키인데 드롭다운이 살아 있다").toBe(true)
    expect(by.get("상품번호"), "리스팅 키인데 드롭다운이 살아 있다").toBe(true)
    expect(by.get("정산확정일")).toBe(false)
  })

  it("초안이 있는 행은 고른 값과 «고침»을 그리고, 배너가 개수와 뜻을 말한다", () => {
    const vals = draw(new Map([["선결제배송비", "vat_amount"]]))
    const row = (vals.fmCols as { header: string; field: string; conf: string }[]).find(
      (r) => r.header === "선결제배송비",
    )!
    expect(row.conf).toBe("고침")
    expect(row.field).toContain("vat_amount — ")
    expect(vals.fmWarn).toBe(true)
    expect(vals.fmWarnText).toContain("1건")
    expect(vals.fmConfirmable).toBe(true)
  })

  it("«쓰지 않음» 초안은 그 낱말 그대로 그린다", () => {
    const vals = draw(new Map([["선결제배송비", null]]))
    const row = (vals.fmCols as { header: string; field: string }[]).find(
      (r) => r.header === "선결제배송비",
    )!
    expect(row.field).toBe("이 열은 쓰지 않음")
  })

  it("★ 최소 한 벌이 깨지는 초안 — 버튼은 죽고 배너가 이유를 말한다 (LOCK 6) ★", () => {
    const vals = draw(
      new Map([
        ["정산확정일", null],
        ["송금완료일", null],
      ]),
    )
    expect(vals.fmConfirmable).toBe(false)
    expect(vals.fmWarnText).toContain("저장할 수 없습니다")
    expect(vals.fmWarnText).toContain("날짜")
  })

  it("초안이 없으면 배너도 없다 — 내장 양식의 평상시", () => {
    const vals = draw(new Map())
    expect(vals.fmWarn).toBe(false)
    expect(vals.fmConfirmable).toBe(false)
  })

  it("미확인 양식은 동결 문구가 그대로 서고 확인 버튼은 없다 (v1 컷)", () => {
    const vals = emptyVals()
    fieldmapVals(vals, { forms: [unknownForm([col(0, "낯선열", "text")])] }, "file:hash:0")
    expect(vals.fmWarn).toBe(true)
    expect(vals.fmWarnText).toContain("아직 확인되지 않았습니다")
    expect(vals.fmConfirmable).toBe(false)
    // 파생의 발판이 없다 — 드롭다운도 전부 잠긴다.
    expect((vals.fmCols as { locked: boolean }[]).every((r) => r.locked)).toBe(true)
  })

  it("내 확정판은 목록에서 «내 확정»으로 선다", () => {
    const mine: FieldmapForm = { ...builtin(), key: "11st/settlement/order-line@u1", source: "user" }
    const vals = emptyVals()
    fieldmapVals(vals, { forms: [mine] }, null)
    expect((vals.fmList[0] as { state: string; src: string }).state).toBe("내 확정")
    expect(vals.fmSrc).toContain("내 확정판")
  })
})

describe("위저드 확인 표 — 프로파일이 없으면 판정이 말한다", () => {
  it("★ «판정하지 못했다» 전열 대신, 아는 열은 아는 만큼 말한다 ★", () => {
    const cols = [col(0, "정산금액", "number"), col(1, "처음 보는 열", "text")]
    const a = {
      fileName: "미지.xlsx",
      byteLength: 10,
      format: "xlsx",
      identityNotes: [],
      sheets: [{ index: 0, name: "S", physicalRowCount: 9, columnCount: 2, reason: "9행", formulaRatio: null }],
      sheetIndex: 0,
      sheetMatches: [],
      suggestedSheetIndex: null,
      autoSelected: null,
      header: { rowIndex: 0, columns: ["정산금액", "처음 보는 열"], confidence: 1 },
      sample: [["1000", "x"]],
      sampleRowIndices: [1],
      sampleExcluded: [],
      columns: cols,
      judge: judgeColumns(cols, buildAliasIndex(PROFILES)),
      identities: [],
      profiles: [],
    } as unknown as ImportAnalysis
    const v = emptyVals()
    importVals(v, { ...EMPTY_WIZARD, analysis: a })
    const rows = v.colRows as { field: string; conf: string; why: string }[]
    expect(rows[0]!.conf).toBe("확정")
    expect(rows[0]!.field).toBe("net_amount")
    expect(rows[1]!.conf).toBe("모름")
    // 판정 요약이 «맞는 양식 없음» 줄에 붙는다 — 새 마크업 없이
    expect(v.profileMeta).toContain("열 판정: 확정 1")
  })
})
