/**
 * 가져오기 기록 화면 배선 — **되돌리기가 처음으로 눌러지는 자리.**
 *
 * ★ 새 마크업이 없다 ★
 * 목업이 표(`vals.syncRows`)와 확인 다이얼로그(`vals.confirm`)를 이미 그려 뒀다.
 * 다이얼로그는 «삭제될 행»·«되돌려질 업데이트»를 행으로 명시하는 모양까지 갖췄다.
 *
 * ★ 목업과 다르게 한 곳 셋 ★
 *  ① `type` — 목업은 `Incremental`/`Initial`. 우리에게 그런 것은 없다. 파일뿐이고
 *     «동기화» 어휘도 쓰지 않는다 (LOCK 10)
 *  ② 다이얼로그의 `batch_id` 행 — 목업은 내부 키를 그대로 노출한다. 헌장 C-4가
 *     금지하므로 **파일 이름과 시각**으로 바꿨다 (결함 54)
 *  ③ 되돌리기 셀에 «비활성 + 사유» 슬롯이 없다 — 마크업이 `canUndo`(버튼)와
 *     `undone`(고정 텍스트«되돌림») 둘만 안다. 그래서 **버튼을 그리지 않고
 *     사유를 상태 칸에 쓴다.** §21-1의 «못 누르는 버튼을 그려놓고 막지 않는다»에는
 *     맞지만, G-2가 말한 «비활성 + 사유»의 문자 그대로는 아니다 — 그러려면
 *     Template 편집(게이트 이탈 선언)이 필요하다
 */

import type { HistoryRow } from "@core/history/rows.js"
import type { TemplateVals } from "./generated/vals.js"
import { won } from "./format.js"

/** 목업의 확인 모달 모양. 타입은 생성된 vals가 이미 갖고 있으므로 거기서 가져온다. */
export type ConfirmDialog = NonNullable<TemplateVals["confirm"]>

const DIM = "var(--fg-4)"
const WARN = "var(--label-orange, #F2994A)"
const GREEN = "var(--pnl-pos, #4CB782)"
const NEG = "var(--pnl-neg, #EB5757)"

/** fact 테이블 → 사람 말. 「엔티티」 칸이 쓴다. */
const TABLE_LABEL: Record<string, string> = {
  fact_order: "주문",
  fact_order_item: "품목",
  fact_settlement: "정산",
  fact_claim: "클레임",
  fact_ad_spend: "광고",
}

/** `2026-08-14T02:23:41` → `08-14 02:23`. 날짜만 있으면 그대로 둔다. */
export function stamp(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso)
  if (m) return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`
  return iso.slice(0, 10)
}

/** 엔티티 칸 — 지금 소유한 테이블만. 되돌린 배치는 아무것도 소유하지 않는다. */
export function entityLabel(byTable: Readonly<Record<string, number>>): string {
  const parts = Object.entries(byTable)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${TABLE_LABEL[t] ?? t} ${won(n)}`)
  return parts.length === 0 ? "—" : parts.join(" · ")
}

/**
 * 상태 칸 — 3상태를 **사유까지** 말한다.
 *
 * 잠긴 이유를 여기 쓰는 것이 이 화면의 핵심이다. 버튼이 없는 자리에 아무 말도
 * 없으면 사용자는 «왜 나만 안 되지»를 묻게 되고, 그 답이 화면에 없으면 그건
 * 조용한 실패다 (LOCK 6 계열).
 */
export function statusText(r: HistoryRow): { text: string; color: string } {
  if (r.undo === "undone") {
    return { text: r.undoneAt === null ? "되돌림" : `되돌림 · ${stamp(r.undoneAt)}`, color: DIM }
  }
  if (r.undo === "blocked") {
    const who = r.blockedBy?.sourceName ?? ""
    return {
      text: who === "" ? "잠김 — 이후 가져오기가 덮음" : `잠김 — 「${who}」가 덮음`,
      color: WARN,
    }
  }
  return { text: r.batchStatus === "committed" ? "완료" : "적재 중", color: GREEN }
}

