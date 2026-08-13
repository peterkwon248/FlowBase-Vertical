/**
 * 주문 화면이 읽는 **단 하나의 조회**.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 배선 규율 — 세 번째 적용 ★
 * `loadPnlSnapshot`(대시보드) · `loadSettlementRows`(정산)에 이어 세 번째다.
 * 화면 코드에서 리포지토리를 직접 조회하지 않는다 — 조인 조건 하나가 어긋나도
 * 화면마다 다른 답이 나오고 그 차이는 아무도 모르게 쌓인다 (헌장 A-5).
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 클레임은 주문에 붙지 않고 **자기 행으로 선다** ★
 * 붙이고 싶어도 붙지 않는다 — ESM 프로파일에서 주문의 `source_key`는
 * `주문번호 + 상품번호`(자연키)인데 클레임의 `order_source_key`는 **주문번호뿐**이라
 * 두 값의 모양이 다르다. 억지로 접두 매칭하면 상품이 여럿인 주문에서 조용히
 * 잘못 붙는다.
 *
 * 그래서 §14-1대로 **성격이 보이게** 따로 세운다. 목록은 주문 146 + 클레임 9 =
 * 155행이고, 이는 적재된 행 수와 정확히 같다.
 *
 * ★ 기간 필터 (ADR-009 ①) ★
 * 주문은 `ordered_at`, 클레임은 `claimed_at` — 둘 다 **발생일**이다. 경계는
 * `>= from AND < date(to,'+1 day')`로, 문자열 비교가 달의 마지막 날을 통째로
 * 잃던 결함을 막는 그 패턴이다 (`tests/range-boundary.test.ts`).
 */

import type { Driver } from "../store/driver.js"
import type { Period } from "../profit/index.js"

export type OrderRowKind = "order" | "claim"

export interface OrderRow {
  readonly kind: OrderRowKind
  /** 발생 시각 — 주문은 결제일, 클레임은 클레임 발생일. */
  readonly at: string
  /** 사람이 읽는 채널 이름. 내부 키를 화면에 내보내지 않는다 (헌장 C-4). */
  readonly channel: string
  /** 마켓이 준 진행 상태 문자열 그대로. 우리가 다시 분류하지 않는다. */
  readonly status: string
  /** 금액. **부호를 붙이지 않는다** — 클레임을 빼는 것은 계산기의 몫이다. */
  readonly amount: number
  /** 클레임 유형(`CANCEL`·`RETURN`·`EXCHANGE`·`REFUND`). 주문 행이면 `null`. */
  readonly claimType: string | null
  /**
   * 이 행의 날짜가 **추정**인가 (`date_precision='proxy'`).
   *
   * ESM 양식에 클레임 일자 컬럼이 없어 결제일을 프록시로 썼다 (ADR-009 ①-보완).
   * 대시보드 단서 카드가 세는 그 9건과 같은 것이다.
   */
  readonly dateEstimated: boolean
}

export async function loadOrderRows(
  db: Driver,
  libraryId: string,
  period: Period,
): Promise<OrderRow[]> {
  const rows = await db
    .prepare(
      `SELECT 'order' AS kind, o.ordered_at AS at,
              COALESCE(cn.display_name, '(이름 없는 연결)') AS ch,
              o.status AS st, o.total_amount AS amt,
              NULL AS ctype, 0 AS est
         FROM active_order o
         LEFT JOIN connection cn ON cn.id = o.connection_id
        WHERE o.library_id = ?
          AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
        UNION ALL
       SELECT 'claim' AS kind, c.claimed_at AS at,
              COALESCE(cn.display_name, '(이름 없는 연결)') AS ch,
              c.status AS st, c.amount AS amt,
              c.claim_type AS ctype,
              CASE WHEN c.date_precision = 'proxy' THEN 1 ELSE 0 END AS est
         FROM active_claim c
         LEFT JOIN connection cn ON cn.id = c.connection_id
        WHERE c.library_id = ?
          AND c.claimed_at >= ? AND c.claimed_at < date(?, '+1 day')
        ORDER BY at DESC, kind`,
    )
    .all(libraryId, period.from, period.to, libraryId, period.from, period.to)

  return rows.map((r) => ({
    kind: String(r["kind"]) === "claim" ? "claim" : "order",
    at: String(r["at"] ?? ""),
    channel: String(r["ch"] ?? ""),
    status: String(r["st"] ?? ""),
    amount: Number(r["amt"] ?? 0),
    claimType: r["ctype"] == null ? null : String(r["ctype"]),
    dateEstimated: Number(r["est"] ?? 0) === 1,
  }))
}
