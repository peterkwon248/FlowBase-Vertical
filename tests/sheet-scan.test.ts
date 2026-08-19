/**
 * 전 시트 탐색 — **「이 파일은 넣을 수 없습니다」가 거짓이던 자리.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 무엇이 틀렸었나 ★
 *
 * 판정은 시트 하나(기본 0번)만 보고, 거기서 못 찾으면 이렇게 말했다:
 *
 *   "맞는 매핑 프로파일이 없습니다 — 이 **파일**은 넣을 수 없습니다"
 *
 * 앱이 아는 것은 「이 **시트**에서 못 찾았다」뿐이었다. 데이터가 틀리게 저장되는
 * 게 아니라 **말이 틀렸고**, 그 말 때문에 되는 일을 안 된다고 믿게 만들었다.
 *
 * ★ 사용자 실파일만의 문제가 아니었다 — 커밋된 픽스처가 이미 그랬다 ★
 * ```
 * #3  2026-01 통합 매출 대시보드.xlsx  (19시트)
 *       시트 0 → 후보 0개 → 「넣을 수 없습니다」
 *       시트 6  매출정리 raw → esm/order        100%
 *       시트 11 11_매출정리  → 11st/settlement  100%
 * #9  25년 11월 원본 데이터…      (7시트)
 *       시트 2 · 5가 같은 방식으로 100%
 * ```
 * 확신도가 100%다. 애매해서 못 고른 게 아니라 **안 본 것**이다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { analyzeImport } from "../src/core/import/analyze.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import { importVals, EMPTY_WIZARD, noMatchLine } from "../src/app/import.js"
import { emptyVals } from "../src/app/generated/vals.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"
import { cardSheet, coverSheet, workbookBytes } from "./synth.js"

const PROFILE_DIR = "src/packs/kr-marketplace/profiles"
const NAMES = [
  "11st-settlement@1.json",
  "coupang-ad-report@1.json",
  "coupang-jet@1.json",
  "coupang-order@1.json",
  "esm-order@1.json",
  "esm-powerclick@1.json",
]
const PROFILES: MappingProfile[] = NAMES.map(
  (n) => JSON.parse(readFileSync(`${PROFILE_DIR}/${n}`, "utf-8")) as MappingProfile,
)

/** #3 = 19시트 수제 워크북 (숨은 원본 시트가 둘) · #6 = 11번가 정산 (시트 0이 맞는다) */
const MULTI = FIXTURES.find((f) => f.id === 3)!
const SINGLE = FIXTURES.find((f) => f.id === 6)!
const bytesOf = (f: typeof MULTI): { bytes: Uint8Array; name: string } => ({
  bytes: new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR))),
  name: f.file,
})

const ready = [MULTI, SINGLE].every((f) => existsSync(fixturePath(f, CLEAN_DIR)))
const run = ready ? describe : describe.skip
if (!ready) console.warn("[sheet-scan] fixtures/clean이 없어 건너뛴다")

