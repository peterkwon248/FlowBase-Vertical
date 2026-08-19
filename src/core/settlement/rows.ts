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
import { SETTLEMENT_DAILY } from "../store/repository.js"

/**
 * 조정이 열려 있는 **단 하나의 필드** (ADR-020 A4).
 *
 * 지급액만 연다. 여는 칸이 늘어날수록 조정은 인라인 편집(LOCK 9)에 수렴하므로,
 * 칸마다 «왜 이 칸인가»를 답할 수 있을 때만 늘린다 — 지급액의 답은 「마켓이 준
 * 지급액이 실제 입금과 다를 때 그 차이를 남기는 자리」다.
 */
export const ADJUSTED_FIELD = "net_amount"

/**
 * 조정 한 건 — **금액 delta**다 (ADR-020 A2).
 *
 * 절대값 대체가 아니라 얹는 값이라, 재가져오기로 원본이 갱신돼도 새 원본 위에
 * 그대로 얹힌다. 스택에서 아무 항목이나 거둬도 나머지 합이 답이 되는 것도
 * 같은 성질이다 — 목업의 항목별 trash 버튼이 성립하는 이유다.
 */
export interface SettlementAdjustment {
  /** 무효화(`revokeAdjustment`)의 대상. 화면에 그리지 않는다. */
  readonly id: number
  readonly delta: number
  /** 왜 고쳤는지. **비어 있을 수 없다** (ADR-020 A5). */
  readonly reason: string
  readonly createdAt: string
}

/** 정산 한 묶음 — **정산일 × 연결**. 목업이 표를 그리는 단위와 같다. */
export interface SettlementRow {
  readonly settledOn: string
  /**
   * ⚠ **내부 키다. 화면에 그대로 내보내지 않는다** (헌장 C-4 · `LinkingListing.listingKey`
   * 선례). 사람이 읽을 것은 아래 `channel`이다.
   *
   * 그럼에도 운반하는 이유는 **조정의 대상 키**이기 때문이다 (ADR-020 A1·A7) —
   * 조정은 (정산일, 연결)에 붙으므로 이 값 없이는 어디에 얹을지 말할 수 없다.
   * C-4가 금지하는 것은 화면 노출이지 뷰 타입이 아는 것이 아니다.
   */
  readonly connectionId: string
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
  /**
   * 이 묶음에 얹힌 **활성 조정의 합** (ADR-020). 없으면 0.
   *
   * ★ 합은 SQL이 낸다 ★ (LOCK 5) — 아래 `adjustments`를 JS로 더하지 않는다.
   * 둘이 갈리면 화면의 지급액과 팝오버의 스택이 다른 말을 하게 되므로
   * `tests/settlement-adjustment.test.ts`가 **둘이 같음**을 못박는다.
   */
  readonly adjSum: number
  /**
   * 팝오버가 그리는 스택 — 시간순이며 무효화된 것은 없다.
   *
   * 조정은 사용자가 손으로 넣는 것이라 기간당 몇 건이다. Fact 행이 아니므로
   * LOCK 5(전체 메모리 적재 금지)가 겨냥하는 대상이 아니고, 조회 범위도
   * 보고 있는 기간으로 잘려 있다.
   */
  readonly adjustments: readonly SettlementAdjustment[]
}

