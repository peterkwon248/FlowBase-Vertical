/**
 * 상품별 손익 — **대시보드의 그 표를 채우는 조회.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 표는 지금까지 비어 있었다 ★
 * 마크업은 처음부터 있었는데 `vals.pnlRows`를 채우는 코드가 **0곳**이라 늘 빈
 * 배열이었다. 원가가 없던 동안에는 그래도 손해가 없었다 — 모든 상품이
 * «매출 = 이익»이라 표가 있어도 아무 말도 못 했다. 원가가 들어온 지금은
 * **계산할 수 있는 것이 안 그려지는** 상태이고, 그건 §22가 가르는
 * 「부재」가 아니라 「미구현」이다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 채우는 칸과 비우는 칸을 **미리** 가른다 ★
 *
 * ```
 * 채운다   수량 · 매출 · 할인 · 매입원가      품목 행에 직접 붙어 있다
 * 비운다   수수료 · 배송비 · 광고비            품목에 붙는 근거가 오늘 없다
 * ```
 *
 * 수수료·배송비는 **주문 단위**로 오고(정산), 광고비는 **캠페인 단위**로 온다
 * (인계 §5 — 광고비는 SKU가 아니라 캠페인에 붙는다). 주문의 금액 비중으로
 * 안분하는 길은 열려 있지만(`allocate`), 그건 **새 회계 결정**이라 이 조회가
 * 혼자 정할 일이 아니다. 0으로 채우면 「수수료가 0원인 상품」이라는 거짓이
 * 표에 앉으므로, 비운 채로 두고 화면이 그 이유를 한 줄로 말한다.
 *
 * 그래서 이 표의 이익 칸은 **순이익이 아니라 부분 기여이익**이다:
 * `매출 − 할인 − 매입원가`. 이름을 그렇게 부르는 것이 이 파일의 계약이다.
 *
 * ★ 원가 규칙을 다시 적지 않는다 ★
 * `costAtSql`·`ITEM_JOIN`·`SOLD`를 손익 스냅샷과 **같은 조각**으로 쓴다. 여기서
 * 따로 적으면 상품별 합과 대시보드 매입원가가 갈리고, 그 차이는 아무도 모르게
 * 쌓인다 (단일 계산기 LOCK의 조회판).
 */

import type { Driver } from "../store/driver.js"
import { costAtSql } from "../cost/index.js"
import type { Period } from "./index.js"

const COST = costAtSql({
  libraryId: "oi.library_id",
  skuId: "ml.sku_id",
  kind: "'COGS'",
  on: "o.ordered_at",
})

/** 손익 스냅샷과 **같은** 조인·필터. 갈라지면 두 화면이 다른 답을 낸다. */
const ITEM_JOIN =
  `FROM active_order_item oi
     JOIN active_order o ON o.id = oi.order_id
     LEFT JOIN marketplace_listing ml ON ml.id = oi.listing_id AND ml.link_state = 'linked'`

/** 0개 팔린 옵션은 세지 않는다 (쿠팡 제트가 안 팔린 옵션도 행으로 내보낸다). */
const SOLD = "oi.quantity > 0"

export interface ProfitRow {
  /** SKU가 붙은 행이면 그 id, 아니면 `null` (미연결 묶음). */
  readonly skuId: string | null
  /** 사람이 읽는 이름. 미연결이면 «SKU 미연결»이 아니라 그 사실을 화면이 쓴다. */
  readonly name: string
  readonly code: string
  readonly qty: number
  readonly revenue: number
  readonly discount: number
  /**
   * 매입원가. **원가를 모르는 행은 더하지 않는다** — 0원으로 세면 그 상품이
   * «엄청 남는 상품»이 된다. 대신 아래 `noCostQty`가 그 크기를 말한다.
   */
  readonly cogs: number
  /** 원가를 모르는 판매 수량. 0이면 이 행의 이익은 온전하다. */
  readonly noCostQty: number
}

