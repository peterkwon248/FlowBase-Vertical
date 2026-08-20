/**
 * 다섯 화면의 내보내기 표 — **무엇을 내보내는지 문장으로 말한다** (LOCK 8 · LOCK 6).
 *
 * ★ 「지금 보고 있는 것」이 범위다 ★
 * 다시 조회하지 않는다. 화면이 그리는 행을 그대로 낸다 — 사용자가 본 것과 파일이
 * 갈리면 「내보내기」라는 말이 거짓이 된다. 대신 `scope`가 **몇 행 · 어느 달**인지
 * 밝히므로, 좁혀 보고 있으면 좁혀 나간다는 사실이 팝오버에 적혀 있다.
 *
 * ★ 표시 문자열이 아니라 값을 낸다 ★
 * 화면의 `8,285,200원`을 그대로 쓰면 엑셀에서 문자열이 되어 합계도 못 낸다.
 * 내보내기는 **다시 계산할 수 있는 재료**여야 한다.
 */

import type { ExportTable } from "./export.js"
import { stamp } from "./export.js"
import type { SettlementRow } from "@core/settlement/rows.js"
import type { OrderRow } from "@core/order/rows.js"
import type { ProfitRow } from "@core/profit/rows.js"
import type { HistoryRow } from "@core/history/rows.js"
import type { OverheadItem } from "./costs.js"
import { monthLabel, type Month } from "@core/profit/months.js"

/** 「N행 · 2026년 7월」. 범위를 숫자로 말한다 — «전부인가»를 사용자가 알아야 한다. */
const scopeOf = (n: number, month: Month | null): string =>
  `${n.toLocaleString("ko-KR")}행` + (month === null ? "" : ` · ${monthLabel(month)}`)

const BASIS: Readonly<Record<OverheadItem["basis"], string>> = {
  MONTH: "월",
  ORDER: "주문당",
  UNIT: "개당",
}

export function settlementTable(rows: readonly SettlementRow[], month: Month): ExportTable<SettlementRow> {
  return {
    file: `정산 ${month}`,
    scope: `${scopeOf(rows.length, month)} — 화면에 보이는 정산 그대로입니다.`,
    note: "금액은 원 단위 숫자입니다. 조정은 반영 전 원본입니다 (LOCK 3 — 대사는 원본끼리).",
    columns: [
      { header: "정산일", get: (r) => r.settledOn },
      { header: "채널", get: (r) => r.channel },
      { header: "건수", get: (r) => r.count },
      { header: "판매액", get: (r) => r.gross },
      { header: "수수료", get: (r) => r.fee },
      { header: "부가세", get: (r) => r.vat },
      { header: "배송비", get: (r) => r.shipping },
      { header: "정산액", get: (r) => r.net },
      { header: "지급일", get: (r) => r.payOutOn },
      { header: "주문에 이어진 건수", get: (r) => r.linked },
    ],
    rows,
  }
}

export function productTable(rows: readonly ProfitRow[], month: Month): ExportTable<ProfitRow> {
  return {
    file: `상품별 손익 ${month}`,
    scope: `${scopeOf(rows.length, month)} — SKU에 이어진 판매만 상품으로 묶입니다.`,
    note: "연결되지 않은 판매는 여기 없습니다. 상품 연결 화면에서 이으면 소급해서 들어옵니다.",
    columns: [
      { header: "상품코드", get: (r) => r.code },
      { header: "상품명", get: (r) => r.name },
      { header: "수량", get: (r) => r.qty },
      { header: "매출", get: (r) => r.revenue },
      { header: "할인", get: (r) => r.discount },
      { header: "매입원가", get: (r) => r.cogs },
      { header: "원가 미상 수량", get: (r) => r.noCostQty },
    ],
    rows,
  }
}

/** 고정비와 운영비를 **한 표로** 낸다 — 구분 열이 둘을 가른다. */
export function costTable(
  fixed: readonly OverheadItem[],
  ops: readonly OverheadItem[],
): ExportTable<OverheadItem & { readonly group: string }> {
  const rows = [
    ...fixed.map((f) => ({ ...f, group: "고정비" })),
    ...ops.map((o) => ({ ...o, group: "운영비" })),
  ]
  return {
    file: "운영·고정비",
    // 기간이 없다 — 비용은 «기준 데이터»라 달로 자르지 않는다 (`period.ts`의 PERIOD_VIEWS와 같은 판단)
    scope: `${scopeOf(rows.length, null)} — 지금 유효한 값입니다. 달과 무관합니다.`,
    note: "「이력」은 같은 항목이 몇 번 바뀌었는지입니다. 옛 값은 이 파일에 없습니다.",
    columns: [
      { header: "구분", get: (r) => r.group },
      { header: "항목", get: (r) => r.label },
      { header: "금액", get: (r) => r.amount },
      { header: "기준", get: (r) => BASIS[r.basis] ?? r.basis },
      { header: "적용 시작일", get: (r) => r.effectiveFrom },
      { header: "이력", get: (r) => r.historyCount },
    ],
    rows,
  }
}

export function orderTable(rows: readonly OrderRow[], month: Month): ExportTable<OrderRow> {
  return {
    file: `주문 ${month}`,
    scope: `${scopeOf(rows.length, month)} — 주문과 홀로 선 클레임이 함께 있습니다.`,
    note: "금액에 부호를 붙이지 않습니다. 클레임을 빼는 것은 손익 계산의 몫입니다.",
    columns: [
      { header: "구분", get: (r) => (r.kind === "order" ? "주문" : "클레임") },
      { header: "발생일", get: (r) => stamp(r.at) },
      { header: "채널", get: (r) => r.channel },
      { header: "상태", get: (r) => r.status },
      { header: "금액", get: (r) => r.amount },
      { header: "클레임 유형", get: (r) => r.claimType },
      { header: "클레임 금액", get: (r) => r.claimAmount },
      // ★ 추정을 숨기지 않는다 (LOCK 6) ★ 파일에 클레임 일자가 없어 결제일을 쓴 행이 있다
      { header: "날짜 추정", get: (r) => (r.dateEstimated || r.claimDateEstimated ? "추정" : "") },
    ],
    rows,
  }
}

export function historyTable(rows: readonly HistoryRow[]): ExportTable<HistoryRow> {
  return {
    file: "가져오기 기록",
    // 기간을 안 받는다 — «7월 파일을 언제 넣었나»는 8월을 보고 있어도 답이 같다
    scope: `${scopeOf(rows.length, null)} — 넣은 파일 전부입니다. 달과 무관합니다.`,
    note: "「제외」는 읽지 못해 뺀 행입니다. 그 행들은 어떤 숫자에도 안 들어갑니다.",
    columns: [
      { header: "시각", get: (r) => stamp(r.at) },
      { header: "채널", get: (r) => r.channel },
      { header: "파일", get: (r) => r.sourceName },
      { header: "시트", get: (r) => r.sheetName },
      { header: "유형", get: (r) => r.docType },
      { header: "상태", get: (r) => r.batchStatus },
      { header: "읽은 행", get: (r) => r.fetched },
      { header: "새로 넣음", get: (r) => r.created },
      { header: "갱신", get: (r) => r.updated },
      { header: "실패", get: (r) => r.failed },
    ],
    rows,
  }
}
