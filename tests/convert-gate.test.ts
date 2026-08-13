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
const generated = readFileSync(GENERATED, "utf8")

/**
 * ★ 선언된 이탈 — 목업과 **일부러** 다른 자리 ★
 *
 * 게이트의 원래 규칙은 "diff 0"이었다. 그런데 목업을 그대로 따르면 오히려 헌장을
 * 어기는 자리가 실제로 있다. 그때 선택지는 둘뿐이다 — 게이트를 빨간 채로 두거나,
 * 이탈을 **선언**하거나. 빨간 게이트는 곧 꺼지므로(이 저장소가 이미 아는 교훈)
 * 선언하는 쪽을 만든다.
 *
 * 선언은 게이트를 무르게 하지 않는다. **오히려 강해진다** —
 *   · 선언한 것 말고 다른 차이가 있으면 여전히 실패한다
 *   · 선언이 **낡으면**(목업에 그 문구가 더는 없으면) 실패한다. 목록이 썩지 않는다
 *
 * 그래서 이 배열이 곧 *"목업과 다르게 만든 자리의 전체 목록"*의 기계 검사판이다.
 * 사람이 읽는 판은 `docs/목업-결함-발견분.md`에 있다.
 */
const DEVIATIONS: { field: IrField; from: string[]; to: string[]; why: string }[] = [
  {
    field: "texts",
    from: ["데이터 신선도"],
    to: ["이 숫자가 담지 못한 것"],
    why:
      "이 카드에 연결별 신선도 대신 손익의 결손(`pnlGaps`)을 올렸다. CLI가 손익 밑에 " +
      "늘 출력하던 단서를 화면이 두고 오면 사용자는 순이익을 완성된 숫자로 읽는다 (A-5). " +
      "실제 연결 신선도는 연결 배선이 생길 때 자기 카드를 받는다",
  },
  {
    field: "texts",
    from: ["마켓 API 장애와 무관하게 마지막 성공 동기화 데이터로 계속 조회됩니다."],
    to: ["여기 있는 항목은 위 숫자에 반영되지 않았습니다. 기준 데이터를 넣거나 빠진 파일을 가져오면 목록에서 사라집니다."],
    why:
      'LOCK 10 — "동기화" 카피는 양방향·자동이 실존하기 전까지 금지다. 게다가 우리는 ' +
      "마켓 API를 부르지 않으므로(파일 가져오기뿐) 원문은 사실도 아니다. 문서 우선순위상 " +
      "헌장이 목업을 이긴다",
  },
]

/** `hay`에서 `needle` **연속 구간**의 시작 위치. 없으면 -1. */
function indexOfRun(hay: readonly string[], needle: readonly string[]): number {
  if (needle.length === 0) return -1
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer
    return i
  }
  return -1
}

/**
 * 선언된 이탈을 기대값에 반영한다. **연속 구간을 통째로 갈아끼운다** —
 * `from`을 찾아 `to`로 splice한다. 길이가 달라도 되므로 카피 한 줄 교체부터
 * 요소 삭제(`to: []`)·신설(`from`은 인접 항목, `to`는 그것 + 새 항목)까지 한 어휘로 적는다.
 *
 * ★ 왜 인덱스가 아니라 **내용**으로 찾는가 ★
 * §21 패치는 요소를 지우고 새로 그리므로 뒤따르는 모든 인덱스가 밀린다. 인덱스로
 * 선언하면 이탈 하나를 추가할 때마다 나머지 선언이 전부 어긋난다 — 그런 목록은
 * 유지되지 않는다. 내용으로 찾으면 **선언끼리 독립**이고, 목업에서 그 문구가
 * 사라지는 순간 자동으로 낡은 것으로 잡힌다.
 *
 * ★ 이 장치의 한계를 정직하게 ★
 * 도넛을 막대로 바꾼 자리에는 **대조할 원본이 없다**. 게이트가 그 구간에서
 * 증명하는 것은 "같다"가 아니라 **"여기가 바뀐다고 선언돼 있다"**뿐이다.
 * 게이트의 진짜 값은 **선언 밖이 그대로임**을 보증하는 데 있다.
 */
function applyDeviations(ir: ReturnType<typeof irFromTree>): ReturnType<typeof irFromTree> {
  const out = { ...ir }
  for (const d of DEVIATIONS) {
    const list = [...out[d.field]]
    const at = indexOfRun(list, d.from)
    if (at === -1) {
      throw new Error(
        `선언된 이탈이 낡았다: 목업의 ${d.field}에 ${JSON.stringify(d.from)} 구간이 없다. ` +
          `목업이 바뀌었거나 이탈이 필요 없어진 것이다 — DEVIATIONS에서 지워야 한다`,
      )
    }
    list.splice(at, d.from.length, ...d.to)
    out[d.field] = list
  }
  return out
}

