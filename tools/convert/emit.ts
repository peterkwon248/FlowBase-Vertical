/**
 * 노드 트리 → TSX. 핸드오프 §4-1 변환표의 구현이다.
 *
 * ```
 * {{ path }}        →  {expr}          <sc-if value>  →  {cond && …}
 * <sc-for list as>  →  .map()          $index         →  .map((x, i) =>)
 * <x-import>        →  import          <x-dc>·hint-*  →  삭제
 * ```
 *
 * ★ **§21 이탈을 여기서 하지 않는다.** 도넛→가로막대·스파크라인 제거는
 * 별도 커밋(③단계)의 일이다. 변환기가 그것까지 하면 보존 게이트가 "의도된
 * 이탈"과 "사고"를 구분하지 못한다. 이 파일의 목표는 오직 **100% 충실**이다.
 *
 * ★ **계산을 옮기지 않는다.** 이 파일은 마크업만 다룬다. `renderVals`의 산수는
 * 변환기 스코프 밖이고, 계산기는 `computePnl` 하나다 (단일 계산기 LOCK).
 */

import type { Attr, ElNode, Node, Part } from "./parse.js"

export interface EmitOptions {
  /** `<x-import from="…">`를 실제 모듈 경로로 바꾸는 표. 없는 값이 오면 세운다. */
  moduleMap: Record<string, string>
  /** 값 객체의 이름. 스코프 변수가 아닌 홀은 전부 여기에 매달린다. */
  valsName: string
}

export interface EmitResult {
  /** 컴포넌트 본문 JSX (최상위 요소 하나). */
  jsx: string
  /** 모듈 경로 → 가져올 이름 집합. */
  imports: Map<string, Set<string>>
  /** 홀에서 쓰인 최상위 키. 생성 인터페이스의 필드가 된다. */
  valsKeys: Set<string>
  /** 사람이 봐야 할 것. 조용히 넘기지 않는다 (헌장 6). */
  notes: string[]
}

/** DC 런타임 전용이라 그대로 버리는 속성. */
const DROP_ATTR = /^hint-/

/** React가 number로 선언한 속성. HTML 문자열을 그대로 두면 타입이 어긋난다. */
const NUMERIC_ATTR = new Set(["colSpan", "rowSpan", "span"])

/** 지시자 자신이 쓰는 속성 — props로 새어나가면 안 된다. */
const DIRECTIVE_ATTR = new Set(["value", "list", "as", "component-from-global-scope", "from"])

/** JSX에서 이름이 달라지는 HTML 속성. 목업 전수 조사로 확정한 목록이다. */
const RENAME: Record<string, string> = {
  class: "className",
  colspan: "colSpan",
  for: "htmlFor",
}

/** 내용을 가질 수 없어 JSX에서 반드시 self-closing이어야 하는 요소. */
const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
])

