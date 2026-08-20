/**
 * 원본 표 미리보기(격자) — **행 번호가 파일의 좌표인가.**
 *
 * ─────────────────────────────────────────────────────────────
 * 이 시험이 지키는 것은 「격자가 그려진다」가 아니라 **「지어내지 않는다」**다.
 *
 * `a.sample`은 «파일이 생긴 것»이 아니라 «파이프라인이 본 것»이다 — 헤더 위
 * 제목·헤더·합계·빈 행이 이미 빠져 있다. 그래서 표본을 순서대로 1,2,3…으로
 * 그리면 **파일에 없는 좌표를 만들어내는 것**이고(LOCK 6), 그 거짓말이 실제로
 * 큰 파일이 픽스처 안에 있다(#4 「파워클릭 보고서」 — 표본 17행이 물리 6~65에
 * 흩어져 있고 16~34행이 통째로 비어 있다).
 * ─────────────────────────────────────────────────────────────
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { importVals, EMPTY_WIZARD } from "../src/app/import.js"
import { emptyVals } from "../src/app/generated/vals.js"
import { analyzeImport } from "../src/core/import/analyze.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const read = (n: string): MappingProfile =>
  JSON.parse(readFileSync(`src/packs/kr-marketplace/profiles/${n}`, "utf-8")) as MappingProfile

const PROFILES = [read("esm-order@1.json"), read("esm-powerclick@1.json"), read("cost-master@1.json")]

async function gridOf(fixtureId: number) {
  const f = FIXTURES.find((x) => x.id === fixtureId)!
  const bytes = new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR)))
  const a = await analyzeImport(bytes, f.file, PROFILES)
  const v = emptyVals()
  importVals(v, { ...EMPTY_WIZARD, analysis: a })
  return { a, v }
}

describe("원본 표 미리보기 — 격자", () => {
  it("파일을 안 골랐으면 격자가 없다 — 빈 격자를 그리지 않는다", () => {
    const v = emptyVals()
    importVals(v, EMPTY_WIZARD)
    expect(v.impGrid).toBe(false)
    expect(v.impGridRows).toEqual([])
    expect(v.impGridCols).toEqual([])
    expect(v.impGridNote).toBe("")
  })

  it("★ 행 번호는 파일 좌표다 — 표본의 순서가 아니다 ★", async () => {
    // #12 「일별 매출현황」: 날짜마다 pc/mobile/수기주문 3줄 + 소계 1줄.
    // 소계가 빠지므로 표본의 순서와 파일의 행이 3행째부터 어긋난다.
    const { a, v } = await gridOf(12)
    expect(a.sampleRowIndices.slice(0, 8)).toEqual([3, 4, 5, 7, 8, 9, 11, 12])

    const data = v.impGridRows.filter((r) => r.kind === "" && r.cells.length > 0)
    // 격자의 데이터 행 번호는 **물리 행 + 1**이지 1,2,3…이 아니다.
    expect(data.slice(0, 8).map((r) => r.no)).toEqual(["4", "5", "6", "8", "9", "10", "12", "13"])
    expect(data.map((r) => r.no)).not.toEqual(data.map((_, i) => String(i + 1)))
  })

  it("★ 제외된 행이 제자리에 남는다 — 헌장 C-5 「삭선 + 카운트」 ★", async () => {
    const { v } = await gridOf(12)
    const at = new Map(v.impGridRows.map((r) => [r.no, r]))
    // 7행은 첫 소계다. 사라지지 않고 그 자리에 사유와 함께 있다.
    expect(at.get("7")?.kind).toBe("excl")
    expect(at.get("7")?.note).toBe("합계 행 — 제외")
    // 제외 행은 **내용이 남아 있지 않다** — 자리와 사유만 안다. 지어내지 않는다.
    expect(at.get("7")?.cells).toEqual([])
  })

  it("헤더 행도 제자리에 표시된다 — 「헤더가 몇 행인가」가 파일의 성격을 말한다", async () => {
    const { a, v } = await gridOf(4)
    expect(a.header.rowIndex).toBe(5)
    const head = v.impGridRows.filter((r) => r.kind === "head")
    expect(head).toHaveLength(1)
    expect(head[0]!.no).toBe("6") // 1-기준 — 사용자가 엑셀에서 찾는 좌표
    // 이름은 격자 머리글에 상시 떠 있으므로 셀로 또 그리지 않는다.
    expect(head[0]!.cells).toEqual([])
  })

  it("★ 빈 구간은 접히되 사라지지 않는다 — 「빈 행 19개」 ★", async () => {
    // #4 「파워클릭 보고서」는 표가 아니라 대행사 리포트다 —
    // 작은 표 3개가 19행짜리 빈 구간으로 갈라져 한 시트에 놓여 있다.
    const { v } = await gridOf(4)
    const skips = v.impGridRows.filter((r) => r.kind === "skip")
    expect(skips.length).toBeGreaterThan(0)
    const big = skips.find((r) => r.no === "17–35")
    expect(big).toBeDefined()
    expect(big!.note).toBe("빈 행 19개")
    // 접어도 **센다** — 접힌 것이 몇 행인지 말하지 않으면 조용한 실패다 (LOCK 6)
    for (const s of skips) expect(s.note).toMatch(/빈 행 \d+개/)
  })

  it("★ 격자 범위 안에는 사유 없는 구멍이 없다 — 전 픽스처 ★", async () => {
    for (const f of FIXTURES) {
      const bytes = new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR)))
      const a = await analyzeImport(bytes, f.file, PROFILES)
      const v = emptyVals()
      importVals(v, { ...EMPTY_WIZARD, analysis: a })
      if (!v.impGrid) continue

      // 격자가 말하는 행 번호를 전부 펴서, 첫 행부터 끝까지 빠짐이 없는지 본다.
      const covered = new Set<number>()
      for (const r of v.impGridRows) {
        const m = /^(\d+)(?:–(\d+))?$/.exec(r.no)
        expect(m, `${f.file}: 행 번호 «${r.no}»를 못 읽는다`).not.toBeNull()
        const lo = Number(m![1]), hi = Number(m![2] ?? m![1])
        for (let i = lo; i <= hi; i++) covered.add(i)
        // trailing-blank 한 항목이 N행을 대표하는 경우는 사유 문장이 그 수를 든다.
        const t = /(\d+)행부터 (\d+)행이 비어 있다/.exec(r.note)
        if (t) for (let i = 0; i < Number(t[2]); i++) covered.add(lo + i)
      }
      const lo = Math.min(...covered), hi = Math.max(...covered)
      const holes: number[] = []
      for (let i = lo; i <= hi; i++) if (!covered.has(i)) holes.push(i)
      expect(holes, `${f.file}: 사유 없는 구멍 ${holes.slice(0, 8).join(",")}`).toEqual([])
    }
  }, 120_000)

  it("★ 편집 어포던스가 없다 — 원본 셀은 사실층이다 (LOCK 9 · §21-1) ★", async () => {
    const { v } = await gridOf(12)
    // 격자 값에 핸들러가 하나도 없다. 「못 누르는 칸」조차 그리지 않는다.
    const json = JSON.stringify(v.impGridRows) + JSON.stringify(v.impGridCols)
    expect(json).not.toMatch(/function|=>/)
    for (const r of v.impGridRows) {
      for (const [k, val] of Object.entries(r)) {
        expect(typeof val, `impGridRows.${k}가 함수다`).not.toBe("function")
      }
    }
  })

  it("열 좌표는 엑셀 문자다 — 「3번째 열」이라 하면 파일에서 못 찾는다", async () => {
    const { v } = await gridOf(12)
    expect(v.impGridCols.slice(0, 3).map((c) => c.ref)).toEqual(["A", "B", "C"])
    expect(v.impGridCols[0]!.name).toBe("날짜")
  })

  it("★ 그린 것이 전부가 아니라는 사실을 말한다 (LOCK 6) ★", async () => {
    const { v } = await gridOf(4)
    expect(v.impGridNote).toContain("파일의 6행부터 봅니다")
    expect(v.impGridNote).toContain("이 위에 5행이 더 있습니다")
    expect(v.impGridNote).toContain("전체 행 수는 가져온 뒤에 나옵니다")
  })
})
