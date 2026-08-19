/**
 * 가져오기 위저드를 **실파일로 렌더해** 자체 완결 HTML로 남긴다.
 *
 * ```
 * npx tsx tools/harness/render-wizard.ts                       # 원가표 (픽스처 #3)
 * npx tsx tools/harness/render-wizard.ts <픽스처id> <프로파일>   # 다른 조합
 * ```
 *
 * ─────────────────────────────────────────────────────────────
 * ★ `render-screen.ts`가 못 그리는 화면이 하나 있었다 ★
 *
 * 그 도구는 DB를 읽어 화면을 그린다. 위저드는 **DB가 아니라 파일**에서 나오므로
 * 대상이 아니었고, 그래서 «눈으로 보는 층»이 위저드에만 없었다.
 *
 * 없어서 실제로 놓쳤다: 원가 파일을 넣는 길을 만들면서 확인 화면 아래 줄이
 *
 *     "같은 source_key가 이미 있으면 덮어쓰지 않고 갱신됩니다 (UPSERT)."
 *
 * 로 그대로 떠 있었다. 기준 데이터에는 `source_key`도 UPSERT도 없다 — 키는
 * (SKU · 종류 · 적용일)이고 같으면 **건너뛴다.** 단위 시험은 내가 채운 값만
 * 보므로 «안 고친 값이 거짓이 됐다»를 잡지 못한다. **렌더해서 읽어야 보인다.**
 * ─────────────────────────────────────────────────────────────
 *
 * 상호작용은 확인하지 못한다 (`render-screen.ts`와 같은 한계). 클릭 동선은
 * 사람이 실기기에서 본다.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { Template } from "../../src/app/generated/Template.js"
import { emptyVals } from "../../src/app/generated/vals.js"
import { importVals, EMPTY_WIZARD } from "../../src/app/import.js"
import { analyzeImport } from "../../src/core/import/analyze.js"
import type { MappingProfile } from "../../src/core/import/mapping/index.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "../../tests/fixtures.js"

const FIXTURE_ID = Number(process.argv[2] ?? 3)
const PROFILE = process.argv[3] ?? "cost-master@1.json"
const OUT = ".tmp/wizard.html"

const profile = JSON.parse(
  readFileSync(`src/packs/kr-marketplace/profiles/${PROFILE}`, "utf-8"),
) as MappingProfile
const f = FIXTURES.find((x) => x.id === FIXTURE_ID)
if (!f) throw new Error(`픽스처 ${FIXTURE_ID}는 없다`)
const bytes = new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR)))

// ★ 시트 번호를 박지 않는다 ★ 판정이 찾은 시트를 쓴다 — 픽스처가 바뀌면
// 엉뚱한 시트를 그려 놓고 «화면이 이상하다»로 읽게 된다.
const scan = await analyzeImport(bytes, f.file, [profile])
const hit = scan.sheetMatches.find((m) => m.profiles.length > 0)
const sheetIndex = hit?.sheetIndex ?? 0
console.log(
  hit
    ? `시트 ${sheetIndex} 「${hit.sheetName}」 — ${profile.label}`
    : `맞는 시트가 없다. 시트 0을 그린다 («맞는 양식 없음» 화면 확인용)`,
)

const a = await analyzeImport(bytes, f.file, [profile], { sheetIndex })
const vals = emptyVals()
vals.v = { ...vals.v, import: true }
importVals(vals, {
  ...EMPTY_WIZARD,
  analysis: a,
  // 기준 데이터 갈래를 그리려면 적용일이 있어야 한다. 사실 파일에서는 무시된다.
  effectiveFrom: "2025-01-01",
})
const html = renderToString(createElement(Template, { vals }))

// CSS는 `@import`를 풀어 인라인한다 — 파일 하나만 열면 앱과 같은 화면이다.
const cssDir = "src/app/styles"
const css = readdirSync(cssDir)
  .filter((n) => n.endsWith(".css"))
  .map((n) => readFileSync(`${cssDir}/${n}`, "utf-8"))
  .join("\n")
  .replace(/@import[^;]+;/g, "")

mkdirSync(".tmp", { recursive: true })
writeFileSync(OUT, `<!doctype html><meta charset="utf-8"><style>${css}</style><body>${html}</body>`)
console.log(`→ ${OUT}`)
