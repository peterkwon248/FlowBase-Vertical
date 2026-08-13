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
import { emitTemplate } from "./emit.js"

const MOCKUP = "mockup/FlowBase.dc.html"
const OUT = "src/app/generated/Template.tsx"

/** `<x-import from="…">`이 가리키는 목업 안 경로 → 우리 모듈. */
const MODULE_MAP: Record<string, string> = {
  "./ds/icons.jsx": "../ds/icons",
  "./ds/charts.jsx": "../ds/charts",
}

const toStdout = process.argv.includes("--stdout")

const src = readTemplate(MOCKUP)
const { nodes, implicit, ignored } = parseTemplate(src.html, src.startLine)
const out = emitTemplate(nodes, { moduleMap: MODULE_MAP, valsName: "vals" })

const needsFragment = out.jsx.includes("<Fragment ")
const importLines: string[] = []
if (needsFragment) importLines.push(`import { Fragment } from "react"`)
for (const [mod, names] of [...out.imports].sort()) {
  importLines.push(`import { ${[...names].sort().join(", ")} } from "${mod}"`)
}

const keys = [...out.valsKeys].sort()

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

/**
 * 템플릿이 읽는 값. 지금은 전부 \`any\`다 — 배선하면서 화면별로 좁힌다.
 * 홀 ${out.valsKeys.size}종이 실제로 쓰인다.
 */
export interface TemplateVals {
${keys.map((k) => `  ${/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k)}: any`).join("\n")}
}

export function Template({ vals }: { vals: TemplateVals }): React.JSX.Element {
  return (
${out.jsx}
  )
}
`

if (toStdout) {
  console.log(file)
} else {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, file, "utf8")
}

const lines = file.split("\n").length
console.error(`변환 완료 → ${toStdout ? "(stdout)" : OUT}`)
console.error(`  ${lines.toLocaleString()}줄 · 값 ${out.valsKeys.size}종 · import ${out.imports.size}모듈`)
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
