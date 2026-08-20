/**
 * ⌘K 명령 팔레트 — **화면에 적혀 있으면 동작해야 한다** (U-3 · 감사 A-2-3).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 이제야 ★
 * 마크업은 처음부터 통째로 있었다 — 입력칸·목록·빈 상태·`esc` 표시까지.
 * 그런데 `cmdOpen`을 켜는 코드가 0이고 키 리스너도 0이었다. 헤더에는
 * **「⌘K」라고 적혀 있다**(`Template.tsx:96`). 적어 놓고 안 되는 것은
 * 「곧 만들 거니까 자리만」이고, U-3이 금지하는 바로 그것이다.
 *
 * 좁은 화면에서는 이게 **두 번째 통로**이기도 하다. 768px 미만에서 헤더가
 * 접히는데(A-3), 「더보기」와 ⌘K 둘 다 죽어 있으면 되찾을 길이 하나도 없었다.
 *
 * ★ 무엇을 담나 ★ 목업의 placeholder가 «이동 · 가져오기 · SKU 검색…»이라고
 * 약속한다. 그 세 가지를 담는다 — **약속한 것만** 담고, 없는 기능을 여기서
 * 새로 만들지 않는다.
 *
 * ★ 「모름」을 만들지 않는다 ★ 아직 안 만든 화면(`UNBUILT`)은 목록에 넣지 않는다.
 * 넣으면 골라서 갔는데 「준비 중」이 뜬다 — 그건 팔레트가 거짓말한 것이다.
 * ─────────────────────────────────────────────────────────────
 */

import type { TemplateVals } from "./generated/vals.js"
import { NAV, TITLES, UNBUILT, type NavKey } from "./shell.js"
import type { LinkingView } from "@core/linking/view.js"
import type { ProfitRow } from "@core/profit/rows.js"

/** 사이드바가 쓰는 것과 **같은 아이콘**이다 — 같은 곳으로 가는 길이 다르게 보이면 안 된다. */
const ICON: Readonly<Record<NavKey, string>> = {
  dash: "layout-dashboard",
  settlement: "receipt",
  products: "package",
  diag: "target",
  costs: "wallet",
  orders: "shopping-cart",
  connect: "plug",
  import: "file-up",
  sync: "history",
  linking: "link",
  fieldmap: "columns-3",
  myfields: "square-pen",
  design: "git-fork",
  settings: "settings",
}

export interface PaletteItem {
  readonly icon: string
  readonly label: string
  readonly sub: string
  readonly on: string
  readonly run: () => void
}

export interface PaletteActions {
  readonly close: () => void
  /**
   * **마우스로 여는 길.** 사이드바의 「검색 ⌘K」 상자가 `cursor: pointer`로 그려져
   * 있는데 `onClick`이 빈 함수라 눌러도 아무 일이 없었다 (2026-08-20).
   * 「⌘K」라고 적힌 것을 키보드로만 열 수 있으면, 그 상자는 **눌리는 척하는 장식**이다.
   */
  readonly open: () => void
  readonly setQuery: (q: string) => void
  readonly go: (view: NavKey) => void
  readonly goImport: () => void
}

export interface PaletteData {
  /** 상품 검색 재료. 없으면 그 갈래를 아예 안 만든다. */
  readonly products: readonly ProfitRow[]
  /** 리스팅 검색 재료 — 아직 SKU에 안 이어진 것도 찾을 수 있어야 한다. */
  readonly linking: LinkingView | null
}

/** 공백·대소문자를 무시하고 **포함**으로 본다. 초성 검색은 여기서 안 한다. */
const hit = (hay: string, q: string): boolean =>
  hay.toLowerCase().replace(/\s+/g, "").includes(q)

/** 몇 개까지 보일까 — 목록이 길면 팔레트가 화면을 덮는다. 잘랐다는 사실은 말한다. */
const MAX_PER_KIND = 6