export async function loadSettlementRows(
  db: Driver,
  libraryId: string,
  period: Period,
): Promise<SettlementRow[]> {
  const stacks = await loadAdjustmentStacks(db, libraryId, period)

  const rows = await db
    .prepare(
      `SELECT s.settled_on AS d, s.connection_id AS cid,
              COALESCE(cn.display_name, '(이름 없는 연결)') AS c, COUNT(*) AS n,
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
              MAX(s.pay_out_on) AS payMax,
              -- 조정 합 — 집계 **밖**에서 이미 묶여 온 값이라 그룹 안에서 상수다.
              -- 그래서 SUM이 아니라 MAX다. SUM으로 쓰면 묶음의 행 수만큼 곱해진다.
              COALESCE(MAX(adj.asum), 0) AS adjSum
         FROM active_settlement s
         LEFT JOIN connection cn ON cn.id = s.connection_id
         LEFT JOIN (
                SELECT target_connection_id AS acid, target_source_key AS ad,
                       SUM(CAST(new_value AS INTEGER)) AS asum
                  FROM adjustment
                 WHERE library_id = ?
                   AND target_table = '${SETTLEMENT_DAILY}'
                   AND field = '${ADJUSTED_FIELD}'
                   AND revoked_at IS NULL
                 GROUP BY target_connection_id, target_source_key
              ) adj ON adj.acid = s.connection_id AND adj.ad = s.settled_on
        WHERE s.library_id = ?
          AND s.settled_on >= ? AND s.settled_on < date(?, '+1 day')
        GROUP BY s.settled_on, s.connection_id
        ORDER BY s.settled_on DESC, c`,
    )
    .all(libraryId, libraryId, period.from, period.to)

  const num = (r: Record<string, unknown>, k: string): number => Number(r[k] ?? 0)

  return rows.map((r) => {
    const lo = r["payMin"] == null ? null : String(r["payMin"])
    const hi = r["payMax"] == null ? null : String(r["payMax"])
    const settledOn = String(r["d"] ?? "")
    const connectionId = String(r["cid"] ?? "")
    return {
      settledOn,
      connectionId,
      channel: String(r["c"] ?? ""),
      count: num(r, "n"),
      gross: num(r, "gross"),
      fee: num(r, "fee"),
      vat: num(r, "vat"),
      shipping: num(r, "ship"),
      net: num(r, "net"),
      linked: num(r, "linked"),
      payOutOn: lo !== null && lo === hi ? lo : null,
      adjSum: num(r, "adjSum"),
      adjustments: stacks.get(adjustmentKey(settledOn, connectionId)) ?? [],
    }
  })
}

/**
 * 조정 대상 키 — (정산일, 연결)을 한 문자열로 (ADR-020 A1).
 *
 * `U+0001`을 쓰는 것은 리스팅 키(ADR-006)와 같은 이유다. 날짜와 연결 id 어느
 * 쪽에도 나타날 수 없는 문자여야 두 조각이 섞이지 않는다.
 */
export function adjustmentKey(settledOn: string, connectionId: string): string {
  return `${settledOn}${connectionId}`
}

/**
 * 보고 있는 기간의 조정을 한 번에 읽어 대상별로 묶는다.
 *
 * 행마다 따로 조회하면 묶음 수만큼 왕복한다(N+1). `target_source_key`가 곧
 * 정산일이라 기간으로 그대로 자를 수 있다 — 그게 이 키 설계의 부수 이득이다.
 */
async function loadAdjustmentStacks(
  db: Driver,
  libraryId: string,
  period: Period,
): Promise<Map<string, SettlementAdjustment[]>> {
  const rows = await db
    .prepare(
      `SELECT id, target_connection_id AS cid, target_source_key AS d,
              CAST(new_value AS INTEGER) AS delta, reason, created_at AS at
         FROM adjustment
        WHERE library_id = ?
          AND target_table = '${SETTLEMENT_DAILY}'
          AND field = '${ADJUSTED_FIELD}'
          AND revoked_at IS NULL
          AND target_source_key >= ? AND target_source_key < date(?, '+1 day')
        ORDER BY id`,
    )
    .all(libraryId, period.from, period.to)

  const out = new Map<string, SettlementAdjustment[]>()
  for (const r of rows) {
    const key = adjustmentKey(String(r["d"] ?? ""), String(r["cid"] ?? ""))
    const list = out.get(key) ?? []
    list.push({
      id: Number(r["id"] ?? 0),
      delta: Number(r["delta"] ?? 0),
      reason: String(r["reason"] ?? ""),
      createdAt: String(r["at"] ?? ""),
    })
    out.set(key, list)
  }
  return out
}
