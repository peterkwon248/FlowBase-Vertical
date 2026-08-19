/**
 * 화면 하나를 실데이터로 렌더해 **자체 완결 HTML**로 남긴다.
 *
 *   npx tsx tools/harness/render-screen.ts [뷰키] [DB경로]
 *   예: npx tsx tools/harness/render-screen.ts settlement
 *
 * ★ 왜 이게 저장소 안에 있나 ★
 * 화면을 눈으로 확인하는 층은 원래 **네이티브 창**(사람이 앱을 띄워 누르는 것)이
 * 담당한다. 그런데 클릭이 필요한 화면은 스크립트로 조작하면 창이 최소화되는
 * 환경 문제가 있어(작업-상태 "막혀 있는 것 3" 참조) 에이전트가 직접 못 본다.
 *
 * 그 사이를 메우는 도구다 — **같은 Template · 같은 CSS · 같은 조회**로 렌더하므로
 * 마크업과 데이터는 확인할 수 있다. 다만 **상호작용은 확인하지 못한다.**
 * 클릭 동선은 여전히 사람이 실기기에서 본다.
 *
 * 출력은 `.tmp/<뷰키>.html`이고 외부 자원을 하나도 안 탄다 — CSS는 `@import`를
 * 풀어 인라인하고 Pretendard는 data URI로 심는다. 파일 하나만 열면 앱과 같은 화면이다.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { openNodeDriver } from "../../src/core/store/driver-node.js"
import { loadPnlSnapshot } from "../../src/core/profit/snapshot.js"
import { loadSettlementRows } from "../../src/core/settlement/rows.js"
import { loadOrderRows } from "../../src/core/order/rows.js"
import { loadLinkingView } from "../../src/core/linking/view.js"
import { krLinkingMatcher, krCostBridgeMatcher } from "../../src/packs/kr-marketplace/linking-matcher.js"
import { loadPendingCostView } from "../../src/core/linking/pending-cost.js"
import { dashboardVals } from "../../src/app/dashboard.js"
import { settlementVals } from "../../src/app/settlement.js"
import { orderVals } from "../../src/app/order.js"
import { linkingVals, type LinkTab } from "../../src/app/linking.js"
import { channelVals } from "../../src/app/channel.js"
import { loadCoverage } from "../../src/core/coverage/load.js"
import { historyVals } from "../../src/app/history.js"
import { productVals } from "../../src/app/product.js"
import { costsVals, emptyCostsDraft, type CostsView } from "../../src/app/costs.js"
import { loadProductRows } from "../../src/core/product/rows.js"
import { loadChannelRows, loadDailySeries, loadProfitRows } from "../../src/core/profit/rows.js"
import { loadHistoryRows } from "../../src/core/history/rows.js"
import type { DocType } from "../../src/core/coverage/index.js"
import type { MarketDict } from "../../src/packs/kr-marketplace/markets/index.js"
import { profileVersion, type MappingProfile } from "../../src/core/import/mapping/index.js"
import { Template } from "../../src/app/generated/Template.js"
import { shellVals, shellStateFor } from "../../src/app/shell.js"

const VIEW = process.argv[2] ?? "dash"
const DB = process.argv[3] ?? ".tmp/pnl.sqlite"
/** 상품 연결은 탭이 셋이라 하나를 골라야 한다 — `… linking done`. */
const TAB = (process.argv[4] ?? "todo") as LinkTab
const PERIOD = { from: "2026-07-01", to: "2026-07-31" }
const STYLES = "src/app/styles"

/** `@import url(...)`을 내용으로 바꾼다. npm 패키지 경로는 node_modules에서 찾는다. */
function inlineCss(file: string, seen = new Set<string>()): string {
  const abs = resolve(file)
  if (seen.has(abs)) return ""
  seen.add(abs)
  return readFileSync(abs, "utf8").replace(
    /@import\s+url\(\s*["']([^"']+)["']\s*\)\s*;/g,
    (_m, href: string) => {
      const target = href.startsWith(".") ? resolve(dirname(abs), href) : resolve("node_modules", href)
      try {
        return inlineCss(target, seen)
      } catch {
        return `/* 인라인 실패: ${href} */`
      }
    },
  )
}

/** woff2를 data URI로. 인터넷 없이 열려야 한다 (로컬퍼스트). */
function embedFonts(css: string, baseDir: string): string {
  return css.replace(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g, (_m, p: string) => {
    try {
      return `url(data:font/woff2;base64,${readFileSync(resolve(baseDir, p)).toString("base64")})`
    } catch {
      return `url("${p}")`
    }
  })
}

/**
 * 팩 사전과 프로파일을 **디스크에서** 읽는다.
 *
 * `packs/…/markets/index.ts`와 `profiles/index.ts`는 `import.meta.glob`을 쓰므로
 * 번들러 안에서만 돈다. 하네스는 `tsx`라 그 길이 없어서, 여기서는 «자기가 쓸 것을
 * 명시하는» 하네스의 기존 규율대로 파일을 직접 읽는다.
 */
const readJson = <T,>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T
const MARKET_DIR = "src/packs/kr-marketplace/markets"
const PROFILE_DIR = "src/packs/kr-marketplace/profiles"

const profiles = readdirSync(PROFILE_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => readJson<MappingProfile>(`${PROFILE_DIR}/${f}`))

