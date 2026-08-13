/**
 * DC 템플릿 파서 — 동결 목업의 본문을 노드 트리로 읽는다.
 *
 * **범용 HTML 파서가 아니다.** 목적은 `mockup/FlowBase.dc.html` 한 파일을
 * 정확히 읽는 것뿐이다. 그래서 모르는 것을 만나면 추측해서 넘기지 않고
 * `ParseError`로 세운다 — 조용히 흘려보낸 자리가 나중에 "어디서 어긋났는지
 * 아무도 모르는" 결함이 된다 (헌장 6 · ADR-010).
 *
 * 파서는 **의미를 부여하지 않는다.** `<sc-if>`·`<sc-for>`·`<x-import>`도
 * 그냥 요소로 읽는다. 지시자 해석은 emit이 한다 — 그래야 게이트가 보는 IR과
 * 변환 결과가 같은 트리에서 나온다.
 */

/** 속성값·텍스트의 조각. `{{ expr }}`가 홀이다. */
export type Part =
  | { t: "lit"; text: string }
  | { t: "hole"; expr: string }

export interface Attr {
  name: string
  /** `null`이면 값 없는 속성 (`<input autoFocus>`). */
  parts: Part[] | null
  line: number
}

export type Node = ElNode | TextNode | CommentNode

export interface ElNode {
  k: "el"
  tag: string
  attrs: Attr[]
  kids: Node[]
  line: number
}

export interface TextNode {
  k: "text"
  parts: Part[]
  line: number
}

export interface CommentNode {
  k: "comment"
  text: string
  line: number
}

export class ParseError extends Error {
  constructor(
    msg: string,
    readonly line: number,
  ) {
    super(`${msg} — 원본 L${line}`)
    this.name = "ParseError"
  }
}

/**
 * 닫는 태그가 없는 채로 부모가 닫혀 **암묵적으로 닫힌** 요소.
 *
 * 목업은 이 구조를 실제로 쓴다:
 *
 * ```html
 * <section>
 *   <sc-if value="{{ notFirstRun }}">   ← 닫는 태그가 없다
 *     …화면 전체…
 * </section>                            ← 여기서 sc-if도 함께 닫힌다
 * ```
 *
 * DC 런타임이 `template.innerHTML`로 파싱하므로(support.js:470) 진짜 트리는
 * **브라우저 HTML 파서가 만드는 트리**다. 브라우저는 짝이 안 맞는 종료 태그를
 * 만나면 스택을 되감으며 그 위의 열린 요소를 전부 닫는다. 실제 목업 구간을
 * 브라우저에 물려 확인한 동작이다.
 *
 * 조용히 처리하지 않고 전부 기록해서 내보낸다 — 변환기가 트리를 어떻게
 * 해석했는지가 곧 "sc-if가 어디까지 감싸는가"이고, 그걸 사람이 볼 수 있어야
 * 한다 (헌장 6).
 */
export interface ImplicitClose {
  /** 암묵적으로 닫힌 태그. */
  tag: string
  /** 그 태그가 열린 줄. */
  openLine: number
  /** 닫히게 만든 종료 태그. */
  byTag: string
  /** 그 종료 태그의 줄. */
  byLine: number
}

/**
 * 스택에서 짝을 찾기 전에 special 요소를 만나 **무시된** 종료 태그.
 * 목업 안의 잉여 태그가 여기로 드러난다.
 */
export interface IgnoredClose {
  tag: string
  line: number
  /** 무시하게 만든 special 요소. */
  blockedBy: string
}

export interface ParseResult {
  nodes: Node[]
  implicit: ImplicitClose[]
  ignored: IgnoredClose[]
}

/**
 * HTML5 "special" 요소 — 종료 태그가 스택을 되감을 때 **벽**이 된다.
 * 스택을 훑다 이걸 만나면 브라우저는 그 종료 태그를 통째로 무시한다.
 *
 * ★ 표 계열(`table`·`tbody`·`tr`·`td`·`th`·`thead`·`tfoot`·`caption`·`select`)은
 * 일부러 뺐다. DC 런타임이 파싱 직전에 `sc-raw-*` 별칭으로 바꾸기 때문에
 * (support.js:303 `RAW_WRAP`) 브라우저 눈에는 표가 아니고, 따라서 special도
 * 아니다. 이 별칭이 없으면 foster parenting이 `<sc-for>`를 표 밖으로 밀어내
 * 반복 범위가 통째로 사라진다 — 실제로 브라우저에 물려 확인했다.
 */
