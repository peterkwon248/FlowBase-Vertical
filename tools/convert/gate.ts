/**
 * 보존 게이트 — 변환기가 목업을 **그대로** 옮겼는지 판정한다.
 *
 * ```
 * 원본 HTML ──우리 파서──▶ IR
 *                              ├──▶ 대조
 * 출력 TSX  ──TypeScript──▶ IR
 * ```
 *
 * 두 경로가 다른 구현이라는 게 요점이다. 같은 파서로 양쪽을 읽으면 파서의
 * 착각까지 복사돼 자기 자신을 증명하게 된다 (ADR-007의 `equivalence`와 같은 발상).
 *
 * **이 게이트가 녹색이어도 "예쁘다"는 뜻은 아니다.** 카피·클래스·토큰·속성·
 * 인라인 style·동적 자리가 원본과 1:1이라는 뜻뿐이다. §21 이탈은 별도 커밋에서
 * 의도적으로 만들고, 그 커밋의 diff가 곧 "목업과 다른 곳의 전체 목록"이 된다.
 *
 *   npm run convert:gate
 */

import { readFileSync } from "node:fs"
import { readTemplate } from "./source.js"
import { parseTemplate } from "./parse.js"
import { compareIr, irFromTree, IR_FIELDS, type IrField } from "./ir.js"
import { irFromTsx } from "./jsx-ir.js"

const MOCKUP = "mockup/FlowBase.dc.html"
const GENERATED = "src/app/generated/Template.tsx"

const LABEL: Record<IrField, string> = {
  texts: "텍스트 노드",
  classes: "클래스",
  styles: "인라인 style 선언",
  attrs: "그 밖의 속성",
  tokens: "토큰 var(--…)",
  holes: "동적 자리",
}

const src = readTemplate(MOCKUP)
const { nodes } = parseTemplate(src.html, src.startLine)
const want = irFromTree(nodes)
const got = irFromTsx(GENERATED, readFileSync(GENERATED, "utf8"))
const diff = compareIr(want, got)

let failed = 0
console.log(`보존 게이트 — ${MOCKUP} ↔ ${GENERATED}\n`)

for (const field of IR_FIELDS) {
  const diffs = diff[field]
  const mark = diffs.length === 0 ? "통과" : "★ 불일치"
  const counts = `원본 ${String(want[field].length).padStart(5)} · 출력 ${String(got[field].length).padStart(5)}`
  console.log(`  ${LABEL[field].padEnd(20)} ${counts}  ${mark}`)
  if (diffs.length > 0) {
    failed++
    for (const d of diffs.slice(0, 6)) console.log(`      ${d}`)
    if (diffs.length > 6) console.log(`      … 그리고 ${diffs.length - 6}건 더`)
  }
}

if (failed > 0) {
  console.log(`\n${failed}개 항목이 어긋났다. 변환기가 목업을 그대로 옮기지 못했다.`)
  process.exit(1)
}
console.log("\n전 항목 일치 — 구조와 정적 속성이 보존됐고 동적 자리가 1:1이다.")
