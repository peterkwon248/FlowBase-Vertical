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

import type { OrderRow } from "@core/order/rows.js"
import type { Period } from "@core/profit/index.js"
import type { TemplateVals } from "./generated/vals.js"
import { won } from "./format.js"

const DIM = "var(--fg-4)"
const WARN = "var(--label-orange, #F2994A)"
const NONE = "—"

/** 클레임 유형 → 사람이 읽는 말. 목업의 클레임 열 표기를 따른다. */
const CLAIM_LABEL: Record<string, string> = {
  CANCEL: "취소",
  RETURN: "반품",
  EXCHANGE: "교환",
  REFUND: "환불",
}

export function orderScopeLine(rows: readonly OrderRow[], period: Period): string {
  const orders = rows.filter((r) => r.kind === "order").length
  const claims = rows.length - orders
  if (rows.length === 0) return `${period.from} ~ ${period.to}`
  return `${period.from} ~ ${period.to} · 주문 ${won(orders)}건 · 클레임 ${won(claims)}건`
}

export function orderVals(
  vals: TemplateVals,
  rows: readonly OrderRow[],
  period: Period,
): void {
  vals.ordersEmpty = rows.length === 0
  vals.orderScope = orderScopeLine(rows, period)

  vals.orderRows = rows.map((r) => {
    const claim = r.kind === "claim"
    return {
      // 결제일시 — 클레임은 발생일이다. 추정이면 그 사실을 옆에 붙인다
      // (§20 계열 — 정확도를 숨기지 않는다).
      at: r.dateEstimated ? `${r.at} (추정)` : r.at,
      // 마켓 주문번호 — **아직 저장하지 않는다.**
      // `source_key`는 우리 내부 키(주문번호+상품번호 자연키)라 화면에 내보내지
      // 않는다 (헌장 C-4). 마켓 주문번호를 그대로 보여주려면 전용 컬럼이 필요하고,
      // 그건 마이그레이션 + 프로파일 매핑 + 재가져오기다 → 대기목록에 올렸다.
      extId: NONE,
      ch: r.channel,
      color: "var(--fg-2)",
      // 상품 — `fact_order_item`이 비어 있다. ESM 주문통합검색에는 상품명이 있지만
      // 아직 품목 테이블로 매핑하지 않았다 (프로파일 스코프 밖).
      item: claim ? `클레임 · ${CLAIM_LABEL[r.claimType ?? ""] ?? r.claimType ?? ""}` : NONE,
      itemColor: claim ? WARN : DIM,
      // 연결하기 — 상품 연결은 쓰기 경로다. 어포던스를 그리지 않는다.
      unlinked: false,
      qty: NONE,
      rev: won(r.amount),
      // 기여이익 — **주문 단위 배분은 아직 없다.** 손익 계산기가 기간 단위로만
      // 계산한다. 여기에 임의 배분을 넣으면 그 순간 계산기가 둘이 된다
      // (단일 계산기 LOCK).
      net: NONE,
      netColor: DIM,
      claim: claim ? (CLAIM_LABEL[r.claimType ?? ""] ?? r.claimType ?? "") : NONE,
      claimColor: claim ? WARN : DIM,
      // 출처 — 우리는 파일 가져오기뿐이다 (LOCK 10).
      src: "파일",
      click: () => {},
      link: () => {},
    }
  })
}
