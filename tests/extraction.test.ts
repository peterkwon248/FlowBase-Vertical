import { describe, it, expect } from "vitest"
import { detectHeader, headerSpan } from "../src/core/import/extraction/header.js"
import { isTotalRow, stripTotals } from "../src/core/import/extraction/totals.js"
import { classifySheet, looksMachineGenerated } from "../src/core/import/extraction/sheets.js"
import { lastNonBlankRow } from "../src/core/import/extraction/rows.js"
import type { RawRow } from "../src/core/import/types.js"

describe("헤더 탐지", () => {
  it("제목 행을 건너뛰고 진짜 헤더를 찾는다", () => {
    // #4·#5·#6 모양 — 위에 제목·기간이 있고 헤더가 아래에 있다.
    const rows: RawRow[] = [
      [],
      ["Gmarket 파워클릭 상품별 리포트"],
      [],
      ["사이트 코드", "상품ID", "노출", "클릭"],
      ["G마켓", "4778338468", 42466, 221],
      ["G마켓", "2106845960", 20515, 88],
      ["G마켓", "2702301401", 26080, 84],
    ]
    expect(detectHeader(rows, 4).rowIndex).toBe(3)
  })

  it("2단 병합 헤더의 윗단을 고른다", () => {
    // #12 모양 — 윗단이 듬성듬성하지만 아랫단이 메운다.
    const rows: RawRow[] = [
      ["날짜", "구분", "매출금액", "판매금액", null, null],
      [null, null, null, "상품판매가", "(-)상품할인", "결제금액"],
      ["2025-10-01", "pc", "753,100", "687,100", "0", "687,100"],
      [null, "mobile", "214,000", "202,000", "0", "202,000"],
      [null, "수기주문", "0", "0", "0", "0"],
    ]
    const h = detectHeader(rows, 6)
    expect(h.rowIndex).toBe(0)
    expect(headerSpan(rows, 0, 6)).toBe(2)
    // 윗단 이름이 살아 있어야 한다 — 아랫단을 고르면 날짜·구분이 사라진다.
    expect(h.columns[0]).toBe("날짜")
    expect(h.columns[3]).toBe("판매금액 상품판매가")
  })

  it("아랫행에 숫자가 있으면 2단으로 보지 않는다", () => {
    const rows: RawRow[] = [
      ["날짜", "금액", null, null],
      [null, null, 100, 200],
      ["2026-07-01", "1,000", 1, 2],
    ]
    expect(headerSpan(rows, 0, 4)).toBe(1)
  })

  it("헤더가 없으면 0행을 넘겨짚지 않는다", () => {
    const rows: RawRow[] = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]
    const h = detectHeader(rows, 3)
    expect(h.rowIndex).toBeNull()
    expect(h.evidence.join(" ")).toContain("헤더로 볼 만한 행이 없다")
  })

  it("힌트는 동점일 때만 개입한다", () => {
    const rows: RawRow[] = [
      ["이름", "수량"],
      ["가", 1],
      ["나", 2],
      ["다", 3],
    ]
    // 힌트가 2행이어도 내용 판정(0행)이 이긴다.
    const h = detectHeader(rows, 2, { hintRow: 2 })
    expect(h.rowIndex).toBe(0)
    expect(h.evidence.join(" ")).toContain("내용 판정이 우선")
  })
})

describe("합계 행 제거", () => {
  it("위치와 무관하게 잡는다", () => {
    // #1·#2는 헤더 바로 아래(2행)에 합계가 있다.
    expect(isTotalRow(["합계", 262733, 694])).toBe(true)
    // 맨 아래에 있는 경우 (#15의 TOTAL).
    expect(isTotalRow(["TOTAL", "", "", 73740340])).toBe(true)
    expect(isTotalRow(["총액", "967,100", "889,100"])).toBe(true)
  })

  it("상품명에 든 글자에 속지 않는다", () => {
    expect(isTotalRow(["계량컵 3종 세트", 12000, 3])).toBe(false)
    expect(isTotalRow(["벽시계", 8000, 1])).toBe(false)
  })

  it("라벨만 있고 숫자가 없으면 소제목이지 합계가 아니다", () => {
    expect(isTotalRow(["합계", "", ""])).toBe(false)
  })

  it("라벨 없는 집계 행을 잡는다 (#4 G_상품별 6행)", () => {
    // 식별자 칸이 비었는데 측정값은 차 있다.
    const body: RawRow[] = [
      [null, null, 236612, 843, 533291, 45],
      ["G마켓", "4778338468", 42466, 221, 133408, 13],
      ["G마켓", "2106845960", 20515, 88, 73029, 2],
      ["G마켓", "2702301401", 26080, 84, 47377, 6],
      ["G마켓", "3510242340", 1, 1, 209, 0],
    ]
    const r = stripTotals(body, 5)
    expect(r.rows).toHaveLength(4)
    expect(r.excluded[0]).toMatchObject({ rowIndex: 5, reason: "total" })
    expect(r.excluded[0]?.detail).toContain("라벨 없는 집계")
  })

  it("끌 수 있다", () => {
    const body: RawRow[] = [
      [null, null, 236612, 843, 533291],
      ["G마켓", "4778338468", 42466, 221, 133408],
      ["G마켓", "2106845960", 20515, 88, 73029],
      ["G마켓", "2702301401", 26080, 84, 47377],
    ]
    expect(stripTotals(body, 0, { detectUnlabeledAggregates: false }).rows).toHaveLength(4)
  })

  it("제외 행 번호가 절대 기준이다", () => {
    const body: RawRow[] = [["a", 1], ["합계", 2]]
    expect(stripTotals(body, 10).excluded[0]?.rowIndex).toBe(11)
  })
})

