/**
 * 출력 TSX → 보존 IR. **TypeScript 컴파일러로 읽는다.**
 *
 * 우리 HTML 파서로 양쪽을 읽으면 파서의 착각까지 함께 복사돼 게이트가 자기
 * 자신을 증명하게 된다. 그래서 출력 쪽은 완전히 다른 구현(tsc)에 맡긴다 —
 * `equivalence` 하네스가 "표현을 바꿔도 같은 답이 나오는가"를 두 경로로 묻는
 * 것과 같은 발상이다 (ADR-007).
 *
 * 변환기가 **덧붙인 것**은 여기서 빼야 원본과 1:1이 된다:
 *   · `key={$index}`  — React가 목록을 맞추는 데 필요해서 넣은 것
 *   · `{" "}`         — HTML의 형제 사이 공백을 JSX에서 살리려고 넣은 것
 *   · `vals.` 접두    — 값의 출처를 명시한 것 (`normPath`가 벗긴다)
 */

import ts from "typescript"
import {
  collectTokens,
  emptyIr,
  isConstantExpr,
  joinParts,
  normAttrName,
  normCssProp,
  normCssValue,
  normPath,
  normText,
  type Ir,
} from "./ir.js"

type Segment = { lit?: string; expr?: string }

export function irFromTsx(fileName: string, source: string): Ir {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX)

  const diagnostics = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] })
    .parseDiagnostics
  if (diagnostics && diagnostics.length > 0) {
    const lines = diagnostics.slice(0, 5).map((d) => {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, " ")
      if (d.start === undefined) return `  ${msg}`
      const { line, character } = sf.getLineAndCharacterOfPosition(d.start)
      const text = (sf.text.split("\n")[line] ?? "").trim().slice(0, 100)
      return `  ${fileName}:${line + 1}:${character + 1} ${msg}\n    ${text}`
    })
    throw new Error(`출력 TSX가 문법적으로 깨졌다:\n${lines.join("\n")}`)
  }

  const ir = emptyIr()
  walk(sf)
  return ir

  function walk(node: ts.Node): void {
    if (ts.isJsxElement(node)) {
      opening(node.openingElement)
      for (const c of node.children) walk(c)
      return
    }
    if (ts.isJsxSelfClosingElement(node)) {
      opening(node)
      return
    }
    if (ts.isJsxFragment(node)) {
      for (const c of node.children) walk(c)
      return
    }
    if (ts.isJsxText(node)) {
      const t = normText(node.text)
      if (t !== "") ir.texts.push(t)
      return
    }
    if (ts.isJsxExpression(node)) {
      if (node.expression) expression(node.expression)
      return
    }
    node.forEachChild(walk)
  }

  /** JSX 중괄호 안. 지시자가 여기로 옮겨왔으므로 홀도 여기서 나온다. */
  function expression(expr: ts.Expression): void {
    if (ts.isParenthesizedExpression(expr)) {
      expression(expr.expression)
      return
    }
    // 변환기가 넣은 {" "} — 원본에는 없는 자리다
    if (ts.isStringLiteral(expr)) return
    // 상수 홀은 동적 자리가 아니다 (`isConstantExpr`와 같은 판정)
    if (ts.isNumericLiteral(expr)) return
    if (
      expr.kind === ts.SyntaxKind.TrueKeyword ||
      expr.kind === ts.SyntaxKind.FalseKeyword ||
      expr.kind === ts.SyntaxKind.NullKeyword
    ) {
      return
    }

    // sc-if → {cond && (…)}
    if (
      ts.isBinaryExpression(expr) &&
      expr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      ir.holes.push(normPath(expr.left.getText(sf)))
      walk(expr.right)
      return
    }

    // sc-for → {list.map((x, $index) => (…))}
    if (
      ts.isCallExpression(expr) &&
      ts.isPropertyAccessExpression(expr.expression) &&
      expr.expression.name.text === "map"
    ) {
      ir.holes.push(normPath(expr.expression.expression.getText(sf)))
      for (const arg of expr.arguments) walk(arg)
      return
    }

    // 텍스트 자리의 값 홀
    if (ts.isIdentifier(expr) || ts.isPropertyAccessExpression(expr)) {
      ir.holes.push(normPath(expr.getText(sf)))
      return
    }

    throw new Error(`해석 규칙이 없는 JSX 표현식: ${expr.getText(sf).slice(0, 60)}`)
  }

  function opening(el: ts.JsxOpeningElement | ts.JsxSelfClosingElement): void {
    for (const attr of el.attributes.properties) {
      if (!ts.isJsxAttribute(attr)) continue // spread는 변환기가 내지 않는다
      const name = attr.name.getText(sf)
      if (name === "key") continue // 변환기가 넣은 것

      const init = attr.initializer
      if (!init) continue // 값 없는 속성

      if (name === "className") {
        ir.classes.push(normText(joinParts(segments(init))))
      } else if (name === "style") {
        styleDeclarations(init)
      }
      if (name !== "style") {
        ir.attrs.push(`${normAttrName(name)}=${normText(joinParts(segments(init)))}`)
      }

      for (const s of segments(init)) {
        if (s.expr !== undefined) {
          if (!isConstantExpr(s.expr)) ir.holes.push(normPath(s.expr))
        } else if (s.lit !== undefined) collectTokens(s.lit, ir.tokens)
      }
    }
  }

  /** `style={{ … }}` → `prop:value` 목록. 원본 HTML의 선언 순서와 같아야 한다. */
  function styleDeclarations(init: ts.JsxAttributeValue): void {
    const obj = styleObject(init)
    if (!obj) return
    for (const p of obj.properties) {
      if (!ts.isPropertyAssignment(p)) {
        throw new Error(`style에 처리 규칙이 없는 항목: ${p.getText(sf).slice(0, 40)}`)
      }
      const raw = p.name.getText(sf).replace(/^["']|["']$/g, "")
      const value = normCssValue(joinParts(exprSegments(p.initializer)))
      if (value !== "") ir.styles.push(`${normCssProp(raw)}:${value}`)
    }
  }

  function styleObject(init: ts.JsxAttributeValue): ts.ObjectLiteralExpression | null {
    if (!ts.isJsxExpression(init) || !init.expression) return null
    const e = init.expression
    return ts.isObjectLiteralExpression(e) ? e : null
  }

  /** 속성값 하나를 리터럴·홀 조각으로. `style`은 객체라 여기서 통째로 훑는다. */
  function segments(init: ts.JsxAttributeValue): Segment[] {
    if (ts.isStringLiteral(init)) return [{ lit: init.text }]
    if (!ts.isJsxExpression(init) || !init.expression) return []
    const e = init.expression
    if (ts.isObjectLiteralExpression(e)) {
      // style 객체 — 값들을 순서대로 이어붙여 홀·토큰을 뽑는다
      const out: Segment[] = []
      for (const p of e.properties) {
        if (ts.isPropertyAssignment(p)) out.push(...exprSegments(p.initializer))
      }
      return out
    }
    return exprSegments(e)
  }

  function exprSegments(e: ts.Expression): Segment[] {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [{ lit: e.text }]
    if (ts.isNumericLiteral(e)) return [{ lit: e.text }]
    if (e.kind === ts.SyntaxKind.TrueKeyword) return [{ lit: "true" }]
    if (e.kind === ts.SyntaxKind.FalseKeyword) return [{ lit: "false" }]
    if (ts.isTemplateExpression(e)) {
      const out: Segment[] = [{ lit: e.head.text }]
      for (const span of e.templateSpans) {
        out.push({ expr: span.expression.getText(sf) })
        out.push({ lit: span.literal.text })
      }
      return out
    }
    if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) return [{ expr: e.getText(sf) }]
    // 삼항 등 계산이 든 자리. 변환 출력에는 없다(원본에 없으므로) — 손으로 이식한
    // 코드를 대조할 때 나온다. 통째로 한 자리로 보고, 원본의 `{o.bg}`와 다르다는
    // 사실이 그대로 차이로 드러나게 둔다.
    if (ts.isConditionalExpression(e) || ts.isBinaryExpression(e)) {
      return [{ expr: e.getText(sf) }]
    }
    throw new Error(`속성값에 처리 규칙이 없는 표현식: ${e.getText(sf).slice(0, 60)}`)
  }
}
