/**
 * 보존 IR — 변환 전후로 **반드시 같아야 하는 것**만 뽑아낸 표현.
 *
 * 게이트가 비교하는 것은 정적 구조 수준이다. **JSX를 렌더한 DOM이 아니다** —
 * `{{ path }}` → `{expr}`는 값이 아니라 *자리*의 치환이라, 렌더해서 비교하려면
 * 값이 필요하고 값은 아직 없다.
 *
 * | 대상 | 왜 |
 * |---|---|
 * | 텍스트 노드 | 카피가 바뀌면 안 된다 |
 * | 클래스 | Vector DS 클래스가 살아 있어야 한다 |
 * | 토큰 | `var(--…)` 참조 보존 |
 * | 인라인 style 선언 | ★ 이 목업은 **토큰이 인라인 style에 박힌 코드**다. 클래스만 보면 style 드리프트가 샌다 |
 * | 동적 자리의 개수·경로 | 1:1로 봐야 표현식 누락까지 잡힌다 |
 *
 * 한 줄로: **구조와 정적 속성의 완전 보존 + 동적 자리의 1:1 대응.**
 *
 * IR은 두 경로로 만들어진다 — 원본 HTML은 우리 파서로, 출력 TSX는 **TypeScript
 * 컴파일러**로. 같은 파서로 양쪽을 읽으면 파서의 착각까지 함께 복사돼 게이트가
 * 자기 자신을 증명하는 꼴이 된다. 경로를 갈라놔야 대조에 의미가 있다 (ADR-007).
 */

import type { ElNode, Node, Part } from "./parse.js"

export interface Ir {
  /** 텍스트 조각. 공백만인 것은 뺀다. 홀을 경계로 쪼갠다. */
  texts: string[]
  /** class 속성값. */
  classes: string[]
  /** 인라인 style 선언 — `prop:value` 한 줄씩. */
  styles: string[]
  /**
   * style을 뺀 나머지 속성 — `name=value`.
   *
   * 처음에는 조건 1의 목록(텍스트·클래스·토큰·style·홀)만 봤는데, 그러면
   * `d`(SVG 경로)·`placeholder`·`colSpan`·`onClick`이 **어디에도 안 잡힌다.**
   * 아이콘 모양이 바뀌어도 게이트가 녹색으로 통과한다는 뜻이라 항목을 넓혔다.
   * 조건 1의 정신인 "정적 속성의 완전 보존"에 오히려 가깝다.
   */
  attrs: string[]
  /** `var(--…)` 참조 전부. */
  tokens: string[]
  /** 동적 자리의 경로. 순서까지 같아야 한다. 상수 홀은 세지 않는다. */
  holes: string[]
}

export const IR_FIELDS = ["texts", "classes", "styles", "attrs", "tokens", "holes"] as const
export type IrField = (typeof IR_FIELDS)[number]

export function emptyIr(): Ir {
  return { texts: [], classes: [], styles: [], attrs: [], tokens: [], holes: [] }
}

/**
 * `{{ true }}`·`{{ 10 }}`처럼 값이 상수인 홀. **동적 자리로 세지 않는다** —
 * 변환기가 `colSpan={10}`처럼 상수로 내보내는 것이 옳고, 그 값이 사라지는
 * 사고는 `attrs`가 잡는다.
 */
export function isConstantExpr(expr: string): boolean {
  return /^(true|false|null|-?\d+(\.\d+)?)$/.test(expr.trim())
}

/** 항목별 어긋난 자리. 비어 있으면 통과다. */
export type IrDiff = Record<IrField, string[]>

/**
 * 두 IR을 항목별로 대조한다. **개수만 맞추고 넘기지 않는다** — 같은 자리끼리
 * 견주어 첫 어긋난 지점을 사람이 읽을 수 있게 돌려준다.
 */
export function compareIr(want: Ir, got: Ir): IrDiff {
  const diff = {} as IrDiff
  for (const field of IR_FIELDS) {
    const a = want[field]
    const b = got[field]
    const out: string[] = []
    const n = Math.max(a.length, b.length)
    for (let i = 0; i < n; i++) {
      const x = a[i]
      const y = b[i]
      if (x === y) continue
      if (x === undefined) out.push(`[${i}] 출력에만 있다: ${cut(y)}`)
      else if (y === undefined) out.push(`[${i}] 출력에서 사라졌다: ${cut(x)}`)
      else out.push(`[${i}] 원본 ${cut(x)}  ≠  출력 ${cut(y)}`)
    }
    diff[field] = out
  }
  return diff
}

