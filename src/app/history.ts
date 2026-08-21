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
import { CLAIM_LABEL } from "./order.js"
import { KEY_SEP } from "@core/import/mapping/listing.js"

/**
 * ★ 컬럼 이름 → 사람 말 (2026-08-21) ★
 *
 * 화면은 코드값을 그대로 내보내지 않는다. `screen-safety`가 «source_key» 같은
 * 컬럼명을 문자열로 잡는 이유도 그것이다 — 사용자에게 「source_key」는 아무 뜻도
 * 아니고, 그 말이 보인다는 것은 화면이 DB를 그대로 흘리고 있다는 뜻이다.
 *
 * **거부 목록의 여집합을 전부 덮어야 한다.** 새 Fact 컬럼이 생기면
 * `tests/batch-rows.test.ts`가 먼저 깨진다 — 라벨을 안 정하면 화면이 그 값을
 * 못 그리고, 못 그리면 조용히 사라지기 때문이다 (LOCK 6).
 */
export const FIELD_LABEL: Readonly<Record<string, string>> = {
  // 어느 표에나 있는 것
  source_key: "마켓 번호",
  status: "상태",
  // 주문
  ordered_at: "주문일",
  total_amount: "주문 총액",
  // 003·005가 나중에 더한 열 — 「이 날짜를 얼마나 믿을 수 있나」다 (ADR-009)
  date_precision: "날짜 정밀도",
  period_end: "기간 끝",
  // 품목
  quantity: "수량",
  gross_amount: "판매 금액",
  discount_amount: "할인",
  // 정산
  order_source_key: "주문 번호",
  settled_on: "정산일",
  pay_out_on: "지급일",
  fee_amount: "수수료·공제",
  vat_amount: "부가세",
  shipping_amount: "배송비",
  net_amount: "지급액",
  // 클레임
  claim_type: "클레임 종류",
  claimed_at: "귀속일",
  amount: "금액",
  // 광고
  campaign_key: "캠페인 코드",
  campaign_name: "캠페인",
  campaign_type: "캠페인 분류",
  spent_on: "집행일",
  spend_amount: "광고비",
  impressions: "노출",
  clicks: "클릭",
  conversions: "전환",
  conversion_amount: "전환 매출",
  // 014 — 광고비를 상품에 붙이는 열. 사용자에게는 「상품」이지 `listing_key`가 아니다 (U-5)
  listing_key: "광고 건 상품",
}

/**
 * ★ 코드값 → 사람 말 (2026-08-21) ★
 *
 * 머리글만 사람 말로 바꾸고 값을 DB 그대로 흘리면 화면에 `CANCEL`·`proxy`가 뜬다 —
 * 실측으로 그렇게 나왔다. 헌장 C-4가 막는 것은 내부 **키**만이 아니다: 사용자가
 * 뜻을 모르는 코드값을 그대로 내보내는 것도 같은 계열이다.
 *
 * `CLAIM_LABEL`은 **주문 화면의 것을 그대로 가져온다** — 두 벌로 적으면 한쪽만
 * 고쳐지는 날 두 화면이 같은 행을 다른 말로 부른다.
 */
const VALUE_LABEL: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  claim_type: CLAIM_LABEL,
  // `proxy`는 「이 날짜는 추정이다」라는 뜻이다 (ADR-009 — 반품일이 없어 결제일을 썼다).
  date_precision: { proxy: "추정", day: "일 단위", period: "기간 집계" },
}

/**
 * ★ 합성 키를 사람이 읽는 모양으로 (ADR-006 · 2026-08-21) ★
 *
 * `source_key`는 한 컬럼일 때도 있지만 **여러 열을 `U+0001`로 이은 합성 키**일 때도
 * 있다. 그대로 그리면 두 가지가 동시에 잘못된다:
 *   ① 화면에 제어문자가 샌다 — `screen-safety`가 «보이지 않으므로 눈으로는 못
 *      잡는다»고 경계하는 그 문자다 (실제로 렌더해서 눈으로 잡았다: `…0014␁73952`)
 *   ② 사용자가 «2510290951000014␁73952»를 자기 파일에서 못 찾는다
 *
 * 그래서 **보이는 구분자로 갈아 끼운다.** 값을 자르지 않는다 — 뒤쪽 조각이
 * 사라지면 그 행을 특정할 수 없게 된다 (LOCK 6).
 */
const showKey = (v: string): string => v.split(KEY_SEP).join(" · ")