const SPECIAL = new Set([
  "address", "applet", "area", "article", "aside", "base", "basefont", "bgsound",
  "blockquote", "body", "br", "button", "center", "col", "colgroup", "dd", "details",
  "dir", "div", "dl", "dt", "embed", "fieldset", "figcaption", "figure", "footer",
  "form", "frame", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header",
  "hgroup", "hr", "html", "iframe", "img", "input", "keygen", "li", "link", "listing",
  "main", "marquee", "menu", "meta", "nav", "noembed", "noframes", "noscript", "object",
  "ol", "p", "param", "plaintext", "pre", "script", "section", "source", "style",
  "summary", "template", "textarea", "title", "track", "ul", "wbr", "xmp",
])

/**
 * 내용을 가질 수 없는 요소. 목업은 `<input …/>` 19개가 전부 self-closing이라
 * 지금은 쓰이지 않지만, 닫는 태그 없이 나타나도 트리가 어긋나지 않게 둔다.
 */
const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
])

const NAME_START = /[A-Za-z]/
const ATTR_NAME = /[^\s=/>]/

/**
 * 템플릿 조각을 노드 트리로 읽는다.
 *
 * @param src       읽을 HTML 조각
 * @param startLine 이 조각이 원본 파일에서 시작하는 줄 번호. 오류 메시지가
 *                  **원본 줄을 가리키게** 하려고 받는다 — 조각 기준 줄 번호는
 *                  목업과 대조할 때 쓸모가 없다
 */