/**
 * 잠김 사유의 **긴 판** — 확인 다이얼로그와 툴팁이 쓴다.
 *
 * 테이블 횡단 잠김은 사용자 입장에서 놀라운 동작이다: 정산 파일을 다시 넣었을
 * 뿐인데 **주문까지** 잠긴다. 그래서 «일부가 덮였다 → 배치 전체가 잠긴다»를
 * 문장으로 말한다.
 */
export function blockedWhy(r: HistoryRow): string {
  const who = r.blockedBy?.sourceName ?? "이후 가져오기"
  const when = r.blockedBy?.at === null || r.blockedBy?.at === undefined ? "" : ` (${stamp(r.blockedBy.at)})`
  return (
    `이 배치의 행 일부를 「${who}」${when}가 덮었습니다. ` +
    `일부만 덮여도 배치 전체가 잠깁니다 — 먼저 그쪽을 되돌리면 이 배치도 되돌릴 수 있습니다.`
  )
}

export interface HistoryActions {
  /** 확인 다이얼로그를 띄운다. 실제 실행은 다이얼로그의 [되돌리기]가 한다. */
  readonly askUndo: (row: HistoryRow) => void
}

const NOOP_HISTORY: HistoryActions = { askUndo: () => {} }

export function historyVals(
  vals: TemplateVals,
  rows: readonly HistoryRow[],
  act: HistoryActions = NOOP_HISTORY,
): void {
  vals.syncRows = rows.map((r) => {
    const st = statusText(r)
    return {
      at: stamp(r.at),
      conn: r.channel,
      // 출처는 파일뿐이다. 목업의 «Incremental»은 존재하지 않는 동작이다 (LOCK 10)
      type: "파일",
      entity: entityLabel(r.ownedByTable),
      fetched: won(r.fetched),
      created: won(r.created),
      updated: won(r.updated),
      failed: String(r.failed),
      failColor: r.failed > 0 ? NEG : DIM,
      status: st.text,
      statusColor: st.color,
      // 소요 시간을 재지 않는다. 「0.0s」를 지어내지 않고 없음을 표시한다
      dur: "—",
      canUndo: r.undo === "can",
      undone: r.undo === "undone",
      undo: (e?: { stopPropagation?: () => void }) => {
        e?.stopPropagation?.()
        act.askUndo(r)
      },
      // 상세 패널은 아직 없다. 어포던스를 그리지 않는다 (§21-1)
      click: () => {},
    }
  })

  // `syncAll`·`syncColor`는 이 표의 값이 아니다 — 헤더의 [가져오기] 버튼 핸들러와
  // 상태 점 색이다. 이름이 비슷하다고 건드리면 엉뚱한 것을 덮는다.
}

/**
 * 되돌리기 확인 다이얼로그 (§21-1 «되돌릴 수 없는 일은 묻는다»).
 *
 * **행 수를 명시한다.** «되돌릴까요?»만 묻고 규모를 안 말하면 사용자는 8만 행이
 * 사라지는 것과 128행이 사라지는 것을 같은 무게로 결정하게 된다.
 */
export function undoConfirm(r: HistoryRow, run: () => void): ConfirmDialog {
  return {
    title: "이 가져오기를 되돌릴까요",
    body:
      `${r.channel} · ${stamp(r.at)}에 들어온 「${r.sourceName}」입니다. ` +
      `이 배치가 넣은 행만 사라지고, 덮어썼던 행은 이전 판으로 돌아갑니다. ` +
      `직접 입력한 원가와 상품 연결은 그대로 남습니다.`,
    hasRows: true,
    rows: [
      { k: "사라질 행", v: `${won(r.created)}건` },
      { k: "이전 판으로 복원될 행", v: `${won(r.updated)}건` },
      // ★ 목업은 여기에 `batch_id`를 그대로 노출했다 ★ 내부 키를 화면에
      //   내보내지 않는다 (헌장 C-4). 사람이 알아보는 것은 파일과 시각이다.
      { k: "파일", v: r.sourceName },
    ],
    hasChoice: false,
    choices: [],
    hasType: false,
    confirmLabel: "되돌리기",
    btnFg: NEG,
    btnBorder: NEG,
    btnOp: "1",
    run,
  }
}
