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
 * ─────────────────────────────────────────────────────────────
 * ★ 취소된 판매는 **한 행이다** — 이중 기록의 화면 쪽 짝 (2026-08-15) ★
 *
 * 이중 기록(ADR-009 ①-보완 4)이 저장 계층에 들어오면서 취소된 판매 한 건이
 * `fact_order`와 `fact_claim` **양쪽**에 선다. 이 조회가 둘을 그대로 UNION하면
 * 화면이 **같은 거래를 두 번 그린다** — 실측으로 확인했다:
 *
 * ```
 * 주문행  · 2026-07-25T15:53:48 · 취소완료 ·          31,500원
 * 클레임  · 2026-07-25T15:53:48 · 취소완료 · CANCEL · 31,500원   ← 같은 거래
 * 목록 164행  vs  적재 155행
 * ```
 *
 * 그래서 **짝이 있으면 주문 행이 취소를 달고 서고, 클레임 행은 서지 않는다.**
 * 접합은 `(connection_id, source_key)` **정확 조인**이다 — 이중 기록이 두 행에
 * 같은 `source_key`를 주기 때문이고(`mapping/index.ts`의 «두 행의 source_key는
 * 같다»), `fact_claim`의 UNIQUE가 같은 키라 짝은 최대 하나다.
 *
 * ★ 이 조인은 예전에 금지했던 그 조인이 **아니다** ★
 * 여기 있던 옛 주석은 *"붙이고 싶어도 붙지 않는다"*였다. 그 말은 `order_source_key`
 * (ESM에서는 주문번호뿐)를 주문의 자연키(주문번호+상품번호)에 맞추는 **근사 매칭**을
 * 두고 한 것이고, 그것은 지금도 금지다 (ADR-006). 이중 기록이 만든 것은 **다른
 * 컬럼의 정확한 동일성**이다 — 같은 원본 행에서 나온 두 표현이라 키가 글자까지 같다.
 *
 * ★ 짝이 없는 클레임은 그대로 자기 행으로 선다 ★
 * 월경계 클레임(8월에 오는 7월 주문의 취소)이 그렇다. 그 행을 접으면 취소가
 * 화면에서 사라진다. 그래서 접는 조건은 **«주문 행이 지금 이 기간에 함께 보이는가»**
 * 이지 «어딘가에 주문이 있는가»가 아니다 — 후자로 접으면 기간 밖 주문 때문에
 * 기간 안 클레임이 침묵한다.
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
  /**
   * 클레임 유형(`CANCEL`·`RETURN`·`EXCHANGE`·`REFUND`). 클레임이 없으면 `null`.
   *
   * ★ 주문 행에서도 `null`이 아닐 수 있다 ★ 취소된 판매는 한 행으로 서고 그 행이
   * 취소를 달고 있다. **«클레임인가»를 `kind`로 묻지 않는다** — `kind`는 이제
   * «주문 행인가 홀로 선 클레임인가»만 답한다.
   */
  readonly claimType: string | null
  /**
   * 이 행에 딸린 클레임 금액. 클레임이 없으면 `0`.
   *
   * 홀로 선 클레임 행에서는 `amount`와 같은 값이다 — `amount`는 «이 행이 표에
   * 찍는 금액»이고 이쪽은 «손익에서 빠지는 금액»이라, 두 뜻이 우연히 겹칠 뿐이다.
   * **클레임 합계는 언제나 전 행의 `claimAmount` 합이다** (`amount`를 섞어 세면
   * 취소된 판매가 두 번 빠진다 — 저장 계층에서 닫은 그 버그의 화면판).
   */
  readonly claimAmount: number
  /**
   * 이 행이 **표에 찍는 날짜**가 추정인가 (`date_precision='proxy'`).
   *
   * 취소된 판매의 통합 행은 **결제일**을 찍으므로 여기는 `false`다 — 결제일은
   * 파일이 준 사실이다. 추정인 것은 클레임 일자 쪽이고 그건 아래가 말한다.
   * 홀로 선 클레임 행에서만 `true`가 될 수 있다.
   */
  readonly dateEstimated: boolean
  /**
   * 딸린 클레임의 **발생일**이 추정인가.
   *
   * ESM 양식에 클레임 일자 컬럼이 없어 결제일을 프록시로 썼다 (ADR-009 ①-보완).
   * 대시보드 단서 카드가 세는 그 9건과 같은 집합이고, 통합 행이 되어도 그 사실을
   * 잃지 않아야 해서 `dateEstimated`와 **따로** 둔다.
   */
  readonly claimDateEstimated: boolean
}

