/**
 * 열 판정 4단 (계획 A · ADR-017) — **이름은 좁히고 값이 확정한다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 파일이 지키는 것 ★
 *
 * ① 충돌 실측의 재현 — 「구매금액」은 esm 주문에서 total_amount, esm 광고에서
 *    conversion_amount다. 전역 사전이 위험한 이유 그 자체이고, 판정은 이걸
 *    후보로 내려 사람에게 보내야 한다. 확정하면 광고 전환매출이 매출로 들어간다.
 * ② 값 게이트 — 별칭이 유일해도 kind가 어긋나면 후보다 (§20 2층).
 * ③ 색인은 저장이 아니라 유도다 — 프로파일이 곧 씨앗이고 출처가 하나다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { buildAliasIndex, judgeColumns } from "../src/core/import/judge.js"
import { IDENTITY_TEMPLATES, TARGETS, targetSpec } from "../src/core/import/mapping/targets.js"
import { loadProfiles } from "../src/packs/kr-marketplace/profiles/index.js"
import type { ColumnSighting } from "../src/core/import/columns.js"

const INDEX = buildAliasIndex(loadProfiles())

const col = (
  header: string,
  kind: ColumnSighting["kind"] = "number",
  ordinal = 0,
): ColumnSighting => ({
  ordinal,
  header,
  sample: kind === "null" ? null : "표본",
  kind,
  confidence: 0.9,
  reason: "테스트",
})

const one = (s: ColumnSighting) => judgeColumns([s], INDEX).verdicts[0]!

describe("별칭 색인 — 프로파일에서 유도한다 (저장 0)", () => {
  it("실측 규모가 나온다 — 헤더 수십 종이 실린다", () => {
    // 프로파일 9장에서 유도. 정확한 수는 프로파일이 늘면 함께 는다 — 하한만 잡는다.
    expect(INDEX.byHeader.size).toBeGreaterThanOrEqual(40)
  })

  it("★ 한 이름의 여러 쓰임이 **전부** 실린다 — columnRoles의 병합이 잃던 것 ★", () => {
    // 「구매금액」 하나가 **네 뜻**이다: esm 주문의 total_amount · 같은 파일 품목의
    // gross_amount · 클레임 경로의 amount · esm 광고의 conversion_amount.
    // columnRoles는 병합해서 하나만 남긴다(그 화면 질문에는 맞다). 색인은 선언을
    // 직접 걸어 넷 다 든다 — 이 넷이 곧 «전역 사전 금지»의 실측 증거다.
    const e = INDEX.byHeader.get("구매금액")!
    expect(new Set(e.map((x) => x.target))).toEqual(
      new Set(["total_amount", "gross_amount", "amount", "conversion_amount"]),
    )
  })
})

describe("★ 충돌 — 같은 이름이 여러 뜻이면 확정하지 않는다 ★", () => {
  it("「구매금액」은 후보다 — 두 뜻을 전부 들고 사람에게 간다", () => {
    const v = one(col("구매금액"))
    expect(v.tier).toBe("candidate")
    expect(v.target, "여러 뜻인데 하나를 골랐다 — 광고 전환매출이 매출이 된다").toBeNull()
    expect(v.candidates).toContain("total_amount")
    expect(v.candidates).toContain("conversion_amount")
    expect(v.sentence).toContain("다른 뜻")
  })

  it("「영역명」도 후보다 — campaign_key이자 campaign_name이다", () => {
    const v = one(col("영역명", "text"))
    expect(v.tier).toBe("candidate")
    expect(v.candidates.length).toBeGreaterThan(1)
  })
})

describe("★ 값 게이트 — 이름은 좁히고 값이 확정한다 (§20 2층) ★", () => {
  it("유일한 뜻 + kind 일치 → 확정(alias)", () => {
    // 「정산금액」은 11번가 정산에만 있다 — 유일. 값이 number면 확정.
    const v = one(col("정산금액", "number"))
    expect(v.tier).toBe("alias")
    expect(v.target).toBe("net_amount")
    // 근거는 %가 아니라 문장이다 (§20 규칙 2)
    expect(v.sentence).toContain("net_amount")
    expect(v.sentence).not.toMatch(/\d+%/)
  })

  it("★ 유일한 뜻인데 값이 날짜면 **후보로 강등** — 이름만 믿지 않는다 ★", () => {
    const v = one(col("정산금액", "date"))
    expect(v.tier).toBe("candidate")
    expect(v.target).toBeNull()
    expect(v.sentence).toContain("이름만 믿지 않는다")
  })

  it("표본이 없으면 확정하지 못한다 — 값 없이 확정은 없다", () => {
    const v = one(col("정산금액", "null"))
    expect(v.tier).toBe("candidate")
    expect(v.sentence).toContain("표본이 없어")
  })

  it("날짜 필드는 날짜로 확정된다", () => {
    const v = one(col("정산확정일", "date"))
    expect(v.tier).toBe("alias")
    expect(v.target).toBe("settled_on")
  })
})

describe("구조 역할과 미지", () => {
  it("행 식별에만 쓰이는 이름은 필드로 확정하지 않는다", () => {
    // 「옵션ID」는 쿠팡 두 프로파일에서 listing-key + source-key다 — target이 없다.
    const v = one(col("옵션ID", "identifier"))
    expect(v.tier).toBe("candidate")
    expect(v.target).toBeNull()
    expect(v.sentence).toContain("확정하지 않는다")
  })

  it("아는 양식 어디에도 없는 이름은 unknown — 세어서 말한다", () => {
    const v = one(col("완전히 처음 보는 열", "text"))
    expect(v.tier).toBe("unknown")
  })

  it("tierCounts가 화면의 요약 한 줄이 된다", () => {
    const r = judgeColumns(
      [col("정산금액", "number", 0), col("구매금액", "number", 1), col("처음 보는 열", "text", 2)],
      INDEX,
    )
    expect(r.tierCounts).toEqual({ alias: 1, identity: 0, candidate: 1, unknown: 1 })
  })
})

describe("전용 필드 등록부", () => {
  it("전 항목에 뜻풀이와 kind가 있다 — 드롭다운의 재료다", () => {
    for (const t of TARGETS) {
      expect(t.gloss.length, t.name).toBeGreaterThan(3)
      expect(t.kinds.length, t.name).toBeGreaterThan(0)
      expect(t.tables.length, t.name).toBeGreaterThan(0)
    }
  })

  it("항등식 템플릿의 항은 전부 등록부에 있다", () => {
    for (const tpl of IDENTITY_TEMPLATES) {
      expect(targetSpec(tpl.result), tpl.result).toBeDefined()
      for (const term of tpl.terms) {
        expect(targetSpec(term.replace(/^-/, "")), term).toBeDefined()
      }
    }
  })

  it("항이 하나뿐인 템플릿은 없다 — a=b로 필드를 증명하지 않는다", () => {
    for (const tpl of IDENTITY_TEMPLATES) {
      expect(tpl.terms.length, tpl.result).toBeGreaterThanOrEqual(2)
    }
  })
})