/** 마켓별로 **읽을 수 있는** 성격 — 팩의 `readableDocTypes()`와 같은 파생이다. */
const readableOf = (key: string): DocType[] =>
  profiles
    .filter((p) => p.marketplaceKey === key)
    .map((p) => p.docType)
    .filter((d): d is DocType => d === "order" || d === "settlement" || d === "ad")

const dicts = readdirSync(MARKET_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => readJson<Omit<MarketDict, "readable">>(`${MARKET_DIR}/${f}`))
const dictOf = (key: string): MarketDict | null => {
  const d = dicts.find((x) => x.marketplaceKey === key)
  return d === undefined ? null : { ...d, readable: readableOf(key) }
}

const docTypeByVersion = new Map(profiles.map((p) => [profileVersion(p), p.docType]))
const resolveDocType = (mv: string): DocType | null => {
  const dt = docTypeByVersion.get(mv)
  return dt === "order" || dt === "settlement" || dt === "ad" ? dt : null
}

const db = openNodeDriver(DB, { pragmas: false })
const snap = await loadPnlSnapshot(db, "lib-1", PERIOD)
const settlement = await loadSettlementRows(db, "lib-1", PERIOD)
const orders = await loadOrderRows(db, "lib-1", PERIOD)
const linking = await loadLinkingView(db, "lib-1", krLinkingMatcher)
const pendingCost = await loadPendingCostView(db, "lib-1", krCostBridgeMatcher)
const coverage = await loadCoverage(db, "lib-1", resolveDocType)
const history = await loadHistoryRows(db, "lib-1", resolveDocType)
// 원가 기준일은 **고정한다** — 오늘을 쓰면 같은 DB에서 날마다 다른 HTML이 나와
// 렌더 대조가 성립하지 않는다. 초안도 비어 있다(상호작용은 이 층이 증명하지 못한다).
const products = await loadProductRows(db, "lib-1", PERIOD, PERIOD.to)
// ★ 2026-08-17에 배선된 세 블록 — 이 도구가 **앱보다 낡으면 화면을 잘못 본다** ★
// 클라우드 세션에서는 이 HTML이 사람의 눈을 대신하므로, 여기가 빠지면 «비어 있는
// 표»를 보고 «아직 안 만들었구나»로 읽게 된다. 앱의 `data.ts`와 같은 조회를 쓴다.
const profitRows = await loadProfitRows(db, "lib-1", PERIOD)
const channelRows = await loadChannelRows(db, "lib-1", PERIOD)
const daily = await loadDailySeries(db, "lib-1", PERIOD)
/**
 * ★ 2026-08-19에 배선된 비용 화면 — 위 경고의 두 번째 적용 ★
 * 고정비를 안 먹이면 이 도구로 본 화면은 영영 「고정비 0원」이고, 클라우드
 * 세션에서는 그게 사람이 보는 유일한 화면이다.
 */
const repo = new (await import("../../src/core/store/repository.js")).Repository(db)
const withHistory = async (kind: "FIXED" | "OPS") =>
  Promise.all(
    (await repo.overheads("lib-1", kind, PERIOD.from)).map(async (o) => ({
      ...o,
      historyCount: (await repo.overheadHistory("lib-1", kind, o.label)).length,
    })),
  )
const costs: CostsView = {
  fixed: await withHistory("FIXED"),
  ops: await withHistory("OPS"),
  stance: { fixed: await repo.overheadStance("lib-1", "FIXED") },
}
await db.close()

const noop = (): void => {}
const vals = shellVals(shellStateFor(false), {
  go: noop, toggleNav: noop, closeNav: noop, openNav: noop, goImport: noop, toggleTheme: noop,
} as never)
dashboardVals(vals, snap, PERIOD, coverage, {
  products: profitRows,
  channels: channelRows,
  daily,
  // 호버는 상호작용이라 SSR에서는 늘 꺼져 있다 (툴팁은 사람이 실기기에서 본다).
  trendIdx: -1,
})
settlementVals(vals, settlement, PERIOD)
orderVals(vals, orders, PERIOD)
// 선택 상태는 상호작용이라 SSR에서는 늘 비어 있다 — 일괄 바의 «모두 선택»은
// 그려지지만 눌린 뒤의 모습은 이 층이 증명하지 못한다 (2d에서 사람이 본다).
linkingVals(vals, linking, TAB, new Set(), undefined, pendingCost)
channelVals(vals, coverage, { goImport: noop }, dictOf)
historyVals(vals, history)
productVals(vals, products, "list", new Map(), PERIOD.to, undefined, PERIOD)
// 초안은 비어 있다 — 상호작용은 이 층이 증명하지 못한다. 적용일도 고정한다.
costsVals(vals, costs, snap.pnl, emptyCostsDraft(PERIOD.to))
vals.firstRun = false
vals.notFirstRun = true
;(vals.v as Record<string, boolean>)[VIEW] = true

const body = renderToString(createElement(Template, { vals }))
const css = embedFonts(
  `${inlineCss(`${STYLES}/vector-base.css`)}\n${inlineCss(`${STYLES}/flowbase-theme.css`)}`,
  "node_modules/pretendard/dist/web/variable",
)

const out = `.tmp/${VIEW}.html`
writeFileSync(
  out,
  `<!doctype html>
<html lang="ko" data-theme="dark">
  <head><meta charset="UTF-8" /><title>FlowBase — ${VIEW}</title>
  <style>${css}</style><style>html,body{margin:0;height:100%}</style></head>
  <body><div id="root">${body}</div></body>
</html>
`,
  "utf8",
)
console.log(`→ ${out}`)