export async function loadOrderRows(
  db: Driver,
  libraryId: string,
  period: Period,
): Promise<OrderRow[]> {
  const rows = await db
    .prepare(
      // 주문 행 — 짝이 되는 클레임이 **같은 기간 안에** 있으면 달고 선다.
      // `fact_claim`의 UNIQUE(connection_id, source_key)가 짝을 최대 하나로
      // 묶으므로 이 LEFT JOIN은 행을 불리지 않는다.
      `SELECT 'order' AS kind, o.ordered_at AS at,
              COALESCE(cn.display_name, '(이름 없는 연결)') AS ch,
              o.status AS st, o.total_amount AS amt,
              c.claim_type AS ctype, COALESCE(c.amount, 0) AS camt,
              0 AS est,
              CASE WHEN c.date_precision = 'proxy' THEN 1 ELSE 0 END AS cest
         FROM active_order o
         LEFT JOIN connection cn ON cn.id = o.connection_id
         LEFT JOIN active_claim c
                ON c.library_id = o.library_id
               AND c.connection_id = o.connection_id
               AND c.source_key = o.source_key
               AND c.claimed_at >= ? AND c.claimed_at < date(?, '+1 day')
        WHERE o.library_id = ?
          AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
        UNION ALL
       -- 홀로 선 클레임 — 짝이 이 기간에 **안 보이는** 것만. 기간 밖 주문 때문에
       -- 기간 안 취소가 침묵하면 안 되므로 EXISTS에도 같은 기간을 건다.
       SELECT 'claim' AS kind, c.claimed_at AS at,
              COALESCE(cn.display_name, '(이름 없는 연결)') AS ch,
              c.status AS st, c.amount AS amt,
              c.claim_type AS ctype, c.amount AS camt,
              CASE WHEN c.date_precision = 'proxy' THEN 1 ELSE 0 END AS est,
              CASE WHEN c.date_precision = 'proxy' THEN 1 ELSE 0 END AS cest
         FROM active_claim c
         LEFT JOIN connection cn ON cn.id = c.connection_id
        WHERE c.library_id = ?
          AND c.claimed_at >= ? AND c.claimed_at < date(?, '+1 day')
          AND NOT EXISTS (
                SELECT 1 FROM active_order o
                 WHERE o.library_id = c.library_id
                   AND o.connection_id = c.connection_id
                   AND o.source_key = c.source_key
                   AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
              )
        ORDER BY at DESC, kind`,
    )
    .all(
      period.from, period.to, // 주문 쪽 LEFT JOIN의 클레임 기간
      libraryId, period.from, period.to,
      libraryId, period.from, period.to,
      period.from, period.to, // NOT EXISTS의 주문 기간
    )

  return rows.map((r) => ({
    kind: String(r["kind"]) === "claim" ? "claim" : "order",
    at: String(r["at"] ?? ""),
    channel: String(r["ch"] ?? ""),
    status: String(r["st"] ?? ""),
    amount: Number(r["amt"] ?? 0),
    claimType: r["ctype"] == null ? null : String(r["ctype"]),
    claimAmount: Number(r["camt"] ?? 0),
    dateEstimated: Number(r["est"] ?? 0) === 1,
    claimDateEstimated: Number(r["cest"] ?? 0) === 1,
  }))
}
