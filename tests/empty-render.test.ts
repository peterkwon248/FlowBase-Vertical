/**
 * 3a 게이트 — **빈 DB로 전 화면이 렌더된다.**
 *
 * 데이터가 하나도 없을 때 화면이 죽지 않고 "없음"을 정직하게 그리는지 본다.
 * 시드를 넣어 채워 보이지 않는 것이 이 프로젝트의 규칙이므로(헌장 C), 빈 값이
 * 정상 경로다. 여기서 죽으면 사용자가 앱을 처음 켠 순간 죽는다는 뜻이다.
 *
 * 값은 `emptyVals()`가 준다 — 변환기가 홀의 쓰임에서 추론한 골격이고,
 * **추론이 틀린 자리는 여기서 드러난다** (문자열로 짐작한 것이 실은 배열이면
 * `.map`에서 터진다).
 *
 * `renderToString`을 쓰는 이유는 DOM 없이 서버에서 한 번 그려보면 충분하기
 * 때문이다. 상호작용은 이 게이트의 대상이 아니다.
 */

import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { Template } from "../src/app/generated/Template.js"
import { emptyVals, type TemplateVals } from "../src/app/generated/vals.js"

/** 목업의 화면 전환 플래그. `data-screen-label`과 1:1이다. */
const SCREENS: { key: keyof TemplateVals["v"]; label: string }[] = [
  { key: "dash", label: "손익 대시보드" },
  { key: "settlement", label: "정산" },
  { key: "products", label: "상품 SKU" },
  { key: "diag", label: "진단" },
  { key: "costs", label: "비용" },
  { key: "orders", label: "주문" },
  { key: "connect", label: "채널" },
  { key: "import", label: "가져오기" },
  { key: "sync", label: "가져오기 기록" },
  { key: "linking", label: "상품 연결" },
  { key: "fieldmap", label: "필드 매핑" },
  { key: "myfields", label: "내 필드" },
  { key: "design", label: "데이터 구조" },
  { key: "settings", label: "설정" },
]

function render(mutate: (v: TemplateVals) => void = () => {}): string {
  const vals = emptyVals()
  mutate(vals)
  return renderToString(createElement(Template, { vals }))
}

describe("빈 DB — 전 화면이 데이터 없이 렌더된다 (3a 게이트)", () => {
  it("아무 화면도 켜지 않으면 셸만 그린다", () => {
    const html = render()
    expect(html).toContain("sidebar")
  })

  for (const s of SCREENS) {
    it(`${s.label} 화면`, () => {
      const html = render((v) => {
        v.v[s.key] = true
      })
      expect(html, `${s.label}이 렌더되지 않았다`).toContain(s.label)
    })
  }

  it("첫 실행 온보딩이 그려진다", () => {
    const html = render((v) => {
      v.v.dash = true
      v.firstRun = true
    })
    expect(html).toContain("정산서 한 장으로 시작합니다")
    expect(html).toContain("데이터는 이 컴퓨터에만 저장됩니다")
  })

  it("빈 값은 시드가 아니다 — 목록이 실제로 비어 있다", () => {
    const vals = emptyVals()
    const lists = Object.entries(vals).filter(([, v]) => Array.isArray(v))
    expect(lists.length).toBeGreaterThan(50)
    for (const [name, list] of lists) {
      expect((list as readonly unknown[]).length, `${name}에 값이 들어 있다`).toBe(0)
    }
  })
})
