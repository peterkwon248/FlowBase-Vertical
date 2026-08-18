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

    const vals = emptyVals()
    importVals(vals, { ...EMPTY_WIZARD, analysis: a })
    expect(String(vals.profileMeta), "맞았는데 «없습니다»가 떴다").toContain("일치도")
  })
})