export function emitTemplate(nodes: readonly Node[], opts: EmitOptions): EmitResult {
  const imports = new Map<string, Set<string>>()
  const valsKeys = new Set<string>()
  const notes: string[] = []

  const roots = nodes.filter((n) => !isBlank(n))
  const first = roots[0]
  if (roots.length !== 1 || !first || first.k !== "el") {
    throw new Error(`템플릿 최상위가 요소 하나가 아니다 (${roots.length}개)`)
  }

  const jsx = emitNode(first, 2, new Set())
  return { jsx, imports, valsKeys, notes }

  // ── 노드 ────────────────────────────────────────────────────────────

  function emitNode(n: Node, depth: number, scope: ReadonlySet<string>): string {
    const pad = "  ".repeat(depth)
    if (n.k === "comment") return `${pad}{/*${n.text}*/}`
    if (n.k === "text") return emitText(n.parts, depth, scope)
    if (n.tag === "sc-if") return emitIf(n, depth, scope)
    if (n.tag === "sc-for") return emitFor(n, depth, scope)
    if (n.tag === "x-import") return emitImport(n, depth, scope)
    return emitElement(n, depth, scope)
  }

  function emitChildren(kids: readonly Node[], depth: number, scope: ReadonlySet<string>): string[] {
    const out: string[] = []
    for (let i = 0; i < kids.length; i++) {
      const kid = kids[i]
      if (!kid) continue

      // 공백만 있는 텍스트: HTML은 형제 **사이**의 것만 공백 한 칸으로 렌더한다
      // (줄 시작·끝의 공백은 접힌다). JSX는 줄바꿈이 든 공백을 통째로 버리므로,
      // 살아남아야 하는 자리에만 {" "}를 명시해 원본 렌더를 유지한다.
      if (isBlank(kid)) {
        const between = hasContentBefore(kids, i) && hasContentAfter(kids, i)
        if (between) out.push(`${"  ".repeat(depth)}{" "}`)
        continue
      }
      out.push(emitNode(kid, depth, scope))
    }
    return out
  }

  function emitElement(n: ElNode, depth: number, scope: ReadonlySet<string>): string {
    const pad = "  ".repeat(depth)
    const attrs = n.attrs
      .filter((a) => !DROP_ATTR.test(a.name))
      .map((a) => emitAttr(n.tag, a, scope, false))
      .filter((s) => s !== "")

    const head = attrs.length === 0 ? n.tag : `${n.tag} ${attrs.join(" ")}`

    if (VOID.has(n.tag)) {
      if (n.kids.length > 0) throw new Error(`<${n.tag}>에 자식이 있다 — L${n.line}`)
      return `${pad}<${head} />`
    }

    const kids = emitChildren(n.kids, depth + 1, scope)
    if (kids.length === 0) return `${pad}<${head}></${n.tag}>`
    return `${pad}<${head}>\n${kids.join("\n")}\n${pad}</${n.tag}>`
  }

  /** `<sc-if value="{{ c }}">` → `{c && (…)}` (§4-1). */
  function emitIf(n: ElNode, depth: number, scope: ReadonlySet<string>): string {
    const pad = "  ".repeat(depth)
    const cond = directiveExpr(n, "value", scope)
    const kids = emitChildren(n.kids, depth + 2, scope)
    if (kids.length === 0) return `${pad}{/* 빈 sc-if: ${cond} */}`
    const body = wrapFragment(kids, depth + 1)
    return `${pad}{${cond} && (\n${body}\n${pad})}`
  }

  /** `<sc-for list="{{ xs }}" as="x">` → `{xs.map((x, $index) => …)}` (§4-1). */
  function emitFor(n: ElNode, depth: number, scope: ReadonlySet<string>): string {
    const pad = "  ".repeat(depth)
    const list = directiveExpr(n, "list", scope)
    const as = literalAttr(n, "as")
    if (!as) throw new Error(`<sc-for>에 as가 없다 — L${n.line}`)

    // `$index`는 목업이 실제로 쓰는 이름이다(1곳). 항상 바인딩해 key로도 쓴다 —
    // key 없이 .map을 내면 React가 목록 갱신을 못 맞춘다.
    const inner = new Set(scope)
    inner.add(as)
    inner.add("$index")

    const kids = emitChildren(n.kids, depth + 2, inner)
    if (kids.length === 0) return `${pad}{/* 빈 sc-for: ${list} */}`

    const only = kids[0]
    const body =
      kids.length === 1 && only && isElementJsx(only)
        ? withKey(only)
        : wrapKeyedFragment(kids, depth + 1)
    // 파라미터에 타입을 명시한다. `vals`가 아직 전부 any라 주석이 없으면
    // 콜백 인자가 implicit any가 되어 strict에서 250건씩 터진다. 배선하면서
    // `vals`를 좁히면 이 주석도 같이 사라진다.
    return `${pad}{${list}.map((${as}: any, $index: number) => (\n${body}\n${pad}))}`
  }

  /** `<x-import component-from-global-scope="Lic" from="…">` → 컴포넌트 + import (§4-1). */
  function emitImport(n: ElNode, depth: number, scope: ReadonlySet<string>): string {
    const pad = "  ".repeat(depth)
    const comp = literalAttr(n, "component-from-global-scope")
    const from = literalAttr(n, "from")
    if (!comp) throw new Error(`<x-import>에 component-from-global-scope가 없다 — L${n.line}`)
    if (!from) throw new Error(`<x-import>에 from이 없다 — L${n.line}`)

    const mod = opts.moduleMap[from]
    if (!mod) throw new Error(`모듈 표에 없는 from="${from}" — L${n.line}`)

    // `VChart.Line`처럼 점이 든 이름은 JSX 멤버 표현식이다. 가져오는 것은 뿌리.
    const root = comp.split(".")[0] ?? comp
    let set = imports.get(mod)
    if (!set) {
      set = new Set()
      imports.set(mod, set)
    }
    set.add(root)

    if (n.kids.length > 0) throw new Error(`<x-import>에 자식이 있다 — L${n.line}`)

    const props = n.attrs
      .filter((a) => !DROP_ATTR.test(a.name) && !DIRECTIVE_ATTR.has(a.name))
      .map((a) => emitAttr(comp, a, scope, true))
      .filter((s) => s !== "")

    return props.length === 0 ? `${pad}<${comp} />` : `${pad}<${comp} ${props.join(" ")} />`
  }

  // ── 속성 ────────────────────────────────────────────────────────────

  /** 지시자가 자기 속성에 담아둔 표현식 — `<sc-if value="{{ c }}">`의 `c`. */
  function directiveExpr(n: ElNode, attr: string, scope: ReadonlySet<string>): string {
    const a = n.attrs.find((x) => x.name === attr)
    if (!a || a.parts === null) throw new Error(`<${n.tag}>에 ${attr}이 없다 — L${n.line}`)
    return partsToExpr(a.parts, scope)
  }

  function emitAttr(tag: string, a: Attr, scope: ReadonlySet<string>, isComponent: boolean): string {
    if (DIRECTIVE_ATTR.has(a.name) && (tag === "sc-if" || tag === "sc-for")) return ""

    const name = RENAME[a.name] ?? a.name
    if (a.parts === null) return name // 값 없는 속성 (autoFocus)

    if (name === "style") return `style={{ ${emitStyle(a.parts, scope)} }}`

    // React가 number로 선언한 속성. HTML은 전부 문자열이라 그대로 두면
    // `colSpan="8"`이 되어 타입이 어긋난다. 값이 같으니 충실성 문제는 없다.
    if (NUMERIC_ATTR.has(name)) {
      const lit = onlyLiteral(a.parts)
      if (lit !== null && lit.trim() !== "" && Number.isFinite(Number(lit))) {
        return `${name}={${Number(lit)}}`
      }
    }

    // 컴포넌트 prop만 숫자를 복원한다. `size="20"`은 DOM 속성이면 문자열로 족하지만
    // React 컴포넌트에는 숫자로 가야 한다(Lic이 width/height에 그대로 쓴다).
    // HTML·SVG 요소의 속성은 원문 그대로 둔다 — 그게 충실하다.
    if (isComponent) {
      const lit = onlyLiteral(a.parts)
      if (lit !== null && lit.trim() !== "" && Number.isFinite(Number(lit))) {
        return `${name}={${Number(lit)}}`
      }
    }

    return `${name}=${partsToAttrValue(a.parts, scope)}`
  }

  /** 인라인 style 문자열 → JSX 스타일 객체. 이 목업은 토큰이 style에 박혀 있다. */
  function emitStyle(parts: readonly Part[], scope: ReadonlySet<string>): string {
    const decls = splitDeclarations(parts)
    const out: string[] = []
    for (const d of decls) {
      const prop = cssPropToJs(d.prop)
      out.push(`${prop}: ${partsToExpr(d.value, scope)}`)
    }
    return out.join(", ")
  }

  // ── 텍스트·표현식 ────────────────────────────────────────────────────

  function emitText(parts: readonly Part[], depth: number, scope: ReadonlySet<string>): string {
    const pad = "  ".repeat(depth)
    const out: string[] = []
    for (const p of parts) {
      if (p.t === "hole") {
        out.push(`{${qualify(p.expr, scope)}}`)
        continue
      }
      const text = p.text
      if (text.trim() === "") continue
      // JSX 텍스트에서 중괄호는 표현식 시작이다. 목업에는 없지만 방어해 둔다.
      out.push(/[{}<>]/.test(text) ? `{${JSON.stringify(text.trim())}}` : text.trim())
    }
    return out.length === 0 ? "" : pad + out.join("")
  }

  /** JSX 속성값 — 통째로 리터럴이면 문자열, 홀 하나면 표현식, 섞이면 템플릿 리터럴. */
  function partsToAttrValue(parts: readonly Part[], scope: ReadonlySet<string>): string {
    const lit = onlyLiteral(parts)
    if (lit !== null) return JSON.stringify(lit)
    return `{${partsToExpr(parts, scope)}}`
  }

  /** 중괄호 없는 표현식. style 객체의 값이나 속성값 안쪽에 쓴다. */
  function partsToExpr(parts: readonly Part[], scope: ReadonlySet<string>): string {
    const lit = onlyLiteral(parts)
    if (lit !== null) return JSON.stringify(lit)

    const holes = parts.filter((p) => p.t === "hole")
    const lits = parts.filter((p) => p.t === "lit")
    if (holes.length === 1 && lits.every((p) => p.t === "lit" && p.text.trim() === "")) {
      const only = holes[0]
      if (only && only.t === "hole") return qualify(only.expr, scope)
    }

    const body = parts
      .map((p) =>
        p.t === "hole"
          ? `\${${qualify(p.expr, scope)}}`
          : p.text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${"),
      )
      .join("")
    return `\`${body}\``
  }

  /**
   * 홀 경로에 스코프를 채운다.
   *
   * - sc-for가 연 이름(`o`·`$index`)으로 시작하면 지역 변수
   * - `true`·`false`·숫자는 리터럴
   * - 나머지는 전부 renderVals가 주던 값 → `vals.`에 매단다
   */
  function qualify(expr: string, scope: ReadonlySet<string>): string {
    if (/^(true|false|null|-?\d+(\.\d+)?)$/.test(expr)) return expr
    const root = expr.split(".")[0] ?? expr
    if (scope.has(root)) return expr
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(root)) {
      throw new Error(`홀 경로를 식별자로 볼 수 없다: {{ ${expr} }}`)
    }
    valsKeys.add(root)
    return `${opts.valsName}.${expr}`
  }
}

