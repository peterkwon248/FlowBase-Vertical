/**
 * 주문 화면 배선 — **사실(Fact) 화면이다.**
 *
 * ★ §21-1 렌더 규약 ★
 * 사실층은 *채움 없음 · 헤어라인 · 식별자는 모노*이고 무엇보다
 * **편집 어포던스를 그리지 않는다.** 못 누르는 버튼을 그려놓고 막는 것이 아니라
 * 아예 안 그린다 — 헌장 규칙 9(Fact 인라인 편집 금지)의 시각적 대응이다.
 * 수정이 필요하면 조정 레이어로 가고, 그 쓰기 경로는 아직 없다.
 *
 * ★ 없는 것을 지어내지 않는다 ★
 * 이 표에는 `—`가 여럿 뜬다. 전부 **아직 데이터가 없는 자리**이고 그게 지금의
 * 사실이다 (헌장 A-5). 무엇이 왜 비었는지는 아래 각 자리의 주석에 있다.
 */

import type { OrderItems, OrderRow } from "@core/order/rows.js"
import type { Period } from "@core/profit/index.js"
import type { TemplateVals } from "./generated/vals.js"
import { orderKey, type DetailTarget } from "./detail.js"
import { won } from "./format.js"

const DIM = "var(--fg-4)"
const WARN = "var(--label-orange, #F2994A)"
const NONE = "—"

/**
 * 품목 요약을 사람 말로. **세 갈래를 구분한다** (§22 — 부재는 일급이다).
 *
 *   이름을 안다      「무선충전거치대 F5」 · 여럿이면 「무선충전거치대 F5 외 2건」
 *   이름을 모른다     「상품 3건」 — 리스팅이 아직 안 붙어 제목이 없다
 *   품목이 없다       «—» — 정산만 있는 연결이나 품목 열이 없는 양식
 *
 * 마지막 갈래를 「0개」로 찍으면 안 된다. 「안 팔렸다」와 「모른다」는 다른 말이다.
 */
function itemLabel(items: OrderItems | null): string {
  if (items === null) return NONE
  const more = items.count > 1 ? ` 외 ${won(items.count - 1)}건` : ""
  return items.title === null ? `상품 ${won(items.count)}건` : `${items.title}${more}`
}

/**
 * 클레임 유형 → 사람이 읽는 말. 목업의 클레임 열 표기를 따른다.
 *
 * ★ 내보낸다 — 사전은 하나다 ★ 적재된 행 패널(`history-rows`)이 같은 코드값을
 * 그리므로, 두 벌로 적으면 한쪽만 고쳐지는 날 화면끼리 다른 말을 하게 된다.
 */
export const CLAIM_LABEL: Record<string, string> = {
  CANCEL: "취소",
  RETURN: "반품",
  EXCHANGE: "교환",
  REFUND: "환불",
}

/**
 * ★ 조건 (d)의 어휘를 대시보드와 맞춘다 ★
 *
 * 이중 기록 이후 판매 건수에는 취소된 것도 들어 있다. 대시보드가 이미
 * «판매 155건 · 취소 9건»으로 짝을 쓰므로(`dashboard.ts`) 주문 화면도 같은 말을
 * 쓴다 — 두 화면이 다른 낱말로 같은 수를 부르면 사용자가 대조하다 옛 146을 찾는다.
 *
 * **취소는 `kind`가 아니라 `claimType`으로 센다.** 취소된 판매는 통합되어
 * `kind === "order"`인 채로 취소를 달고 있다.
 */
export function orderScopeLine(rows: readonly OrderRow[], period: Period): string {
  const sales = rows.filter((r) => r.kind === "order").length
  const claims = rows.filter((r) => r.claimType !== null).length
  if (rows.length === 0) return `${period.from} ~ ${period.to}`
  return `${period.from} ~ ${period.to} · 판매 ${won(sales)}건 · 취소 ${won(claims)}건`
}

