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
import { computePnl, prorateFixed, type Period, type Pnl } from "./index.js"

/** 사람이 넣는 기준 데이터. 아직 화면이 없으므로 기본은 0이다. */
export interface BaseCosts {
  /** 매입원가 (COGS). */
  readonly cogs?: number
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
  /** 기간 안 주문 건수. */
  readonly orderCount: number
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
    cogs: base.cogs ?? 0,
    adDirect: 0,
    adUnallocated: adSpend,
    ops: base.ops ?? 0,
    fixed: prorateFixed(base.fixedMonthly ?? 0, period),
  })

  return {
    pnl,
    orderCount,
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
    contributingConnections: num(conns, "n"),
    hasPriorPeriod: num(prior, "n") === 1,
  }
}
