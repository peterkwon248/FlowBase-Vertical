/**
 * 보존 게이트가 **진짜 잡는지** 확인한다.
 *
 * 게이트가 녹색인 것만으로는 아무것도 증명되지 않는다 — 가드가 무를 수도,
 * 그 경로가 애초에 안 쓰일 수도 있다. 둘은 전혀 다른 결론이다 (ADR-007).
 * 그래서 출력에 **일부러 흠집을 내고** 게이트가 그걸 잡는지 본다.
 *
 * 흠집은 실제로 이식에서 일어날 법한 것들이다: 카피를 살짝 고치기, DS 클래스를
 * 빠뜨리기, 토큰을 다른 토큰으로 바꾸기, 표현식을 통째로 잃기, SVG 경로가
 * 뭉개지기. 마지막 것이 `attrs` 항목을 넓힌 이유다.
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { readTemplate } from "../tools/convert/source.js"
import { parseTemplate } from "../tools/convert/parse.js"
import { compareIr, irDiffCount, irFromTree, type IrField } from "../tools/convert/ir.js"
import { irFromTsx } from "../tools/convert/jsx-ir.js"

const MOCKUP = "mockup/FlowBase.dc.html"
const GENERATED = "src/app/generated/Template.tsx"

const src = readTemplate(MOCKUP)
const want = irFromTree(parseTemplate(src.html, src.startLine).nodes)
const generated = readFileSync(GENERATED, "utf8")

/** 흠집 하나를 낸 출력으로 IR을 만들고 게이트를 돌린다. */
function gateAfter(mutate: (s: string) => string) {
  const mutated = mutate(generated)
  expect(mutated, "치환이 실제로 일어나야 시험이 성립한다").not.toBe(generated)
  return compareIr(want, irFromTsx(GENERATED, mutated))
}

/** 첫 번째 자리만 바꾼다. 전역 치환은 "많이 틀렸다"를 만들어 시험이 무뎌진다. */
function once(s: string, find: string, replace: string): string {
  const at = s.indexOf(find)
  if (at === -1) throw new Error(`시험용 문자열을 못 찾았다: ${find}`)
  return s.slice(0, at) + replace + s.slice(at + find.length)
}

describe("보존 게이트 — 변환 출력이 목업과 같은가", () => {
  it("손대지 않은 출력은 전 항목이 일치한다", () => {
    const diff = compareIr(want, irFromTsx(GENERATED, generated))
    const report = Object.entries(diff)
      .filter(([, v]) => v.length > 0)
      .map(([k, v]) => `${k}: ${v.slice(0, 3).join(" / ")}`)
      .join("\n")
    expect(irDiffCount(diff), report).toBe(0)
  })

  it("문법이 깨진 출력은 IR을 만들기 전에 세운다", () => {
    expect(() => irFromTsx("x.tsx", "export const a = <div>{</div>")).toThrow(/문법/)
  })
})

describe("가드를 부러뜨려 본다 — 이 흠집들은 반드시 잡혀야 한다", () => {
  const cases: { name: string; field: IrField; mutate: (s: string) => string }[] = [
    {
      name: "카피를 한 글자 고치면",
      field: "texts",
      mutate: (s) => once(s, "정산 파일을 여기에 놓으세요", "정산 파일을 여기에 놓으세요."),
    },
    {
      name: "Vector DS 클래스를 빠뜨리면",
      field: "classes",
      mutate: (s) => once(s, `className="v-btn v-btn--primary"`, `className="v-btn"`),
    },
    {
      name: "인라인 style 값이 드리프트하면",
      field: "styles",
      mutate: (s) => once(s, `padding: "34px 24px"`, `padding: "32px 24px"`),
    },
    {
      name: "토큰을 다른 토큰으로 바꾸면",
      field: "tokens",
      mutate: (s) => once(s, `background: "var(--bg-subtle)"`, `background: "var(--bg-app)"`),
    },
    {
      name: "동적 자리를 통째로 잃으면",
      field: "holes",
      mutate: (s) => once(s, `onClick={vals.goImport}`, ``),
    },
    {
      name: "SVG 경로가 뭉개지면",
      field: "attrs",
      mutate: (s) => once(s, ' d="', ' d="M0 0 '),
    },
    {
      name: "아이콘 이름이 바뀌면",
      field: "attrs",
      mutate: (s) => once(s, `<Lic name="file-spreadsheet"`, `<Lic name="file-text"`),
    },
  ]

  for (const c of cases) {
    it(`${c.name} ${c.field}에서 잡힌다`, () => {
      const diff = gateAfter(c.mutate)
      expect(diff[c.field].length, `${c.field}가 흠집을 못 봤다`).toBeGreaterThan(0)
    })
  }
})
