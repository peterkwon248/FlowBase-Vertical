/**
 * 표 구조 안에서는 `{" "}`를 내지 않는다 (결함 65).
 *
 * 목업의 표 마크업은 태그 사이가 줄바꿈으로 떨어져 있고, 변환기가 그 공백을
 * 살리려고 `{" "}`를 넣었다. 형제 사이 공백을 한 칸으로 렌더하는 HTML 규칙을
 * 지키려던 것인데 **표 구조 안에서는 그 규칙이 애초에 적용되지 않는다** — 파서는
 * 공백을 DOM에 남기지만 CSS 표 레이아웃이 아무것도 그리지 않는다. 남는 것은
 * 소음뿐이다: React 개발 모드가 «whitespace text nodes cannot be a child of
 * `<table>`»을 매 렌더 뱉어 **진짜 오류가 거기 묻힌다** (LOCK 6의 뒷면 —
 * 계측기를 막아 두는 셈이다).
 *
 * `convert-text.test.ts`(결함 66)와 같은 이유로 **세 쪽에서 잡는다**:
 *   ① 작은 입력의 단위 시험      — 규칙이 옳은가
 *   ② 동결 목업 전체의 불변식     — 실제 입력에 걸리는가
 *   ③ 지금 `Template.tsx`의 상태   — **이게 진짜 게이트다**
 *
 * ③이 따로 필요한 이유: `Template.tsx`는 재생성 대상이 아니다. §21 패치와 배선이
 * 손으로 얹혀 있어 `npm run convert`를 돌리면 통째로 날아간다. 변환기를 고쳐도
 * 이미 나와 있는 파일은 저절로 안 고쳐지므로, 같은 규칙을 완성된 TSX 쪽에서
 * 한 번 더 집행한다(`tools/convert/blank-audit.ts`).
 */

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { readTemplate } from "../tools/convert/source.js"
import { parseTemplate } from "../tools/convert/parse.js"
import { emitTemplate } from "../tools/convert/emit.js"
import { findTableBlanks, stripTableBlanks } from "../tools/convert/blank-audit.js"

const MOCKUP = "mockup/FlowBase.dc.html"
const TEMPLATE = "src/app/generated/Template.tsx"

function convert(html: string): string {
  const { nodes } = parseTemplate(html, 1)
  return emitTemplate(nodes, { moduleMap: {}, componentPropUse: {}, valsName: "vals" }).jsx
}

function convertMockup(): string {
  const src = readTemplate(MOCKUP)
  const { nodes } = parseTemplate(src.html, src.startLine)
  return emitTemplate(nodes, {
    // `convert.ts`와 같은 표. 여기서 보는 것은 공백뿐이지만 없으면 emit이 선다
    moduleMap: { "./ds/icons.jsx": "../ds/icons", "./ds/charts.jsx": "../ds/charts" },
    componentPropUse: {},
    valsName: "vals",
  }).jsx
}

describe("표 구조 안의 공백 — 변환기 규칙", () => {
  it("★ `<tr>` 안의 셀 사이에는 {\" \"}를 내지 않는다 — 결함 65가 난 모양 ★", () => {
    const jsx = convert(`<table>\n<tr>\n<td>가</td>\n<td>나</td>\n</tr>\n</table>`)
    expect(jsx).not.toContain(`{" "}`)
  })

  it("표 **밖**에서는 그대로 낸다 — 규칙을 넓히지 않는다", () => {
    // 여기서 빼면 «없는 공백을 만드는» 반대 사고가 된다 (결함 67 「안 고친 것」).
    const jsx = convert(`<div>\n<span>가</span>\n<span>나</span>\n</div>`)
    expect(jsx).toContain(`{" "}`)
  })

  it("`<td>` 안은 표 구조가 **아니다** — 셀 내용은 보통 요소처럼 다룬다", () => {
    const jsx = convert(`<table>\n<tr>\n<td>\n<b>가</b>\n<b>나</b>\n</td>\n</tr>\n</table>`)
    expect(jsx).toContain(`{" "}`)
  })

  it("sc-if / sc-for는 DOM을 안 만든다 — 부모의 host를 물려받는다", () => {
    // Fragment로 나가므로 그 안의 공백도 결국 `<tbody>`의 자식이 된다.
    const forIn = convert(
      `<table>\n<tbody>\n<sc-for list="{{ xs }}" as="x">\n<tr>\n<td>가</td>\n</tr>\n</sc-for>\n</tbody>\n</table>`,
    )
    expect(forIn).not.toContain(`{" "}`)

    const ifIn = convert(
      `<table>\n<tr>\n<sc-if value="{{ c }}">\n<td>가</td>\n<td>나</td>\n</sc-if>\n</tr>\n</table>`,
    )
    expect(ifIn).not.toContain(`{" "}`)

    // 반대로 표 밖의 sc-for는 부모(div)를 물려받으므로 공백이 살아 있어야 한다
    const outside = convert(
      `<div>\n<sc-for list="{{ xs }}" as="x">\n<span>가</span>\n<span>나</span>\n</sc-for>\n</div>`,
    )
    expect(outside).toContain(`{" "}`)
  })

  it("★★ 동결 목업 전체 — 표 구조 안의 {\" \"}가 하나도 안 나온다 ★★", () => {
    // 규칙이 옳아도 실제 입력에 안 걸리면 아무것도 증명하지 못한다 (결함 66과 같은 이유).
    const hits = findTableBlanks(`const x = (\n${convertMockup()}\n)\n`)
    expect(hits).toEqual([])
  })
})

describe("감사기가 변환기보다 넓지도 좁지도 않다", () => {
  /**
   * 두 구현이 **같은 답을 낸다**는 것은 도입 때 한 번 바이트로 쟀다 (2026-08-20):
   * 고치기 전 변환 출력에 감사기를 돌린 결과가 고친 뒤 변환 출력과 완전히 일치했고,
   * 양쪽 다 173건이었다. 그 실측은 옛 `emit.ts`가 있어야 재현되므로 시험으로 못 남긴다.
   *
   * 여기 남는 것은 **지금 붙들 수 있는 절반**이다 — 감사기가 변환기 출력에서
   * 더 지울 것을 찾지 않고(넓지 않다), 표 밖 공백은 그대로 둔다(좁은 쪽도 지킨다).
   */
  it("변환기 출력에 감사기를 돌리면 지울 것이 없고, 표 밖 공백은 남는다", () => {
    const wrapped = `const x = (\n${convertMockup()}\n)\n`
    expect(findTableBlanks(wrapped)).toEqual([])
    expect(stripTableBlanks(wrapped, findTableBlanks(wrapped))).toBe(wrapped)
    expect(wrapped).toContain(`{" "}`) // 표 밖의 공백은 그대로 살아 있다
  })
})

describe("★★ 지금 나가는 화면 — Template.tsx ★★", () => {
  it("표 구조 안의 {\" \"}가 0건이다 — React가 매 렌더 우는 자리가 없다", () => {
    const text = readFileSync(TEMPLATE, "utf8")
    const hits = findTableBlanks(text, TEMPLATE)
    // 실패하면 줄 번호가 그대로 나온다: npx tsx tools/convert/blank-audit.ts
    expect(hits.map((h) => `L${h.line} <${h.host}>`)).toEqual([])
  })
})
