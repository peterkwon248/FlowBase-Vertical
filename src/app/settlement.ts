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
import { adjustmentKey } from "@core/settlement/rows.js"
import type { Period } from "@core/profit/index.js"
import type { TemplateVals } from "./generated/vals.js"
import { signed, won } from "./format.js"

const DIM = "var(--fg-4)"
const WARN = "var(--label-orange, #F2994A)"
const GREEN = "var(--pnl-pos, #4CB782)"

/**
 * 이 묶음의 **유효 지급액** — 원본 + 조정 스택 (헌장 B-3 · ADR-020 A2).
 *
 * 여기가 유일한 자리다. 요약 줄과 표의 지급액 칸이 각각 더하면 둘이 갈리고,
 * 그 차이는 아무도 모르게 쌓인다.
 */
export const effectivePayout = (r: SettlementRow): number => r.net + r.adjSum

/** 목업 L5567과 같은 자리. "몇 건이 무엇인지"를 한 줄로. */
export function settlementSummary(rows: readonly SettlementRow[]): string {
  const n = rows.reduce((a, r) => a + r.count, 0)
  const payout = rows.reduce((a, r) => a + effectivePayout(r), 0)
  if (n === 0) return ""
  return `정산 ${won(n)}건 · 지급액 ${won(payout)}원`
}

/**
 * 팝오버 초안 — **DB에 없다.** 저장되기 전까지는 화면 상태다 (`costsDraft` 판례).
 *
 * `openKey`가 열려 있는 묶음을 가리킨다. 한 번에 하나만 열린다 — 여럿 열면
 * 어느 팝오버의 초안인지 모르게 된다.
 */
export interface AdjDraft {
  readonly openKey: string | null
  readonly amount: string
  readonly why: string
  readonly top: string
  readonly left: string
}

export const emptyAdjDraft = (): AdjDraft => ({
  openKey: null,
  amount: "",
  why: "",
  top: "120px",
  left: "120px",
})

export interface AdjActions {
  /** 팝오버를 연다(같은 것을 다시 누르면 닫는다). `pos`는 누른 칸의 화면 좌표. */
  readonly open: (key: string, pos: { top: string; left: string } | null) => void
  readonly setAmount: (v: string) => void
  readonly setWhy: (v: string) => void
  readonly add: (row: SettlementRow) => void
  /** 조정 하나를 거둔다 — 지우는 것이 아니라 무효화다 (ADR-020 A6). */
  readonly revoke: (id: number) => void
  /** 이 묶음의 활성 조정을 전부 거둔다 — 「원본으로 복원」. */
  readonly reset: (row: SettlementRow) => void
}

export const noAdjActions: AdjActions = {
  open: () => {},
  setAmount: () => {},
  setWhy: () => {},
  add: () => {},
  revoke: () => {},
  reset: () => {},
}

/**
 * 「+/− 금액」을 정수 delta로. **0은 조정이 아니다** — 거른다.
 *
 * `parseAmount`(비용)와 갈라지는 것은 **부호를 받는다**는 점 하나다. 조정은
 * 얹는 값이라 음수가 정상이고, 오히려 양수만 받으면 「깎였다」를 넣을 수 없다.
 */
export function parseDelta(raw: string): number | null {
  const t = raw.replace(/[,\s원+]/g, "")
  if (!/^-?\d+$/.test(t)) return null
  const n = Number(t)
  return n === 0 ? null : n
}

/**
 * 「조정 추가」를 누를 수 있나, 없으면 왜 (§21-1).
 *
 * ★ 사유가 **필수**다 ★ (ADR-020 A5) — 목업은 「사유 (선택)」이지만, 사유 없는
 * 조정은 나중에 오타와 구별되지 않는다. 조정 레이어를 복제 시트 대신 고른 근거
 * 자체가 「왜 고쳤는지가 반드시 남는다」였다.
 */
export function adjGuard(d: AdjDraft): { can: boolean; why: string } {
  const amount = d.amount.trim()
  const why = d.why.trim()
  // 아무것도 안 쓴 상태는 «아직»이지 «틀림»이 아니다. 열자마자 빨간 줄이 뜨지 않는다.
  if (amount === "" && why === "") return { can: false, why: "" }
  if (parseDelta(d.amount) === null) {
    return {
      can: false,
      why: amount === "" ? "고칠 금액이 필요합니다" : "금액은 「-1200」·「+3000」처럼 넣어 주세요",
    }
  }
  if (why === "") return { can: false, why: "사유가 필요합니다 — 왜 고쳤는지가 남습니다" }
  return { can: true, why: "" }
}

/** `2026-08-20T06:24:13` → `08-20 06:24`. 목업 스택 항목의 표기와 같은 모양이다. */
const stampLabel = (s: string): string =>
  s.length >= 16 ? `${s.slice(5, 10)} ${s.slice(11, 16)}` : s