export function paletteVals(
  vals: TemplateVals,
  open: boolean,
  query: string,
  data: PaletteData,
  actions: PaletteActions,
): void {
  vals.cmdOpen = open
  vals.cmdQuery = query
  vals.closeCmd = actions.close
  vals.openCmd = actions.open
  vals.onCmdInput = (e: { target: { value: string } }) => actions.setQuery(e.target.value)
  /**
   * `esc`로 닫는다 — 팝오버 안에 «esc»라고 적혀 있다. 적힌 것은 동작해야 한다.
   * ⌘K로 여는 것은 **문서 전역** 리스너의 몫이라 여기 없다(`App.tsx`).
   */
  vals.onCmdKey = (e: { key: string }) => {
    if (e.key === "Escape") actions.close()
  }

  const q = query.trim().toLowerCase().replace(/\s+/g, "")
  const items: PaletteItem[] = []

  // ① 화면 이동. 만들지 않은 화면은 넣지 않는다 — 골라서 갔는데 「준비 중」이면 거짓말이다.
  for (const key of NAV) {
    if (UNBUILT.includes(key)) continue
    const [title, sub] = TITLES[key]
    if (q !== "" && !hit(title, q) && !hit(key, q)) continue
    items.push({
      icon: ICON[key],
      label: title,
      // 부제는 «Order · OrderItem»처럼 내부 어휘라 그대로 보이면 U-5에 걸린다.
      // 여기서는 «이동»이라는 **행위**를 말한다.
      sub: "이동",
      on: "",
      run: () => {
        actions.close()
        actions.go(key)
      },
    })
    void sub
  }

  // ② 가져오기 — placeholder가 약속한 둘째 갈래. 「이동」과 뜻이 달라 따로 세운다.
  if (q === "" || hit("가져오기", q) || hit("import", q)) {
    items.push({
      icon: "file-up",
      label: "파일 가져오기",
      sub: "실행",
      on: "",
      run: () => {
        actions.close()
        actions.goImport()
      },
    })
  }

  /**
   * ③ SKU 검색 — **글자를 넣었을 때만** 낸다.
   *
   * 빈 질의에 상품을 쏟으면 팔레트가 「상품 목록」이 되고, 정작 화면 이동이
   * 아래로 밀려난다. 목업의 목록은 스크롤이 없다.
   */
  if (q !== "") {
    const seen = new Set<string>()
    for (const p of data.products) {
      if (items.length > 40) break
      if (!hit(p.name, q) && !hit(p.code, q)) continue
      if (seen.has(p.code)) continue
      seen.add(p.code)
      if (seen.size > MAX_PER_KIND) break
      items.push({
        icon: "package",
        label: p.name === "" ? p.code : p.name,
        sub: `${p.code} · 상품`,
        on: "",
        run: () => {
          actions.close()
          actions.go("products")
        },
      })
    }
    /**
     * 아직 SKU에 안 이어진 리스팅도 찾힌다. 사용자가 찾는 이름이 **거기에만**
     * 있는 경우가 흔하다 — 연결 전에는 상품 목록에 없기 때문이다.
     */
    // `todo` = 아직 안 이은 카드. `done`은 위 상품 검색이 이미 덮는다.
    const todo = data.linking?.todo ?? []
    let n = 0
    for (const l of todo) {
      if (n >= MAX_PER_KIND) break
      if (!hit(l.title, q)) continue
      n++
      items.push({
        icon: "link",
        label: l.title,
        sub: "연결 대기",
        on: "",
        run: () => {
          actions.close()
          actions.go("linking")
        },
      })
    }
  }

  vals.cmdItems = items
  /**
   * ★ 「결과 없음」은 **찾아봤을 때만** 뜬다 ★
   * 빈 질의에 목록이 비는 일은 없지만(화면 이동이 늘 있다), 조건을 `items`로만
   * 쓰면 논리가 화면에 종속된다. 「질의가 있는데 없다」가 이 문장의 뜻이다.
   */
  vals.cmdEmpty = q !== "" && items.length === 0
}
