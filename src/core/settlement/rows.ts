/**
 * 정산 화면이 읽는 **단 하나의 조회**.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 배선 규율 ★
 * 화면 코드에서 리포지토리를 직접 조회하지 않는다. 대시보드가 `loadPnlSnapshot`을
 * 거치듯 정산 화면은 이 함수를 거친다 — "간단한 조회니까" 하고 화면에 SQL을 박는
 * 순간 조인 조건 하나가 어긋나도 두 화면이 다른 답을 내고, 그 차이는 아무도 모르게
 * 쌓인다 (헌장 A-5).
 * ─────────────────────────────────────────────────────────────
 *
 * 집계는 전부 SQL에 위임한다 (헌장 B-5). 행을 메모리로 끌어와 더하지 않는다.
 */

import type { Driver } from "../store/driver.js"
import type { Period } from "../profit/index.js"

/** 정산 한 묶음 — **정산일 × 연결**. 목업이 표를 그리는 단위와 같다. */
export interface SettlementRow {
  readonly settledOn: string
  /**
   * 사람이 읽는 채널 이름 — `connection.display_name`.
   *
   * **내부 키(`connection_id`)를 화면에 내보내지 않는다** (헌장 C-4). 값의 출처는
   * 프로파일이고(`MappingProfile.displayName`) 연결 화면이 생기면 사용자가
   * 덮어쓴다. core는 이 문자열이 무엇인지 모른 채 옮기기만 한다 (LOCK 4).
   */
  readonly channel: string
  readonly count: number
  readonly gross: number
  readonly fee: number
  readonly vat: number
  readonly shipping: number
  /** 마켓이 실제로 지급하는 금액. 원본 그대로다 — 우리가 다시 계산하지 않는다. */
  readonly net: number
  /**
   * 이 묶음에서 **주문에 이어진 건수**.
   *
   * ★ 손익의 `settlement.joined`와 묻는 것이 다르다 ★
   * 손익 쪽은 "이 **기간의 주문**에 이어졌나"(`ordered_at`이 기간 안)를 묻는다 —
   * 수수료를 주문 귀속으로 잡기 때문이다 (ADR-009 ①). 여기서는 "이 정산 행이
   * **어떤 주문에든** 이어지나"를 묻는다. 정산 행의 성질이지 보는 기간의 성질이
   * 아니어서다.
   *
   * 두 숫자가 갈리면 화면끼리 모순으로 보이므로 `tests/settlement-rows.test.ts`가
   * **오늘 둘 다 0임**을 못박는다. 갈라지는 날이 오면 그 테스트가 먼저 깨진다.
   */
  readonly linked: number
  /** 지급 예정일. 묶음 안에서 갈리면 `null` — 하나로 뭉뚱그리지 않는다. */
  readonly payOutOn: string | null
}

export async function loadSettlementRows(
  db: Driver,
  libraryId: string,
  period: Period,
): Promise<SettlementRow[]> {
  const rows = await db
    .prepare(
      `SELECT s.settled_on AS d, COALESCE(cn.display_name, '(이름 없는 연결)') AS c, COUNT(*) AS n,
              COALESCE(SUM(s.gross_amount),0)    AS gross,
              COALESCE(SUM(s.fee_amount),0)      AS fee,
              COALESCE(SUM(s.vat_amount),0)      AS vat,
              COALESCE(SUM(s.shipping_amount),0) AS ship,
              COALESCE(SUM(s.net_amount),0)      AS net,
              SUM(CASE WHEN EXISTS(
                    SELECT 1 FROM active_order o
                     WHERE o.library_id = s.library_id
                       AND o.source_key = s.order_source_key
                  ) THEN 1 ELSE 0 END) AS linked,
              MIN(s.pay_out_on) AS payMin,
              MAX(s.pay_out_on) AS payMax
         FROM active_settlement s
         LEFT JOIN connection cn ON cn.id = s.connection_id
        WHERE s.library_id = ?
          AND s.settled_on >= ? AND s.settled_on < date(?, '+1 day')
        GROUP BY s.settled_on, s.connection_id
        ORDER BY s.settled_on DESC, c`,
    )
    .all(libraryId, period.from, period.to)

  const num = (r: Record<string, unknown>, k: string): number => Number(r[k] ?? 0)

  return rows.map((r) => {
    const lo = r["payMin"] == null ? null : String(r["payMin"])
    const hi = r["payMax"] == null ? null : String(r["payMax"])
    return {
      settledOn: String(r["d"] ?? ""),
      channel: String(r["c"] ?? ""),
      count: num(r, "n"),
      gross: num(r, "gross"),
      fee: num(r, "fee"),
      vat: num(r, "vat"),
      shipping: num(r, "ship"),
      net: num(r, "net"),
      linked: num(r, "linked"),
      payOutOn: lo !== null && lo === hi ? lo : null,
    }
  })
}