// ── 순수 도우미 ────────────────────────────────────────────────────────

function isBlank(n: Node): boolean {
  return n.k === "text" && n.parts.every((p) => p.t === "lit" && p.text.trim() === "")
}

function hasContentBefore(kids: readonly Node[], i: number): boolean {
  for (let k = i - 1; k >= 0; k--) {
    const n = kids[k]
    if (n && !isBlank(n)) return true
  }
  return false
}

function hasContentAfter(kids: readonly Node[], i: number): boolean {
  for (let k = i + 1; k < kids.length; k++) {
    const n = kids[k]
    if (n && !isBlank(n)) return true
  }
  return false
}

function onlyLiteral(parts: readonly Part[]): string | null {
  if (parts.some((p) => p.t === "hole")) return null
  return parts.map((p) => (p.t === "lit" ? p.text : "")).join("")
}

function literalAttr(n: ElNode, name: string): string | null {
  const a = n.attrs.find((x) => x.name === name)
  if (!a || a.parts === null) return null
  return onlyLiteral(a.parts)
}

/**
 * 자식이 **요소 하나**일 때만 프래그먼트를 생략한다.
 *
 * 자식이 `{xs.map(…)}` 같은 표현식이면 생략하면 안 된다 —
 * `{cond && ( {xs.map(…)} )}`가 되어 중괄호가 겹치고 JSX가 깨진다.
 * 프래그먼트 안에서는 표현식 자식이 정상이므로 감싸면 해결된다.
 */
