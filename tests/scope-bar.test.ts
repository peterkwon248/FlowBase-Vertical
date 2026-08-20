/**
 * 보는 범위 막대 — 묶음 전환 + 편집의 **배선**(§21 «scope-bar» · ADR-021).
 *
 * 저장 쪽은 `collection.test.ts`가 본다. 여기서 보는 것은 «그 사실이 화면의 말로
 * 어떻게 나오는가»다:
 *
 * ```
 * ① 「전체」는 지울 수 없는 첫 항목    저장된 행이 아니라 화면의 기본값이다
 * ② 뺀 것의 **크기**를 말한다         막지 않는 대신 보인다 (ADR-021)
 * ③ 못 저장하는 이유를 말한다          아무 말 없이 회색인 버튼은 «고장»이다 (§21-1)
 * ④ batch_id가 화면에 안 나온다        헌장 C-4
 * ```
 */

import { describe, expect, it } from "vitest"
import { scopeVals, type ScopeState } from "../src/app/history.js"
import { emptyVals, type TemplateVals } from "../src/app/generated/vals.js"
import type { HistoryRow } from "../src/core/history/rows.js"

const file = (id: string, name: string, blocked = false): HistoryRow => ({
  id,
  channel: "쿠팡",
  sourceName: name,
  sheetName: null,
  docType: null,
  at: "2026-07-14T09:20:00",
  batchStatus: "committed",
  fetched: 100,
  created: 100,
  updated: 0,
  failed: 0,
  ownedByTable: { fact_order: 100 },
  undo: "can",
  outcome: "done",
  undoneAt: null,
  blockedBy: blocked ? { sourceName: "나중.xlsx", at: "2026-08-01T00:00:00" } : null,
})

const ROWS = [file("b1", "7월 매출.xlsx"), file("b2", "8월 매출.xlsx"), file("b3", "광고.xlsx")]

const state = (o: Partial<ScopeState> = {}): ScopeState => ({
  bundles: [],
  activeId: null,
  inScope: 0,
  revenue: null,
  edit: null,
  ...o,
})

function render(st: ScopeState, rows: readonly HistoryRow[] = ROWS): TemplateVals {
  const vals = emptyVals()
  scopeVals(vals, rows, st)
  return vals
}

describe("① 「전체」는 지울 수 없는 첫 항목이다", () => {
  it("묶음이 하나도 없어도 「전체」는 있다 — 그리고 전 파일 수를 센다", () => {
    const v = render(state())
    expect(v.scope.bundles.length).toBe(1)
    expect(v.scope.bundles[0]?.name).toBe("전체")
    // id가 null인 것이 「저장된 행이 아니다」의 표현이다 (013 — 행 없음 = 전체)
    expect(v.scope.bundles[0]?.id).toBeNull()
    expect(v.scope.bundles[0]?.count).toBe(3)
    expect(v.scope.bundles[0]?.active).toBe(true)
  })

  it("묶음이 있으면 「전체」 뒤에 붙고, 고른 것 하나만 active다", () => {
    const v = render(
      state({ bundles: [{ id: "c1", name: "7월 결산", count: 1 }], activeId: "c1", inScope: 1 }),
    )
    expect(v.scope.bundles.map((b) => b.name)).toEqual(["전체", "7월 결산"])
    expect(v.scope.bundles.filter((b) => b.active).length).toBe(1)
    expect(v.scope.label).toBe("7월 결산")
  })

  it("「전체」를 보는 중에는 편집 버튼이 없다 — 전체는 편집 대상이 아니다", () => {
    expect(render(state()).scope.openEdit).toBeNull()
    expect(
      render(state({ bundles: [{ id: "c1", name: "가", count: 1 }], activeId: "c1", inScope: 1 }))
        .scope.openEdit,
    ).not.toBeNull()
  })
})

describe("② ★ 뺀 것의 크기를 말한다 — 막지 않는다 (ADR-021) ★", () => {
  it("전체를 보는 중이면 뺀 것이 없으므로 아무 말도 안 한다", () => {
    const v = render(state({ revenue: { all: 30_000, inScope: 30_000 } }))
    expect(v.scope.summary).toBe("파일 3개 전부를 보고 있습니다")
    expect(v.scope.excluded).toBe("")
  })

  it("★ 묶음을 보는 중이면 몇 개가 빠졌고 **얼마가** 빠졌는지 말한다 ★", () => {
    const v = render(
      state({
        bundles: [{ id: "c1", name: "7월 결산", count: 1 }],
        activeId: "c1",
        inScope: 1,
        revenue: { all: 30_000_000, inScope: 10_000_000 },
      }),
    )
    expect(v.scope.summary).toBe("파일 3개 중 1개 · 2개는 계산 밖입니다")
    // 이 수가 없으면 사용자는 «뺐다»만 알고 «얼마를 뺐는지»를 모른다
    expect(v.scope.excluded).toBe("계산 밖 매출 20,000,000원 (전 기간)")
  })

  it("매출을 아직 못 읽었으면 **지어내지 않는다** (LOCK 6)", () => {
    const v = render(
      state({ bundles: [{ id: "c1", name: "가", count: 1 }], activeId: "c1", inScope: 1 }),
    )
    expect(v.scope.excluded, "0원이라고 말하면 «뺀 게 없다»는 거짓이 된다").toBe("")
  })
})

