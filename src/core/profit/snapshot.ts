/**
 * 손익 스냅샷 — **기간 하나에 대한 조회와 계산을 한 번에.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 이 파일이 있는가 ★
 *
 * 이 조회 로직은 원래 `tools/harness/pnl.ts`(3b-0 CLI) 안에만 있었다. 화면을
 * 배선하면서 같은 SQL을 앱 쪽에 다시 쓰면 **두 번째 진실이 생긴다** — 조인
 * 조건 하나가 어긋나도 CLI와 화면이 다른 답을 내고, 그 차이는 아무도 모르게
 * 쌓인다 (헌장 A-5 · 단일 계산기 LOCK).
 *
 * 그래서 계산기(`computePnl`)뿐 아니라 **계산기에 넣을 값을 만드는 과정**도
 * 하나로 둔다. CLI와 화면은 이 함수의 **소비자**일 뿐이고, 둘이 같은 숫자를
 * 내는 것은 우연이 아니라 구조다.
 * ─────────────────────────────────────────────────────────────
 *
 * 집계는 전부 SQL에 위임한다 (헌장 B-5). 행을 메모리로 끌어와 더하지 않는다.
 */

import type { Driver } from "../store/driver.js"
import { Repository } from "../store/repository.js"
import { costAtSql } from "../cost/index.js"
import { computePnl, prorateFixed, type Period, type Pnl } from "./index.js"

/**
 * 품목 행의 «그 판매일에 유효한 매입원가» — 규칙은 `costAtSql`이 갖고 있다.
 *
 * `'COGS'`를 리터럴로 넣는 것은 이 자리가 손익 3층의 «매입원가»이기 때문이다.
 * 포장비·물류비는 상품 층의 «운영비»라 다른 자리에서 더해진다(오늘은 `base.ops`).
 */
const COST = costAtSql({
  libraryId: "oi.library_id",
  skuId: "ml.sku_id",
  kind: "'COGS'",
  on: "o.ordered_at",
})

/**
 * ★ SKU는 **품목이 아니라 리스팅**이 안다 ★
 *
 * `fact_order_item.sku_id`는 비워 둔다. 적재 시점에 박아 넣으면 그 값은 **그때의
 * 연결 상태를 찍은 사진**이 되고, 사용자가 나중에 리스팅을 SKU에 연결해도 이미
 * 들어온 품목은 영원히 NULL로 남는다 — 원가를 넣어도 손익이 안 움직이는 두 번째
 * 함정이 될 자리다.
 *
 * 대신 `listing_id`(자연키에서 나오는 안정된 id)만 박고 SKU는 **조회 때 이어붙인다.**
 * 그러면 연결하는 순간 과거 판매의 원가가 소급해서 붙고, 잘못 연결한 것을 고치면
 * 그 정정도 소급된다. 연결은 «기준 데이터»이고 기준 데이터의 정정이 이력을
 * 바로잡는 것은 정상 동작이다.
 */
const ITEM_JOIN =
  `FROM active_order_item oi
     JOIN active_order o ON o.id = oi.order_id
     LEFT JOIN marketplace_listing ml ON ml.id = oi.listing_id AND ml.link_state = 'linked'`

/**
 * ★ 수량 0인 품목은 «원가 미상»의 모집단이 아니다 ★
 *
 * 쿠팡 제트는 안 팔린 옵션도 행으로 내보낸다 — 실측 147행 중 103행이 수량 0이다.
 * 그 행들을 세면 «147품목 중 103건 원가 미상»이 되는데, 그건 거짓 경보다: 0개
 * 팔린 물건의 원가를 몰라도 손익은 한 푼도 틀리지 않는다.
 *
 * 그렇다고 그 행을 **적재에서** 빼지는 않는다 (§22) — «이 옵션은 이 달에 안 팔렸다»는
 * 사실이고, 사실을 지워 경보를 끄는 것이 이 프로젝트가 가장 경계하는 동작이다.
 * 지우는 대신 **세는 자리에서 가른다.**
 */
const SOLD = "oi.quantity > 0"

/**
 * 사람이 넣는 기준 데이터 중 **아직 화면이 없는 것.**
 *
 * ★ `cogs`가 여기서 빠졌다 (③④, 2026-08-14) ★
 * 매입원가는 이제 `cost_history`에 있고 이 함수가 **직접 조회한다.** 인자로도 받을 수
 * 있게 두면 «인자로 온 원가»와 «DB의 원가»가 갈리고, 그때 화면과 CLI가 다른 순이익을
 * 낸다 — 단일 계산기 원칙이 막으려는 바로 그 모양이다. 두 입구를 두지 않는다.
 */
