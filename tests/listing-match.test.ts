/**
 * 리스팅 제목 매칭 — 정규화 · 유사도 · 제안 등급.
 *
 * 픽스처 없이 규칙 **자체**를 본다. 임계값의 근거가 되는 실데이터 분포는
 * `tools/harness/listing-match-dist.ts`가 뜨고, 그 결과는 모듈 주석에 기록돼 있다.
 *
 * ★ 이 파일이 지키는 것 중 제일 무거운 것 ★
 * **자동 확정이 없다는 것.** 1.0이 나와도 이 코드는 연결하지 않는다.
 */

import { describe, expect, it } from "vitest"
import {
  clusterByProduct,
  normalizeTitle,
  similarity,
  suggest,
  type Candidate,
} from "../src/packs/kr-marketplace/listing-match.js"

describe("제목 정규화", () => {
  /** ★ 조건 4의 본체 — 옵션부를 떼지 않으면 채널 간 매칭이 구조적으로 불리해진다 ★ */
  it("옵션 단위 제목은 옵션부를 뗀다", () => {
    const n = normalizeTitle("머레이 100단 무선 미니팬 NS-19 · 색상:블랙-1개", "option")
    expect(n.product, "옵션부가 남아 있다").toBe("머레이 100단 무선 미니팬 NS-19")
    expect(n.tokens).not.toContain("블랙")
  })

  it("상품 단위 제목은 그대로 쓴다", () => {
    const n = normalizeTitle("머레이 100단 무선 미니팬 NS-19", "product")
    expect(n.product).toBe("머레이 100단 무선 미니팬 NS-19")
  })

  it("판촉어와 한 글자 토큰은 신호가 아니다", () => {
    const n = normalizeTitle("한일의료기 3D 에어매쉬 쿨패드 정품 공급처", "product")
    expect(n.tokens).not.toContain("정품")
    expect(n.tokens).not.toContain("공급처")
    expect(n.tokens).toContain("한일의료기")
  })

  it("기호가 달라도 같은 토큰이 나온다", () => {
    const a = normalizeTitle("3in1 무선충전기 (C타입/8핀)", "product")
    const b = normalizeTitle("3in1 무선충전기 C타입 8핀", "product")
    expect([...a.tokens].sort()).toEqual([...b.tokens].sort())
  })
})

describe("유사도", () => {
  it("겹친 토큰을 근거로 돌려준다 — 화면이 «왜»를 말할 수 있어야 한다", () => {
    const a = normalizeTitle("한일의료기 3D 에어매쉬 쿨패드", "product")
    const b = normalizeTitle("한일의료기 3D 에어매쉬 냉감패드", "product")
    const s = similarity(a, b)
    expect(s.score).toBeGreaterThan(0.7)
    expect(s.shared).toContain("한일의료기")
    expect(s.shared).toContain("에어매쉬")
  })

  it("겹치는 것이 없으면 0이다", () => {
    const s = similarity(
      normalizeTitle("블루투스 마이크 스피커", "product"),
      normalizeTitle("전기매트 온열매트", "product"),
    )
    expect(s.score).toBe(0)
  })

  /** 옵션부를 떼는 것이 실제로 점수를 살리는지 — 조건 4의 효과 검증. */
  it("옵션부를 떼면 채널 간 점수가 오른다", () => {
    const esm = normalizeTitle("머레이 100단 무선 미니팬 NS-19", "product")
    const withOption = normalizeTitle("머레이 100단 무선 미니팬 NS-19 · 색상:블랙-1개", "option")
    const asProduct = normalizeTitle("머레이 100단 무선 미니팬 NS-19 · 색상:블랙-1개", "product")

    expect(
      similarity(esm, withOption).score,
      "옵션부를 뗀 쪽이 더 높아야 한다",
    ).toBeGreaterThan(similarity(esm, asProduct).score)
  })
})

describe("제안 등급 — 확정은 언제나 사람이다", () => {
  const C = (key: string, score: number, shared: string[]): Candidate => ({ key, score, shared })

  it("뚜렷하면 후보 하나를 미리 선택해 준다", () => {
    const s = suggest([C("A", 0.89, ["한일의료기", "에어매쉬", "3d"]), C("B", 0.18, ["3d"])])
    expect(s.kind).toBe("clear")
    expect(s.candidates).toHaveLength(1)
    expect(s.candidates[0]?.key).toBe("A")
  })

  /** ★ 경합이면 골라주지 않는다 — 애매한 것을 골라주면 사람은 그대로 누른다 ★ */
  it("점수가 높아도 2위와 붙어 있으면 경합이다", () => {
    const s = suggest([C("A", 0.50, ["머레이", "방향제"]), C("B", 0.47, ["머레이", "방향제"])])
    expect(s.kind, "미리 고르면 안 된다").toBe("contested")
    expect(s.candidates.length).toBeGreaterThan(1)
  })

  it("겹친 토큰이 하나뿐이면 후보가 아니다 — 브랜드·범용어는 잡음이다", () => {
    const s = suggest([C("A", 0.35, ["머레이"])])
    expect(s.kind).toBe("none")
    expect(s.candidates).toHaveLength(0)
  })

  it("후보가 없으면 새 SKU 등록이 기본이다", () => {
    expect(suggest([]).kind).toBe("none")
    expect(suggest([C("A", 0.05, ["충전기", "무선"])]).kind).toBe("none")
  })

  /** ★ 이 테스트가 «AI 초안·사람 확정»의 마지막 방어선이다 ★ */
  it("완전 일치여도 연결하지 않는다 — 점수만 낸다", () => {
    const s = suggest([C("A", 1, ["가", "나", "다"])])
    expect(s.kind).toBe("clear")
    // 반환 타입에 "연결됨"이나 skuId 같은 것이 없다. 이 함수는 **제안만** 한다.
    expect(Object.keys(s).sort()).toEqual(["candidates", "kind"])
  })
})

describe("옵션 군집 — 자동 병합이 아니라 묶음 제안", () => {
  it("상품부가 같은 옵션끼리 묶인다", () => {
    const ls = [
      { title: "미니팬 NS-19 · 색상:블랙", grain: "option" as const },
      { title: "미니팬 NS-19 · 색상:화이트", grain: "option" as const },
      { title: "거리측정기 GR-40 · 그린", grain: "option" as const },
    ]
    const c = clusterByProduct(ls)
    expect(c.size, "상품 종수만큼 묶여야 한다").toBe(2)
    expect(c.get("미니팬 NS-19")).toHaveLength(2)
  })

  /**
   * ★ 유사도가 아니라 **상품부 완전 일치**로 묶는다 ★
   * 유사도로 묶으면 서로 다른 상품이 조용히 한 SKU가 되고, 그건 사람이 눈치채기
   * 어려운 종류의 오류다.
   */
  it("비슷하기만 한 것은 묶지 않는다", () => {
    const c = clusterByProduct([
      { title: "머레이 마사지건 M-GUN · 실버", grain: "option" as const },
      { title: "머레이 미니 마사지건 TRI-GUN · 블랙", grain: "option" as const },
    ])
    expect(c.size, "이름이 다르면 다른 상품이다").toBe(2)
  })
})