function wrapFragment(kids: string[], depth: number): string {
  const pad = "  ".repeat(depth)
  const only = kids[0]
  if (kids.length === 1 && only && isElementJsx(only)) return only
  return `${pad}<>\n${kids.join("\n")}\n${pad}</>`
}

/** 이 조각이 JSX 요소로 시작하는가(= 중괄호 표현식이 아닌가). */
function isElementJsx(jsx: string): boolean {
  return jsx.trimStart().startsWith("<")
}

function wrapKeyedFragment(kids: string[], depth: number): string {
  const pad = "  ".repeat(depth)
  return `${pad}<Fragment key={$index}>\n${kids.join("\n")}\n${pad}</Fragment>`
}

/** 반복 항목의 최상위 요소에 key를 붙인다. 여는 태그 이름 바로 뒤에 끼운다. */
function withKey(jsx: string): string {
  const m = /^(\s*)<([A-Za-z][A-Za-z0-9.-]*)/.exec(jsx)
  if (!m) return jsx // 표현식({…})이면 그대로 — 호출부가 Fragment로 감싼다
  const at = m[0].length
  return `${jsx.slice(0, at)} key={$index}${jsx.slice(at)}`
}

/** `-` 이어붙인 CSS 이름 → JS 이름. 커스텀 프로퍼티는 따옴표 키로 남긴다. */
function cssPropToJs(prop: string): string {
  const p = prop.trim()
  if (p.startsWith("--")) return JSON.stringify(p)
  return p.replace(/-([a-zA-Z])/g, (_, c: string) => c.toUpperCase())
}

