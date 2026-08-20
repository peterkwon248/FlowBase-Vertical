/**
 * 사용자 불변식 — [docs/사용자-불변식.md](../docs/사용자-불변식.md)의 집행자.
 *
 * ★ 왜 이 파일이 있나 ★
 *
 * 2026-08-20 감사의 진단은 「문서끼리 모순」이 아니라 **「집행 없는 선언」**이었다.
 * 기계가 지키는 약속(LOCK 10 금지어·배선 래칫·보존 게이트)은 안 썩었고, 산문으로만
 * 있는 약속은 전부 썩었다. 그래서 처방도 산문이면 안 된다.
 *
 * LOCK 1~10을 세면 거의 전부 엔지니어링을 향한다 — 사용자를 향한 것은 6·8 둘뿐이다.
 * 「넣은 파일은 전부 장부에 보인다」 같은 **사용자 쪽 불변식이 애초에 목록에 없어서**
 * 새 저장 경로(ADR-016)가 들어올 때 아무도 그 질문을 던지지 않았다.
 *
 * ★ 래칫이 이 파일의 핵심 장치다 ★
 *
 * 오늘 못 지키는 자리를 **0으로 위장하지 않고 세어서 상한으로 박는다.** 상한은
 * 내려갈 수만 있고, 새 위반은 즉시 붉어진다. 「0으로 만들고 시작」은 오늘 스무 자리를
 * 한 커밋에 고치라는 뜻이라 검토가 불가능해진다 — `TODO_MAX = 0`이 배선에서 한 일과
 * 같은 발상이고, **빨간 게이트는 곧 꺼지지만 래칫은 안 꺼진다.**
 */

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

/**
 * ★ 주석을 벗긴다 ★
 *
 * 이 시험을 처음 쓴 날 **내가 단 주석이 내 게이트를 통과시켰다** — 침묵하는 분기
 * 바로 위에 «`sayConfirm`으로 말하는데 원가만…»이라는 설명이 있었고, 소스를 문자로
 * 훑는 검사가 그 낱말을 «말하고 있다»로 읽었다. 가드를 일부러 부러뜨려 보고서야 알았다.
 *
 * `core-env-neutral.test.ts`가 마켓 금지어를 검사할 때 주석을 빼는 것과 같은 이유다 —
 * **소스를 문자로 보는 게이트는 반드시 주석을 먼저 벗긴다.**
 */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")

const APP = stripComments(readFileSync("src/app/App.tsx", "utf8"))
const TEMPLATE = readFileSync("src/app/generated/Template.tsx", "utf8")
const DATA = readFileSync("src/app/data.ts", "utf8")
const THEME = readFileSync("src/app/styles/flowbase-theme.css", "utf8")
const WIRING = readFileSync("tools/harness/wiring.ts", "utf8")

/** 배선 파일 전부 — 핸들러가 어디서 채워지든 잡는다. */
const WIRED = ["App.tsx", "shell.ts", "history.ts", "import.ts", "dashboard.ts", "settlement.ts",
  "order.ts", "product.ts", "costs.ts", "channel.ts", "linking.ts", "fieldmap.ts", "period.ts"]
  .map((f) => stripComments(readFileSync(`src/app/${f}`, "utf8"))).join("\n")

// ─────────────────────────────────────────────────────────────
// U-2. 사용자의 쓰기는 결과를 말한다 — 성공이든 실패든
// ─────────────────────────────────────────────────────────────