/**
 * 기간 안 판매를 SKU로 묶는다. **연결되지 않은 품목은 한 줄로 모은다** —
 * 리스팅마다 줄이 서면 그게 곧 «상품별»이 아니게 되고, 22품목이 표를 덮는다.
 * 그 묶음은 화면에서 «SKU에 연결되지 않은 판매»로 이름 붙는다.
 */
export async function loadProfitRows(
  db: Driver,
  libraryId: string,
  period: Period,
): Promise<ProfitRow[]> {
  const rows = await db
    .prepare(
      `SELECT ml.sku_id AS sku_id,
              COALESCE(p.name, '')  AS name,
              COALESCE(p.code, '')  AS code,
              COALESCE(SUM(oi.quantity), 0)        AS qty,
              COALESCE(SUM(oi.gross_amount), 0)    AS revenue,
              COALESCE(SUM(oi.discount_amount), 0) AS discount,
              COALESCE(SUM(oi.quantity * ${COST}), 0) AS cogs,
              COALESCE(SUM(CASE WHEN ${COST} IS NULL THEN oi.quantity ELSE 0 END), 0) AS no_cost_qty
       ${ITEM_JOIN}
       LEFT JOIN sku p ON p.id = ml.sku_id
        WHERE oi.library_id = ? AND ${SOLD}
          AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
        GROUP BY ml.sku_id
        ORDER BY revenue DESC`,
    )
    .all(libraryId, period.from, period.to)

  return rows.map((r) => ({
    skuId: r["sku_id"] === null || r["sku_id"] === undefined ? null : String(r["sku_id"]),
    name: String(r["name"] ?? ""),
    code: String(r["code"] ?? ""),
    qty: Number(r["qty"] ?? 0),
    revenue: Number(r["revenue"] ?? 0),
    discount: Number(r["discount"] ?? 0),
    cogs: Number(r["cogs"] ?? 0),
    noCostQty: Number(r["no_cost_qty"] ?? 0),
  }))
}

export interface DailyPoint {
  /** `YYYY-MM-DD`. */
  readonly day: string
  /** 그날 주문의 매출. **일별로 쪼갤 수 있는 것만** 들어온다 (아래 참조). */
  readonly revenue: number
  readonly orderCount: number
  readonly cogs: number
  readonly claims: number
  /** 그날 **주문**에 이어 붙은 정산 수수료(+VAT). 정산일이 아니라 주문일 기준이다. */
  readonly fee: number
  readonly shipping: number
  /**
   * ★ 이 차트가 그리는 값 ★ `매출 − 수수료 − 배송비 − 클레임 − 매입원가`.
   *
   * 스냅샷의 `productContribution`과 **같은 항**을 쓴다(운영비만 빠진다 — 그건
   * 월 단위 기준값이라 날짜에 붙지 않는다). 카드 제목이 「일별 기여이익」이므로
   * 여기서 매출을 그리면 **제목이 거짓말을 한다** — 실제로 한 번 그랬다.
   */
  readonly contribution: number
}

export interface DailySeries {
  readonly points: readonly DailyPoint[]
  /**
   * ★ 이 차트가 **담지 못한 매출** ★
   *
   * 쿠팡 제트(로켓그로스)는 옵션×기간 집계로만 온다 — 행마다 날짜가 없고 기간은
   * 파일명에만 있다(마이그레이션 005). 그 행들은 월 합계에는 온전히 들어가지만
   * **일별로 분해할 수 없다.**
   *
   * 실측(7월): 총매출 87,297,920원 중 **73,740,340원(84%)**이 그렇다. 이 값을
   * 함께 들고 나가지 않으면 사용자는 일별 합이 월 숫자와 다른 것을 보고 어느
   * 쪽이 틀렸는지 알 수 없다 (§22 — 부재는 일급 데이터다).
   */
  readonly periodOnly: number
}