export function irDiffCount(diff: IrDiff): number {
  return IR_FIELDS.reduce((n, f) => n + diff[f].length, 0)
}

function cut(s: string | undefined): string {
  if (s === undefined) return "(없음)"
  return s.length > 70 ? `${JSON.stringify(s.slice(0, 70))}…` : JSON.stringify(s)
}

/** 이름이 달라진 속성을 원래 이름으로 되돌려 대조 가능하게 만든다. */
export function normAttrName(name: string): string {
  const n = name.trim()
  if (n === "className") return "class"
  if (n === "htmlFor") return "for"
  if (n.toLowerCase() === "colspan") return "colspan"
  return n
}

// ── 공통 정규화 ────────────────────────────────────────────────────────
// 양쪽 추출기가 **반드시 같은 규칙**을 쓴다. 여기 있는 함수만 쓰도록 강제한다.

/** 이어진 공백을 한 칸으로 접는다. HTML 렌더의 공백 접힘과 같은 규칙이다. */
export function normText(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

/**
 * 리터럴과 홀이 섞인 값을 한 문자열로 굳힌다.
 * HTML의 `1px solid {{ o.border }}`와 TSX의 `` `1px solid ${o.border}` ``가
 * 여기서 같은 `1px solid {o.border}`가 된다.
 */
export function joinParts(segments: readonly { lit?: string; expr?: string }[]): string {
  return segments
    .map((s) => {
      if (s.expr === undefined) return s.lit ?? ""
      // 상수 홀은 값 그대로 — 변환기가 `colSpan={10}`처럼 상수로 내보내므로
      // 중괄호를 씌우면 양쪽 모양이 달라진다
      return isConstantExpr(s.expr) ? s.expr.trim() : `{${normPath(s.expr)}}`
    })
    .join("")
}

/**
 * 홀 경로를 정규형으로. 변환기가 붙인 `vals.` 접두는 **여기서 벗긴다** —
 * 그건 값의 출처를 명시한 것이지 경로가 달라진 게 아니다.
 */
export function normPath(expr: string): string {
  return expr.trim().replace(/^vals\./, "").replace(/\s+/g, "")
}

/** CSS 속성 이름을 camelCase로 통일한다 (`border-radius` = `borderRadius`). */
export function normCssProp(prop: string): string {
  const p = prop.trim()
  if (p.startsWith("--")) return p
  return p.replace(/-([a-zA-Z])/g, (_, c: string) => c.toUpperCase())
}

/** style 값의 군더더기 공백만 접는다. 값 자체는 건드리지 않는다. */
export function normCssValue(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/** 문자열에서 `var(--…)` 참조를 순서대로 뽑는다. */
export function collectTokens(s: string, into: string[]): void {
  const re = /var\(\s*(--[A-Za-z0-9-_]+)/g
  for (;;) {
    const m = re.exec(s)
    if (!m) break
    if (m[1]) into.push(m[1])
  }
}

// ── 원본 HTML → IR ─────────────────────────────────────────────────────

/**
 * 파서가 만든 트리에서 IR을 뽑는다.
 *
 * 순서는 **변환기가 JSX를 내는 순서와 같아야** 한다. 지시자의 표현식
 * (`sc-if`의 조건 · `sc-for`의 리스트)이 자식보다 먼저 나오는 것도 그래서다 —
 * JSX에서도 `{cond && (…)}` · `{xs.map(…)}` 순으로 앞에 온다.
 */
/**
 * §21이 **통째로 갈아엎는 구간**을 대조에서 빼기 위한 선언.
 *
 * 도넛을 가로 막대로 바꾼 자리에는 **대조할 원본이 없다.** 그런 구간을 값 단위로
 * 선언하려 하면 스타일·토큰만 백 개가 넘고, 그 목록은 유지되지 않는다. 그래서
 * **구간 단위**로 뺀다 — 원본 쪽은 그 요소의 `style` 원문 한 조각으로 짚고,
 * 출력 쪽은 `data-s21` 표식으로 짚는다 (`irFromTsx`).
 *
 * ★ 게이트가 무뎌지지 않는 이유 ★
 * 빼는 것은 **선언한 구간뿐**이고, 나머지 전 항목은 여전히 1:1로 맞아야 한다.
 * 그리고 짚는 문자열이 원본에서 사라지면(= 선언이 낡으면) 호출부가 그것을 잡는다.
 */
export interface IrSkip {
  /** 이 문자열을 `style` 속성 원문에 포함하는 요소의 **서브트리 전체**를 건너뛴다. */
  readonly styleContains: readonly string[]
}

export function irFromTree(nodes: readonly Node[], skip?: IrSkip): Ir {
  const ir = emptyIr()
  visit(nodes)
  return ir

  /** 이 요소가 §21 교체 구간의 뿌리인가. */
  function isSkipped(n: ElNode): boolean {
    if (!skip || skip.styleContains.length === 0) return false
    const style = n.attrs.find((a) => a.name === "style")
    if (!style?.parts) return false
    const raw = style.parts.map((p) => (p.t === "lit" ? p.text : "")).join("")
    return skip.styleContains.some((s) => raw.includes(s))
  }

  function visit(list: readonly Node[]): void {
    for (const n of list) {
      if (n.k === "comment") continue
      if (n.k === "text") {
        // 홀을 경계로 쪼갠다. JSX에서도 `{expr}` 앞뒤가 별개 텍스트가 되므로
        // 이렇게 해야 양쪽이 같은 모양이 되고, 카피가 **어느 자리에** 있는지까지 지킨다.
        for (const p of n.parts) {
          if (p.t === "hole") {
            if (!isConstantExpr(p.expr)) ir.holes.push(normPath(p.expr))
          } else {
            const t = normText(p.text)
            if (t !== "") ir.texts.push(t)
          }
        }
        continue
      }
      visitElement(n)
    }
  }

  function visitElement(n: ElNode): void {
    // §21 교체 구간이면 이 요소도 자식도 세지 않는다 — 대조할 원본이 없는 자리다
    if (isSkipped(n)) return

    // 지시자의 표현식이 먼저
    if (n.tag === "sc-if") pushAttrHoles(n, "value")
    if (n.tag === "sc-for") pushAttrHoles(n, "list")

    for (const a of n.attrs) {
      if (a.name.startsWith("hint-")) continue // 런타임 전용, 변환기가 버린다
      if (n.tag === "sc-if" && a.name === "value") continue // 위에서 이미 넣었다
      if (n.tag === "sc-for" && (a.name === "list" || a.name === "as")) continue
      // 지시자가 자기 몫으로 쓰는 속성 — 컴포넌트 이름과 모듈 경로는 JSX에서
      // 태그와 import 문이 되므로 props로 남지 않는다
      if (n.tag === "x-import" && (a.name === "component-from-global-scope" || a.name === "from")) {
        continue
      }
      if (a.parts === null) continue

      if (a.name === "class") {
        ir.classes.push(partsToString(a.parts))
      } else if (a.name === "style") {
        for (const d of declarations(a.parts)) ir.styles.push(d)
      }
      if (a.name !== "style") {
        ir.attrs.push(`${normAttrName(a.name)}=${partsToString(a.parts)}`)
      }

      for (const p of a.parts) {
        if (p.t === "hole") {
          if (!isConstantExpr(p.expr)) ir.holes.push(normPath(p.expr))
        } else collectTokens(p.text, ir.tokens)
      }
    }

    visit(n.kids)
  }

  function pushAttrHoles(n: ElNode, attr: string): void {
    const a = n.attrs.find((x) => x.name === attr)
    for (const p of a?.parts ?? []) {
      if (p.t === "hole" && !isConstantExpr(p.expr)) ir.holes.push(normPath(p.expr))
    }
  }

  function textOf(parts: readonly Part[]): string {
    return normText(parts.map((p) => (p.t === "lit" ? p.text : "")).join(""))
  }

  function partsToString(parts: readonly Part[]): string {
    return normText(
      joinParts(parts.map((p) => (p.t === "hole" ? { expr: p.expr } : { lit: p.text }))),
    )
  }

  /** style 문자열을 `prop:value` 목록으로. 변환기와 같은 방식으로 가른다. */
  function declarations(parts: readonly Part[]): string[] {
    const out: string[] = []
    let prop: string | null = null
    let segs: { lit?: string; expr?: string }[] = []
    let depth = 0

    const flush = (): void => {
      const value = normCssValue(joinParts(segs))
      if (prop !== null && value !== "") out.push(`${normCssProp(prop)}:${value}`)
      prop = null
      segs = []
    }

    for (const p of parts) {
      if (p.t === "hole") {
        segs.push({ expr: p.expr })
        continue
      }
      let buf = ""
      for (const ch of p.text) {
        if (ch === "(") depth++
        else if (ch === ")") depth--
        if (ch === ";" && depth === 0) {
          if (buf) segs.push({ lit: buf })
          buf = ""
          flush()
          continue
        }
        if (ch === ":" && depth === 0 && prop === null && segs.length === 0) {
          prop = buf.trim()
          buf = ""
          continue
        }
        buf += ch
      }
      if (buf) segs.push({ lit: buf })
    }
    flush()
    return out
  }
}