/**
 * ★ §21이 **통째로 갈아엎은 구간** ★
 *
 * 카피 한 줄 교체(`DEVIATIONS`)와 달리, 여기는 요소가 사라지고 다른 것이 들어온다.
 * 값 단위로 선언하려면 스타일·토큰만 백 개가 넘고 **그 목록은 유지되지 않는다.**
 * 그래서 구간째 뺀다 — 목업 쪽은 그 요소의 `style` 원문으로, 출력 쪽은
 * `data-s21` 표식으로 짚는다.
 *
 * ★ 정직하게: 이 구간에서 게이트가 증명하는 것은 "같다"가 아니다 ★
 * 대조할 원본이 없으므로 증명되는 것은 **"여기가 바뀐다고 선언돼 있다"**뿐이다.
 * 게이트의 값은 **선언 밖 전 항목이 그대로임**을 보증하는 데 있고, 아래 두
 * 테스트가 선언 자체의 유효성(목업에 실재 · 출력에 표식 실재)을 지킨다.
 */
const S21_REGIONS = [
  {
    id: "cost-bars",
    mockupStyle: "display: flex; align-items: center; gap: 14px; position: relative",
    why:
      "§21-4 «매출 구성 도넛 → 가로 막대». 도넛(112px 원 + clip 조각) · 범례 · 호버 " +
      "툴팁이 통째로 빠지고 항목별 가로 막대(라벨 · 금액 · 매출 대비 · 막대)가 들어온다. " +
      "금액이 인라인으로 나오면서 §9의 «S/M hover 의존 금지»도 함께 해소된다",
  },
] as const

const want = applyDeviations(
  irFromTree(parseTemplate(src.html, src.startLine).nodes, {
    styleContains: S21_REGIONS.map((r) => r.mockupStyle),
  }),
)

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

  it("선언된 이탈에는 이유가 붙어 있다 — 이유 없는 이탈은 사고와 구분되지 않는다", () => {
    // 목업에 실재하는 문구를 가리키는지는 `applyDeviations`가 모듈 로드 시점에
    // 이미 검증했다 (낡으면 이 파일 전체가 선다).
    expect(DEVIATIONS.length, "이탈이 하나도 없으면 이 장치는 필요 없다").toBeGreaterThan(0)
    for (const d of DEVIATIONS) {
      expect(d.from.length, "찾을 구간이 비면 아무것도 못 찾는다").toBeGreaterThan(0)
      expect(d.why.length, `${d.from[0]}의 이탈에 이유가 없다`).toBeGreaterThan(20)
    }
  })

  /**
   * 구간 선언은 **양쪽에서 정확히 한 번씩** 짚혀야 한다.
   *
   * 오타 하나로 짚기가 빗나가면 큰 구간이 조용히 **대조에서 빠지거나**(출력 표식
   * 오타) **통째로 diff로 쏟아진다**(목업 짚기 오타). 앞의 경우가 특히 위험하다 —
   * 게이트는 녹색인데 아무것도 안 보고 있는 상태가 된다.
   */
  it("§21 구간 선언이 양쪽에서 정확히 하나씩 짚힌다", () => {
    const mockupSrc = readFileSync(MOCKUP, "utf8")
    for (const r of S21_REGIONS) {
      expect(
        mockupSrc.split(r.mockupStyle).length - 1,
        `목업에서 "${r.mockupStyle}"가 하나만 잡혀야 한다 — 0이면 낡았고, 2 이상이면 엉뚱한 구간까지 뺀다`,
      ).toBe(1)
      expect(
        generated.split(`data-s21="${r.id}"`).length - 1,
        `출력에 data-s21="${r.id}" 표식이 하나여야 한다`,
      ).toBe(1)
      expect(r.why.length, `${r.id} 구간에 이유가 없다`).toBeGreaterThan(20)
    }
    // 표식이 선언보다 많으면, 선언되지 않은 구간이 조용히 대조에서 빠지고 있다
    expect(
      generated.split("data-s21=").length - 1,
      "선언되지 않은 data-s21 표식이 있다 — 그 구간은 아무도 안 보고 있다",
    ).toBe(S21_REGIONS.length)
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