export function orderVals(
  vals: TemplateVals,
  rows: readonly OrderRow[],
  period: Period,
  /**
   * 행을 누르면 §21-2 L2 근거 패널이 연다 (조사 1.7). 안 넘기면 눌러도 아무 일이
   * 없다 — 어포던스는 동결 마크업에 박혀 있어 여기서 지울 수 없다.
   */
  openDetail: (t: DetailTarget) => void = () => {},
): void {
  vals.ordersEmpty = rows.length === 0
  vals.orderScope = orderScopeLine(rows, period)

  vals.orderRows = rows.map((r) => {
    /** 홀로 선 클레임 행인가. **«취소가 있는가»와 다른 질문이다.** */
    const claim = r.kind === "claim"
    /**
     * 취소 칩의 문구. 통합 행이든 홀로 선 행이든 같은 말을 쓴다.
     *
     * ★ 추정 표기가 날짜에서 여기로 옮겨왔다 ★ 통합 행이 찍는 날짜는 **결제일**이라
     * 추정이 아니다. 거기에 «(추정)»을 붙이면 파일이 준 사실을 추정이라 부르는
     * 새 거짓말이 된다. 추정인 것은 클레임 **발생일**이므로 취소 쪽에 붙인다
     * (ADR-009 ①-보완 — «화면은 이 표기를 반드시 노출한다»).
     */
    const claimLabel =
      r.claimType === null
        ? NONE
        : [
            CLAIM_LABEL[r.claimType] ?? r.claimType,
            // ★ 부분 취소면 금액을 말한다 ★ 통합 행의 금액 열은 **판매액**을 찍는다.
            // 전액 취소는 두 수가 같아 덧붙일 게 없지만, 부분 환불이면 통합하면서
            // 클레임 행이 말하던 금액이 사라진다 — 조건은 데이터에서 판정한다
            // (ADR-009 ①-보완 3의 3번: «표기는 있을 때만 말한다»).
            r.claimAmount !== r.amount ? `${won(r.claimAmount)}원` : null,
            // 이 행이 찍는 날짜가 **이미** 추정이라고 말했으면 되풀이하지 않는다.
            // 홀로 선 클레임 행이 그렇다 — 거기서는 날짜가 곧 클레임 발생일이라
            // «2026-07-13 (추정) · 반품 · 일자 추정»으로 한 행이 두 번 말하게 된다.
            r.claimDateEstimated && !r.dateEstimated ? "일자 추정" : null,
          ]
            .filter((x) => x !== null)
            .join(" · ")
    return {
      // 결제일시 — 홀로 선 클레임은 발생일이다. 추정이면 그 사실을 옆에 붙인다
      // (§20 계열 — 정확도를 숨기지 않는다).
      at: r.dateEstimated ? `${r.at} (추정)` : r.at,
      // 마켓 주문번호 — **아직 저장하지 않는다.**
      // `source_key`는 우리 내부 키(주문번호+상품번호 자연키)라 화면에 내보내지
      // 않는다 (헌장 C-4). 마켓 주문번호를 그대로 보여주려면 전용 컬럼이 필요하고,
      // 그건 마이그레이션 + 프로파일 매핑 + 재가져오기다 → 대기목록에 올렸다.
      extId: NONE,
      ch: r.channel,
      color: "var(--fg-2)",
      /**
       * ★ 상품 — 상수 «—»였다 (2026-08-20 · 조사 1.11) ★
       *
       * 옛 주석은 「`fact_order_item`이 **비어 있다**」였는데 **거짓이었다.**
       * `run.ts:364`가 적재하고 있었고, 빠진 것은 **조회의 조인**이었다
       * (`core/order/rows.ts`). 그래서 같은 데이터로 대시보드 상품별 표는
       * 품목 단위로 그려지는데 이 화면만 비어 있었다 — 두 화면이 다른 말을 했다.
       *
       * 세 갈래를 구분해서 말한다 (§22 — 부재는 일급이다):
       *   품목이 있고 이름도 안다   「무선충전거치대 F5」 · 여럿이면 「… 외 2건」
       *   품목은 있는데 이름을 모른다  「상품 3건」 — 리스팅이 아직 안 붙었다
       *   품목 자체가 없다          «—» — 정산만 있는 연결·품목 열이 없는 양식
       */
      item: claim
        ? `클레임 · ${CLAIM_LABEL[r.claimType ?? ""] ?? r.claimType ?? ""}`
        : itemLabel(r.items),
      itemColor: claim ? WARN : r.items === null ? DIM : "var(--fg-2)",
      // ↑ 홀로 선 클레임만 여기서 자기 성격을 말한다. 통합 행의 취소는 **취소 열**이
      // 말하므로(아래 `claim`), 상품 열까지 쓰면 한 행이 같은 말을 두 번 한다.
      // 연결하기 — 상품 연결은 쓰기 경로다. 어포던스를 그리지 않는다.
      unlinked: false,
      // 수량 — 품목이 없으면 «—»다. 0으로 찍으면 「0개 팔렸다」로 읽힌다 (§22).
      qty: claim || r.items === null ? NONE : won(r.items.quantity),
      rev: won(r.amount),
      // 기여이익 — **주문 단위 배분은 아직 없다.** 손익 계산기가 기간 단위로만
      // 계산한다. 여기에 임의 배분을 넣으면 그 순간 계산기가 둘이 된다
      // (단일 계산기 LOCK).
      net: NONE,
      netColor: DIM,
      claim: claimLabel,
      claimColor: r.claimType === null ? DIM : WARN,
      // 출처 — 우리는 파일 가져오기뿐이다 (LOCK 10).
      src: "파일",
      click: () => openDetail({ kind: "order", key: orderKey(r) }),
      link: () => {},
    }
  })
}