export function settlementVals(
  vals: TemplateVals,
  rows: readonly SettlementRow[],
  _period: Period,
  draft: AdjDraft = emptyAdjDraft(),
  act: AdjActions = noAdjActions,
): void {
  vals.setEmpty = rows.length === 0
  vals.setSummary = settlementSummary(rows)

  const guard = adjGuard(draft)
  vals.adjDraft = draft.amount
  vals.adjWhy = draft.why
  vals.setAdjDraft = (e: { target?: { value?: string } } | undefined) =>
    act.setAmount(e?.target?.value ?? "")
  vals.setAdjWhy = (e: { target?: { value?: string } } | undefined) =>
    act.setWhy(e?.target?.value ?? "")
  vals.adjPosTop = draft.top
  vals.adjPosLeft = draft.left
  vals.adjBlocked = !guard.can
  vals.adjBlockWhy = guard.why
  // `disabled`만으로는 파란 primary 버튼이 그대로 파랗다 — 눌리는 줄 알고 누른다.
  // `costs.ts`의 `fixSaveOpacity`와 같은 처방이다.
  vals.adjAddOpacity = guard.can ? "1" : "0.45"

  vals.setRows = rows.map((r) => {
    // 대사 — **원본끼리의 비교만 말한다** (헌장 B-3). 여기서 판정하는 것은
    // "이 정산이 주문에 이어지나" 하나뿐이고, 이어지지 않으면 그만큼의 수수료가
    // 손익에서 빠져 있다는 뜻이다. 대시보드 단서 카드와 같은 사실이다.
    const linked = r.linked === r.count
    const key = adjustmentKey(r.settledOn, r.connectionId)
    const hasAdj = r.adjustments.length > 0
    const eff = effectivePayout(r)
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
      // 지급액 — **원본 + 조정 스택 = 유효값**이다 (헌장 B-3 · ADR-020).
      // 원본(`net_amount`)은 그대로 있고 우리가 다시 계산하지도 않는다. 얹힌
      // 조정이 있으면 그 사실을 조정 칸의 점과 팝오버가 말한다 (LOCK 6).
      payout: won(eff),
      // 출처 — 우리는 파일 가져오기뿐이다. API는 존재하지 않는다 (LOCK 10)
      src: "파일",
      srcColor: DIM,
      needsMap: false,
      recon: linked ? "일치" : "주문 미연결",
      reconColor: linked ? GREEN : WARN,
      // ── 조정 (ADR-020) ─────────────────────────────────────────
      // ★ 합이 0이어도 «—»이 아니다 ★ (+100, −100)처럼 상쇄되는 스택이 있으면
      // 합은 0이지만 **조정은 있었다.** «—»로 그리면 그 사실이 사라진다 (LOCK 6).
      adj: hasAdj ? signed(r.adjSum) : "—",
      adjColor: hasAdj ? "var(--fg)" : DIM,
      adjTip: hasAdj
        ? `원본 지급액 ${won(r.net)} → ${won(eff)}` +
          (r.adjustments.length > 1 ? ` · 조정 ${r.adjustments.length}건` : "")
        : "",
      hasAdj,
      adjOpen: draft.openKey === key,
      adjStack: r.adjustments.map((a) => ({
        head: `${signed(a.delta)}원`,
        // 사유는 필수라 «사유 없음»은 뜨지 않는다. 그래도 남겨 두는 것은 이 규칙
        // 이전에 들어간 행이 있을 수 있어서다 — 빈 칸으로 두면 무엇이 빠졌는지 모른다.
        body: `${stampLabel(a.createdAt)} · ${a.reason.trim() === "" ? "사유 없음" : a.reason}`,
        remove: (e?: { stopPropagation?: () => void }) => {
          e?.stopPropagation?.()
          act.revoke(a.id)
        },
      })),
      // 팝오버 머리말 「원본 A → B」 — **지급액**의 전후다.
      // 목업은 여기에 «마켓이 정산서에 실어 준 조정액»을 두는데 우리 스키마에는
      // 그 컬럼이 없고(v1 범위 밖) 늘 0이라, 0에서 얼마로 갔다는 말은 아무것도
      // 알려주지 않는다. 사용자가 보려는 수는 지급액이 얼마에서 얼마가 됐나다.
      origAdj: won(r.net),
      effAdjLabel: won(eff),
      openAdj: (e?: {
        stopPropagation?: () => void
        currentTarget?: { bottom?: number; right?: number; top?: number }
      }) => {
        e?.stopPropagation?.()
        act.open(key, popoverPos(e, r.adjustments.length))
      },
      addAdj: () => act.add(r),
      resetAdj: () => act.reset(r),
      // ── 아직 없는 것 ────────────────────────────────────────────
      // 대사 「확인함으로」는 `recon_ack`라 조정과 별개 기능이다 (ADR-020 범위 밖).
      // 그때까지 **어포던스를 그리지 않는다** (§21-1).
      canAck: false,
      ackWhy: "",
      click: () => {},
      goMap: () => {},
      ack: () => {},
    }
  })
}

/**
 * 팝오버를 누른 칸 옆에 띄운다 — 목업 L4287~4300과 같은 규칙.
 *
 * 아래로 넘치면 위로 뒤집고, 좌우로도 화면 밖으로 나가지 않게 민다. 좌표를 못
 * 구하면(테스트·렌더 하네스처럼 DOM이 없을 때) `null`을 돌려주고 부르는 쪽이
 * 기본 위치를 쓴다 — 여기서 0으로 만들면 팝오버가 구석에 붙는다.
 */
function popoverPos(
  e: { currentTarget?: unknown } | undefined,
  stackLen: number,
): { top: string; left: string } | null {
  const el = e?.currentTarget as { getBoundingClientRect?: () => DOMRect } | undefined
  if (typeof el?.getBoundingClientRect !== "function" || typeof window === "undefined") return null
  const r = el.getBoundingClientRect()
  const popH = 150 + stackLen * 46
  const below = r.bottom + 6
  const flip = below + popH > window.innerHeight - 12
  return {
    top: `${Math.max(12, flip ? r.top - popH - 6 : below)}px`,
    left: `${Math.max(12, Math.min(r.right - 258, window.innerWidth - 270))}px`,
  }
}
