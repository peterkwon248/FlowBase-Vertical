/**
 * 다섯 내보내기 팝오버의 배선.
 *
 * ★ 팝오버가 다섯인데 `expScope`·`expNote`는 **하나씩**이다 ★
 * 목업이 그렇게 생겼다. 한 번에 하나만 열리므로 문제는 아니지만, **열린 것에 맞는
 * 문장을 넣어야 한다** — 안 그러면 주문 화면에서 「정산 128행」이라고 말한다.
 * 그래서 「지금 열린 것」을 하나의 상태로 두고 그 표의 문장만 싣는다.
 *
 * ★ 표가 없으면 **팝오버를 안 연다** ★ (§21-1 · U-3)
 * 데이터가 없는 화면에서 열면 「0행을 내보내기」라는 빈 동작이 된다. 여는 버튼
 * 자체는 목업 마크업이라 그리되, 눌러도 아무 일이 없으면 그건 다시 죽은 버튼이다 —
 * 그래서 **행이 0이면 열되 그 사실을 말한다.** 빈 파일을 주는 것이 「데이터가
 * 없다」를 숨기는 것보다 정직하다 (LOCK 8은 «인질 금지»이지 «비면 막아라»가 아니다).
 */

import type { TemplateVals } from "./generated/vals.js"
import type { ExportTable } from "./export.js"
import { saveCsv, saveXlsx } from "./export.js"

export type ExportKey = "set" | "prd" | "cst" | "ord" | "syn"

export interface ExportActions {
  /** 같은 것을 다시 누르면 닫는다. */
  readonly toggle: (key: ExportKey) => void
  readonly close: () => void
}

/**
 * ★ 다섯 자리를 **펼쳐 쓴다** ★
 *
 * 처음엔 `vals[FIELD[key]] = …`로 한 줄에 돌렸는데, 그러면 **배선 게이트가 못
 * 본다** — `wiring.ts`는 `vals.expSet` 같은 이름을 찾으므로 계산된 키로 넣으면
 * «미배선»으로 세어진다. 실제로 배선하고도 게이트가 5건을 남은 일로 신고했다.
 *
 * 게이트가 못 보는 배선은 **게이트를 거짓말하게 만든다.** 반복이 조금 늘어도
 * 기계가 읽을 수 있는 모양이 옳다.
 */
export function exportVals(
  vals: TemplateVals,
  open: ExportKey | null,
  tables: Readonly<Partial<Record<ExportKey, ExportTable<never>>>>,
  actions: ExportActions,
): void {
  const one = (key: ExportKey): TemplateVals["expSet"] => {
    const table = tables[key]
    return {
      // 표가 없는 화면(데이터 미적재)에서는 열리지 않는다 — 열어도 낼 것이 없다
      on: open === key && table !== undefined,
      open: () => actions.toggle(key),
      xlsx: () => {
        if (table === undefined) return
        actions.close()
        saveXlsx(table)
      },
      csv: () => {
        if (table === undefined) return
        actions.close()
        saveCsv(table)
      },
    }
  }

  vals.expSet = one("set")
  vals.expPrd = one("prd")
  vals.expCst = one("cst")
  vals.expOrd = one("ord")
  vals.expSyn = one("syn")

  const t = open === null ? undefined : tables[open]
  if (t !== undefined) {
    vals.expScope = t.scope
    vals.expNote = t.note
  }
}