describe("빈 행 트레일링", () => {
  it("서식만 남은 꼬리를 찾아낸다", () => {
    // #3·#7의 max_row가 1000·3000인 이유 (대조표 함정 #2).
    const rows: RawRow[] = [["a"], ["b"], [], [], [], []]
    expect(lastNonBlankRow(rows)).toBe(1)
  })

  it("전부 비면 -1", () => {
    expect(lastNonBlankRow([[], [null], [""]])).toBe(-1)
  })
})

describe("시트 분류", () => {
  const table = (n: number): RawRow[] => [
    ["이름", "수량", "금액"],
    ...Array.from({ length: n }, (_, i) => [`상품${i}`, i, i * 100] as RawRow),
  ]

  it("반듯한 표는 데이터", () => {
    expect(classifySheet("order_list_all1763693998", table(20), 3).role).toBe("data")
  })

  it("시트명이 파생을 가리키면 구조가 반듯해도 요약", () => {
    // 잘 만든 분석 시트일수록 표가 반듯하다 — 구조로 뒤집으면 예외가 상시 발동한다.
    expect(classifySheet("통합_상품분석", table(20), 3).role).toBe("summary")
    expect(classifySheet("메인 A", table(20), 3).role).toBe("summary")
    expect(classifySheet("파워클릭_종합요약", table(20), 3).role).toBe("summary")
  })

  it("타임스탬프 시트명은 아무것도 가리키지 않는다 (대조표 함정 #1)", () => {
    expect(classifySheet("order_list_refund1763629991.421", table(20), 3).role).toBe("data")
  })

  it("기계가 붙인 이름을 가려낸다", () => {
    for (const n of ["Sheet1", "sheet", "시트2", "Worksheet 3", "order_list_all1763693998.5244"]) {
      expect(looksMachineGenerated(n), n).toBe(true)
    }
    for (const n of ["매출정리 raw", "통합_상품분석", "메인 A", "G_상품별", "판매통계"]) {
      expect(looksMachineGenerated(n), n).toBe(false)
    }
  })

  it("기계 이름 안의 요약 어휘는 읽지 않는다", () => {
    // 만약 export 도구가 우연히 "summary20260801123456" 같은 이름을 찍어도
    // 그건 사람의 선언이 아니다.
    expect(classifySheet("summary20260801123456", table(20), 3).role).toBe("data")
  })

  it("구조는 표인데 내용이 비면 요약이 아니라 데이터 0행이다", () => {
    // #4 카테고리 — 다음 달 파일엔 데이터가 있을 수 있다.
    // 역할은 구조로, 행 수는 내용으로.
    const empty: RawRow[] = [["카테고리", "노출수", "클릭수", "총비용", "전환수량"]]
    const c = classifySheet("G_카테고리", empty, 5)
    expect(c.role).toBe("data")
    expect(c.reason).toContain("내용이 없다")
  })

  it("헤더가 없으면 단일 표가 아니다", () => {
    // #4 주차별 — 작은 표를 세로로 쌓은 구조.
    const stacked: RawRow[] = [[], ["Gmarket 파워클릭 주차별 리포트"], [], [], [], []]
    expect(classifySheet("G_주차별", stacked, 16).role).toBe("summary")
  })

  it("빈 시트", () => {
    expect(classifySheet("빈시트", [[], []], 0).role).toBe("empty")
  })
})
