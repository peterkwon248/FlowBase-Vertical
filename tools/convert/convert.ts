/**
 * DC 템플릿 변환기 — 동결 목업의 본문을 TSX 한 장으로 옮긴다.
 *
 * ```
 * ① 변환 (기계, 100% 충실)  →  ② 보존 게이트  →  ③ §21 패치 (손, 커밋 분리)
 * ```
 *
 * 이 파일은 ①이다. **§21 이탈도, 계산 이식도 하지 않는다.**
 * 화면별 배선과 `renderVals` 분해는 그다음 블록의 일이다.
 *
 *   npx tsx tools/convert/convert.ts          # 변환 → src/app/generated/
 *   npx tsx tools/convert/convert.ts --stdout # 파일로 쓰지 않고 미리보기
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname } from "node:path"
import { readTemplate } from "./source.js"
import { parseTemplate } from "./parse.js"
import { emitTemplate, type Use } from "./emit.js"

const MOCKUP = "mockup/FlowBase.dc.html"
const OUT = "src/app/generated/Template.tsx"
const OUT_VALS = "src/app/generated/vals.ts"

/** `<x-import from="…">`이 가리키는 목업 안 경로 → 우리 모듈. */
const MODULE_MAP: Record<string, string> = {
  "./ds/icons.jsx": "../ds/icons",
  "./ds/charts.jsx": "../ds/charts",
}

/**
 * 컴포넌트 prop 중 **문자열이 아닌 것**. 마크업만 봐서는 알 수 없어 여기 적는다.
 * 목업이 홀을 넘기는 prop은 7곳뿐이고 그중 6곳이 `Lic`의 아이콘 이름(문자열),
 * 나머지 하나가 이것이다.
 */
const COMPONENT_PROP_USE: Record<string, Record<string, Use>> = {
  "VChart.Line": { data: "list" },
}

const toStdout = process.argv.includes("--stdout")

const src = readTemplate(MOCKUP)
const { nodes, implicit, ignored } = parseTemplate(src.html, src.startLine)
const out = emitTemplate(nodes, { moduleMap: MODULE_MAP, componentPropUse: COMPONENT_PROP_USE, valsName: "vals" })

const needsFragment = out.jsx.includes("<Fragment ")
const importLines: string[] = []
if (needsFragment) importLines.push(`import { Fragment } from "react"`)
for (const [mod, names] of [...out.imports].sort()) {
  importLines.push(`import { ${[...names].sort().join(", ")} } from "${mod}"`)
}
importLines.push(`import type { TemplateVals } from "./vals.js"`)

const file = `/**
 * ★ 자동 생성 — 손으로 고치지 않는다 ★
 *
 * 만든 것: \`tools/convert/convert.ts\`
 * 원본:    \`${MOCKUP}\` (동결 목업, 본문 L${src.startLine}~)
 *
 * 이 파일은 목업 템플릿의 **기계 변환 결과**다. 목업과 다른 곳이 있으면 그건
 * 사고이지 의도가 아니다 — 보존 게이트(\`npm run convert:gate\`)가 지킨다.
 * §21 이탈(도넛→가로막대·스파크라인 제거)은 여기가 아니라 **별도 커밋**에서
 * 한다. 그 커밋의 diff가 곧 "목업과 의도적으로 다른 곳의 전체 목록"이다.
 *
 * 값은 전부 \`vals\`로 들어온다. 예전 \`renderVals()\`가 주던 것이고, 배선
 * 단계에서 리포지토리와 \`computePnl\`로 갈라 붙인다. **산수를 이 파일로
 * 가져오지 않는다** — 계산기는 \`computePnl\` 하나다 (단일 계산기 LOCK).
 */

${importLines.join("\n")}

export function Template({ vals }: { vals: TemplateVals }): React.JSX.Element {
  return (
${out.jsx}
  )
}
`

// ── 값 골격 ────────────────────────────────────────────────────────────
//
// 361종을 손으로 채우지 않는다. 홀이 **어떻게 쓰였는지**는 변환하는 순간
// 이미 알고 있으므로(조건인지 목록인지 핸들러인지) 그대로 기본값이 된다.
// 이게 있어야 "빈 DB로 전 화면 렌더"를 시도라도 할 수 있다 (3a 게이트).

interface ShapeNode {
  children: Map<string, ShapeNode>
  uses: Set<Use>
}

const shapeRoot = new Map<string, ShapeNode>()
for (const [path, uses] of out.valsUses) {
  let level = shapeRoot
  let node: ShapeNode | undefined
  for (const seg of path.split(".")) {
    let next = level.get(seg)
    if (!next) {
      next = { children: new Map(), uses: new Set() }
      level.set(seg, next)
    }
    node = next
    level = next.children
  }
  if (node) for (const u of uses) node.uses.add(u)
}

/**
 * 쓰임이 여럿이면 **더 구체적인 쪽**을 택한다. 목록으로 쓰인 자리에 문자열을
 * 넣으면 `.map`에서 죽지만, 문자열 자리에 빈 배열이 오면 빈 칸으로 그려질 뿐이다.
 *
 * ★ `cond`가 가장 약하다 ★
 * 조건은 아무 값에나 걸 수 있지만 그 역은 아니다. 실제로 `cond+text`가 4건
 * 나오는데(`urlError`·`kpiTip.foot`·`impChannelName`·`mixHiClip`) 전부
 * **"값이 있으면 보여준다"**는 관용구다 — `{x && …}` 다음에 `{x}`로 찍는다.
 * 여기서 boolean을 고르면 텍스트 자리가 아무것도 그리지 않는다. React는
 * boolean을 렌더하지 않기 때문이다.
 */
