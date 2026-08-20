/**
 * 표 구조 안의 `{" "}`를 **판정한다** (결함 65).
 *
 * 변환기(`emit.ts`)의 `NO_TEXT_CHILD` 규칙을 **완성된 TSX 쪽에서** 다시 묻는 도구다.
 * 두 개가 필요한 이유: `Template.tsx`는 재생성 대상이 아니다. §21 패치와 배선이
 * 손으로 얹혀 있어서 `npm run convert`를 돌리면 그게 통째로 날아간다. 그래서
 * 변환기를 고쳐도 **이미 나와 있는 파일은 저절로 안 고쳐진다** — 같은 규칙을
 * 여기서 한 번 더 집행한다.
 *
 * 판정 규칙은 `emit.ts`와 글자 그대로 같다:
 *   가장 가까운 **DOM 요소** 조상이 표 구조(`NO_TEXT_CHILD`)면 공백 텍스트를 안 낸다.
 *   `Fragment`·`{cond && …}`·`.map(…)`은 DOM을 만들지 않으므로 host를 **물려받는다**.
 *
 * 두 판정이 같다는 것은 실측으로 확인했다 — 고치기 전 변환 출력에 이 도구를
 * 적용한 결과가 고친 뒤 변환 출력과 **바이트까지 일치**한다 (`tests/convert-blank.test.ts`).
 *
 *   npx tsx tools/convert/blank-audit.ts                    # 세기만
 *   npx tsx tools/convert/blank-audit.ts <파일> --apply      # 그 줄을 지운다
 */

import ts from "typescript"
import { readFileSync, writeFileSync } from "node:fs"

/**
 * 텍스트 노드를 직속 자식으로 가질 수 없는 요소 — `emit.ts`의 같은 이름과 **동일해야 한다**.
 * 한쪽만 늘리면 변환기와 감사기가 다른 답을 낸다.
 */
export const NO_TEXT_CHILD = new Set(["table", "thead", "tbody", "tfoot", "tr", "colgroup"])

export interface Blank {
  /** 1부터 세는 줄 번호. */
  readonly line: number
  /** 이 공백을 직속 자식으로 갖는 표 구조 태그. */
  readonly host: string
}

/** `{" "}` 인가 — 문자열 리터럴 하나만 든 JSX 표현식. */
function isSpaceExpr(n: ts.Node): boolean {
  if (!ts.isJsxExpression(n)) return false
  const e = n.expression
  return e !== undefined && ts.isStringLiteral(e) && e.text === " "
}

/** DOM 요소면 태그 이름, 컴포넌트(`Ic`·`VChart.Line`)면 `null`. */
function domTag(n: ts.JsxElement): string | null {
  const tag = n.openingElement.tagName
  if (!ts.isIdentifier(tag)) return null
  return /^[a-z]/.test(tag.text) ? tag.text : null
}

/** TSX 원문에서 표 구조 안의 `{" "}`를 전부 찾는다. */
export function findTableBlanks(text: string, fileName = "in-memory.tsx"): Blank[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const hits: Blank[] = []

  function walk(node: ts.Node, host: string | null): void {
    if (ts.isJsxElement(node)) {
      // 컴포넌트는 무엇을 그릴지 알 수 없으므로 host를 **끊지 않고** 물려준다.
      // 표 안에 컴포넌트가 오는 자리는 목업에 없지만, 생기면 보수적인 쪽이 맞다.
      const inner = domTag(node) ?? host
      ts.forEachChild(node.openingElement, (c) => walk(c, host))
      for (const kid of node.children) {
        if (isSpaceExpr(kid) && inner !== null && NO_TEXT_CHILD.has(inner)) {
          const { line } = sf.getLineAndCharacterOfPosition(kid.getStart(sf))
          hits.push({ line: line + 1, host: inner })
        }
        walk(kid, inner)
      }
      return
    }
    ts.forEachChild(node, (c) => walk(c, host))
  }
  walk(sf, null)
  return hits
}

/**
 * 찾은 줄을 지운 원문을 돌려준다.
 *
 * 지우려는 줄이 `{" "}` **단독 줄**이 아니면 던진다 — 변환기 출력은 늘 단독 줄이고,
 * 아니라면 손으로 만진 자리라 기계가 판단할 일이 아니다.
 */
export function stripTableBlanks(text: string, hits: readonly Blank[]): string {
  const drop = new Set(hits.map((h) => h.line))
  const lines = text.split("\n")
  for (const ln of drop) {
    const l = lines[ln - 1]
    if (l === undefined || l.trim() !== '{" "}') {
      throw new Error(`L${ln}이 {" "} 단독 줄이 아니다: ${JSON.stringify(l)}`)
    }
  }
  return lines.filter((_, i) => !drop.has(i + 1)).join("\n")
}

// ── CLI ────────────────────────────────────────────────────────────────

const isMain = process.argv[1]?.endsWith("blank-audit.ts") ?? false
if (isMain) {
  const args = process.argv.slice(2).filter((a) => a !== "--apply")
  const file = args[0] ?? "src/app/generated/Template.tsx"
  const apply = process.argv.includes("--apply")

  const text = readFileSync(file, "utf8")
  const hits = findTableBlanks(text, file)

  const byHost = new Map<string, number>()
  for (const h of hits) byHost.set(h.host, (byHost.get(h.host) ?? 0) + 1)

  console.log(`${file} — 표 구조 안의 {" "} ${hits.length}건`)
  for (const [h, n] of [...byHost].sort((a, b) => b[1] - a[1])) console.log(`  <${h}>  ${n}`)

  if (apply && hits.length > 0) {
    writeFileSync(file, stripTableBlanks(text, hits), "utf8")
    console.log(`\n${hits.length}줄 삭제`)
  } else if (!apply && hits.length > 0) {
    console.log("\n(미적용 — --apply 를 주면 그 줄을 지운다)")
  }
}