/**
 * 일별 매출 — **날짜가 있는 주문만.**
 *
 * `date_precision = 'period'`인 행을 **빼는** 것이 이 조회의 요점이다. 그 행의
 * `ordered_at`은 기간 시작일이라, 넣으면 7월 1일 하나에 73,740,340원이 솟는
 * **가짜 봉우리**가 생긴다. 빼되 얼마를 뺐는지 함께 돌려준다.
 */
export async function loadDailySeries(
  db: Driver,
  libraryId: string,
  period: Period,
): Promise<DailySeries> {
  /** 기간 집계 행을 뺀 «날짜가 있는 주문»만. 이 조건이 세 조회에 똑같이 걸린다. */
  const DATED = "(o.date_precision IS NULL OR o.date_precision <> 'period')"

  const rows = await db
    .prepare(
      `SELECT substr(o.ordered_at, 1, 10) AS day,
              COALESCE(SUM(o.total_amount), 0) AS revenue,
              COUNT(*) AS orders
         FROM active_order o
        WHERE o.library_id = ? AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
          AND ${DATED}
        GROUP BY day
        ORDER BY day`,
    )
    .all(libraryId, period.from, period.to)

  const cogsByDay = await db
    .prepare(
      `SELECT substr(o.ordered_at, 1, 10) AS day,
              COALESCE(SUM(oi.quantity * ${COST}), 0) AS cogs
       ${ITEM_JOIN}
        WHERE oi.library_id = ? AND ${SOLD} AND ${DATED}
          AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
        GROUP BY day`,
    )
    .all(libraryId, period.from, period.to)

  /** 클레임은 **자기 날짜**로 붙는다 — 주문일이 아니라 클레임 발생일이다. */
  const claimsByDay = await db
    .prepare(
      `SELECT substr(claimed_at, 1, 10) AS day, COALESCE(SUM(amount), 0) AS amt
         FROM active_claim
        WHERE library_id = ? AND claimed_at >= ? AND claimed_at < date(?, '+1 day')
        GROUP BY day`,
    )
    .all(libraryId, period.from, period.to)

  /** 수수료·배송비는 **주문 귀속**이다 (ADR-009 ①) — 정산일이 아니라 주문일로 묶는다. */
  const feeByDay = await db
    .prepare(
      `SELECT substr(o.ordered_at, 1, 10) AS day,
              COALESCE(SUM(s.fee_amount + s.vat_amount), 0) AS fee,
              COALESCE(SUM(s.shipping_amount), 0) AS ship
         FROM active_settlement s
         JOIN active_order o ON o.source_key = s.order_source_key
        WHERE s.library_id = ? AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
          AND ${DATED}
        GROUP BY day`,
    )
    .all(libraryId, period.from, period.to)

  const byDay = <T>(list: readonly Record<string, unknown>[], pick: (r: Record<string, unknown>) => T) => {
    const m = new Map<string, T>()
    for (const r of list) m.set(String(r["day"] ?? ""), pick(r))
    return m
  }
  const cogsMap = byDay(cogsByDay, (r) => Number(r["cogs"] ?? 0))
  const claimMap = byDay(claimsByDay, (r) => Number(r["amt"] ?? 0))
  const feeMap = byDay(feeByDay, (r) => ({
    fee: Number(r["fee"] ?? 0),
    ship: Number(r["ship"] ?? 0),
  }))

  const spread = await db
    .prepare(
      `SELECT COALESCE(SUM(total_amount), 0) AS amt
         FROM active_order
        WHERE library_id = ? AND ordered_at >= ? AND ordered_at < date(?, '+1 day')
          AND date_precision = 'period'`,
    )
    .get(libraryId, period.from, period.to)

  return {
    points: rows.map((r) => {
      const day = String(r["day"] ?? "")
      const revenue = Number(r["revenue"] ?? 0)
      const cogs = cogsMap.get(day) ?? 0
      const claims = claimMap.get(day) ?? 0
      const { fee, ship } = feeMap.get(day) ?? { fee: 0, ship: 0 }
      return {
        day,
        revenue,
        orderCount: Number(r["orders"] ?? 0),
        cogs,
        claims,
        fee,
        shipping: ship,
        // 스냅샷의 `productContribution`과 같은 항 (운영비만 제외 — 월 기준값이다).
        contribution: revenue - fee - ship - claims - cogs,
      }
    }),
    periodOnly: Number(spread?.["amt"] ?? 0),
  }
}

