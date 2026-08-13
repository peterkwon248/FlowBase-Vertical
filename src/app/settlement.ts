/**
 * 정산 화면 배선 — **표는 원본을 그대로 보여준다.**
 *
 * ★ 배선 규율 ★
 * 조회는 `loadSettlementRows` 하나를 거친다. 여기서 하는 일은 **포맷**뿐이고,
 * 금액을 다시 더하거나 빼지 않는다 — `payout`도 우리가 계산하지 않고 마켓이 준
 * `net`을 그대로 쓴다 (헌장 B-3 원본 불변).
 *
 * ★ 이 화면이 "담지 못한 것"의 두 번째 소비처다 ★
 * 대시보드의 단서 카드가 *"정산 106건이 주문에 이어지지 않는다"*라고 말하고,
 * 이 화면은 **그 106건이 어느 날짜의 무엇인지**를 보여준다. 같은 사실의 요약과
 * 상세이므로 숫자가 갈리면 안 된다 — `linked`가 그 연결 고리다.
 */

import type { SettlementRow } from "@core/settlement/rows.js"
import type { Period } from "@core/profit/index.js"
import type { TemplateVals } from "./generated/vals.js"
import { won } from "./format.js"

const DIM = "var(--fg-4)"
const WARN = "var(--label-orange, #F2994A)"
const GREEN = "var(--pnl-pos, #4CB782)"

/** 목업 L5567과 같은 자리. "몇 건이 무엇인지"를 한 줄로. */
export function settlementSummary(rows: readonly SettlementRow[]): string {
  const n = rows.reduce((a, r) => a + r.count, 0)
  const payout = rows.reduce((a, r) => a + r.net, 0)
  if (n === 0) return ""
  return `정산 ${won(n)}건 · 지급액 ${won(payout)}원`
}

export function settlementVals(
  vals: TemplateVals,
  rows: readonly SettlementRow[],
  _period: Period,
): void {
  vals.setEmpty = rows.length === 0
  vals.setSummary = settlementSummary(rows)

  vals.setRows = rows.map((r) => {
    // 대사 — **원본끼리의 비교만 말한다** (헌장 B-3). 여기서 판정하는 것은
    // "이 정산이 주문에 이어지나" 하나뿐이고, 이어지지 않으면 그만큼의 수수료가
    // 손익에서 빠져 있다는 뜻이다. 대시보드 단서 카드와 같은 사실이다.
    const linked = r.linked === r.count
    return {
      date: r.settledOn,
      // 채널 — `connection.display_name`이고 값의 출처는 프로파일이다.
      // 내부 키를 화면에 내보내지 않는다 (헌장 C-4).
      ch: r.channel,
      color: DIM,
      count: `${won(r.count)}건`,
      gross: won(r.gross),
      fee: won(r.fee),
      vat: won(r.vat),
      ship: won(r.shipping),
      // 지급액 — 마켓이 준 `net_amount` 원본이다. 우리가 다시 계산하지 않는다.
      payout: won(r.net),
      // 출처 — 우리는 파일 가져오기뿐이다. API는 존재하지 않는다 (LOCK 10)
      src: "파일",
      srcColor: DIM,
      needsMap: false,
      recon: linked ? "일치" : "주문 미연결",
      reconColor: linked ? GREEN : WARN,
      // ── 아직 없는 것들 ──────────────────────────────────────────
      // 조정 레이어는 쓰기 경로가 필요하다(다음-마이그레이션-대기목록). 그때까지
      // **어포던스를 그리지 않는다** — 못 누르는 버튼을 그려놓고 막지 않는다 (§21-1).
      adj: "—",
      adjColor: DIM,
      adjTip: "",
      hasAdj: false,
      adjOpen: false,
      adjStack: [],
      origAdj: "",
      effAdjLabel: "",
      canAck: false,
      ackWhy: "",
      click: () => {},
      openAdj: () => {},
      addAdj: () => {},
      goMap: () => {},
      ack: () => {},
    }
  })
}
