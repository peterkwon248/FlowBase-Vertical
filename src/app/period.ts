/**
 * 월 선택기 — **헤더의 기간 표시를 고를 수 있게 만든 것.**
 *
 * ★ 왜 필요했나 (MVP 1, 2026-08-16) ★
 * 앱의 기간이 `{2026-07-01, 2026-07-31}` 상수였다. 7월 파일만 넣는 동안은 아무도
 * 몰랐지만, **8월 파일을 넣으면 가져오기는 성공하고 화면은 7월을 그린다** —
 * 사용자가 «넣었는데 안 나온다»를 겪는 자리이고, 매달 반복될 일이었다.
 *
 * ★ 새 화면을 만들지 않았다 ★
 * 목업의 헤더 부제(«2026년 8월»이라는 박힌 문자열) 옆이 원래 기간이 적히던 자리다.
 * 그 자리에 칩 하나를 세우고 끝낸다. 기간 비교·아카이브 같은 것은 MVP 밖이다.
 */

import type { PeriodPick, TemplateVals } from "./generated/vals.js"
import { monthLabel, type Month, type MonthRow } from "@core/profit/months.js"
import type { NavKey } from "./shell.js"

/**
 * ★ 기간이 **실제로 걸리는** 화면들 ★
 *
 * 나머지 화면(연결·기록·채널·가져오기)은 조회에 기간을 넘기지 않는다 —
 * 리스팅은 «기준»이고 가져오기 기록은 «언제 넣었나»라 달과 무관하기 때문이다
 * (`data.ts`의 각 필드 주석). 그런 화면에 선택기를 그리면 **아무것도 안 바뀌는
 * 컨트롤**이 되고, 사용자는 자기가 뭘 잘못 눌렀는지 찾게 된다.
 */
export const PERIOD_VIEWS: readonly NavKey[] = ["dash", "settlement", "orders", "products"]

/**
 * ★ 주문이 없는 달은 **왜 목록에 있는지** 말한다 ★
 *
 * 실기기 실측에서 나온 자리다 (2026-08-16). 7월 11번가 정산 파일 하나를 넣었더니
 * 목록에 «2026년 8월»이 생겼다 — **정산은 다음 달에 지급되기 때문**이고, 그 22건은
 * 8월 장사가 아니라 7월 장사의 돈이다. 아무 말 없이 «2026년 8월»만 세우면
 * 사용자는 그 달을 «8월 실적»으로 읽고, 눌러 보면 매출 0원이 뜬다.
 *
 * 그래서 **주문이 있는 달은 아무 말도 하지 않고**(그게 평범한 달이다), 없는 달만
 * 무엇이 들어 있는지 적는다. 종류를 우리가 판단하지 않고 **행 수에서 뽑는다** —
 * «정산만 있는 달»이라고 못박으면 광고만 있는 달이 생기는 날 거짓이 된다.
 */
function kindsOf(m: MonthRow): string {
  if (m.orders > 0) return ""
  const kinds = [
    m.settlements > 0 ? "정산" : "",
    m.claims > 0 ? "클레임" : "",
    m.ads > 0 ? "광고" : "",
  ].filter((s) => s !== "")
  return kinds.length === 0 ? "" : `${kinds.join(" · ")}만`
}

export interface PeriodActions {
  readonly toggle: () => void
  readonly pick: (ym: Month) => void
}

/**
 * 선택기를 붙인다. **달이 하나도 없으면 붙이지 않는다** — 데이터가 없는 앱에서
 * 고를 수 없는 선택기를 그리면 «여기서 뭔가 고를 수 있는데 비어 있다»로 읽힌다.
 * 그 상태의 화면은 이미 «가져오기부터 하세요»를 말하고 있다.
 */
export function periodVals(
  vals: TemplateVals,
  view: NavKey,
  month: Month,
  months: readonly MonthRow[],
  open: boolean,
  actions: PeriodActions,
): void {
  if (!PERIOD_VIEWS.includes(view) || months.length === 0) return

  const items = months.map((m) => ({
    label: monthLabel(m.ym),
    sub: kindsOf(m),
    fg: m.ym === month ? "var(--fg)" : "var(--fg-2)",
    bg: m.ym === month ? "var(--bg-active)" : "transparent",
    pick: () => actions.pick(m.ym),
  }))

  /**
   * ★ 목록의 «없음»을 설명한다 (§22) ★
   *
   * 달력이 아니라 목록이라 사용자는 «왜 6월이 없지»를 반드시 묻는다. 답은
   * «6월에 안 팔렸다»가 아니라 **«6월 파일을 안 넣었다»**이고, 그 둘을 화면이
   * 구분해 주지 않으면 사용자가 틀린 결론을 내린다.
   */
  const note =
    months.length === 1
      ? "가져온 파일이 이 달치뿐입니다. 다른 달 파일을 넣으면 여기에 나타납니다."
      : "가져온 파일이 있는 달만 나옵니다."

  const pick: PeriodPick = {
    label: monthLabel(month),
    open,
    toggle: actions.toggle,
    items,
    note,
  }
  vals.periodPick = pick

  /**
   * ★ 부제를 비운다 — 같은 달을 두 번 쓰지 않는다 ★
   *
   * 목업의 부제는 대시보드에서 «2026년 8월»(박힌 문자열)이었다. 선택기가 그 뜻을
   * 가져갔으므로 부제까지 달을 적으면 헤더에 같은 말이 두 번 선다. 선택기가 붙지
   * 않는 화면에서는 **건드리지 않는다** — 거기 부제는 «Order · OrderItem»처럼
   * 화면을 설명하는 문장이라 살아 있어야 한다.
   */
  vals.subtitle = ""
}