run("전 시트 탐색 — 앱이 아는 만큼만 말한다", () => {
  it("★ 숨은 시트를 찾아낸다 — 시트 0이 비어도 파일은 넣을 수 있다 ★", async () => {
    const { bytes, name } = bytesOf(MULTI)
    const a = await analyzeImport(bytes, name, PROFILES)

    expect(a.profiles, "이 픽스처는 시트 0에 후보가 없다").toHaveLength(0)
    expect(a.suggestedSheetIndex, "다른 시트에 답이 있는데 못 찾았다").not.toBeNull()

    const hit = a.sheetMatches.find((m) => m.sheetIndex === a.suggestedSheetIndex)
    expect(hit?.profiles[0]?.confidence, "권하는 시트가 확신도 100%가 아니다").toBe(1)
  })

  it("★ 문구가 사실이 된다 — 「이 파일은」이라고 단정하지 않는다 ★", async () => {
    const { bytes, name } = bytesOf(MULTI)
    const a = await analyzeImport(bytes, name, PROFILES)
    const line = noMatchLine(a)

    // 예전 문장은 이 파일에 대해 **거짓**이었다
    expect(line, "「이 파일은 넣을 수 없습니다」는 이 파일에 대해 거짓이다").not.toContain(
      "이 파일은 넣을 수 없습니다",
    )
    expect(line).toContain("이 시트에서는")
    // 그리고 어디로 가야 하는지 말한다
    const hit = a.sheetMatches.find((m) => m.sheetIndex === a.suggestedSheetIndex)!
    expect(line, "어느 시트인지 말하지 않았다").toContain(hit.sheetName)
    expect(line).toContain("100%")
  })

  it("어느 시트에도 없을 때만 «이 파일은»이라고 말한다 — 그때는 참이다", async () => {
    const { bytes, name } = bytesOf(MULTI)
    // 이 워크북과 무관한 프로파일만 준다
    const only = PROFILES.filter((p) => p.marketplaceKey === "coupang")
    const a = await analyzeImport(bytes, name, only)
    const line = noMatchLine(a)

    expect(a.suggestedSheetIndex).toBeNull()
    expect(line).toContain("이 파일은 넣을 수 없습니다")
    // ★ 근거를 함께 말한다 — 실제로 전부 봤기 때문에 할 수 있는 말이다
    expect(line, "몇 장을 봤는지 말하지 않으면 예전 문장과 같다").toContain(
      `${a.sheetMatches.length}개 시트를 모두 살펴봤`,
    )
  })

  it("시트가 하나뿐이면 「시트」를 말하지 않는다 — 파일과 같은 말이라 군더더기다", async () => {
    const { bytes, name } = bytesOf(SINGLE)
    const only = PROFILES.filter((p) => p.marketplaceKey === "coupang")
    const a = await analyzeImport(bytes, name, only)

    expect(a.sheets.length).toBe(1)
    expect(noMatchLine(a)).toBe("맞는 매핑 프로파일이 없습니다 — 이 파일은 넣을 수 없습니다")
  })

  it("★ 시트 목록이 「여기 맞는다」를 말한다 — 19번 눌러 보게 하지 않는다 ★", async () => {
    const { bytes, name } = bytesOf(MULTI)
    const a = await analyzeImport(bytes, name, PROFILES)
    const vals = emptyVals()
    importVals(vals, { ...EMPTY_WIZARD, analysis: a })

    const sheets = vals.impSheets as readonly { label: string; note: string }[]
    expect(sheets.length).toBe(a.sheets.length)

    const marked = sheets.filter((s) => s.note.includes("★"))
    expect(marked.length, "맞는 시트가 목록에서 표시되지 않았다").toBeGreaterThan(0)
    // 표시된 시트는 실제로 맞는 시트여야 한다
    const hitNames = a.sheetMatches
      .filter((m) => m.profiles.some((p) => p.blockedBy === undefined))
      .map((m) => m.sheetName)
    for (const s of marked) expect(hitNames).toContain(s.label)
  })

  it("잘 고른 사람에게는 딴 데를 가리키지 않는다", async () => {
    const { bytes, name } = bytesOf(SINGLE)
    const a = await analyzeImport(bytes, name, PROFILES)
    expect(a.profiles.length).toBeGreaterThan(0)
    expect(a.suggestedSheetIndex).toBeNull()
    expect(a.autoSelected, "맞는 시트에서 자동 이동이 일어났다").toBeNull()

    const vals = emptyVals()
    importVals(vals, { ...EMPTY_WIZARD, analysis: a })
    expect(String(vals.profileMeta), "맞았는데 «없습니다»가 떴다").toContain("일치도")
  })
})

/**
 * ★ 자동 시트 선택 (ADR-019) — 「고르세요」가 말이 아니라 손이 된다 ★
 *
 * 실물: 15시트 단가표의 0번이 표지(「공유정보」)라 사용자가 이메일·img 태그를
 * 미리보기로 봤다. 1~14번은 전부 100%로 맞는데, 앱은 「아래에서 그 시트를
 * 고르세요」라고 말만 했다. 이제 시트를 지정하지 않은 분석은 그 시트를 **연다.**
 *
 * 실파일은 사업 데이터라 커밋하지 않는다 — 같은 구조(표지+카드 시트)를 합성한다.
 */
const COST_CARD = JSON.parse(
  readFileSync(`${PROFILE_DIR}/cost-card@1.json`, "utf-8"),
) as MappingProfile

const coverAndCards = (): Uint8Array =>
  workbookBytes([
    ["공유정보", coverSheet],
    ["충전기", cardSheet(["워치독", "MW-DOC", 9200], ["무선충전", "M-DOC", 13300])],
    ["계절상품", cardSheet(["쿨매트", "CM-1", 7700], ["손선풍기", "HF-2", 3300])],
  ])