/** 합성 키가 오는 칸. 여기만 `showKey`를 지난다. */
const KEY_FIELD: ReadonlySet<string> = new Set(["source_key", "order_source_key", "campaign_key"])

/** 금액·수량 칸인가 — 우측 정렬 + 천 단위 (§21-4). */
const NUMERIC_FIELD: ReadonlySet<string> = new Set([
  "total_amount",
  "quantity",
  "gross_amount",
  "discount_amount",
  "fee_amount",
  "vat_amount",
  "shipping_amount",
  "net_amount",
  "amount",
  "spend_amount",
  "impressions",
  "clicks",
  "conversions",
  "conversion_amount",
])

/** 목업의 확인 모달 모양. 타입은 생성된 vals가 이미 갖고 있으므로 거기서 가져온다. */
export type ConfirmDialog = NonNullable<TemplateVals["confirm"]>

const DIM = "var(--fg-4)"
const WARN = "var(--label-orange, #F2994A)"
const GREEN = "var(--pnl-pos, #4CB782)"
const NEG = "var(--pnl-neg, #EB5757)"

/** fact 테이블 → 사람 말. 「엔티티」 칸과 적재된 행 패널이 **같은 것**을 쓴다. */
export const TABLE_LABEL: Record<string, string> = {
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
 * ★ 기준 데이터가 **무엇이 됐나** — batch가 없는 파일의 「개체」 칸 (015) ★
 *
 * Fact 파일은 `ownedByTable`이 답한다(「주문 1,352」). 기준 파일은 batch가 없어서
 * 그 칸이 영원히 «—»였고, 그래서 원가 파일은 **기록에 서더라도 아무 말도 안 하는
 * 줄**이 된다. `sighting_outcome`이 그 자리를 채운다 (LOCK 6).
 *
 * 문구는 여기가 소유한다 — core는 `cost`·`pending_cost` 같은 **코드값**만 날랐다
 * (U-5 · 헌장 C-4).
 */
const OUTCOME_LABEL: Readonly<Record<string, string>> = {
  cost: "원가",
  cost_replaced: "원가 정정",
  cost_skipped: "이미 있어 건너뜀",
  pending_cost: "원가 대기",
  bridged: "지난 판단으로 붙음",
  sku_created: "SKU 신규",
  bad_rows: "읽지 못한 행",
  // 016·017의 표 보관이 실패한 파일 — 원가는 들어갔고 표만 못 연다 (LOCK 6).
  sheet_store_failed: "표 보관 실패",
}

export function outcomeLabel(outcomes: Readonly<Record<string, number>>): string {
  const parts = Object.entries(outcomes)
    .filter(([k, n]) => n > 0 && k !== "nothing")
    // 큰 것부터 — 사용자가 먼저 볼 것이 「원가 35건」이지 「읽지 못한 행 47」이 아니다.
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${OUTCOME_LABEL[k] ?? k} ${won(n)}`)
  return parts.length === 0 ? "—" : parts.join(" · ")
}

/**
 * 상태 칸 — 사유까지 말한다.
 *
 * 잠긴 이유를 여기 쓰는 것이 이 화면의 핵심이다. 버튼이 없는 자리에 아무 말도
 * 없으면 사용자는 «왜 나만 안 되지»를 묻게 되고, 그 답이 화면에 없으면 그건
 * 조용한 실패다 (LOCK 6 계열).
 *
 * ★ 015에서 두 상태가 늘었다 ★ 장부의 단위가 배치에서 파일로 올라가면서
 * 「기준 데이터」·「훑기만 함」이 이 표에 선다. 둘 다 되돌리기 대상이 아닌데
 * 기존 「잠김」으로 부르면 **먼저 무엇을 되돌리면 풀리는 줄** 알게 된다.
 */
export function statusText(r: HistoryRow): { text: string; color: string } {
  /**
   * ★ batch가 없는 줄은 **되돌리기의 어휘를 쓰지 않는다** (015) ★
   *
   * `undo`가 `blocked`인 것은 맞지만 사유가 다르다 — Fact는 「이후 가져오기가 덮음」이고
   * 기준 데이터는 **애초에 되돌리기 대상이 아니다**(`row_shadow`가 Fact 5종만 덮는다 — 002).
   * 같은 「잠김」으로 부르면 사용자는 무엇을 먼저 되돌리면 풀리는 줄 안다.
   */
  if (r.kind === "reference") {
    return { text: "되돌릴 수 없음 — 기준 데이터", color: DIM }
  }
  if (r.kind === "seen") {
    // 「기록이 없다」와 「봤지만 안 넣었다」는 다르다. 후자를 말하려고 009가 생겼다.
    return { text: "넣지 않음 — 훑기만 했습니다", color: DIM }
  }
  if (r.undo === "undone") {
    /**
     * ★ 취소와 되돌리기를 가른다 ★
     * `aborted`는 **커밋된 적이 없는** 배치를 치운 것이다 — 손익에 반영된 적이 없어
     * 무게가 다르다. 같은 말로 부르면 사용자가 「내 숫자가 바뀌었나」를 묻게 된다.
     */
    const what = r.outcome === "aborted" ? "취소됨" : "되돌림"
    return { text: r.undoneAt === null ? what : `${what} · ${stamp(r.undoneAt)}`, color: DIM }
  }
  if (r.undo === "blocked") {
    const who = r.blockedBy?.sourceName ?? ""
    return {
      text: who === "" ? "잠김 — 이후 가져오기가 덮음" : `잠김 — 「${who}」가 덮음`,
      color: WARN,
    }
  }
  /**
   * ★ 「적재 중」이 초록으로 영원히 남던 자리 (2026-08-16, 대열 4 ③-b) ★
   *
   * 옛 판정은 `batchStatus === "committed" ? "완료" : "적재 중"` 한 줄이었고 색은
   * **늘 초록**이었다. 적재하다 죽은 배치가 영원히 「적재 중」이고, 끝나지 않은 일이
   * 완료와 같은 색을 썼다.
   *
   * `open`은 진행이 아니라 **미완료**다 — 진행 중인 적재는 위저드 화면에 있지 이
   * 목록에 있지 않다. 그래서 색도 초록이 아니다. 시계에 기대지 않는 판정이다
   * (「몇 분 지났나」로 정하면 느린 기기에서 정상 적재가 경고로 뜬다).
   */
  if (r.outcome === "unfinished") {
    return { text: "미완료 — 적재가 끝나지 않았습니다", color: WARN }
  }
  return { text: "완료", color: GREEN }
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
  /** 이 batch가 넣은 행을 펴거나 접는다 (§21 «history-rows»). */
  readonly openRows: (row: HistoryRow) => void
}

const NOOP_HISTORY: HistoryActions = { askUndo: () => {}, openRows: () => {} }

export function historyVals(
  vals: TemplateVals,
  rows: readonly HistoryRow[],
  act: HistoryActions = NOOP_HISTORY,
): void {
  vals.syncRows = rows.map((r) => {
    const st = statusText(r)
    return {
      at: stamp(r.at),
      /**
       * ★ 「출처」 칸 — **이 행이 어디서 왔나** (ADR-028 · §21-8) ★
       *
       * 015에서는 머리글이 「연결」이었고 기준 데이터에 상수 「채널 없음」을 넣었다.
       * 없는 것과 못 읽은 것을 가른다는 판단은 맞았지만, **그 구분을 바로 옆
       * 「유형」 칸이 이미 한다**(«기준 데이터»). 같은 말을 두 칸이 하는 동안
       * 정작 필요한 것 — **어느 파일인가** — 은 화면 어디에도 없었다.
       * 원가 파일을 두 개 넣으면 두 줄이 구별되지 않았다.
       *
       * Fact는 연결에서 오고 기준 데이터·훑기만은 **파일에서** 온다. 한 칸에 두
       * 종류가 들어가는 것이 어긋남이 아닌 이유는 옆 칸이 어느 쪽인지를 먼저
       * 말하기 때문이다 (ADR-028 결정 2).
       *
       * 긴 이름을 자르지 않는다 — `.db-table-wrap`이 `overflow-x: auto`라
       * 표가 가로로 밀린다. 말줄임이 없으니 LOCK 6의 「읽을 수 없다고 말하기」도 없다.
       */
      conn: r.kind === "fact" ? (r.channel === "" ? "—" : r.channel) : r.sourceName,
      /**
       * ★ 「유형」 칸이 드디어 유형을 말한다 (015) ★
       *
       * 목업의 «Incremental / Initial»은 존재하지 않는 동작이라 상수 「파일」로
       * 눌러 뒀었다 (LOCK 10). 그런데 전 행이 같은 글자면 **정보량이 0인 칸**이다.
       * 장부의 단위가 파일로 올라가면서 진짜로 갈리는 축이 생겼다 — 이 파일이
       * 사실로 들어갔나, 기준으로 들어갔나, 훑기만 했나.
       *
       * ⚠ **파일 이름 칸은 아직 없다.** 동결 목업의 이 표에는 「시각·연결·유형·대상·
       * 조회·신규·갱신·실패·결과·소요」뿐이고 머리글이 `Template.tsx`에 하드코딩돼
       * 있다. 이름을 여기 넣으면 **머리글과 내용이 어긋난다** — 그건 §21 항목이지
       * 배선으로 우겨넣을 일이 아니다 (남은일에 올렸다).
       */
      type: r.kind === "fact" ? "파일" : r.kind === "reference" ? "기준 데이터" : "훑기만",
      // Fact는 표별 행 수가, 기준 데이터는 「무엇이 됐나」가 답한다 (015).
      entity: r.kind === "fact" ? entityLabel(r.ownedByTable) : outcomeLabel(r.outcomes),
      /**
       * ★ 행 수 칸은 **배치의 어휘**다 — 없으면 «—»이지 0이 아니다 (§22) ★
       * 0을 그리면 「0행 들어갔다」로 읽히는데 원가 35건이 들어간 파일에 그건 거짓이다.
       */
      fetched: r.kind === "fact" ? won(r.fetched) : "—",
      created: r.kind === "fact" ? won(r.created) : "—",
      updated: r.kind === "fact" ? won(r.updated) : "—",
      failed: r.kind === "fact" || r.failed > 0 ? String(r.failed) : "—",
      failColor: r.failed > 0 ? NEG : DIM,
      status: st.text,
      statusColor: st.color,
      // 소요 시간을 재지 않는다. 「0.0s」를 지어내지 않고 없음을 표시한다
      dur: "—",
      // ★ 못 누르는 버튼을 그려놓고 막지 않는다 (§21-1 · U-3) ★
      // 기준 데이터·훑기만 한 파일은 되돌리기 대상이 아니다. 사유는 상태 칸이 쓴다.
      canUndo: r.kind === "fact" && r.undo === "can",
      undone: r.kind === "fact" && r.undo === "undone",
      undo: (e?: { stopPropagation?: () => void }) => {
        e?.stopPropagation?.()
        act.askUndo(r)
      },
      /**
       * ★ 눌러서 편다 — **행이 무엇이냐에 따라 다른 것이 열린다** (018) ★
       *
       * `fact`      이 batch가 넣은 행 (11번)
       * 나머지      **파일에 있던 원본 표** (016·017이 담았다)
       *
       * 015까지는 여기가 `if (r.kind !== "fact") return`이었다 — 기준 데이터 행은
       * `cursor: pointer`를 달고도 아무 일이 없었고, 그것이 §21-1 U-3 위반이자
       * 남은일 1.6의 항목이었다. 이 줄이 그 자리를 채운다.
       *
       * 목격이 없으면(실측 0건이지만 타입이 든다) 열 것이 없다 — 그때는 어포던스도
       * 없어야 맞지만, 그 판정을 화면 배선에서 하려면 행마다 커서를 갈라야 한다.
       * **지금은 아무 일도 안 하는 대신 그 경우가 실재하면 여기 사유를 적는다.**
       */
      click: () => {
        act.openRows(r)
      },
    }
  })

  // `syncAll`·`syncColor`는 이 표의 값이 아니다 — 헤더의 [가져오기] 버튼 핸들러와
  // 상태 점 색이다. 이름이 비슷하다고 건드리면 엉뚱한 것을 덮는다.
}

/** 화면이 여는 패널 하나. 닫혀 있으면 `null`이다. */
export interface OpenBatch {
  /**
   * ★ 같은 패널이 **두 가지**를 연다 (018 · ADR-028 결정 4) ★
   *
   * `batch`  앱이 **해석한** Fact 행 — 11번이 세운 것. 표별 탭이 있다
   * `sheet`  파일에 있던 **그대로의 표** — 016·017이 담아 둔 것. 탭이 없다
   *
   * 새 패널을 만들지 않는다(ADR-023 확인 ④). 둘은 «넣은 결과»와 «원본»이라
   * 서로 다른 것을 보여 주지만, 여는 자리와 페이지 규율(LOCK 5)이 같다.
   */
  readonly kind: "batch" | "sheet"
  /** `sheet`일 때 제목이 쓰는 파일 이름. `batch`에서는 안 쓴다. */
  readonly sourceName: string
  /** `sheet`일 때 읽을 통의 줄. `batch`에서는 `null`이다. */
  readonly sightingId: number | null
  readonly batchId: string
  readonly table: string
  /** 몇 번째 페이지인가 (0-기준). */
  readonly page: number
  readonly columns: readonly string[]
  readonly rows: readonly (readonly (string | number | null)[])[]
  readonly total: number
  /** 이 batch가 표별로 몇 행을 갖고 있나 — 탭이 이걸 그린다. */
  readonly tables: Readonly<Record<string, number>>
  readonly busy: boolean
}

export interface RowsActions {
  /** batch 행을 눌렀다 — 열거나 닫는다. */
  readonly toggle: (batchId: string, tables: Readonly<Record<string, number>>) => void
  readonly pickTable: (table: string) => void
  readonly pickPage: (page: number) => void
}

/** 한 페이지에 몇 행. 8만 행 batch가 정기 입력이라 전량을 그리지 않는다 (LOCK 5). */
export const ROWS_PER_PAGE = 50

/**
 * ★ 적재된 행 패널 (§21 «history-rows» · 신설, 2026-08-21) ★
 *
 * ─────────────────────────────────────────────────────────────
 * 사용자가 물었다: *"가져오기로 가져온 것들 어디서 테이블을 볼 수 있다는 거야?"*
 * 답은 «어디서도 못 본다»였다 — 주문 화면은 가공된 뷰, 정산 화면은 집계,
 * 가져오기 기록은 파일 단위 요약이고, **넣은 행 자체를 보는 자리가 없었다.**
 * 이 파일의 `syncRows.click` 주석이 그 사실을 이미 적어 뒀다:
 * *「상세 패널은 아직 없다. 어포던스를 그리지 않는다」*.
 *
 * ★ 이제 **둘 다 연다** (018 · ADR-028 결정 4) ★
 * 2026-08-21까지 이 자리에 「원본은 어디에도 저장되지 않는다」고 적혀 있었고
 * 그때는 참이었다. **016·017이 그것을 뒤집었다** — 파싱된 표가 `sheet_block`에
 * gzip으로 담긴다(ADR-027). 그래서 패널이 갈래를 갖는다:
 *
 * `batch`  앱이 **해석한** Fact 행. 제목이 «넣은 결과»라고 말한다
 * `sheet`  파일에 있던 **그대로의 표**. 제목이 «원본 표»라고 말한다
 *
 * ⚠ `sheet`도 원본 **바이트**가 아니다 — 파서가 정규화한 값이다(ADR-023 확인 ③:
 * 「원본 바이트는 안 둔다 — 구매자 실명이 든 원본을 앱이 계속 들고 있게 된다」).
 * 적재 **전**의 격자(`import-grid`)와 같은 깊이이고, 다른 점은 **나중에도 열린다**는 것뿐이다.
 *
 * ★ 편집 어포던스 0 ★ Fact 행이다. LOCK 9가 인라인 편집 UI를 금지하고, §21-1이
 * «못 누르는 칸을 그려놓고 막는 것이 아니라 아예 안 그린다»고 못박았다.
 * 값을 고치는 자리는 조정 레이어다 (ADR-020).
 * ─────────────────────────────────────────────────────────────
 */
export function batchRowVals(
  vals: TemplateVals,
  open: OpenBatch | null,
  act: RowsActions,
): void {
  vals.rowsOpen = open !== null
  if (open === null) {
    vals.rowsTitle = ""
    vals.rowsTabs = []
    vals.rowsCols = []
    vals.rowsBody = []
    vals.rowsNote = ""
    vals.rowsPages = []
    vals.rowsBusy = false
    return
  }

  vals.rowsBusy = open.busy
  const sheet = open.kind === "sheet"
  vals.rowsTitle = sheet
    ? `${open.sourceName} — 원본 표`
    : `${TABLE_LABEL[open.table] ?? open.table} — 넣은 결과`

  /**
   * 이 batch가 실제로 채운 표만 탭이 된다. 0행짜리 탭을 그리면 눌러도 빈 표다.
   * **원본 표에는 탭이 없다** — 한 시트가 한 표이고, 갈래가 없는 자리에 탭을
   * 하나만 그리면 «더 있는데 안 보여준다»로 읽힌다 (§21-1 · U-3).
   */
  vals.rowsTabs = sheet
    ? []
    : Object.entries(open.tables)
        .filter(([, n]) => n > 0)
        .map(([t, n]) => ({
          label: `${TABLE_LABEL[t] ?? t} ${won(n)}`,
          on: t === open.table ? "active" : "",
          pick: () => act.pickTable(t),
        }))

  vals.rowsCols = open.columns.map((c) => ({
    // ★ 원본 표의 열 이름은 **파일이 쓴 글자 그대로다** ★ 번역하면 «원본»이
    // 아니게 된다 — 헌장 C-4가 막는 것은 내부 코드값이지 파일의 머리글이 아니다.
    // 머리글이 빈 열은 파일에 실제로 그런 열이 있다는 뜻이라 그 사실을 말한다.
    //
    // Fact 쪽은 반대다: 라벨이 없으면 **컬럼명을 흘리지 않고** 그 사실을 말한다 —
    // 코드값이 화면에 나가는 것은 C-4 위반이고, 조용히 숨기는 것은 LOCK 6 위반이다.
    label: sheet ? (c.trim() === "" ? "(이름 없는 열)" : c) : (FIELD_LABEL[c] ?? "(이름 없는 열)"),
    num: sheet ? false : NUMERIC_FIELD.has(c),
  }))

  vals.rowsBody = open.rows.map((r, i) => ({
    // 왼쪽 번호는 **이 패널 안에서 몇 번째**다. 파일의 행 번호가 아니다 —
    // 적재도 담기도 합계·빈 행을 이미 걸렀으므로 둘은 같지 않고, 파일 좌표는
    // 저장되지 않는다 (ADR-027은 «파싱된 표»를 담지 파일 좌표를 담지 않는다).
    no: won(open.page * ROWS_PER_PAGE + i + 1),
    cells: r.map((v, c) => ({
      text:
        v === null
          ? "—"
          : sheet
            ? // ★ 원본은 **바꾸지 않고 그대로 낸다** ★ 천단위 쉼표도 넣지 않는다 —
              // 파일과 다른 글자가 보이면 그건 원본이 아니다 (LOCK 3의 정신).
              String(v)
            : NUMERIC_FIELD.has(open.columns[c] ?? "")
              ? won(Number(v))
              : KEY_FIELD.has(open.columns[c] ?? "")
                ? showKey(String(v))
                : (VALUE_LABEL[open.columns[c] ?? ""]?.[String(v)] ?? String(v)),
      num: sheet ? typeof v === "number" : NUMERIC_FIELD.has(open.columns[c] ?? ""),
      dim: v === null,
    })),
  }))

  const last = Math.max(0, Math.ceil(open.total / ROWS_PER_PAGE) - 1)
  const from = open.page * ROWS_PER_PAGE + 1
  const to = Math.min(open.total, (open.page + 1) * ROWS_PER_PAGE)
  vals.rowsNote =
    open.total === 0
      ? sheet
        // 담기 전에 넣은 파일이거나 담기가 실패한 파일이다. 「없다」로 끝내지 않고
        // 왜 비었는지의 실마리를 준다 — 사유 자체는 장부의 결과 칸이 말한다 (LOCK 6).
        ? "이 파일의 원본 표가 담기지 않았습니다"
        : "이 표에 들어간 행이 없습니다"
      : `${won(open.total)}행 중 ${won(from)}–${won(to)}`

  /**
   * ★ 페이지를 전부 그리지 않는다 ★ 8만 행이면 1,603쪽이라 버튼이 화면을 덮는다.
   * 앞뒤 두 쪽과 처음·끝만 낸다 — 「어디쯤인가」는 위 문장이 이미 말했다.
   */
  const want = new Set([0, last, open.page - 1, open.page, open.page + 1])
  vals.rowsPages = [...want]
    .filter((p) => p >= 0 && p <= last)
    .sort((a, b) => a - b)
    .map((p) => ({
      label: won(p + 1),
      on: p === open.page ? "active" : "",
      pick: () => act.pickPage(p),
    }))
}

/**
 * 되돌리기 확인 다이얼로그 (§21-1 «되돌릴 수 없는 일은 묻는다»).
 *
 * **행 수를 명시한다.** «되돌릴까요?»만 묻고 규모를 안 말하면 사용자는 8만 행이
 * 사라지는 것과 128행이 사라지는 것을 같은 무게로 결정하게 된다.
 */
export function undoConfirm(r: HistoryRow, run: () => void): ConfirmDialog {
  /**
   * ★ 미완료 배치를 치우는 것은 «되돌리기»가 아니라 «취소»다 ★
   * 그 행들은 애초에 손익에 잡힌 적이 없다 — 조회는 `committed`만 보기 때문이다
   * (`active_*` 뷰). 「이전 판으로 돌아갑니다」라고 말하면 있지도 않았던 변화를
   * 되돌리는 것처럼 들린다.
   */
  const aborting = r.outcome === "unfinished"
  return {
    title: aborting ? "적재하다 만 것을 치울까요" : "이 가져오기를 되돌릴까요",
    body: aborting
      ? `${r.channel} · ${stamp(r.at)}에 시작한 「${r.sourceName}」입니다. ` +
        `이 가져오기는 **끝나지 않았습니다** — 그 행들은 손익에 잡힌 적이 없고, ` +
        `치우면 목록에서도 사라집니다.`
      : `${r.channel} · ${stamp(r.at)}에 들어온 「${r.sourceName}」입니다. ` +
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
    confirmLabel: aborting ? "치우기" : "되돌리기",
    btnFg: NEG,
    btnBorder: NEG,
    btnOp: "1",
    run,
  }
}

// ═══════════════════════════════════════════════════════════════
// 보는 범위 — 묶음 전환 + 편집 (§21 «scope-bar» · ADR-021 · 013)
// ═══════════════════════════════════════════════════════════════
//
// ★ 이름을 가른다 ★
// 저장된 것은 **묶음**(`collection`), 화면이 말하는 것은 **범위**(지금 무엇을
// 보고 있나)다. 묶음은 여럿이고 범위는 하나다.
//
// ★ 이 화면이 범위에 안 걸린다 ★
// 파일 목록이 범위로 걸러지면 «담을 파일을 고르는 화면»이 자기 자신을 가린다.
// 그래서 `batchHistory`는 늘 전부를 준다 (`tests/collection.test.ts`가 못 박는다).

/** 화면이 들고 있는 상태. App이 소유하고 여기서는 읽기만 한다. */
export interface ScopeState {
  readonly bundles: readonly { readonly id: string; readonly name: string; readonly count: number }[]
  /** `null`이면 「전체」 — 저장된 행이 없는 상태다 (013). */
  readonly activeId: string | null
  /** 지금 범위에 든 파일 수. 「전체」면 전부와 같다. */
  readonly inScope: number
  /** 전 기간 매출 — 전체 / 지금 범위. 아직 안 읽었으면 `null`. */
  readonly revenue: { readonly all: number; readonly inScope: number } | null
  readonly edit: {
    readonly mode: "new" | "edit"
    readonly name: string
    readonly query: string
    /** 담긴 batch id. 화면에 안 나온다 (헌장 C-4). */
    readonly picked: readonly string[]
  } | null
  /** 방금 넣은 파일. 지금 묶음 밖이면 그 사실을 말한다 (ADR-021 「함정」). */
  readonly justImported?: { readonly id: string; readonly name: string } | null
}

export interface ScopeActions {
  readonly pick: (id: string | null) => void
  readonly openNew: () => void
  readonly openEdit: () => void
  readonly setName: (v: string) => void
  readonly setQuery: (v: string) => void
  readonly toggleFile: (batchId: string) => void
  readonly save: () => void
  readonly cancel: () => void
  readonly remove: () => void
  readonly addJustImported: () => void
  readonly dismissJustImported: () => void
}

const NOOP_SCOPE: ScopeActions = {
  pick: () => {}, openNew: () => {}, openEdit: () => {}, setName: () => {},
  setQuery: () => {}, toggleFile: () => {}, save: () => {}, cancel: () => {}, remove: () => {},
  addJustImported: () => {}, dismissJustImported: () => {},
}

export function scopeVals(
  vals: TemplateVals,
  allRows: readonly HistoryRow[],
  st: ScopeState,
  act: ScopeActions = NOOP_SCOPE,
): void {
  /**
   * ★ 묶음은 **batch**를 묶는다 — 통 줄을 섞지 않는다 (015) ★
   *
   * 장부의 단위가 파일로 올라가면서 이 배열에 기준 데이터·훑기만 한 파일이 함께
   * 온다. 그런데 `collection_batch.batch_id`가 batch를 가리키므로(013), 그 줄들을
   * 후보로 그리면 **고를 수는 있는데 담기지 않는** 체크박스가 된다 — 못 누르는
   * 것을 그려놓고 막는 그 모양이다 (U-3).
   *
   * 「파일을 묶어야 맞다」는 013 확장 항목으로 열려 있다(대기목록 8). 그 확장이
   * 오기 전까지 여기는 **batch가 붙은 줄만** 본다.
   */
  const rows = allRows.filter((r) => r.kind === "fact")
  const total = rows.length
  const active = st.bundles.find((b) => b.id === st.activeId) ?? null
  const inScope = active === null ? total : st.inScope

  // 「전체」가 목록의 첫 항목이고 **지울 수 없다** (ADR-021 — Linear식).
  const bundles = [
    { id: null, name: "전체", count: total, active: st.activeId === null, pick: () => act.pick(null) },
    ...st.bundles.map((b) => ({
      id: b.id,
      name: b.name,
      count: b.count,
      active: b.id === st.activeId,
      pick: () => act.pick(b.id),
    })),
  ]

  const q = (st.edit?.query ?? "").trim().toLowerCase()
  const picked = new Set(st.edit?.picked ?? [])
  const files = rows
    .filter((r) => q === "" || r.sourceName.toLowerCase().includes(q))
    .map((r) => ({
      key: r.id,
      name: r.sheetName === null ? r.sourceName : `${r.sourceName} · ${r.sheetName}`,
      at: `${stamp(r.at)} · ${r.channel}`,
      checked: picked.has(r.id),
      toggle: () => act.toggleFile(r.id),
      // 겹치는 파일의 실제 증상은 「두 배」가 아니라 「조용히 빠짐」이다 (ADR-021 개정 ②).
      // 담아 둔 파일의 행을 나중 파일이 가져갔으면 그 사실을 여기서 말한다.
      note: r.blockedBy === null ? "" : `나중 파일이 가져감`,
    }))

  const name = (st.edit?.name ?? "").trim()
  const canSave = name !== ""

  vals.scope = {
    label: active?.name ?? "전체",
    summary:
      st.activeId === null
        ? `파일 ${won(total)}개 전부를 보고 있습니다`
        : `파일 ${won(total)}개 중 ${won(inScope)}개 · ${won(total - inScope)}개는 계산 밖입니다`,
    // ★ 막지 않는다. 크기를 말한다 (ADR-021) ★
    // 이 수가 없으면 사용자는 «뺐다»만 알고 «얼마를 뺐는지»를 모른다.
    excluded:
      st.activeId === null || st.revenue === null
        ? ""
        : `계산 밖 매출 ${won(st.revenue.all - st.revenue.inScope)}원 (전 기간)`,
    bundles,
    /**
     * ★ 넣었는데 안 보이는 일을 없앤다 (ADR-021 「함정」) ★
     * 「전체」를 보는 중이면 새 파일은 자동으로 든다 — 할 말이 없다.
     * Lightroom은 이걸 안 한다(임포트와 앨범이 무관한 일이라서). 우리는 다르다.
     */
    fresh:
      st.justImported === null || st.justImported === undefined || st.activeId === null
        ? null
        : {
            text: `방금 넣은 「${st.justImported.name}」은 이 묶음에 없습니다 — 지금 화면에 안 들어갑니다`,
            add: act.addJustImported,
            dismiss: act.dismissJustImported,
          },
    openNew: act.openNew,
    // 「전체」는 편집 대상이 아니다 — 저장된 행이 아니기 때문이다 (013).
    openEdit: st.activeId === null ? null : act.openEdit,
    edit:
      st.edit === null
        ? null
        : {
            title: st.edit.mode === "new" ? "새 묶음" : "묶음 편집",
            name: st.edit.name,
            setName: act.setName,
            query: st.edit.query,
            setQuery: act.setQuery,
            files,
            picked: picked.size,
            canSave,
            // 아무 말 없이 회색인 버튼은 «고장»으로 읽힌다 (§21-1).
            // 열자마자는 안 띄운다 — 아직 아무것도 안 쓴 상태는 «틀림»이 아니라 «아직»이다.
            why: canSave
              ? picked.size === 0
                ? "파일을 하나도 안 담아도 만들 수 있습니다 — 그때는 화면이 0을 그립니다"
                : ""
              : "이름을 지어야 저장할 수 있습니다",
            save: act.save,
            cancel: act.cancel,
            remove: st.edit.mode === "edit" ? act.remove : null,
          },
  }
}