describe("U-2. 쓰기는 결과를 말한다", () => {
  /**
   * ★ 이 시험이 잡았을 실제 사고 ★
   * 2026-08-20까지 원가 저장만 `console.warn` 하나로 끝났다. 다른 쓰기 일곱 곳은
   * 전부 모달로 말하는데 원가만 예외였고, 초안이 남아 있어 사용자는 «저장됐나»를
   * 구별할 수 없었다. 저장소가 300줄 위에 «console.warn 하나로 넘긴 것이 그 사고였다»
   * 라고 적어 놓고 그 아래에서 같은 모양을 남겼다.
   */
  it("★ 쓰기 실패 분기가 하나도 침묵하지 않는다 ★", () => {
    // ★ 창을 «N자 앞»으로 잡으면 안 된다 ★ 2026-08-20에 이 시험을 처음 썼을 때
    // 300자 창을 썼는데, 분기 **바깥**의 `setConfirm`이 창에 들어와 침묵을 통과시켰다.
    // 가드를 일부러 부러뜨려 보고서야 알았다. 그래서 **그 분기가 끝나는 곳까지**만 본다.
    const silent: string[] = []
    for (const m of APP.matchAll(/if \(r\.error\)/g)) {
      const rest = APP.slice(m.index)
      const end = rest.indexOf("return")
      const branch = end === -1 ? rest.slice(0, 200) : rest.slice(0, end)
      const speaks = /sayConfirm|setConfirm|stop\(|setWiz/.test(branch)
      if (!speaks) silent.push(`L${APP.slice(0, m.index).split("\n").length}`)
    }
    expect(silent, "쓰기 실패를 사용자에게 안 말하는 자리").toEqual([])
  })

  it("`console.warn`으로만 끝나는 실패 분기를 센다 — 줄어들기만 한다", () => {
    /**
     * `data.ts`가 개인 프로파일의 결함을 **세어 놓고** `console.warn`으로 끝낸다.
     * 리포지토리 주석이 «조용히 버리면 사용자의 확정이 소리 없이 사라진다»고 적어
     * 뒀는데, 센 수가 화면까지 오지 않는다. 「센다」와 「말한다」 사이가 끊긴 자리다.
     */
    const WARN_MAX = 3
    const warns = [...DATA.matchAll(/console\.warn/g)].length
    expect(warns, `console.warn ${warns}곳 (상한 ${WARN_MAX})`).toBeLessThanOrEqual(WARN_MAX)
    // 상한이 낡지 않았는지 — 다 고쳤으면 상한을 내리라고 말한다
    expect(WARN_MAX - warns, "상한이 실측보다 3 이상 높다 — 내려라").toBeLessThan(3)
  })
})

// ─────────────────────────────────────────────────────────────
// U-3. 못 누르는 것은 그리지 않는다
// ─────────────────────────────────────────────────────────────

/** `onClick={vals.X}` · `onClick={vals.X.open}`에서 X를 뽑는다. */
function clickHandlers(): string[] {
  const keys = new Set<string>()
  // 식별자를 `[A-Za-z0-9_]`로 좁히면 그 밖의 이름이 통째로 안 잡힌다 —
  // 가드 자해 시험에서 실제로 새어 나갔다 (2026-08-20).
  for (const m of TEMPLATE.matchAll(/onClick=\{vals\.([^\s}.[]+)/g)) keys.add(m[1]!)
  return [...keys].sort()
}

/** 배선 파일 어디에서든 그 키가 채워지는가. */
const isWired = (k: string): boolean =>
  new RegExp(`vals\\.${k}\\s*=|\\b${k}:\\s`, "").test(WIRED)

/** `wiring.ts`의 CUTS에 선언됐는가 — 「안 만들기로 했다」는 정직한 상태다. */
const isDeclaredCut = (k: string): boolean => {
  for (const m of WIRING.matchAll(/fields:\s*(\/\^\([^\n]*?\)\/)/g)) {
    try {
      const re = new RegExp(m[1]!.slice(1, m[1]!.lastIndexOf("/")))
      if (re.test(k)) return true
    } catch {
      /* 정규식을 못 읽으면 선언으로 안 친다 — 관대하게 넘어가면 게이트가 헐거워진다 */
    }
  }
  return false
}

describe("U-3. 못 누르는 것은 그리지 않는다", () => {
  /**
   * ★ 래칫 ★ 오늘 화면에 그려져 있는데 배선도 없고 선언도 없는 핸들러의 수다.
   * 이 수는 **줄어들기만 한다.** 새 죽은 버튼을 그리면 즉시 붉어진다.
   *
   * 선언(`wiring.ts`의 CUTS)은 면제가 아니라 **정직**이다 — 「안 만들기로 했다」와
   * 「만들다 말았다」를 가르는 것이 이 게이트의 요점이다. 다만 선언된 것도 화면에
   * 버튼이 그려져 있으면 사용자는 여전히 고장으로 읽는다 → `docs/사용자-불변식.md` U-3.
   */
  const UNDECLARED_MAX = 0

  it("★ 선언되지 않은 죽은 버튼이 없다 ★", () => {
    const dead = clickHandlers().filter((k) => !isWired(k) && !isDeclaredCut(k))
    expect(dead, "배선도 선언도 없이 그려진 핸들러").toEqual([])
    expect(dead.length).toBeLessThanOrEqual(UNDECLARED_MAX)
  })

  it("시험이 헛돌지 않는다 — 실제로 핸들러를 세고 있다", () => {
    const all = clickHandlers()
    expect(all.length, "onClick 핸들러를 하나도 못 찾았다면 정규식이 죽은 것이다")
      .toBeGreaterThan(20)
    expect(all.filter(isWired).length, "배선된 것이 하나도 없을 리 없다").toBeGreaterThan(5)
  })

  /**
   * ⌘K는 **화면에 적혀 있다**(`Template.tsx`의 헤더 힌트). 적혀 있으면 동작해야
   * 한다 — 광고된 단축키가 무반응인 것은 「아직 안 만든 기능」이 아니라 **거짓말**이다.
   * 그래서 이 자리는 CUTS 선언으로 면제되지 않는다.
   */
  it("⌘K — 화면에 적힌 단축키는 배선되거나, 적히지 않거나", () => {
    const advertised = /⌘K/.test(TEMPLATE)
    const wired = isWired("openCmd") || /addEventListener\(\s*["']keydown/.test(WIRED)
    // 오늘은 적혀 있는데 안 돈다. 그 사실을 붙들어 둔다 — 고치면 이 시험을 뒤집는다.
    expect(advertised && !wired, "⌘K가 적혀 있는데 배선이 없다 (2026-08-20 감사 A-2-3)")
      .toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────
// U-4. 화면이 좁아져도 기능은 사라지지 않는다 — 접힌다
// ─────────────────────────────────────────────────────────────

describe("U-4. 좁아져도 안 사라진다", () => {
  /**
   * §21-3: «어떤 브레이크포인트에서도 기능 제거 ❌ — 접는다».
   *
   * 실측: `flowbase-theme.css`가 768px 미만에서 `.fb-head-actions`의 자식을 전부
   * 지운다. 그 안에 **기간 선택기**(살아 있는 유일한 헤더 컨트롤)가 있고, 되찾는
   * 통로인 「더보기」는 배선이 없다. ⌘K도 죽어 있어 우회로도 없다.
   * → 좁은 화면에서 **보는 달을 바꿀 방법이 없다.**
   */
  it("헤더를 감추면 되찾는 통로가 있어야 한다", () => {
    const hides = /\.fb-head-actions\s*>\s*\*:not\(\.fb-head-more\)\s*\{\s*display:\s*none/.test(THEME)
    if (!hides) return // 감추지 않으면 이 불변식은 애초에 안 걸린다
    const escapeWired = isWired("toggleHeadMore") && isWired("headMoreItems")
    // 오늘 미이행. 고치면 이 단언을 뒤집는다 — 그때가 U-4가 ✅가 되는 날이다
    expect(escapeWired, "「더보기」 배선이 생겼다 — docs/사용자-불변식.md U-4를 ✅로 올려라")
      .toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// U-5. 저장 분류는 화면의 언어가 아니다
// ─────────────────────────────────────────────────────────────

describe("U-5. 저장 분류 ≠ 화면 언어", () => {
  /**
   * 사용자가 아는 것은 「파일」·「상품」·「7월」이다. `batch`·`fact_order`·`pending_cost`
   * 같은 내부 분류가 화면 문장에 나오면 그건 설명이 아니라 변명이다 (헌장 C-4).
   *
   * ※ `batch_id`는 예외다 — 가져오기 기록의 안내문이 **개념을 가르치려고** 일부러
   *   쓴다(«각 실행에 batch_id가 붙어서, 잘못 올린 파일 하나만 골라 되돌릴 수 있습니다»).
   *   가르치는 것과 새는 것은 다르다.
   */
  const LEAK = ["fact_order", "fact_settlement", "fact_claim", "fact_ad_spend",
    "pending_cost", "cost_history", "marketplace_listing", "collection_active"]

  it("★ 내부 표 이름이 화면 문장에 안 나온다 ★", () => {
    const leaked = LEAK.filter((t) => TEMPLATE.includes(t))
    expect(leaked, "내부 표 이름이 화면에 새어 나왔다").toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────
// U-6. 숫자는 어디서 왔는지 말할 수 있다
// ─────────────────────────────────────────────────────────────

describe("U-6. 숫자는 근거를 말한다", () => {
  /**
   * §21-2가 L1/L2/L3를 규약으로 세웠고 §21-5가 «derived 값은 근거 경로 없이
   * 렌더되지 않는다»고 못박았다. 오늘 **전 화면에서 거짓**이다.
   *
   * 다만 개념-지도가 적었던 「코드에 한 줄도 없다」는 과소 서술이었다 — 마크업(`detail-side`)
   * 과 타입(`vals.detail`)은 **전부 있고 배선만 0**이다. 「짓기」가 아니라 「잇기」다.
   */
  it("L2 패널의 마크업·타입은 있다 — 없는 것은 배선뿐이다", () => {
    expect(TEMPLATE, "detail-side 마크업이 사라졌다").toContain("detail-side")
    expect(TEMPLATE).toContain("vals.hasDetail")
  })

  it("표 행에서 근거로 내려가는 자리를 센다 — 늘어나기만 한다", () => {
    /**
     * 오늘 `click: () => {}`인 표가 다섯이다(대시보드 상품별·채널별·주문·정산·상품).
     * 이 수는 **줄어들기만 한다** — 하나를 이으면 상한도 함께 내린다.
     */
    const DEAD_ROW_CLICK_MAX = 5
    const dead = [...WIRED.matchAll(/click:\s*\(\)\s*=>\s*\{\s*\}/g)].length
    expect(dead, `근거로 못 내려가는 표 ${dead}곳 (상한 ${DEAD_ROW_CLICK_MAX})`)
      .toBeLessThanOrEqual(DEAD_ROW_CLICK_MAX)
    expect(DEAD_ROW_CLICK_MAX - dead, "상한이 낡았다 — 내려라").toBeLessThan(3)
  })
})

// ─────────────────────────────────────────────────────────────
// 깨끗할 때 못박는 것 — 지금 0이라 무비용이다
// ─────────────────────────────────────────────────────────────

describe("지금 0이라 못박는다", () => {
  /**
   * 헌장 E-5(localStorage 통짜 저장 금지)·A-1(로컬퍼스트). 오늘 0회다.
   * **깨끗할 때 박아 두면 첫 위반이 즉시 잡힌다** — 나중에 세면 이미 늦다.
   */
  it("localStorage · sessionStorage를 쓰지 않는다 (헌장 E-5)", () => {
    expect(WIRED).not.toMatch(/\blocalStorage\b/)
    expect(WIRED).not.toMatch(/\bsessionStorage\b/)
  })

  /**
   * 헌장 C-6 «Fact 화면 드래그 영구 금지». 오늘 0건이라 무비용이고,
   * 칸반이나 열 재정렬을 붙이는 날 자동으로 걸린다.
   */
  it("Fact 화면에 드래그 어포던스가 없다 (헌장 C-6)", () => {
    expect(TEMPLATE).not.toMatch(/\bdraggable\b/)
    expect(WIRED).not.toMatch(/onDragStart|dataTransfer/)
  })
})