const PRIORITY: Use[] = ["list", "handler", "text", "style", "attr", "cond"]
function pick(uses: Set<Use>): Use {
  for (const u of PRIORITY) if (uses.has(u)) return u
  return "attr"
}

const TYPE: Record<Use, string> = {
  list: "readonly any[]",
  handler: "(...args: any[]) => void",
  cond: "boolean",
  text: "string",
  style: "string",
  attr: "string",
}
const EMPTY: Record<Use, string> = {
  list: "[]",
  handler: "() => {}",
  cond: "false",
  text: '""',
  style: '""',
  attr: '""',
}

const key = (k: string): string => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k))

/**
 * **조건이자 객체**인 값은 비었을 때 `null`이어야 한다.
 *
 * 목업의 관용구다 — `{confirm && <모달/>}` 안에서 `confirm.title`을 쓴다.
 * 여기서 빈 객체 `{}`를 주면 **항상 truthy라 모달이 영영 열려 있다.**
 * 실제로 처음 셸을 띄웠을 때 확인 모달이 화면을 덮고 있었고, 그게 이 규칙이
 * 빠져 있다는 신호였다.
 */
function isNullable(node: ShapeNode): boolean {
  return node.children.size > 0 && node.uses.has("cond")
}

function renderType(node: ShapeNode, depth: number): string {
  if (node.children.size === 0) return TYPE[pick(node.uses)]
  const pad = "  ".repeat(depth + 1)
  const rows = [...node.children]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${pad}${key(k)}: ${renderType(v, depth + 1)}`)
  const obj = `{\n${rows.join("\n")}\n${"  ".repeat(depth)}}`
  return isNullable(node) ? `${obj} | null` : obj
}

function renderEmpty(node: ShapeNode, depth: number): string {
  if (node.children.size === 0) return EMPTY[pick(node.uses)]
  if (isNullable(node)) return "null"
  const pad = "  ".repeat(depth + 1)
  const rows = [...node.children]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${pad}${key(k)}: ${renderEmpty(v, depth + 1)},`)
  return `{\n${rows.join("\n")}\n${"  ".repeat(depth)}}`
}

const conflicts: string[] = []
for (const [path, uses] of out.valsUses) {
  if (uses.size > 1) conflicts.push(`${path}: ${[...uses].join("+")} → ${pick(uses)}`)
}

const valsFile = `/**
 * ★ 자동 생성 — 손으로 고치지 않는다 ★
 *
 * 만든 것: \`tools/convert/convert.ts\`
 *
 * 예전 \`renderVals()\`가 템플릿에 넘기던 값의 **모양**이다. 타입은 변환기가
 * 홀의 쓰임에서 추론했다 — \`{{ x }}\`가 \`<sc-if value>\`에 있었으면 boolean,
 * \`<sc-for list>\`였으면 배열, \`onClick\`이었으면 함수다.
 *
 * \`emptyVals()\`는 **아무 데이터도 없는 상태**를 그린다. 시드가 아니다 —
 * 목록은 비어 있고 숫자 자리는 빈 문자열이다. 3a 게이트의 "빈 DB로 기동해
 * 전 화면이 데이터 없음으로 렌더된다"가 이 값으로 판정된다.
 *
 * 배선하면서 화면별로 실제 값(리포지토리 조회 · \`computePnl\`)이 이 자리를
 * 하나씩 대체한다. **산수를 여기로 가져오지 않는다** — 계산기는 \`computePnl\`
 * 하나다 (단일 계산기 LOCK).
 */

export interface TemplateVals ${renderType({ children: shapeRoot, uses: new Set() }, 0)}

/** 데이터가 하나도 없을 때의 값. 빈 상태를 **정직하게** 그리기 위한 것이다. */
export function emptyVals(): TemplateVals {
  return ${renderEmpty({ children: shapeRoot, uses: new Set() }, 1)}
}
`

if (toStdout) {
  console.log(file)
} else {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, file, "utf8")
  writeFileSync(OUT_VALS, valsFile, "utf8")
}

const lines = file.split("\n").length
console.error(`변환 완료 → ${toStdout ? "(stdout)" : OUT}`)
console.error(`  ${lines.toLocaleString()}줄 · 값 ${out.valsKeys.size}종 · import ${out.imports.size}모듈`)
console.error(`값 골격 → ${OUT_VALS}`)
{
  const tally = new Map<Use, number>()
  for (const [, uses] of out.valsUses) {
    const u = pick(uses)
    tally.set(u, (tally.get(u) ?? 0) + 1)
  }
  const parts = [...tally].sort((a, b) => b[1] - a[1]).map(([u, n]) => `${u} ${n}`)
  console.error(`  경로 ${out.valsUses.size}개 · ${parts.join(" · ")}`)
  if (conflicts.length > 0) {
    console.error(`\n  한 값이 여러 쓰임으로 나온 곳 ${conflicts.length}건 — 더 구체적인 쪽을 택했다:`)
    for (const c of conflicts.slice(0, 10)) console.error(`    ${c}`)
    if (conflicts.length > 10) console.error(`    … ${conflicts.length - 10}건 더`)
  }
}
if (implicit.length > 0) {
  console.error(`\n  암묵적으로 닫힌 요소 ${implicit.length}건 — 브라우저 파서 규칙대로 처리했다:`)
  for (const im of implicit) {
    console.error(`    <${im.tag}> L${im.openLine} → </${im.byTag}> L${im.byLine}가 함께 닫는다`)
  }
}
if (ignored.length > 0) {
  console.error(`\n  무시된 종료 태그 ${ignored.length}건 — 목업의 잉여 태그다:`)
  for (const ig of ignored) {
    console.error(`    </${ig.tag}> L${ig.line} (${ig.blockedBy}가 막았다)`)
  }
}
for (const n of out.notes) console.error(`  · ${n}`)
