/**
 * **데이터가 있는 달** — 월 선택기가 고를 수 있는 것의 전부.
 *
 * ★ 왜 달력이 아니라 목록인가 ★
 * 달력형 선택기는 «2027년 3월»도 고를 수 있게 하고, 사용자가 그리로 가면 화면은
 * 아무 잘못 없이 전부 0을 그린다. 그 0은 «그 달에 안 팔렸다»가 아니라 «그 달
 * 파일을 안 넣었다»인데, 화면은 그 둘을 구분해 말할 근거가 없다 — §22가 가장
 * 경계하는 모양이다. **DB에 행이 있는 달만** 목록에 세우면 그 상태가 애초에
 * 만들어지지 않는다.
 *
 * ★ 왜 네 테이블을 다 보는가 ★
 * 11번가처럼 **정산만 들어온 달**이 실제로 있다. 주문만 보면 그 달이 목록에서
 * 빠지고, 사용자는 넣은 파일이 사라졌다고 읽는다. 광고비만 있는 달도 같다.
 */

import type { Driver } from "../store/driver.js"
import type { Period } from "./index.js"

/** `YYYY-MM`. 화면·질의가 같은 문자열을 쓴다. */
export type Month = string

/**
 * 그 달의 1일~말일. **말일을 손으로 세지 않는다** — SQLite의 날짜 계산에
 * 맡기면 윤년·30/31일이 저절로 맞는다. 여기서는 JS로 같은 계산을 한다:
 * «다음 달 1일 − 하루».
 */
export function monthPeriod(ym: Month): Period {
  const y = Number(ym.slice(0, 4))
  const m = Number(ym.slice(5, 7))
  // Date.UTC의 day=0은 «전 달의 마지막 날»이다. m은 1-based이므로 그대로 넣으면
  // 다음 달의 0일 = 이 달의 말일이 된다.
  const last = new Date(Date.UTC(y, m, 0))
  const dd = String(last.getUTCDate()).padStart(2, "0")
  return { from: `${ym}-01`, to: `${ym}-${dd}` }
}

/** "2026년 7월". 앞의 0을 떼는 것이 한국어 표기다 — "2026년 07월"이라 쓰지 않는다. */
export function monthLabel(ym: Month): string {
  const [y, m] = ym.split("-")
  return `${y}년 ${Number(m)}월`
}

/**
 * 한 달에 무엇이 들어 있나. **종류를 뭉개지 않는다** — 아래 `defaultMonth`가
 * 이 구분 위에 서 있고, 화면도 «정산만 있는 달»을 그렇게 말해야 한다.
 */
export interface MonthRow {
  readonly ym: Month
  readonly orders: number
  readonly settlements: number
  readonly claims: number
  readonly ads: number
}

/**
 * 이 라이브러리에 데이터가 있는 달 — **최신이 앞에 온다.**
 *
 * `active_*` 뷰를 쓰므로 **되돌린 batch는 세지 않는다.** 되돌린 달이 목록에
 * 남아 있으면 사용자는 «분명 지웠는데 왜 있지»를 겪고, 그 달로 가면 0이 뜬다.
 *
 * 날짜 컬럼에 시각이 붙어 있을 수 있어(`2026-07-31T16:41:20`) 앞 7글자를 자른다.
 * `strftime`을 쓰지 않는 이유는 그쪽이 `T` 구분자를 만나면 NULL을 내기 때문이다 —
 * 기간 경계 사고와 같은 계열의 함정이다.
 */
export async function loadAvailableMonths(db: Driver, libraryId: string): Promise<MonthRow[]> {
  const rows = await db
    .prepare(
      `SELECT ym,
              SUM(o) AS orders, SUM(s) AS settlements, SUM(c) AS claims, SUM(a) AS ads
         FROM (
           SELECT substr(ordered_at,1,7) ym, 1 o, 0 s, 0 c, 0 a FROM active_order      WHERE library_id = ?
           UNION ALL
           SELECT substr(settled_on,1,7),   0,   1,   0,   0    FROM active_settlement WHERE library_id = ?
           UNION ALL
           SELECT substr(claimed_at,1,7),   0,   0,   1,   0    FROM active_claim      WHERE library_id = ?
           UNION ALL
           SELECT substr(spent_on,1,7),     0,   0,   0,   1    FROM active_ad_spend   WHERE library_id = ?
         )
        GROUP BY ym
        ORDER BY ym DESC`,
    )
    .all(libraryId, libraryId, libraryId, libraryId)

  return rows
    .map((r) => ({
      ym: String(r["ym"] ?? ""),
      orders: Number(r["orders"] ?? 0),
      settlements: Number(r["settlements"] ?? 0),
      claims: Number(r["claims"] ?? 0),
      ads: Number(r["ads"] ?? 0),
    }))
    // 날짜가 비어 있거나 깨진 행이 «» 같은 달을 만들지 않게 형식으로 거른다.
    .filter((m) => /^\d{4}-\d{2}$/.test(m.ym))
}

/**
 * ★ 앱을 열면 어느 달을 보여줄 것인가 — **«최신»이 답이 아니었다** ★
 *
 * 처음엔 목록의 첫 항목(가장 최근 달)을 골랐다. 그런데 실기기 DB를 재 보니
 * 가장 최근 달이 **2026-08**이었고, 그 달의 정체는 이랬다:
 *
 * ```
 * 주문 0 · 클레임 0 · 광고 0 · 정산 22건
 * 그 22건의 출처: 「2026년 7월_11st 결제일 정산확정 건.xls」  ← 7월 장사다
 * ```
 *
 * **정산은 다음 달에 지급된다.** 7월에 판 것의 정산일이 8월 초로 찍히므로,
 * 7월 파일 하나만 넣어도 «8월»이 생긴다. 그 달을 기본으로 열면 사용자는 앱을
 * 켜자마자 매출 0원짜리 화면을 보고 «내 데이터가 날아갔나»를 겪는다.
 *
 * 이 앱의 손익은 **주문 귀속**이다 (ADR-009 ① — 금액은 정산에서, 날짜는
 * 주문에서). 그러니 «장사한 달» = 주문이 있는 달이고, 기본은 그중 최신이다.
 * 주문이 하나도 없으면(정산 파일만 넣은 상태) 그냥 최신 달로 간다 — 그때는
 * 그게 사용자가 가진 전부다.
 */
export function defaultMonth(months: readonly MonthRow[]): Month | null {
  return months.find((m) => m.orders > 0)?.ym ?? months[0]?.ym ?? null
}
