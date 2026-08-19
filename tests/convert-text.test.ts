/**
 * 홀 옆의 공백이 살아남는가 (결함 66).
 *
 * `원본 {{ a }} → {{ b }}`가 화면에 «원본512,721→503,321»로 찍혔다. 변환기가
 * 텍스트 **조각마다** `trim()`을 걸었고, 홀이 리터럴을 가르므로 홀 옆의 공백은
 * 언제나 조각의 가장자리였다 — 전부 먹혔다.
 *
 * 그 자리는 손으로 되돌렸지만(ADR-020), 손으로 되돌린 것은 다음 변환에서 도로
 * 사라진다. 그래서 규칙을 두 쪽에서 잡는다 — 작은 입력의 단위 시험과, **동결 목업
 * 전체**를 실제로 변환해 보는 불변식. 뒤엣것이 진짜 게이트다: 규칙이 옳아도
 * 실제 입력에 안 걸리면 아무것도 증명하지 못한다 (ADR-007과 같은 이유).
 */

import { describe, expect, it } from "vitest"
import { readTemplate } from "../tools/convert/source.js"
import { parseTemplate } from "../tools/convert/parse.js"
import { emitTemplate } from "../tools/convert/emit.js"

const MOCKUP = "mockup/FlowBase.dc.html"

function convert(html: string): string {
  const { nodes } = parseTemplate(html, 1)
  return emitTemplate(nodes, { moduleMap: {}, componentPropUse: {}, valsName: "vals" }).jsx
}

describe("텍스트 런 — 홀 옆의 공백", () => {
  it("★ 홀 사이의 공백이 남는다 — 결함 66이 난 바로 그 모양 ★", () => {
    const jsx = convert(`<div>원본 {{ s.origAdj }} → {{ s.effAdjLabel }}</div>`)
    expect(jsx).toContain("원본 {vals.s.origAdj} → {vals.s.effAdjLabel}")
  })

  it("이어진 공백·줄바꿈은 HTML처럼 한 칸으로 접힌다", () => {
    expect(convert(`<div>입금\n   {{ c.paid }}</div>`)).toContain("입금 {vals.c.paid}")
    expect(convert(`<div>{{ a }}  ·  {{ b }}</div>`)).toContain("{vals.a} · {vals.b}")
  })

  it("런의 **바깥** 가장자리는 그대로 잘라낸다 — 의도된 경계다", () => {
    // 부모가 flex/grid면 이 공백은 익명 항목의 가장자리라 CSS가 그리지 않는다.
    // 마크업만 봐서는 갈리지 않으므로 여기서 `{" "}`를 만들지 않는다 (emit.ts 참조).
    const jsx = convert(`<div>\n  {{ x }}\n</div>`)
    expect(jsx).toContain("{vals.x}")
    expect(jsx).not.toContain(`{" "}{vals.x}`)
  })

  it("중괄호가 든 리터럴은 문자열로 감싸도 공백을 잃지 않는다", () => {
    expect(convert(`<div>{{ a }} {x} 뒤</div>`)).toContain(`{vals.a}{" {x} 뒤"}`)
  })

  it("★★ 동결 목업 전체 — 홀이 맞붙어 나오는 자리가 하나도 없다 ★★", () => {
    const src = readTemplate(MOCKUP)
    const { nodes } = parseTemplate(src.html, src.startLine)
    const jsx = emitTemplate(nodes, {
      // `convert.ts`와 같은 표. 여기서 보는 것은 공백뿐이지만 없으면 emit이 선다
      moduleMap: { "./ds/icons.jsx": "../ds/icons", "./ds/charts.jsx": "../ds/charts" },
      componentPropUse: {},
      valsName: "vals",
    }).jsx

    // 목업에 `}}{{`(딱 붙은 홀)는 0건이다. 그러니 출력의 `}{`도 0이어야 한다 —
    // 하나라도 있으면 그 사이의 공백을 변환기가 먹은 것이다.
    expect(src.html).not.toMatch(/\}\}\{\{/)
    const glued = jsx.split("\n").filter((l) => /\}\{/.test(l.replace(/=\{\{|\}\}/g, "")))
    expect(glued).toEqual([])

    // 결함 66의 그 줄이 실제로 공백을 갖고 나오는지도 못 박는다
    expect(jsx).toContain("원본 {s.origAdj} → {s.effAdjLabel}")
  })
})