export interface BaseCosts {
  /** 운영비 (포장·물류). */
  readonly ops?: number
  /** **월** 고정비. 기간 안분은 `prorateFixed`가 한다 — 8/31 고정이 아니다. */
  readonly fixedMonthly?: number
}

/**
 * 손익과, **그 숫자가 담지 못한 것**.
 *
 * 후자를 함께 내는 이유는 헌장 A-5다 — 조인되지 않은 정산이 있으면 손익에서
 * 수수료가 빠지는데, 그 사실을 숨기면 화면이 조용히 거짓말을 한다.
 */
export interface PnlSnapshot {
  readonly pnl: Pnl
  /**
   * 기간 안 **판매** 건수 — 취소된 것도 «팔리기는 했다»이므로 포함된다.
   *
   * ★ 이 숫자의 뜻이 바뀌었다 (이중 기록, 2026-08-14) ★
   * 전에는 ESM 클레임 계열 9건이 `fact_claim`으로만 가서 여기 없었다(146). 이제
   * 주문에도 들어가므로 155다. 그 9건이 매출에 잡히고 클레임이 다시 빼는 것이
   * 회계상 옳고, **그러려면 판매 건수에도 있어야 한다** — 매출 8,285,200원이
   * 155건에서 나왔다고 말해야 건당 금액이 맞는다.
   *
   * 화면은 이 값을 혼자 두지 않는다: **«판매 155 · 취소 9»**로 함께 쓴다.
   * 146이라는 숫자는 이제 어디에도 없고, 그 소멸은 의도된 것이다.
   */
  readonly orderCount: number
  /** 기간 안 클레임 건수. `orderCount`와 **짝으로만** 표시한다 (위 주석). */
  readonly claimCount: number
  /**
   * 정산 원자료. **파생하지 않고 둘 다 준다** — 소비자마다 필요한 모양이 달라서다.
   *
   * `all`과 `joined`의 차이가 곧 **손익에서 빠진 수수료**다. 11번가처럼 정산
   * 파일만 있고 주문 파일이 없으면 그 차이가 벌어진다. 숨기지 않는 것이 요점이다
   * (헌장 A-5).
   */
  readonly settlement: {
    readonly all: {
      readonly count: number
      readonly fee: number
      readonly vat: number
      readonly shipping: number
      readonly gross: number
      readonly net: number
    }
    readonly joined: {
      readonly count: number
      readonly fee: number
      readonly vat: number
      readonly shipping: number
    }
  }
  /** 발생일이 **추정**인 클레임 수 (`date_precision='proxy'`, ADR-009 ①-보완). */
  readonly proxyDatedClaims: number
  /**
   * **기간 집계로 들어온 주문** (`date_precision='period'`, 마이그레이션 005).
   *
   * 로켓그로스처럼 마켓이 건별 데이터를 주지 않는 채널이 여기 잡힌다. 월 합계는
   * 온전하지만 **일별 분해가 불가능**하므로, 그 한계를 `pnlGaps`가 말한다.
   *
   * `spilling`은 기간이 조회 범위를 **넘어가는** 행 수다 — 월 단위 파일을 월 단위로
   * 보는 한 0이고, 0이 아니면 귀속이 애매해진 것이다.
   */
  readonly periodAggregated: {
    readonly count: number
    readonly amount: number
    readonly spilling: number
  }
  /**
   * 이 기간에 데이터를 보탠 **연결의 수**. 매출·광고비·정산을 통틀어 센다.
   *
   * 2 이상이면 순이익이 여러 연결의 합성이다 — 한 채널의 완결된 손익으로 읽으면
   * 안 된다는 뜻이고, `pnlGaps`가 그 단서를 만든다. 연결이 하나로 정리되면
   * 단서는 **스스로 사라진다** (하드코딩된 경고문이면 그러지 못한다).
   */
  readonly contributingConnections: number
  /**
   * 이 기간 **이전에** 데이터가 있는가 — 비교(전월 대비)가 성립하는지의 근거.
   *
   * 화면의 "전월 대비"·"vs 지난달" 문장은 이 값에 묶인다. 하드코딩된 라벨이면
   * 비교 대상이 없는데도 있는 척하고, 나중에 데이터가 들어와도 **누가 다시 켜야**
   * 한다. 데이터에서 파생시키면 **8월 파일이 들어오는 날 스스로 살아난다.**
   */
  readonly hasPriorPeriod: boolean
  /**
   * **매입원가가 어디까지 계산됐나** (③④).
   *
   * ★ 왜 숫자 하나로 끝나지 않는가 ★
   * `pnl.cogs === 0`에는 뜻이 셋이나 있다 — ① 원가를 안 넣었다 ② 넣었는데 곱할
   * 품목 데이터가 없다 ③ 정말로 원가가 0원인 상품만 팔렸다. 셋을 한 문장으로 말하면
   * 반드시 둘은 거짓이 되고, 오늘 화면이 하던 말(*"cost_history가 비어 있다"*)은
   * 사용자가 원가를 넣는 순간 **거짓말이 된다.** 그래서 근거를 들고 나간다.
   */
  readonly cogsBasis: {
    /**
     * 기간 안에 **실제로 팔린** 품목 행 수 (`quantity > 0`).
     *
     * 0개 팔린 품목을 세지 않는 이유는 그 행의 원가를 몰라도 손익이 한 푼도 틀리지
     * 않기 때문이다 — 쿠팡 제트는 안 팔린 옵션도 행으로 내보내고(실측 147행 중
     * 103행이 수량 0) 그것을 세면 게이지가 거짓으로 빨개진다.
     */
    readonly items: number
    /**
     * 그중 **리스팅이 SKU에 연결되지 않은** 행 수.
     *
     * «원가 미입력»과 처방이 완전히 다르다 — 이쪽은 상품 연결 화면에서 연결해야
     * 하고, 원가를 아무리 넣어도 해소되지 않는다. 뭉뚱그리면 사용자가 엉뚱한
     * 화면에서 헤맨다.
     */
    readonly itemsWithoutLink: number
    /** 연결은 됐는데 그날 유효한 원가를 **모르는** 행 수. `costAt`이 `null`을 낸 행이다. */
    readonly itemsWithoutCost: number
    /** 원가를 모르는 행의 수량 합 — 크기를 말할 수 있게 («N개가 빠졌다»). */
    readonly qtyWithoutCost: number
    /**
     * ★ 기간 집계 행 중 **원가가 근사인** 행 수** (조건 2) ★
     *
     * `date_precision='period'`이면서 그 기간 **안에서** 원가가 바뀐 행이다.
     * `costAt`이 기간 시작일로 단가를 고르므로 기간 후반 판매분이 옛 단가로 잡힌다.
     * 0이면 근사가 실재하지 않는다는 뜻이고 화면은 아무 말도 하지 않는다.
     */
    readonly periodApproxItems: number
    /**
     * ★ **이 기간의** 주문 중 품목이 붙지 않은 건수 ★
     *
     * 품목 없이 들어온 주문은 원가 계산의 모집단 **밖**이다 — 매출에는 잡히고
     * 매입원가에는 안 잡히므로 기여이익이 그만큼 부푼다. 오늘 그런 주문이 생기는
     * 경로는 하나뿐이다: **품목 적재 이전에 들어온 batch.** 그 파일을 다시 넣으면
     * 품목이 생기고 이 값이 스스로 0이 된다.
     *
     * boolean이 아닌 이유는 아래 `amountWithoutItems`와 같다 — 아래 주석 참조.
     */
    readonly ordersWithoutItems: number
    /** 그 주문들의 매출 합. **크기를 말할 수 있어야** 사용자가 무게를 안다. */
    readonly amountWithoutItems: number
    /**
     * 기간 안 주문 중 품목이 붙은 건수. `ordersWithoutItems`와 합이 `orderCount`다.
     *
     * ★ 왜 «있나 없나»가 아닌가 ★ 전에는 라이브러리 전역 `hasOrderItems` boolean이었고,
     * 그 한 줄이 «품목 있는 파일 하나»만으로 나머지 파일의 부재를 전 표면에서
     * 지웠다. §22가 요구하는 것은 «있나»가 아니라 **«몇 건이 밖에 있나»**다.
     */
    readonly ordersWithItems: number
  }
}

