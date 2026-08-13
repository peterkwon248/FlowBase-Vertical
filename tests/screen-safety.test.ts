/**
 * ★ 내부 키는 화면에 나오지 않는다 (헌장 C-4) — **화면 전체를 한 곳에서 지킨다** ★
 *
 * `connection_id`·`batch_id`·`source_key`·`listing_key`는 우리 안에서만 뜻을 갖는
 * 값이다. 사용자에게 `conn-11st`나 `batch-esm`이 보이면 그건 우리가 이름을 안 붙였다는
 * 뜻이지 사용자가 알아야 할 사실이 아니다. 채널 이름의 출처는 프로파일이 선언한
 * `displayName`이고 `connection.display_name`에 산다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 화면별이 아니라 공용인가 — 이 파일의 존재 이유다 ★
 *
 * 처음엔 `order-rows.test.ts` 안에 있었다. 정산과 주문 둘을 한 번에 지키려고 묶은
 * 것인데, 이유는 **다음 화면에서도 같은 실수가 나오기 때문**이었다. 실제로 났다 —
 * 상품 연결의 `listing_key`는 U+0001로 이어 붙인 합성 키(ADR-006)라, 목업이 그리던
 * `{r.key}`를 그대로 두면 **보이지 않는 제어문자**가 HTML에 섞여 나갔다.
 *
 * 화면이 늘 때마다 공용 검사가 자동으로 따라붙는 것이 목적이므로, 파일 이름이
 * `order-rows`에 묶여 있는 것이 오히려 그 목적을 가렸다. 내용은 한 곳 그대로 두고
 * 이름만 옮겼다 — **새 화면은 아래 `VIEWS`에 한 줄을 더한다. 새 파일을 만들지 않는다.**
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { loadOrderRows } from "../src/core/order/rows.js"
import { loadSettlementRows } from "../src/core/settlement/rows.js"
import { loadLinkingView } from "../src/core/linking/view.js"
import { KEY_SEP } from "../src/core/import/mapping/listing.js"
import { krLinkingMatcher } from "../src/packs/kr-marketplace/linking-matcher.js"
import type { Period } from "../src/core/profit/index.js"
import { orderVals } from "../src/app/order.js"
import { settlementVals } from "../src/app/settlement.js"
import { linkingVals } from "../src/app/linking.js"
import { Template } from "../src/app/generated/Template.js"
import { shellVals, shellStateFor } from "../src/app/shell.js"

const DB = ".tmp/pnl.sqlite"
const PERIOD: Period = { from: "2026-07-01", to: "2026-07-31" }
const LIB = "lib-1"

const ready = existsSync(DB)
const run = ready ? describe : describe.skip

if (!ready) {
  console.warn(`[screen-safety] ${DB}가 없어 건너뛴다 — npx tsx tools/harness/pnl.ts 로 만든다`)
}

function emptyActions() {
  const noop = (): void => {}
  return { go: noop, toggleNav: noop, closeNav: noop, openNav: noop, goImport: noop, toggleTheme: noop }
}

/**
 * 화면에 절대 나오면 안 되는 문자열.
 *
 * `KEY_SEP`(U+0001)은 **소스에서 보이지 않는다.** 리터럴로 적지 않고 상수에서
 * 가져오는 이유가 그것이다 — 눈으로 검토할 수 없는 문자를 손으로 적으면, 언젠가
 * 누가 «이 빈 문자열 뭐지» 하고 지운다.
 */
const LEAKS: readonly [string, string][] = [
  ["conn-", "연결 id"],
  ["batch-", "batch id"],
  ["lst-", "리스팅 id"],
  ["sku-lib", "SKU id (사용자가 보는 것은 SKU-0001 코드다)"],
  ["prd-lib", "상품 id"],
  ["source_key", "컬럼명"],
  ["listing_key", "컬럼명"],
  ["connection_id", "컬럼명"],
  ["library_id", "컬럼명"],
  [KEY_SEP, "★ 합성 키 구분자 (ADR-006) — 보이지 않으므로 눈으로는 못 잡는다"],
]

