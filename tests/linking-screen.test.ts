/**
 * 상품 연결 화면 (§21-6) — **완료 기준 a: 엔진 분류와 화면 표시가 1:1이다.**
 *
 * `linking-view.test.ts`가 조회를 지킨다면 이 파일은 **그 값이 HTML에 그대로 나오는지**를
 * 본다. 둘 사이에서 숫자가 갈리면 화면이 다시 세고 있는 것이고, 그게 목업 배지가
 * 어긋났던 경로다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 실데이터를 쓰되 원본을 건드리지 않는다 ★
 * 이 파일은 **쓰기**를 한다(SKU 등록). `.tmp/pnl.sqlite`를 직접 열면 다음 테스트가
 * 보는 세계가 달라지므로 복사본에서 돈다. 그래도 실데이터인 이유는, 콜드스타트
 * 61장과 등록 후 34장이 **합성 데이터로는 나오지 않는 숫자**이기 때문이다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it, beforeAll } from "vitest"
import { existsSync, rmSync } from "node:fs"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { Repository } from "../src/core/store/repository.js"
import { loadLinkingView, type LinkingView } from "../src/core/linking/view.js"
import { krLinkingMatcher as M } from "../src/packs/kr-marketplace/linking-matcher.js"
import { linkingVals, type LinkTab } from "../src/app/linking.js"
import { Template } from "../src/app/generated/Template.js"
import { shellVals, shellStateFor } from "../src/app/shell.js"

const SRC = ".tmp/pnl.sqlite"
const DB = ".tmp/linking-screen.sqlite"
const LIB = "lib-1"
const NOW = "2026-08-13T10:00:00"

const ready = existsSync(SRC)
const run = ready ? describe : describe.skip

if (!ready) {
  console.warn(`[linking-screen] ${SRC}가 없어 건너뛴다 — npx tsx tools/harness/pnl.ts 로 만든다`)
}

function render(view: LinkingView, tab: LinkTab = "todo", picked = new Set<string>()): string {
  const noop = (): void => {}
  const vals = shellVals(shellStateFor(false), {
    go: noop, toggleNav: noop, closeNav: noop, openNav: noop, goImport: noop, toggleTheme: noop,
  } as never)
  linkingVals(vals, view, tab, picked)
  vals.firstRun = false
  vals.notFirstRun = true
  vals.v.linking = true
  return renderToString(createElement(Template, { vals }))
}

const count = (h: string, s: string): number => h.split(s).length - 1

run("상품 연결 — 엔진 분류가 화면에 1:1로 온다 (완료 기준 a)", () => {
  let db: Driver
  let repo: Repository

  /**
   * ★ `copyFileSync`가 아니라 `VACUUM INTO`다 — 첫 판이 그것 때문에 깨졌다 ★
   *
   * 파일 복사는 **SQLite의 잠금을 통째로 무시한다.** vitest가 테스트 파일을 병렬로
   * 돌리므로 다른 파일이 `pnl.sqlite`를 열고 있는 순간에 복사하면 찢어진 스냅샷이
   * 나온다 — 실제로 리스팅 86개 중 39개만 담긴 사본이 만들어졌고, 같은 순간
   * `settlement-rows`도 원본에서 SQLITE 오류를 봤다.
   *
   * `VACUUM INTO`는 SQLite 자신이 만드는 일관된 사본이라 동시 독자와 안전하게
   * 공존한다. 값이 이상하면 도구부터 의심한다는 규칙(작업 리듬 8)이 여기서도 맞았다 —
   * 39는 «조회가 틀렸다»가 아니라 «내가 만든 DB가 반쪽이다»였다.
   */
  beforeAll(async () => {
    rmSync(DB, { force: true })
    const src = openNodeDriver(SRC, { pragmas: false })
    try {
      await src.prepare(`VACUUM INTO ?`).run(DB)
    } finally {
      await src.close()
    }
    db = openNodeDriver(DB, { pragmas: false })
    repo = new Repository(db)
  })

  it("콜드스타트 — 리스팅 86개가 카드 61장으로 접힌다", async () => {
    const v = await loadLinkingView(db, LIB, M)
    expect(v.listingCounts.todo, "원자료").toBe(86)
    expect(v.counts.todo, "일의 단위는 카드다").toBe(61)

    const html = render(v)
    // 탭 배지는 **카드 수**다. 조회가 센 것을 화면이 다시 세지 않는다
    expect(html, "탭 배지가 카드 수가 아니다").toContain(">61<")
    // 카드마다 [새 SKU로 등록]이 하나씩 — §21-6 ②의 «후보 없을 때의 기본 액션»
    expect(count(html, "새 SKU로 등록"), "카드 수와 액션 수가 다르다").toBe(61)
  })

  it("군집 카드가 접은 만큼만 머리를 단다 — 18장 · 클릭 25회 절약", async () => {
    const v = await loadLinkingView(db, LIB, M)
    const folded = v.todo.filter((c) => c.listings.length > 1)
    expect(folded.length).toBe(18)
    expect(v.listingCounts.todo - v.counts.todo, "군집이 줄인 클릭").toBe(25)

    const html = render(v)
    expect(count(html, "같은 상품으로 보이는"), "접힌 카드만 머리를 단다").toBe(18)
    expect(count(html, 'data-s21="link-cluster"'), "군집 블록 수").toBe(18)
  })

  /**
   * ★ 접힌 카드는 전부 단일 채널이다 — 설계의 증거지 우연이 아니다 ★
   * 상품부 완전 일치는 채널을 넘지 못한다(제목이 채널마다 다르게 붙는다). 채널 간
   * N:1은 **접기가 아니라 제안**에서 일어나고, 그래서 접기가 결정론적일 수 있다
   * (작업 리듬 12). 이게 깨지는 날 접기 기준을 다시 봐야 한다.
   */
  it("접기는 채널을 넘지 않는다", async () => {
    const v = await loadLinkingView(db, LIB, M)
    for (const c of v.todo) {
      expect(new Set(c.listings.map((l) => l.channel)).size, `«${c.title}»가 채널을 넘어 접혔다`).toBe(1)
    }
  })

  it("SKU가 0이면 제안도 0 — 빈 «추천 SKU» 머리글을 그리지 않는다", async () => {
    const v = await loadLinkingView(db, LIB, M)
    expect(v.todo.every((c) => c.suggestionKind === "none")).toBe(true)

    const html = render(v)
    // 목업은 이 머리글을 `linkTabTodo`만으로 그려서 61장 전부가 빈 머리글을 이고 섰다.
    // 존재 조건을 데이터에 묶었다 — 결함 47과 같은 처방
    expect(count(html, "추천 SKU"), "후보가 없는데 머리글이 떴다").toBe(0)
    expect(html, "일괄 진입이 없다").toContain("각각 SKU가 됩니다")
  })

  /**
   * ★ 여기가 완료 기준 a의 본체다 ★
   *
   * 11번가 군집 27개를 SKU로 등록하면 ESM 42개가 그 27개를 상대로 등급을 받는다.
   *
   * ─────────────────────────────────────────────────────────────
   * ★ 문서의 예측(clear 6 · contested 17 · none 19)과 다르다 — 둘 다 맞다 ★
   *
   * `listing-match-dist.ts`는 **ESM 리스팅 42개**를 하나씩 채점했고, 화면은
   * **카드 34장**을 채점한다. ESM 안에도 제목이 같은 중복이 8쌍 있어 42 → 34로 접히기
   * 때문이다. 즉 예측은 «리스팅 단위», 화면은 «카드 단위»다.
   *
   * 탭 배지에서 한 번 겪은 그 구분(카드 수 vs 리스팅 수)이 **등급에서 되풀이된 것**이다.
   * 사람이 누를 버튼이 카드마다 하나이므로 화면의 단위는 카드가 맞다.
   * ─────────────────────────────────────────────────────────────
   */
  it("등록 후 등급이 화면 표시와 같다 — clear 4 · contested 13 · none 17", async () => {
    const v0 = await loadLinkingView(db, LIB, M)
    const clusters = v0.todo.filter((c) => c.listings.every((l) => l.grain === "option"))
    expect(clusters.length, "11번가 옵션 군집").toBe(27)
    for (const c of clusters) {
      await repo.createSkuForListings(LIB, c.listings.map((l) => l.id), c.title, NOW)
    }

    const v = await loadLinkingView(db, LIB, M)
    expect(v.counts.done, "등록한 만큼 done으로 간다").toBe(27)
    expect(v.counts.todo, "남는 것은 ESM 42개가 접힌 34장").toBe(34)

    const tally = { clear: 0, contested: 0, none: 0 }
    for (const c of v.todo) tally[c.suggestionKind]++
    expect(tally).toEqual({ clear: 4, contested: 13, none: 17 })

    const html = render(v)
    // 후보를 가진 카드 = clear + contested. 화면의 «추천 SKU» 블록 수와 같아야 한다
    expect(count(html, "추천 SKU"), "후보 있는 카드 수와 추천 블록 수가 다르다").toBe(
      tally.clear + tally.contested,
    )
    // 후보가 없는 카드는 [새 SKU로 등록]만 남는다 — 그래도 액션은 카드마다 있다
    expect(count(html, "새 SKU로 등록")).toBe(34)
  })

  /** ★ §21-6 ③ — 근거는 툴팁 뒤가 아니라 행 안에 있다 ★ */
  it("후보마다 겹친 토큰이 인라인으로 뜬다", async () => {
    const v = await loadLinkingView(db, LIB, M)
    const withCands = v.todo.filter((c) => c.candidates.length > 0)
    const total = withCands.reduce((a, c) => a + c.candidates.length, 0)
    expect(total, "후보가 있어야 시험이 성립한다").toBeGreaterThan(0)

    const html = render(v)
    expect(count(html, "겹침:"), "후보 수만큼 근거 줄이 있어야 한다").toBe(total)

    // 근거가 실제 토큰이지 «있음/없음» 같은 빈말이 아니다
    const top = withCands[0]!.candidates[0]!
    expect(top.shared.length, "근거가 비면 §21-1 위반이다").toBeGreaterThanOrEqual(2)
    expect(html).toContain(`겹침: ${top.shared.join(", ")}`)
  })

  /** ★ 등급이 색을 정한다 — 점수와 색이 갈릴 경로 자체를 없앴다 ★ */
  it("clear는 초록 · contested는 노랑 — 목업의 0.6/0.35 상수를 쓰지 않는다", async () => {
    const v = await loadLinkingView(db, LIB, M)
    const clear = v.todo.find((c) => c.suggestionKind === "clear")!
    const cont = v.todo.find((c) => c.suggestionKind === "contested")!
    expect(clear.candidates).toHaveLength(1)
    // contested는 **미리 고르지 않는다** — 애매한 것을 골라주면 확정이 통과의례가 된다
    expect(cont.candidates.length).toBeGreaterThan(1)

    const html = render(v)
    expect(html, "clear 후보가 초록이 아니다").toContain("var(--pnl-pos)")
    expect(html, "contested 후보가 노랑이 아니다").toContain("var(--pnl-warn)")
  })

  it("done 탭 카피가 ADR-012가 보증하는 것만 말한다 (결함 48)", async () => {
    const v = await loadLinkingView(db, LIB, M)
    expect(v.counts.done, "등록한 27장이 done에 있다").toBe(27)

    const html = render(v, "done")
    expect(html).toContain("같은 리스팅이 다시 오면 이 연결이 유지됩니다")
    expect(html, "약속하지 않은 자동 연결").not.toContain("자동으로 붙습니다")
    expect(html, 'LOCK 10 — "동기화"').not.toContain("동기화")
    // done 카드는 **목적지(SKU)로 묶인다.** 11번가 옵션 3개가 한 SKU면 한 장이다
    expect(count(html, "연결 해제"), "done 카드 수").toBe(27)
  })

  it("무시한 것은 사라지지 않고 자기 탭으로 간다", async () => {
    const v0 = await loadLinkingView(db, LIB, M)
    const target = v0.todo[0]!
    await repo.ignoreListings(target.listings.map((l) => l.id), NOW)

    const v = await loadLinkingView(db, LIB, M)
    expect(v.counts.ignored).toBe(1)
    expect(v.counts.todo, "todo에서 빠진다").toBe(33)

    const html = render(v, "skip")
    expect(html, "되돌릴 길이 없다").toContain("되돌리기")
    expect(html).toContain(target.title)
  })
})
