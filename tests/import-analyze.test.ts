/**
 * 가져오기 판정 단계 — **넣기 전에 보여줄 것이 다 나오는가.**
 *
 * `runImport`가 «넣는다»면 `analyzeImport`는 «보여준다». 헌장 C-5의 «판정 후보
 * 복수 + 일치도 + 사람 확정»이 성립하려면 후보와 근거가 실제로 나와야 하고,
 * 이 파일이 그걸 확인한다.
 *
 * ★ 겨냥하는 것: 만들어지기만 하고 아무도 안 보던 값들 ★
 * 포맷 후보의 근거 · 확장자 어긋남 · 파서 경고 · 시트 역할과 사유 · 헤더 근거 ·
 * 제외 사유. 전부 파이프라인이 이미 만들고 있었지만 어떤 호출부도 읽지 않았다.
 */

import { describe, expect, it } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { analyzeImport } from "../src/core/import/analyze.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const PROFILE_DIR = "src/packs/kr-marketplace/profiles"
const NAMES = ["11st-settlement@1.json", "coupang-ad-report@1.json", "esm-order@1.json"]

/** CLI에서도 도는 테스트라 레지스트리(`import.meta.glob`) 대신 파일을 읽는다. */
const PROFILES: MappingProfile[] = NAMES.map(
  (n) => JSON.parse(readFileSync(`${PROFILE_DIR}/${n}`, "utf-8")) as MappingProfile,
)

const has = (id: number): boolean => {
  const f = FIXTURES.find((x) => x.id === id)
  return f !== undefined && existsSync(fixturePath(f, CLEAN_DIR))
}
const bytesOf = (id: number): { bytes: Uint8Array; name: string } => {
  const f = FIXTURES.find((x) => x.id === id)!
  return { bytes: new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR))), name: f.file }
}

const ready = [6, 8, 3, 12].every(has)
const run = ready ? describe : describe.skip
if (!ready) console.warn("[import-analyze] fixtures/clean이 없어 건너뛴다")

run("analyzeImport — 넣기 전에 보여준다", () => {
  it("11번가 정산 — 포맷·프로파일·헤더·표본이 다 나온다", async () => {
    const { bytes, name } = bytesOf(6)
    const a = await analyzeImport(bytes, name, PROFILES)

    expect(a.format, "매직 바이트가 정한다 — .xls는 BIFF다").toBe("biff")
    expect(a.formatCandidates.length, "후보는 복수로 준다 (헌장 B-9)").toBeGreaterThan(0)
    expect(a.formatCandidates[0]!.evidence.length, "왜 그렇게 봤는지가 비었다").toBeGreaterThan(0)

    // ★ 판정의 본체 ★ 후보 셋을 다 주고 맞는 것이 1등이어야 한다
    expect(a.profiles.length, "아무 프로파일도 맞지 않는다").toBeGreaterThan(0)
    expect(a.profiles[0]!.profile.marketplaceKey).toBe("11st")
    expect(a.profiles[0]!.evidence.length, "판정 근거가 비었다").toBeGreaterThan(0)

    expect(a.header.rowIndex, "헤더를 찾지 못했다").not.toBeNull()
    expect(a.header.columns).toContain("정산금액")
    expect(a.sample.length, "미리보기 행이 없다").toBeGreaterThan(0)
    // 표본 행의 폭이 헤더 폭과 같다 — 어긋나면 화면이 열을 잘못 붙인다
    expect(a.sample[0]!.length).toBe(a.header.columns.length)
    expect(a.byteLength).toBe(bytes.length)
  })

  it("ESM 주문 — 시트 정보가 §18이 요구하는 것을 담는다", async () => {
    const { bytes, name } = bytesOf(8)
    const a = await analyzeImport(bytes, name, PROFILES)
    expect(a.profiles[0]!.profile.marketplaceKey).toBe("esm")

    const s = a.sheets[a.sheetIndex]!
    expect(s.role, "시트 역할이 없다 (§18-B)").toBeTruthy()
    expect(s.reason, "역할을 그렇게 본 사유가 없다 (§18-B)").toBeTruthy()
    expect(s.physicalRowCount, "물리 행 수").toBeGreaterThan(0)
    expect(s.columnCount).toBeGreaterThan(0)
    // 수식 비율은 **null일 수 있다** — 모르면 모른다고 한다 (§18-A는 null이면 경고하지 않는다)
    expect(s.formulaRatio === null || typeof s.formulaRatio === "number").toBe(true)
  })

  /** ★ §18 — 시트가 여럿이면 사람이 고른다 ★ */
  it("여러 시트 파일 — 전부 나오고 골라서 다시 볼 수 있다", async () => {
    const { bytes, name } = bytesOf(3)
    const a = await analyzeImport(bytes, name, PROFILES)
    expect(a.sheets.length, "이 픽스처는 시트가 여럿이다").toBeGreaterThan(1)
    expect(a.sheetIndex, "기본은 첫 시트").toBe(0)

    // 다른 시트를 고르면 그 시트로 다시 본다. 상태를 들고 있지 않으므로
    // 몇 번을 불러도 같은 답이 나온다
    const b = await analyzeImport(bytes, name, PROFILES, { sheetIndex: 1 })
    expect(b.sheetIndex).toBe(1)
    expect(b.sheets[1]!.name).toBe(a.sheets[1]!.name)
    expect(b.header, "시트가 다르면 헤더도 다르다").not.toEqual(a.header)

    const again = await analyzeImport(bytes, name, PROFILES, { sheetIndex: 1 })
    expect(again.header, "같은 입력에 같은 답").toEqual(b.header)
  })

  /** ★ 확장자와 내용이 어긋나는 파일 — 조용히 넘어가지 않는다 (ADR-002) ★ */
  it("확장자가 거짓말하는 파일에서 그 사실이 나온다", async () => {
    const { bytes, name } = bytesOf(12)
    const a = await analyzeImport(bytes, name, PROFILES)
    expect(name.toLowerCase().endsWith(".xls"), "이 픽스처는 .xls라고 주장한다").toBe(true)
    expect(a.format, "내용은 HTML 표다").toBe("html-table")
    expect(a.identityNotes.length, "어긋남을 말하지 않았다").toBeGreaterThan(0)
  })

  it("맞는 프로파일이 없으면 빈 목록이다 — 억지로 1등을 만들지 않는다", async () => {
    const { bytes, name } = bytesOf(6)
    // 11번가 파일에 쿠팡 광고 프로파일만 준다
    const only = PROFILES.filter((p) => p.marketplaceKey === "coupang")
    const a = await analyzeImport(bytes, name, only)
    expect(a.profiles, "관계없는 프로파일이 붙었다").toHaveLength(0)
    // 그래도 나머지는 다 보여준다 — 왜 못 넣는지 사람이 알아야 한다
    expect(a.header.columns.length).toBeGreaterThan(0)
    expect(a.sample.length).toBeGreaterThan(0)
  })

  it("DB를 건드리지 않는다 — 리포지토리를 받지 않는다", () => {
    // (bytes, fileName, profiles, opts) — 쓰기 대상이 인자에 없다
    expect(analyzeImport.length).toBe(3)
  })
})
