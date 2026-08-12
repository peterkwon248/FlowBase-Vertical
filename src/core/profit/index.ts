/**
 * 손익 3층 계산기 — **이것이 유일한 구현이다** (작업-상태 LOCK).
 *
 * 화면은 이 함수를 **소비만** 한다. 목업의 `profit()`을 두 번째 진실로 이식하는 것은
 * 금지다 — 계산이 두 벌이 되는 순간 화면과 CLI가 다른 답을 내고, 그 차이는 아무도
 * 모르게 쌓인다 (헌장 A-5).
 *
 * ```
 * 매출 − 할인·수수료·VAT·배송 − 매입원가 − 직접 광고비 − 운영비
 * = 상품 기여이익
 *  − 미배분 광고비
 * = 채널 기여이익
 *  − 고정비
 * = 회사 순이익
 * ```
 *
 * **상품별 손익의 합은 회사 순이익이 아니다.** 그게 정상이고 화면이 그 차이를
 * 보여준다 — 미배분 광고비와 고정비가 상품에 붙지 않기 때문이다.
 *
 * ★ 순수 함수다 ★
 * 목업의 `profit()`은 모듈 전역(COSTS·ADJUST·OPS·FIXED·AD_UNALLOC)을 읽었다.
 * 여기서는 전부 인자로 받는다 (헌장 C-2). DB도 모른다 — 집계된 숫자만 받으므로
 * 테스트가 파일도 SQLite도 필요 없다.
 */

import { allocate } from "../accounting/allocate.js"
import { claimSign } from "../accounting/recognition.js"

/** 조회 기간. 경계는 KST 자정이고 양끝 포함이다 (ADR-009 ④). */
export interface Period {
  readonly from: string
  readonly to: string
}

/**
 * 계산에 들어가는 집계값. **전부 양수로 받는다** (ADR-009 ②) — 차감 여부는
 * 이 함수가 안다. 호출자가 부호를 섞어 넣으면 조용히 두 번 빼진다.
 */
export interface PnlInput {
  readonly period: Period
  /** 매출 — 주문일이 기간 안인 주문 (ADR-009 ①). */
  readonly revenue: number
  /** 할인. 매출에서 이미 차감돼 있으면 0으로 둔다. */
  readonly discount?: number
  /** 수수료 — 정산 파일에서 오되 **주문에 귀속**된다 (아래 주석 참조). */
  readonly fee: number
  readonly vat: number
  readonly shipping: number
  /** 클레임 — 발생일이 기간 안인 것. 원거래 월로 소급하지 않는다. */
  readonly claims: readonly { readonly type: string; readonly amount: number }[]
  /** 매입원가 (COGS). */
  readonly cogs: number
  /** 상품에 귀속된 직접 광고비. */
  readonly adDirect: number
  /** 상품에 배분되지 않은 광고비 — 채널 층에서 빠진다. */
  readonly adUnallocated: number
  /** 운영비 (포장·물류) — 상품 층에서 빠진다. */
  readonly ops?: number
  /** 고정비 — **이미 기간 안분된 값**을 받는다. 안분은 `prorateFixed()`가 한다. */
  readonly fixed?: number
}

export interface Pnl {
  readonly period: Period
  readonly revenue: number
  readonly discount: number
  readonly fee: number
  readonly vat: number
  readonly shipping: number
  /** 클레임 차감액 (양수). `claimSign`이 0인 유형은 빠져 있다. */
  readonly claims: number
  readonly cogs: number
  readonly adDirect: number
  readonly adUnallocated: number
  readonly ops: number
  readonly fixed: number
  /** 1층. */
  readonly productContribution: number
  /** 2층. */
  readonly channelContribution: number
  /** 3층. */
  readonly netProfit: number
}

/**
 * ★ 수수료는 정산 파일에서 오지만 정산일에 잡히지 않는다 ★
 *
 * ADR-009 ①은 "`fact_settlement`는 손익 인식에 쓰지 않는다"고 했다. 그건
 * **인식 기준일**의 이야기다 — `settled_on`/`pay_out_on`으로 달을 정하지
 * 않는다는 뜻이지, 정산 파일의 금액을 손익에서 뺀다는 뜻이 아니다.
 *
 * 실제로 수수료·VAT·배송비는 정산 파일에만 있고, 스키마도 그렇게 설계돼 있다:
 * `fact_settlement`에 `fee_amount`·`vat_amount`·`shipping_amount`가 있고
 * **`order_source_key`**로 주문에 이어진다. 그 링크를 타고 **그 주문의
 * `ordered_at` 달**에 귀속시키는 것이 발생주의다.
 *
 * 요약: 금액은 정산에서, 날짜는 주문에서.
 */
