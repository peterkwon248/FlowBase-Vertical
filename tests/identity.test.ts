/**
 * 항등식 증명 (계획 C · §20 4층) — **관계는 증명이 되고, 우연은 걸러진다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 실측이 이 파일의 절반을 썼다 ★
 *
 * 11번가 정산(128행)에서 진짜 항등 3건이 나왔다 — 「판매금액합계」=「정산금액」+
 * 「공제금액합계」가 그 하나이고, §20 규칙 2의 예시 문장이 실물이 된 것이다.
 *
 * 그리고 11번가 광고 리포트에서 **거짓 항등 10건**이 나왔다 — 클릭률(≤1)이
 * 허용오차 ±1 안에 통째로 들어가 아무 합에나 붙었다. 실질성 가드(|값|>오차)가
 * 그 10건을 전부 걷어냈고, 진짜 3건은 남았다. 이 파일이 그 경계를 고정한다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { proveIdentities } from "../src/core/import/validation/identity.js"
import { buildAliasIndex, judgeColumns } from "../src/core/import/judge.js"
import { loadProfiles } from "../src/packs/kr-marketplace/profiles/index.js"
import type { ColumnSighting } from "../src/core/import/columns.js"

const cols = (...headers: string[]) => headers.map((header, ordinal) => ({ ordinal, header }))

/** 행렬 편의 — 행마다 [gross, net, fee] 꼴. */
const M = (rows: number[][]): (number | null)[][] => rows

describe("proveIdentities — 관계를 증명한다", () => {
  const GROSS_NET_FEE = M([
    [10000, 9000, 1000],
    [25000, 22000, 3000],
    [8000, 7500, 500],
    [12000, 11000, 1000],
    [30000, 27000, 3000],
    [15000, 13000, 2000],
    [9000, 8200, 800],
    [21000, 19000, 2000],
  ])

  it("★ 합이 전 행에서 성립하면 증명이다 — 문장과 함께 ★", () => {
    const f = proveIdentities(cols("판매합계", "정산금액", "공제합계"), GROSS_NET_FEE)
    expect(f).toHaveLength(1)
    expect(f[0]!.result).toBe(0)
    expect([f[0]!.a, f[0]!.b].sort()).toEqual([1, 2])
    expect(f[0]!.sentence).toContain("8행 중 8행 일치")
    expect(f[0]!.sentence).not.toMatch(/\d+%/)
  })

  it("한 행이라도 어긋나면 증명이 아니다 — 「거의 맞다」는 없다", () => {
    const broken = GROSS_NET_FEE.map((r) => [...r])
    broken[7]![0] = 21002 // 오차 ±1 밖
    expect(proveIdentities(cols("a", "b", "c"), broken)).toHaveLength(0)
  })

  it("반올림 1원은 봐준다 — 오차의 전부다", () => {
    const off1 = GROSS_NET_FEE.map((r, i) => (i === 3 ? [r[0]! + 1, r[1]!, r[2]!] : r))
    expect(proveIdentities(cols("a", "b", "c"), off1)).toHaveLength(1)
  })

  it("★ 실질성 가드 — 오차 안에서만 사는 열은 항이 될 수 없다 ★", () => {
    // 실측 재현: 클릭률(0~1)이 ±1 오차에 삼켜져 「총」=「률」+「직접」이 성립해
    // 버린다. 률의 |값|이 오차를 못 넘으므로 걸러져야 한다.
    const withRate = M([
      [5, 0.4, 5],
      [3, 0.8, 3],
      [7, 0.2, 7],
      [2, 0.9, 2],
      [6, 0.1, 6],
      [4, 0.7, 4],
      [9, 0.3, 9],
      [8, 0.5, 8],
    ])
    expect(
      proveIdentities(cols("총 전환수", "클릭률", "직접 전환수"), withRate),
      "잔값 열이 합의 항이 됐다 — 거짓 항등",
    ).toHaveLength(0)
  })

  it("행이 8개 미만이면 증명이라 부르지 않는다", () => {
    expect(proveIdentities(cols("a", "b", "c"), GROSS_NET_FEE.slice(0, 5))).toHaveLength(0)
  })

  it("값 못 읽은 행은 건너뛰고 센다 — 검사한 행 수가 문장에 남는다", () => {
    const withNull: (number | null)[][] = [...GROSS_NET_FEE, [null, 1, 2], [3, null, 4]]
    const f = proveIdentities(cols("a", "b", "c"), withNull)
    expect(f[0]!.rowsChecked).toBe(8)
  })
})

describe("★ 증명 → 이름 — 템플릿과 확정된 이웃이 함께 지목한다 ★", () => {
  const INDEX = buildAliasIndex(loadProfiles())
  const s = (header: string, ordinal: number): ColumnSighting => ({
    ordinal,
    header,
    sample: "1000",
    kind: "number",
    confidence: 0.9,
    reason: "t",
  })

  it("두 모서리가 별칭 확정 + 항등 성립 → 셋째가 identity로 증명된다", () => {
    // 「판매금액합계」(gross)·「공제금액합계」(fee)는 11번가 별칭으로 확정된다.
    // 「실입금액」은 아는 양식에 없는 이름 — 항등이 net_amount를 지목한다.
    const r = judgeColumns(
      [s("판매금액합계", 0), s("실입금액", 1), s("공제금액합계", 2)],
      INDEX,
      [{ result: 0, a: 1, b: 2, rowsChecked: 128, sentence: "「판매금액합계」 = 「실입금액」 + 「공제금액합계」 — 128행 중 128행 일치" }],
    )
    const v = r.verdicts[1]!
    expect(v.tier).toBe("identity")
    expect(v.target).toBe("net_amount")
    expect(v.sentence).toContain("128행")
    expect(v.sentence).toContain("증명된다")
    expect(r.tierCounts.identity).toBe(1)
  })

  it("★ 모서리가 하나만 확정이면 못 올린다 — 합은 교환법칙이 있다 ★", () => {
    // gross만 확정 — 남은 두 자리 중 어느 쪽이 net인지 항등이 못 가른다.
    const r = judgeColumns(
      [s("판매금액합계", 0), s("실입금액", 1), s("모르는공제", 2)],
      INDEX,
      [{ result: 0, a: 1, b: 2, rowsChecked: 128, sentence: "x" }],
    )
    expect(r.tierCounts.identity).toBe(0)
  })

  it("템플릿 밖 항등은 tier를 못 올린다 — 우연이 확정이 되지 않는다", () => {
    // 「판매가」+「옵션가」=「판매금액합계」는 진짜 항등이지만 템플릿에 없다.
    const r = judgeColumns(
      [s("판매금액합계", 0), s("판매가", 1), s("옵션가", 2)],
      INDEX,
      [{ result: 0, a: 1, b: 2, rowsChecked: 128, sentence: "x" }],
    )
    expect(r.tierCounts.identity).toBe(0)
  })
})
