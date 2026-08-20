/**
 * 헤더 「더보기」 — **좁은 화면에서 기능을 되찾는 통로.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 (2026-08-20 감사 A-3) ★
 *
 * `flowbase-theme.css`가 768px 미만에서 이렇게 한다:
 *
 * ```css
 * .fb-head-actions > *:not(.fb-head-more) { display: none !important; }
 * .fb-head-more { display: inline-flex !important; }
 * ```
 *
 * 즉 **기간 선택기와 「가져오기」가 통째로 사라지고**, 대신 「더보기」가 나타난다.
 * 설계로는 맞다 — 좁으면 접고 메뉴로 준다. 그런데 그 「더보기」의 배선이 **0이었다.**
 * 되찾는 통로라고 CSS가 자리를 비워 뒀는데 아무것도 안 들어 있었다.
 *
 * 결과: 폭 768px 미만에서 **보는 달을 바꿀 방법이 아예 없었다.** ⌘K도 죽어 있어
 * (A-2-3) 우회로도 없다. §21-3 「어떤 브레이크포인트에서도 기능 제거 ❌」와
 * 사용자 불변식 U-4의 정면 위반이다.
 *
 * ★ 배선 게이트가 이걸 못 잡은 이유 ★
 * `toggleHeadMore`가 「헤더 부가 — 배지·팝오버·표시 메뉴」 컷에 사유
 * *"MVP 세 동작에 없다"*로 묶여 있었다. **배지와 같은 취급을 받은 것**이다.
 * 배지는 없어도 앱이 동작하지만 이건 없으면 기능이 사라진다 — `exp[A-Z]`가
 * 「표 필터」 컷에 잘못 접혀 있던 것과 같은 병이다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 무엇을 담나 — 「CSS가 지운 것」이 기준이다 ★
 * 장식이 아니라 **복구**다. 그래서 목록은 위 셀렉터가 지우는 것에서 나온다:
 * 기간 선택기(있는 화면에서만)와 「가져오기」. 없는 기능을 여기서 새로 만들지 않는다.
 */

import type { TemplateVals } from "./generated/vals.js"
import { monthLabel, type Month, type MonthRow } from "@core/profit/months.js"
import type { NavKey } from "./shell.js"
import { PERIOD_VIEWS } from "./period.js"

export interface HeadMoreActions {
  readonly toggle: () => void
  readonly close: () => void
  readonly pick: (ym: Month) => void
  readonly goImport: () => void
}

export function headMoreVals(
  vals: TemplateVals,
  view: NavKey,
  month: Month,
  months: readonly MonthRow[],
  open: boolean,
  actions: HeadMoreActions,
): void {
  const items: { label: string; run: () => void }[] = []

  /**
   * ★ 달이 먼저다 ★ 이 메뉴가 생긴 이유가 「보는 달을 못 바꾼다」이므로,
   * 되찾아야 할 것이 목록 맨 위에 있어야 한다.
   *
   * 기간 선택기가 **애초에 안 붙는 화면**(연결·기록·채널·가져오기)에서는 달도
   * 넣지 않는다. 거기서 달을 고르면 아무것도 안 바뀌고, 그건 «내가 뭘 잘못
   * 눌렀나»를 만드는 컨트롤이다 (`period.ts`의 `PERIOD_VIEWS`와 같은 판단).
   */
  if (PERIOD_VIEWS.includes(view)) {
    for (const m of months) {
      // 보고 있는 달에 표를 단다 — 목록이 라벨뿐이라 어느 것이 현재인지 알 수 없다
      const here = m.ym === month
      items.push({
        label: `${here ? "✓ " : ""}${monthLabel(m.ym)}`,
        run: () => {
          actions.close()
          if (!here) actions.pick(m.ym)
        },
      })
    }
  }

  // 좁은 화면에서 같이 사라지는 주 버튼. 넓은 화면에서는 헤더에 그대로 있다.
  items.push({
    label: "가져오기",
    run: () => {
      actions.close()
      actions.goImport()
    },
  })

  vals.headMoreItems = items
  vals.headMoreOpen = open
  vals.toggleHeadMore = actions.toggle
}