interface Declaration {
  prop: string
  value: Part[]
}

/**
 * style 문자열을 선언 단위로 가른다. 괄호 깊이를 세므로 `var(--a, b)`나
 * `url(data:…)` 안의 `;`·`:`에 속지 않는다.
 */
function splitDeclarations(parts: readonly Part[]): Declaration[] {
  const decls: Declaration[] = []
  let prop: string | null = null
  let acc: Part[] = []
  let depth = 0

  const flush = (): void => {
    const trimmed = trimParts(acc)
    if (prop !== null && trimmed.length > 0) decls.push({ prop, value: trimmed })
    prop = null
    acc = []
  }

  for (const p of parts) {
    if (p.t === "hole") {
      acc.push(p)
      continue
    }
    let buf = ""
    for (const ch of p.text) {
      if (ch === "(") depth++
      else if (ch === ")") depth--

      if (ch === ";" && depth === 0) {
        if (buf) acc.push({ t: "lit", text: buf })
        buf = ""
        flush()
        continue
      }
      if (ch === ":" && depth === 0 && prop === null && acc.length === 0) {
        prop = buf.trim()
        buf = ""
        continue
      }
      buf += ch
    }
    if (buf) acc.push({ t: "lit", text: buf })
  }
  flush()
  return decls
}

function trimParts(parts: readonly Part[]): Part[] {
  const out = parts.map((p) => ({ ...p }))
  const head = out[0]
  if (head && head.t === "lit") head.text = head.text.replace(/^\s+/, "")
  const tail = out[out.length - 1]
  if (tail && tail.t === "lit") tail.text = tail.text.replace(/\s+$/, "")
  return out.filter((p) => p.t === "hole" || p.text !== "")
}