export interface ChannelRow {
  readonly connectionId: string
  /** 사람이 읽는 채널 이름. 내부 키를 화면에 내보내지 않는다 (헌장 C-4). */
  readonly name: string
  readonly revenue: number
  readonly orderCount: number
  readonly claims: number
  readonly cogs: number
  /**
   * 이 채널 **주문에 이어 붙은** 정산 수수료(+VAT). 정산 파일이 없는 채널은 0이고,
   * 그 0은 «수수료가 없다»가 아니라 «파일이 없다»이다 — 그 구분은 커버리지가 한다.
   */
  readonly fee: number
}

/**
 * 채널별 손익 — **연결 단위로 같은 계산을 다시 한다.**
 *
 * ★ 왜 스냅샷을 나누지 않고 다시 조회하나 ★
 * 손익 스냅샷은 라이브러리 전체의 합이라 채널로 쪼갤 수 없다(수수료가 주문
 * 귀속이라 나누는 규칙이 필요하다). 여기서 **같은 조각**(`ITEM_JOIN`·`COST`)으로
 * 연결별로 다시 묶으면 두 화면이 갈릴 여지가 없다.
 *
 * 광고비는 이 표에 없다 — 캠페인이 연결에 붙긴 하지만 «상품 기여이익»의 항이
 * 아니고(손익 3층), 이 표가 답하는 질문은 «어느 채널이 남기나»다.
 */
export async function loadChannelRows(
  db: Driver,
  libraryId: string,
  period: Period,
): Promise<ChannelRow[]> {
  const rows = await db
    .prepare(
      `SELECT c.id AS conn_id, c.display_name AS name,
              COALESCE(SUM(o.total_amount), 0) AS revenue,
              COUNT(o.id) AS orders
         FROM active_order o
         JOIN connection c ON c.id = o.connection_id
        WHERE o.library_id = ? AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
        GROUP BY c.id
        ORDER BY revenue DESC`,
    )
    .all(libraryId, period.from, period.to)

  const out: ChannelRow[] = []
  for (const r of rows) {
    const connectionId = String(r["conn_id"])

    const cogsRow = await db
      .prepare(
        `SELECT COALESCE(SUM(oi.quantity * ${COST}), 0) AS cogs
         ${ITEM_JOIN}
          WHERE oi.library_id = ? AND oi.connection_id = ? AND ${SOLD}
            AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')`,
      )
      .get(libraryId, connectionId, period.from, period.to)

    const claimRow = await db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS claims
           FROM active_claim
          WHERE library_id = ? AND connection_id = ?
            AND claimed_at >= ? AND claimed_at < date(?, '+1 day')`,
      )
      .get(libraryId, connectionId, period.from, period.to)

    // 수수료는 **주문 귀속**이다 (ADR-009 ① — 금액은 정산에서, 날짜는 주문에서).
    // 8월에 정산된 7월 주문의 수수료가 7월 채널 손익에 잡히는 것이 이 조인이다.
    const feeRow = await db
      .prepare(
        `SELECT COALESCE(SUM(s.fee_amount + s.vat_amount), 0) AS fee
           FROM active_settlement s
           JOIN active_order o ON o.source_key = s.order_source_key
                              AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
          WHERE s.library_id = ? AND o.connection_id = ?`,
      )
      .get(period.from, period.to, libraryId, connectionId)

    out.push({
      connectionId,
      name: String(r["name"] ?? ""),
      revenue: Number(r["revenue"] ?? 0),
      orderCount: Number(r["orders"] ?? 0),
      claims: Number(claimRow?.["claims"] ?? 0),
      cogs: Number(cogsRow?.["cogs"] ?? 0),
      fee: Number(feeRow?.["fee"] ?? 0),
    })
  }
  return out
}