export async function loadPnlSnapshot(
  db: Driver,
  libraryId: string,
  period: Period,
  base: BaseCosts = {},
): Promise<PnlSnapshot> {
  const repo = new Repository(db)

  const revenue = await repo.sumInRange(
    "active_order",
    "total_amount",
    libraryId,
    "ordered_at",
    period.from,
    period.to,
  )
  const orderCount = await repo.countInRange(
    "active_order",
    libraryId,
    "ordered_at",
    period.from,
    period.to,
  )
  const adSpend = await repo.sumInRange(
    "active_ad_spend",
    "spend_amount",
    libraryId,
    "spent_on",
    period.from,
    period.to,
  )

  /**
   * 기간 집계로 들어온 주문 (`date_precision='period'`, 마이그레이션 005).
   *
   * ★ 왜 세는가 ★ 이 행들은 **일별로 분해할 수 없다.** 월 합계에는 온전히
   * 들어가지만 일별 차트에서는 통째로 빠지고, 그 부재를 말하지 않으면 사용자는
   * 일별 그래프의 합이 월 숫자와 다른 것을 보고 어느 쪽이 틀렸는지 모른다.
   *
   * `period_end`가 조회 기간을 벗어나면 **기간이 달 경계를 걸친 것**이다 — 그때만
   * 귀속이 애매해지므로 따로 센다.
   */
  const periodRows = await db
    .prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_amount),0) AS amt,
              SUM(CASE WHEN period_end IS NOT NULL AND period_end > ? THEN 1 ELSE 0 END) AS spill
         FROM active_order
        WHERE library_id = ? AND date_precision = 'period'
          AND ordered_at >= ? AND ordered_at < date(?, '+1 day')`,
    )
    .get(period.to, libraryId, period.from, period.to)

  /**
   * 수수료는 **주문 귀속**이다 — 정산일이 아니라 주문의 `ordered_at` 달에 잡힌다
   * (ADR-009 ① · `profit/index.ts`의 "금액은 정산에서, 날짜는 주문에서").
   * `order_source_key`로 이어 붙인다.
   */
  const joined = await db
    .prepare(
      `SELECT COALESCE(SUM(s.fee_amount),0) AS fee, COALESCE(SUM(s.vat_amount),0) AS vat,
              COALESCE(SUM(s.shipping_amount),0) AS ship, COUNT(*) AS n
         FROM active_settlement s
         JOIN active_order o ON o.source_key = s.order_source_key
                            AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
        WHERE s.library_id = ?`,
    )
    .get(period.from, period.to, libraryId)

  /** 정산 전체 — 조인된 것과의 차이가 곧 "손익에서 빠진 수수료"다. */
  const all = await db
    .prepare(
      `SELECT COALESCE(SUM(fee_amount),0) AS fee, COALESCE(SUM(vat_amount),0) AS vat,
              COALESCE(SUM(shipping_amount),0) AS ship, COALESCE(SUM(gross_amount),0) AS gross,
              COALESCE(SUM(net_amount),0) AS net, COUNT(*) AS n
         FROM active_settlement
        WHERE library_id = ? AND settled_on >= ? AND settled_on < date(?, '+1 day')`,
    )
    .get(libraryId, period.from, period.to)

  /**
   * 클레임 — **발생일 기준**이다 (ADR-009 ①). 원거래 월로 소급하지 않는다.
   * 부호는 저장값이 아니라 `claim_type`이 정하므로 유형과 금액을 그대로 넘긴다.
   */
  const claimRows = await db
    .prepare(
      `SELECT claim_type, amount, date_precision FROM active_claim
        WHERE library_id = ? AND claimed_at >= ? AND claimed_at < date(?, '+1 day')`,
    )
    .all(libraryId, period.from, period.to)

  const claims = claimRows.map((r) => ({
    type: String(r["claim_type"]),
    amount: Number(r["amount"]),
  }))

  /**
   * 기간에 데이터를 보탠 연결 수. 세 테이블을 `UNION`해 **서로 다른 연결**만 센다.
   *
   * 테이블별로 `COUNT(DISTINCT)`를 세면 "각각 1개"가 나와 섞인 것을 못 잡는다 —
   * 섞임은 테이블 **사이**에서 생기기 때문이다.
   */
  const conns = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT DISTINCT connection_id FROM active_order
          WHERE library_id = ? AND ordered_at >= ? AND ordered_at < date(?, '+1 day')
         UNION
         SELECT DISTINCT connection_id FROM active_ad_spend
          WHERE library_id = ? AND spent_on >= ? AND spent_on < date(?, '+1 day')
         UNION
         SELECT DISTINCT connection_id FROM active_settlement
          WHERE library_id = ? AND settled_on >= ? AND settled_on < date(?, '+1 day')
       )`,
    )
    .get(
      libraryId, period.from, period.to,
      libraryId, period.from, period.to,
      libraryId, period.from, period.to,
    )

  /**
   * ★ ④ — 매입원가. 원가는 **판매일 기준**으로 붙는다 ★
   *
   * 규칙(«판매일 이전 중 가장 늦은 이력»)은 `costAtSql`이 한 번만 적고 있다. 여기서
   * 다시 적으면 화면(`costAt`)과 손익이 갈리고, 그 차이는 아무도 모르게 쌓인다.
   *
   * ★ 원가를 모르는 행은 **0으로 세지 않는다** ★
   * `SUM(quantity * NULL)`에서 그 행은 합에 아무것도 보태지 않는다 — 0원짜리로
   * 취급되는 것이 아니라 **빠진다.** 대신 몇 행이 그렇게 빠졌는지를 함께 세어
   * `pnlGaps`가 말한다. 여기서 0을 채워 넣으면 그 상품의 기여이익이 매출 전액이 되고
   * 화면은 «원가 미입력»이 아니라 «엄청 남는 상품»이라고 말한다 (§22 계열).
   *
   * 날짜 상한에 `BETWEEN`을 쓰지 않는 이유는 다른 조회와 같다 — `ordered_at`이 시각을
   * 달고 있으면 마지막 날이 통째로 빠진다.
   */
  const cogsRow = await db
    .prepare(
      `SELECT COALESCE(SUM(oi.quantity * ${COST}),0) AS cogs,
              COUNT(*) AS items,
              COALESCE(SUM(CASE WHEN ml.sku_id IS NULL THEN 1 ELSE 0 END),0) AS no_link,
              COALESCE(SUM(CASE WHEN ml.sku_id IS NOT NULL AND ${COST} IS NULL THEN 1 ELSE 0 END),0) AS no_cost,
              COALESCE(SUM(CASE WHEN ml.sku_id IS NOT NULL AND ${COST} IS NULL THEN oi.quantity ELSE 0 END),0) AS no_cost_qty
       ${ITEM_JOIN}
        WHERE oi.library_id = ? AND ${SOLD}
          AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')`,
    )
    .get(libraryId, period.from, period.to)

  /**
   * ★ «품목이 없는 주문»을 **기간 안에서** 센다 ★
   *
   * 여기 있던 것은 `EXISTS(… WHERE library_id = ?)` — **라이브러리 전역 boolean**이었다.
   * 적대적 검토가 그 한 줄로 세 표면을 동시에 침묵시켰다:
   *
   * ```
   * 품목 없는 옛 batch(ESM 주문 146 · 789만원) + 품목 있는 새 batch(제트) 공존
   *   → hasOrderItems = true (제트 때문에)
   *   → cogs-unappliable 억제 · 상품 화면 게이지 note 소멸 · soldQty가 «0»으로 표시
   *   → 146건 789만원이 원가 모집단 **밖**인데 그 부재를 말하는 줄이 하나도 없다
   * ```
   *
   * **이건 사용자의 바로 다음 동작 위에 있었다.** 파일을 한 번에 하나씩 다시 넣으므로
   * 첫 재가져오기 한 번에 나머지 파일의 부재가 통째로 조용해진다.
   *
   * 그래서 boolean이 아니라 **모집단으로 센다** — §22가 요구하는 것은 «있나 없나»가
   * 아니라 «몇 건이 밖에 있나»다.
   */
  /**
   * ★ 취소된 판매는 «품목 없음»이 **정상**이다 ★
   *
   * 이중 기록(`alsoDefault`)은 취소된 행을 주문에도 넣지만 품목은 **일부러**
   * 만들지 않는다 — 매출·클레임이 상쇄되므로(net 0) 원가도 붙지 않아야 정합이다.
   * 그 행을 «품목이 없다»로 세면 화면이 *"그 파일을 다시 넣으면 품목이 생긴다"*고
   * 말하는데, **다시 넣어도 안 생긴다.** 못 지킬 처방이라 세지 않는다.
   *
   * 판정은 «같은 `source_key`의 클레임이 있는가»다 — 이중 기록이 두 행에 같은 키를
   * 주므로 조인이 정확하고, 근사 매칭이 아니다 (ADR-006).
   */
  const itemCoverage = await db
    .prepare(
      `SELECT COUNT(*) AS orders,
              SUM(CASE WHEN EXISTS(SELECT 1 FROM active_order_item i WHERE i.order_id = o.id)
                       THEN 1 ELSE 0 END) AS with_items,
              COALESCE(SUM(CASE WHEN NOT EXISTS(SELECT 1 FROM active_order_item i WHERE i.order_id = o.id)
                       THEN o.total_amount ELSE 0 END),0) AS amount_without
         FROM active_order o
        WHERE o.library_id = ? AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
          AND NOT EXISTS (SELECT 1 FROM active_claim c
                           WHERE c.connection_id = o.connection_id AND c.source_key = o.source_key)`,
    )
    .get(libraryId, period.from, period.to)

  /**
   * ★ 조건 2 — 기간 집계 매출의 원가는 **근사다** ★
   *
   * `date_precision='period'` 행은 `ordered_at`이 기간 **시작일**이다. `costAt`도
   * 그 날짜로 원가를 고르므로, **기간 안에서 원가가 바뀌면 기간 전체가 시작일
   * 단가로 계산된다.** 로켓그로스처럼 한 달치가 한 행으로 오는 채널에서 8/15부터
   * 원가가 올랐다면 8월 후반 판매분이 옛 단가로 잡힌다.
   *
   * ★ 조용한 근사를 만들지 않는다 ★ 근사 자체는 피할 수 없다 — 파일이 일별
   * 분해를 주지 않기 때문이다. 피할 수 있는 것은 **모르고 지나가는 것**이다.
   * 그래서 «그 기간 안에 실제로 원가가 바뀐 행이 있는가»를 센다. 없으면 이 값은
   * 0이고 화면은 아무 말도 하지 않는다 — **근사가 실재할 때만 말한다.**
   */
  const approxRow = await db
    .prepare(
      `SELECT COUNT(*) AS n
       ${ITEM_JOIN}
        WHERE oi.library_id = ? AND ${SOLD}
          AND o.date_precision = 'period' AND o.period_end IS NOT NULL
          AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
          AND EXISTS (
            SELECT 1 FROM cost_history c
             WHERE c.library_id = oi.library_id AND c.sku_id = ml.sku_id AND c.kind = 'COGS'
               AND c.effective_from > o.ordered_at AND c.effective_from <= o.period_end)`,
    )
    .get(libraryId, period.from, period.to)

  /** 기간 시작 **이전**에 주문·광고비·정산이 하나라도 있나. 비교의 성립 근거다. */
  const prior = await db
    .prepare(
      `SELECT (
         EXISTS(SELECT 1 FROM active_order      WHERE library_id = ? AND ordered_at < ?) OR
         EXISTS(SELECT 1 FROM active_ad_spend   WHERE library_id = ? AND spent_on   < ?) OR
         EXISTS(SELECT 1 FROM active_settlement WHERE library_id = ? AND settled_on < ?)
       ) AS n`,
    )
    .get(libraryId, period.from, libraryId, period.from, libraryId, period.from)

  const num = (row: Record<string, unknown> | undefined, k: string): number => Number(row?.[k] ?? 0)

  const pnl = computePnl({
    period,
    revenue,
    fee: num(joined, "fee"),
    vat: num(joined, "vat"),
    shipping: num(joined, "ship"),
    claims,
    cogs: num(cogsRow, "cogs"),
    adDirect: 0,
    adUnallocated: adSpend,
    ops: base.ops ?? 0,
    fixed: prorateFixed(base.fixedMonthly ?? 0, period),
  })

  return {
    pnl,
    orderCount,
    claimCount: claimRows.length,
    settlement: {
      all: {
        count: num(all, "n"),
        fee: num(all, "fee"),
        vat: num(all, "vat"),
        shipping: num(all, "ship"),
        gross: num(all, "gross"),
        net: num(all, "net"),
      },
      joined: {
        count: num(joined, "n"),
        fee: num(joined, "fee"),
        vat: num(joined, "vat"),
        shipping: num(joined, "ship"),
      },
    },
    proxyDatedClaims: claimRows.filter((r) => r["date_precision"] === "proxy").length,
    periodAggregated: {
      count: num(periodRows, "n"),
      amount: num(periodRows, "amt"),
      spilling: num(periodRows, "spill"),
    },
    contributingConnections: num(conns, "n"),
    hasPriorPeriod: num(prior, "n") === 1,
    cogsBasis: {
      items: num(cogsRow, "items"),
      itemsWithoutLink: num(cogsRow, "no_link"),
      itemsWithoutCost: num(cogsRow, "no_cost"),
      qtyWithoutCost: num(cogsRow, "no_cost_qty"),
      periodApproxItems: num(approxRow, "n"),
      ordersWithItems: num(itemCoverage, "with_items"),
      ordersWithoutItems: num(itemCoverage, "orders") - num(itemCoverage, "with_items"),
      amountWithoutItems: num(itemCoverage, "amount_without"),
    },
  }
}
