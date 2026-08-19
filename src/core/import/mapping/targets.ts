/**
 * 전용 필드 등록부 — **canonical target의 유일한 명부.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 (2026-08-19, 계획 A) ★
 *
 * 지금까지 canonical target은 팩 JSON 속 **무형의 문자열**이었다 — 오타를 낸
 * 프로파일은 조용히 그 필드를 잃고, 화면은 「매출액」 한 단어가 셋으로 갈리는
 * (`total_amount`/`gross_amount`/`net_amount`) 것을 설명할 말이 없었다.
 *
 * 이 명부가 세 소비처를 먹인다:
 *   ① 판정(judge)의 값 게이트 — 별칭이 맞아도 kind가 어긋나면 후보로 강등
 *   ② 항등식 증명기(C)의 대상 지목 — 템플릿에 있는 관계만 tier를 올린다
 *   ③ 필드매핑 드롭다운(B)의 뜻풀이 — 이름이 아니라 뜻을 보여준다
 *
 * ★ LOCK 4 비저촉 ★ target 이름은 Fact 테이블 컬럼과 같은 **코어 어휘**다.
 * 마켓 이름(쿠팡·네이버…)은 여기 한 글자도 없다 — 그건 팩의 프로파일이 든다.
 * ─────────────────────────────────────────────────────────────
 */

import type { NormalizedKind } from "../types.js"

export interface TargetSpec {
  readonly name: string
  /**
   * 이 필드에 올 수 있는 값의 종류들. 판정의 **값 게이트**가 본다 — 별칭이
   * 「이 열은 total_amount다」라고 해도 열의 값이 날짜면 후보로 강등된다.
   * 복수인 이유: 식별자 필드는 파일에 따라 숫자로도 문자열로도 온다.
   */
  readonly kinds: readonly NormalizedKind[]
  /**
   * 사람 말 뜻풀이. 드롭다운이 이걸 보인다 — 「매출액」이라는 한 단어가
   * 셋으로 갈리는 문제(작업-상태 «매핑 한 벌의 최소 집합»)의 답이 이 칸이다.
   */
  readonly gloss: string
  /** 어느 표에 사는가. */
  readonly tables: readonly string[]
}

const T = (
  name: string,
  kinds: readonly NormalizedKind[],
  gloss: string,
  tables: readonly string[],
): TargetSpec => ({ name, kinds, gloss, tables })

/**
 * 실사용 26종 — 프로파일 9장의 `fieldMappings`·`rowRouting.routes`·`orderItem`이
 * 쓰는 전부다. `validateProfiles`가 «여기 없는 target은 오타다»로 지킨다
 * (ADR-010 계보 — 미지의 값을 흘리지 않는다).
 */
export const TARGETS: readonly TargetSpec[] = [
  // ── 주문 (fact_order) ──────────────────────────────────────────
  T("ordered_at", ["date"], "주문·결제가 일어난 날", ["fact_order"]),
  T("total_amount", ["number"], "주문 총액 — 구매자가 결제한 금액", ["fact_order"]),
  T("status", ["text"], "주문의 진행 상태 (행 분류에도 쓰인다)", ["fact_order"]),
  T("date_precision", ["text"], "날짜의 정밀도 — 일 단위인가 기간 집계인가", ["fact_order"]),
  T("period_end", ["date"], "기간 집계 행의 끝 날짜", ["fact_order"]),
  // ── 클레임 (fact_claim) ────────────────────────────────────────
  T("claim_type", ["text"], "클레임 종류 — 취소·반품·교환·환불", ["fact_claim"]),
  T("claimed_at", ["date"], "클레임이 귀속되는 날 (발생주의 — ADR-009)", ["fact_claim"]),
  T("amount", ["number"], "클레임 금액", ["fact_claim"]),
  // ── 정산 (fact_settlement) ─────────────────────────────────────
  T("gross_amount", ["number"], "판매 금액 — 공제 전", ["fact_settlement", "fact_order_item"]),
  T("fee_amount", ["number"], "마켓이 뗀 수수료·공제 합", ["fact_settlement"]),
  T("net_amount", ["number"], "정산 금액 — 공제 후 실수령 (음수가 정상인 행이 있다)", ["fact_settlement"]),
  T("shipping_amount", ["number"], "배송비 (선결제 포함)", ["fact_settlement"]),
  T("vat_amount", ["number"], "부가세 (VAT)", ["fact_settlement"]),
  T("settled_on", ["date"], "정산이 확정된 날", ["fact_settlement"]),
  T("pay_out_on", ["date"], "돈이 입금된(될) 날", ["fact_settlement"]),
  T("order_source_key", ["identifier", "number", "text"], "이 정산이 가리키는 주문의 번호", ["fact_settlement"]),
  // ── 광고 (fact_ad_spend) ───────────────────────────────────────
  T("spend_amount", ["number"], "쓴 광고비", ["fact_ad_spend"]),
  T("spent_on", ["date"], "광고비가 나간 날", ["fact_ad_spend"]),
  T("campaign_key", ["identifier", "number", "text"], "캠페인·지면의 식별자", ["fact_ad_spend"]),
  T("campaign_name", ["text"], "캠페인·지면의 이름", ["fact_ad_spend"]),
  T("campaign_type", ["text"], "캠페인 분류 — 배분 규칙이 이걸 본다", ["fact_ad_spend"]),
  T("impressions", ["number"], "노출 수", ["fact_ad_spend"]),
  T("clicks", ["number"], "클릭 수", ["fact_ad_spend"]),
  T("conversions", ["number"], "광고 전환 주문 수", ["fact_ad_spend"]),
  T("conversion_amount", ["number"], "광고 전환 매출 — **주문 매출이 아니다**", ["fact_ad_spend"]),
  // ── 품목 (fact_order_item) ─────────────────────────────────────
  T("quantity", ["number"], "팔린 개수", ["fact_order_item"]),
]

const BY_NAME = new Map(TARGETS.map((t) => [t.name, t]))

export function targetSpec(name: string): TargetSpec | undefined {
  return BY_NAME.get(name)
}

/**
 * 항등식 템플릿 — **증명이 대상을 지목하는 유일한 길** (계획 C의 어휘).
 *
 * 항등식 혼자는 «A = B − C»라는 관계만 증명한다. 그 A가 무슨 필드인지는 이
 * 템플릿과 맞아야 나온다 — 템플릿에 없는 항등은 후보의 문장을 강화할 뿐 tier를
 * 못 올린다. 정직한 하한이다: 우연히 성립하는 관계로 필드를 «증명»하지 않는다.
 *
 * `-` 접두 = 빼는 항. 순서는 뜻이 있다: result = terms[0] − terms[1] …
 */
export const IDENTITY_TEMPLATES: readonly {
  readonly result: string
  readonly terms: readonly string[]
  readonly gloss: string
}[] = [
  // 시작은 하나다 — 11번가 정산의 실측 관계. C 세션이 픽스처로 재고 늘린다.
  // 항이 하나뿐인 «항등»(a = b)은 넣지 않는다 — 값이 같은 두 열은 흔하고
  // (금액 복사 열), 그걸로 필드를 증명하면 우연이 확정이 된다.
  {
    result: "net_amount",
    terms: ["gross_amount", "-fee_amount"],
    gloss: "정산 금액 = 판매 금액 − 공제 합",
  },
]