export function computePnl(input: PnlInput): Pnl {
  const discount = input.discount ?? 0
  const ops = input.ops ?? 0
  const fixed = input.fixed ?? 0

  // 클레임은 유형이 부호를 정한다 (ADR-009 ②). EXCHANGE는 0이라 빠진다.
  const claims = input.claims.reduce((a, c) => a + Math.abs(c.amount) * -claimSign(c.type), 0)

  const productContribution =
    input.revenue -
    discount -
    input.fee -
    input.vat -
    input.shipping -
    claims -
    input.cogs -
    input.adDirect -
    ops

  const channelContribution = productContribution - input.adUnallocated
  const netProfit = channelContribution - fixed

  return {
    period: input.period,
    revenue: input.revenue,
    discount,
    fee: input.fee,
    vat: input.vat,
    shipping: input.shipping,
    claims,
    cogs: input.cogs,
    adDirect: input.adDirect,
    adUnallocated: input.adUnallocated,
    ops,
    fixed,
    productContribution,
    channelContribution,
    netProfit,
  }
}

/** 하루를 밀리초로. 날짜 산술에만 쓰고 표시에는 쓰지 않는다. */
const DAY = 86_400_000

/**
 * 기간에 포함된 날 수 (양끝 포함).
 *
 * `Date.UTC`로 만든다 — 로컬 시간대로 파싱하면 실행 기기에 따라 하루가 어긋난다
 * (ADR-002 · ADR-009 ④). 경계 판정은 이미 문자열 비교로 끝났고, 여기서는
 * **날짜 사이의 거리**만 잰다.
 */
export function daysInPeriod(p: Period): number {
  const [fy, fm, fd] = p.from.split("-").map(Number) as [number, number, number]
  const [ty, tm, td] = p.to.split("-").map(Number) as [number, number, number]
  const a = Date.UTC(fy, fm - 1, fd)
  const b = Date.UTC(ty, tm - 1, td)
  if (b < a) throw new Error(`기간이 뒤집혔다: ${p.from} > ${p.to}`)
  return Math.round((b - a) / DAY) + 1
}

/**
 * 월 고정비를 조회 기간으로 안분한다 — **핸드오프 이슈 20의 해소.**
 *
 * 목업은 고정비 안분 기준일을 `8/31`로 박아뒀다. 그러면 7월을 조회해도 8월
 * 기준으로 나뉘고, 기간을 좁히면 고정비가 통째로 들어와 순이익이 음수로 처박힌다.
 *
 * 여기서는 **조회 기간의 날 수 / 그 달의 날 수**로 나눈다. 잔차는 ADR-009 ③에
 * 따라 처리한다 — 항목이 하나이므로 전액이 그 항목에 간다(합 === 원금).
 *
 * 기간이 여러 달에 걸치면 달마다 안분해 더한다. 달의 길이가 다르므로
 * "기간 일수 / 30" 같은 근사를 쓰지 않는다.
 */
export function prorateFixed(monthlyFixed: number, p: Period): number {
  if (!Number.isInteger(monthlyFixed)) throw new Error(`고정비는 정수여야 한다: ${monthlyFixed}`)
  if (monthlyFixed === 0) return 0

  const [fy, fm, fd] = p.from.split("-").map(Number) as [number, number, number]
  const [ty, tm, td] = p.to.split("-").map(Number) as [number, number, number]
  if (Date.UTC(ty, tm - 1, td) < Date.UTC(fy, fm - 1, fd)) {
    throw new Error(`기간이 뒤집혔다: ${p.from} > ${p.to}`)
  }

  let total = 0
  let y = fy
  let m = fm
  while (y < ty || (y === ty && m <= tm)) {
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const first = y === fy && m === fm ? fd : 1
    const last = y === ty && m === tm ? td : daysInMonth
    const covered = last - first + 1
    // 한 달치를 (해당 월 일수)로 쪼개고 그중 covered일을 가져온다.
    // allocate가 잔차를 최대 항목에 몰아주므로 합이 원금과 어긋나지 않는다.
    const { shares } = allocate(monthlyFixed, [covered, daysInMonth - covered])
    total += shares[0]!
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return total
}