describe("③ 편집 패널 — 못 하는 이유를 말한다 (§21-1)", () => {
  const editing = (over: Partial<NonNullable<ScopeState["edit"]>> = {}) =>
    render(
      state({
        bundles: [{ id: "c1", name: "7월 결산", count: 1 }],
        activeId: "c1",
        inScope: 1,
        edit: { mode: "edit", name: "7월 결산", query: "", picked: ["b1"], ...over },
      }),
    )

  it("이름이 비면 못 저장하고, **왜 못 하는지** 말한다", () => {
    const v = editing({ name: "  " })
    expect(v.scope.edit?.canSave).toBe(false)
    expect(v.scope.edit?.why).toBe("이름을 지어야 저장할 수 있습니다")
  })

  it("빈 묶음도 만들 수 있다 — 대신 그러면 어떻게 되는지 말한다", () => {
    const v = editing({ picked: [] })
    expect(v.scope.edit?.canSave, "막지 않는다").toBe(true)
    expect(v.scope.edit?.why).toContain("0을 그립니다")
  })

  it("다 서면 잔소리를 멈춘다", () => {
    expect(editing().scope.edit?.why).toBe("")
    expect(editing().scope.edit?.picked).toBe(1)
  })

  it("검색이 목록을 좁힌다 — 체크 상태는 검색과 무관하다", () => {
    const v = editing({ query: "광고", picked: ["b1", "b3"] })
    expect(v.scope.edit?.files.map((f) => f.name)).toEqual(["광고.xlsx"])
    expect(v.scope.edit?.files[0]?.checked).toBe(true)
    // 담긴 수는 «지금 보이는 것»이 아니라 «담긴 것»이다 — 검색으로 줄면 안 된다
    expect(v.scope.edit?.picked).toBe(2)
  })

  it("새로 만드는 중이면 「묶음 지우기」가 없다", () => {
    const v = render(state({ edit: { mode: "new", name: "가", query: "", picked: [] } }))
    expect(v.scope.edit?.title).toBe("새 묶음")
    expect(v.scope.edit?.remove).toBeNull()
  })

  it("겹쳐서 행을 빼앗긴 파일은 그 사실을 단다 (ADR-021 개정 ②)", () => {
    const rows = [file("b1", "7월.xlsx"), file("b2", "겹치는 7월.xlsx", true)]
    const v = render(
      state({ edit: { mode: "new", name: "가", query: "", picked: [] } }),
      rows,
    )
    expect(v.scope.edit?.files[0]?.note).toBe("")
    expect(v.scope.edit?.files[1]?.note).toBe("나중 파일이 가져감")
  })
})

describe("④ 화면이 내부 키를 흘리지 않는다", () => {
  it("★ batch_id가 사람이 읽는 문자열 어디에도 없다 (헌장 C-4) ★", () => {
    const v = render(
      state({
        bundles: [{ id: "c1", name: "7월 결산", count: 1 }],
        activeId: "c1",
        inScope: 1,
        revenue: { all: 30_000, inScope: 10_000 },
        edit: { mode: "edit", name: "7월 결산", query: "", picked: ["b1"] },
      }),
    )
    const shown = [
      v.scope.label,
      v.scope.summary,
      v.scope.excluded,
      ...v.scope.bundles.map((b) => b.name),
      ...(v.scope.edit?.files.flatMap((f) => [f.name, f.at, f.note]) ?? []),
      v.scope.edit?.title ?? "",
      v.scope.edit?.why ?? "",
    ].join(" | ")

    for (const id of ["b1", "b2", "b3", "c1"]) {
      expect(shown.includes(id), `${id}가 화면 문자열에 새어 나왔다`).toBe(false)
    }
    // key는 React 전용이라 예외다 — 그리는 값이 아니다
    expect(v.scope.edit?.files[0]?.key).toBe("b1")
  })

  it("「동기화」 카피가 없다 (LOCK 10)", () => {
    const v = render(
      state({
        bundles: [{ id: "c1", name: "가", count: 1 }],
        activeId: "c1",
        inScope: 1,
        revenue: { all: 1, inScope: 1 },
        edit: { mode: "edit", name: "가", query: "", picked: [] },
      }),
    )
    const all = JSON.stringify(v.scope)
    expect(all.includes("동기화")).toBe(false)
  })
})

describe("⑤ 함정 — 넣었는데 안 보이는 일을 없앤다 (ADR-021)", () => {
  const fresh = { id: "b9", name: "8월 매출.xlsx" }

  it("★ 묶음을 보는 중에 넣은 파일이 그 묶음 밖이면 말한다 ★", () => {
    const v = render(
      state({
        bundles: [{ id: "c1", name: "7월 결산", count: 1 }],
        activeId: "c1",
        inScope: 1,
        justImported: fresh,
      }),
    )
    expect(v.scope.fresh).not.toBeNull()
    expect(v.scope.fresh?.text).toContain("8월 매출.xlsx")
    expect(v.scope.fresh?.text).toContain("이 묶음에 없습니다")
    // batch_id는 여기서도 안 샌다
    expect(v.scope.fresh?.text.includes("b9")).toBe(false)
  })

  it("「전체」를 보는 중이면 아무 말도 안 한다 — 새 파일이 저절로 든다", () => {
    expect(render(state({ justImported: fresh })).scope.fresh).toBeNull()
  })

  it("가져온 적이 없으면 없다", () => {
    const v = render(
      state({ bundles: [{ id: "c1", name: "가", count: 1 }], activeId: "c1", inScope: 1 }),
    )
    expect(v.scope.fresh).toBeNull()
  })
})