describe("자동 시트 선택 (ADR-019)", () => {
  it("★ 표지 파일 — 시트를 지정하지 않으면 맞는 시트를 열어준다 ★", async () => {
    const a = await analyzeImport(coverAndCards(), "단가표.xlsx", [COST_CARD])

    expect(a.sheetIndex, "표지(0번)에 머물렀다").toBe(1)
    expect(a.autoSelected, "옮겼다는 사실이 남지 않았다 (LOCK 6)").toEqual({ from: 0, to: 1 })
    expect(a.profiles[0]?.profile.id).toBe("seller/cost/card")
    // 이동의 흔적은 autoSelected가 단독으로 든다 — 매칭이 생겼으니 제안은 없다
    expect(a.suggestedSheetIndex).toBeNull()
  })

  it("명시적으로 고른 시트는 옮기지 않는다 — 표지를 골랐으면 표지를 보여준다", async () => {
    const a = await analyzeImport(coverAndCards(), "단가표.xlsx", [COST_CARD], { sheetIndex: 0 })

    expect(a.sheetIndex).toBe(0)
    expect(a.autoSelected).toBeNull()
    // 「저기 있다」는 제안 경로가 그대로 산다 — pickSheet가 실존하므로 시험도 실존한다
    expect(a.suggestedSheetIndex).toBe(1)
    expect(noMatchLine(a)).toContain("아래에서 그 시트를 고르세요")
  })

  it("0번 시트가 비어 있어도 분석이 죽지 않는다 — 맞는 시트로 살린다", async () => {
    const bytes = workbookBytes([
      ["빈시트", [[]]],
      ["충전기", cardSheet(["워치독", "MW-DOC", 9200], ["무선충전", "M-DOC", 13300])],
    ])
    const a = await analyzeImport(bytes, "단가표.xlsx", [COST_CARD])
    expect(a.sheetIndex).toBe(1)
    expect(a.autoSelected).toEqual({ from: 0, to: 1 })
  })

  it("★ 화면이 옮겼다는 사실을 말한다 — 어디서 어디로, 무슨 근거로 (LOCK 6) ★", async () => {
    const a = await analyzeImport(coverAndCards(), "단가표.xlsx", [COST_CARD])
    const vals = emptyVals()
    importVals(vals, { ...EMPTY_WIZARD, analysis: a })

    const note = String(vals.impSheetAutoNote)
    expect(note, "출발 시트가 없다").toContain("공유정보")
    expect(note, "도착 시트가 없다").toContain("충전기")
    expect(note, "근거(양식 이름)가 없다").toContain("상품별 단가표")
    // 옮기지 않았으면 침묵한다 — 빈 고지가 자리만 차지하면 안 된다
    const b = await analyzeImport(coverAndCards(), "단가표.xlsx", [COST_CARD], { sheetIndex: 1 })
    const vals2 = emptyVals()
    importVals(vals2, { ...EMPTY_WIZARD, analysis: b })
    expect(vals2.impSheetAutoNote).toBe("")
  })
})

/** §18-A 가드는 실픽스처 #3(파생 시트가 실존)이 필요하다 — 픽스처 가드를 같이 쓴다. */
run("자동 시트 선택 — §18-A 가드", () => {
  it("★ 파생으로 보이는 fact 시트로는 옮기지 않는다 ★", async () => {
    // 픽스처 #3의 제안 시트는 esm/order 100%지만 **수식 77%** — 다른 시트에서
    // 계산된 결과다. 사실로 넣으면 매출이 두 번 계산되는 바로 그 자리라,
    // §18-A 경고 UI가 서기 전까지 자동 이동은 여기서 멈춘다. 말(제안)은 그대로 한다.
    const { bytes, name } = bytesOf(MULTI)
    const a = await analyzeImport(bytes, name, PROFILES)

    expect(a.suggestedSheetIndex, "제안 자체는 살아 있어야 한다").not.toBeNull()
    const target = a.sheets[a.suggestedSheetIndex!]!
    expect(
      target.formulaRatio !== null && target.formulaRatio > 0.5,
      "전제 확인 — 이 픽스처의 제안 시트는 수식이 절반을 넘어야 한다",
    ).toBe(true)

    expect(a.sheetIndex, "파생 시트로 자동 이동했다 (§18-A)").toBe(0)
    expect(a.autoSelected).toBeNull()
  })
})