export function parseTemplate(src: string, startLine = 1): ParseResult {
  let i = 0
  let line = startLine
  const implicit: ImplicitClose[] = []
  const ignored: IgnoredClose[] = []

  /** `to`까지 진행하면서 줄 수를 센다. 위치 이동은 전부 이걸 거친다. */
  const seek = (to: number): void => {
    for (let p = i; p < to; p++) if (src[p] === "\n") line++
    i = to
  }

  const root: Node[] = []
  const stack: ElNode[] = []
  const put = (n: Node): void => {
    const top = stack[stack.length - 1]
    if (top) top.kids.push(n)
    else root.push(n)
  }

  while (i < src.length) {
    const lt = src.indexOf("<", i)

    // 남은 것이 전부 텍스트
    if (lt === -1) {
      addText(src.slice(i), line)
      seek(src.length)
      break
    }

    // `<` 앞의 텍스트
    if (lt > i) {
      addText(src.slice(i, lt), line)
      seek(lt)
    }

    if (src.startsWith("<!--", i)) {
      const end = src.indexOf("-->", i + 4)
      if (end === -1) throw new ParseError("닫히지 않은 주석", line)
      put({ k: "comment", text: src.slice(i + 4, end), line })
      seek(end + 3)
      continue
    }

    if (src.startsWith("<!", i)) {
      throw new ParseError(`처리 규칙이 없는 선언: ${src.slice(i, i + 20)}…`, line)
    }

    // 닫는 태그
    if (src.startsWith("</", i)) {
      const end = src.indexOf(">", i)
      if (end === -1) throw new ParseError("닫히지 않은 종료 태그", line)
      const tag = src.slice(i + 2, end).trim()

      // HTML5 "any other end tag" — 스택을 위에서부터 훑는다.
      //   · 짝을 만나면 그 위의 열린 요소를 전부 암묵적으로 닫고 함께 pop
      //   · 짝보다 special 요소를 먼저 만나면 이 종료 태그를 통째로 무시
      let depth = -1
      let blockedBy = ""
      for (let s = stack.length - 1; s >= 0; s--) {
        const node = stack[s]
        if (!node) break
        if (node.tag === tag) {
          depth = s
          break
        }
        if (SPECIAL.has(node.tag)) {
          blockedBy = node.tag
          break
        }
      }

      if (depth === -1) {
        // 브라우저는 조용히 버린다. 우리는 버리되 기록한다 (헌장 6)
        ignored.push({ tag, line, blockedBy: blockedBy || "(스택에 없음)" })
        seek(end + 1)
        continue
      }

      for (let s = stack.length - 1; s > depth; s--) {
        const orphan = stack[s]
        if (orphan) {
          implicit.push({ tag: orphan.tag, openLine: orphan.line, byTag: tag, byLine: line })
        }
      }
      stack.length = depth

      seek(end + 1)
      continue
    }

    // 여는 태그
    const after = src[i + 1] ?? ""
    if (!NAME_START.test(after)) {
      // 텍스트 안의 맨 `<`. 목업에는 없어야 한다
      throw new ParseError(`태그로 볼 수 없는 '<': ${src.slice(i, i + 20)}…`, line)
    }
    readOpenTag()
  }

  const unclosed = stack[stack.length - 1]
  if (unclosed) throw new ParseError(`닫히지 않은 <${unclosed.tag}>`, unclosed.line)

  return { nodes: root, implicit, ignored }

  function addText(raw: string, at: number): void {
    if (raw.length === 0) return
    put({ k: "text", parts: splitHoles(raw, at), line: at })
  }

  function readOpenTag(): void {
    const tagLine = line
    let p = i + 1
    while (p < src.length && ATTR_NAME.test(src[p] ?? "")) p++
    const tag = src.slice(i + 1, p)
    seek(p)

    const attrs: Attr[] = []
    let selfClosed = false

    for (;;) {
      // 공백 건너뛰기 (줄바꿈이 섞이므로 seek으로)
      let q = i
      while (q < src.length && /\s/.test(src[q] ?? "")) q++
      seek(q)

      if (i >= src.length) throw new ParseError(`닫히지 않은 <${tag}>`, tagLine)

      if (src.startsWith("/>", i)) {
        selfClosed = true
        seek(i + 2)
        break
      }
      if (src[i] === ">") {
        seek(i + 1)
        break
      }

      // 속성 이름
      const nameStart = i
      let r = i
      while (r < src.length && ATTR_NAME.test(src[r] ?? "")) r++
      if (r === nameStart) {
        throw new ParseError(
          `<${tag}>의 속성을 읽을 수 없다: ${src.slice(i, i + 24)}…`,
          line,
        )
      }
      const name = src.slice(nameStart, r)
      const attrLine = line
      seek(r)

      // `=` 와 값
      let parts: Part[] | null = null
      if (src[i] === "=") {
        seek(i + 1)
        const quote = src[i]
        if (quote !== '"' && quote !== "'") {
          throw new ParseError(`따옴표 없는 속성값 (${tag}.${name})`, line)
        }
        const end = src.indexOf(quote, i + 1)
        if (end === -1) throw new ParseError(`닫히지 않은 속성값 (${tag}.${name})`, line)
        const raw = src.slice(i + 1, end)
        parts = splitHoles(raw, line)
        seek(end + 1)
      }

      attrs.push({ name, parts, line: attrLine })
    }

    const el: ElNode = { k: "el", tag, attrs, kids: [], line: tagLine }
    put(el)
    if (!selfClosed && !VOID.has(tag)) stack.push(el)
  }

  /** `{{ expr }}`를 조각으로 가른다. 홀 안은 해석하지 않고 문자열로 들고 있는다. */
  function splitHoles(raw: string, at: number): Part[] {
    const parts: Part[] = []
    let p = 0
    for (;;) {
      const open = raw.indexOf("{{", p)
      if (open === -1) break
      const close = raw.indexOf("}}", open + 2)
      if (close === -1) throw new ParseError("닫히지 않은 {{ 홀", at)
      if (open > p) parts.push({ t: "lit", text: raw.slice(p, open) })
      const expr = raw.slice(open + 2, close).trim()
      if (expr === "") throw new ParseError("빈 홀 {{ }}", at)
      parts.push({ t: "hole", expr })
      p = close + 2
    }
    if (p < raw.length) parts.push({ t: "lit", text: raw.slice(p) })
    return parts
  }
}

/** 트리를 깊이 우선으로 훑는다. IR 수집과 검사에서 같은 순서를 쓰려고 한 곳에 둔다. */
export function walk(nodes: readonly Node[], visit: (n: Node) => void): void {
  for (const n of nodes) {
    visit(n)
    if (n.k === "el") walk(n.kids, visit)
  }
}