// 상수가 정말 그 문자인지 **먼저** 확인한다. 빈 문자열이 들어오면 `includes("")`가
// 늘 참이라 검사가 통째로 뒤집힌다 — 보이지 않는 값을 검사할 때는 검사 대상부터
// 검사한다 (작업 리듬 8 — 틀린 실측은 틀린 추정보다 위험하다).
if (KEY_SEP.length !== 1 || KEY_SEP.codePointAt(0) !== 1) {
  throw new Error(`KEY_SEP이 U+0001이 아니다: ${JSON.stringify(KEY_SEP)}`)
}

run("내부 키가 화면에 새지 않는다 (헌장 C-4)", () => {
  it("배선된 전 화면 어디에도 내부 키가 없다", async () => {
    const db = openNodeDriver(DB, { pragmas: false })
    const settlement = await loadSettlementRows(db, LIB, PERIOD)
    const orders = await loadOrderRows(db, LIB, PERIOD)
    const linking = await loadLinkingView(db, LIB, krLinkingMatcher)
    await db.close()

    // 화면마다 나오는 채널이 다르다 — 정산은 11번가, 주문은 ESM에서 왔다.
    // 그 자체가 "연결 3개가 섞여 있다"는 단서의 다른 표현이다.
    const VIEWS = [
      {
        key: "settlement",
        channel: "11번가",
        wire: (v: never) => settlementVals(v, settlement, PERIOD),
      },
      { key: "orders", channel: "ESM", wire: (v: never) => orderVals(v, orders, PERIOD) },
      {
        key: "linking",
        channel: "11번가",
        wire: (v: never) => linkingVals(v, linking, "todo", new Set()),
      },
    ] as const

    for (const view of VIEWS) {
      const vals = shellVals(shellStateFor(false), emptyActions() as never)
      view.wire(vals as never)
      vals.firstRun = false
      vals.notFirstRun = true
      ;(vals.v as Record<string, boolean>)[view.key] = true

      const html = renderToString(createElement(Template, { vals }))
      for (const [leak, what] of LEAKS) {
        expect(
          html.includes(leak),
          `${view.key} 화면에 ${what}(${JSON.stringify(leak)})가 보인다`,
        ).toBe(false)
      }
      expect(html, `${view.key} 화면에 채널 이름이 없다`).toContain(view.channel)
    }
  })

  /**
   * ★ 가드를 부러뜨려 확인한다 (작업 리듬 3) ★
   *
   * U+0001 검사는 **눈으로 통과 여부를 알 수 없는** 유일한 항목이다. 다른 것들은
   * `conn-`처럼 읽히기라도 하지만 이건 렌더 결과를 봐도 보이지 않는다. 그래서
   * "안 잡혔다"가 «없다»인지 «가드가 무르다»인지 확인해 둔다.
   */
  it("U+0001이 섞이면 실제로 잡힌다 — 안 잡는 가드는 없느니만 못하다", async () => {
    const db = openNodeDriver(DB, { pragmas: false })
    const linking = await loadLinkingView(db, LIB, krLinkingMatcher)
    await db.close()

    // ★ 아무 리스팅이나 쓰면 안 된다 ★ ESM은 키 컬럼이 «상품번호» 하나뿐이라
    // 합성이 일어나지 않는다 — 구분자 없는 키로 시험하면 흠집이 안 나고, 그러면
    // "가드가 잡았다"가 아니라 **시험 자체가 성립하지 않은 것**이다.
    const composite = linking.todo
      .flatMap((c) => c.listings)
      .find((l) => l.listingKey.includes(KEY_SEP))
    expect(composite, "합성 키를 가진 리스팅(11번가 옵션)이 있어야 시험이 성립한다").toBeTruthy()

    const vals = shellVals(shellStateFor(false), emptyActions() as never)
    linkingVals(vals, linking, "todo", new Set())
    // 조회는 조각을 나눠 주지만 합성 키 자체는 여전히 들고 있다. 화면이 실수로
    // 그것을 그리는 상황을 흉내 낸다.
    ;(vals.linkRows as { ext: string }[])[0]!.ext = composite!.listingKey
    vals.firstRun = false
    vals.notFirstRun = true
    vals.v.linking = true

    const html = renderToString(createElement(Template, { vals }))
    expect(html.includes(KEY_SEP), "흠집을 냈는데 가드가 못 봤다").toBe(true)
  })
})
