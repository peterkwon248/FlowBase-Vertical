/**
 * 리스팅 매칭 임계값의 **근거 측정**.
 *
 *   npx tsx tools/harness/listing-match-dist.ts [DB경로]
 *
 * `listing-match.ts`의 절단점(0.74 / margin 0.15 / shared 2)은 여기서 나왔다.
 * 임의 상수가 아니라 실제 카탈로그의 분포에서 고른 값이고, **새 채널이 붙어
 * 카탈로그가 달라지면 이 스크립트를 다시 돌려 절단점을 재확인한다.**
 *
 * 측정 대상은 실데이터라 이 스크립트는 `npm test`에 들어가지 않는다 — DB가 있는
 * 기기에서만 의미가 있다. 규칙 **자체**의 동작은 `tests/listing-match.test.ts`가
 * 픽스처 없이 검증한다.
 */

import { openNodeDriver } from "../../src/core/store/driver-node.js"
import {
  clusterByProduct,
  normalizeTitle,
  similarity,
  suggest,
  type Candidate,
} from "../../src/packs/kr-marketplace/listing-match.js"

const DB = process.argv[2] ?? ".tmp/pnl.sqlite"

const db = openNodeDriver(DB, { pragmas: false })
const rows = await db
  .prepare(
    `SELECT l.title, l.grain, cn.display_name AS ch
       FROM marketplace_listing l JOIN connection cn ON cn.id = l.connection_id`,
  )
  .all()
await db.close()

type L = { title: string; grain: "product" | "option"; ch: string }
const all: L[] = rows.map((r) => ({
  title: String(r["title"]),
  grain: String(r["grain"]) === "option" ? "option" : "product",
  ch: String(r["ch"]),
}))

if (all.length === 0) {
  console.error(`리스팅이 없다 — 먼저 npx tsx tools/harness/pnl.ts`)
  process.exit(1)
}

// 옵션 단위 채널을 상품부로 군집한다 — 연결의 목적지가 될 후보다.
const optionSide = all.filter((l) => l.grain === "option")
const productSide = all.filter((l) => l.grain === "product")
const clusters = clusterByProduct(optionSide)

console.log(`옵션 단위 리스팅 ${optionSide.length}개 → 상품 군집 ${clusters.size}개`)
console.log(`  ★ 군집 제안이 줄이는 클릭: ${optionSide.length} → ${clusters.size}`)
const sizes = [...clusters.values()].map((v) => v.length).sort((a, b) => b - a)
console.log(`  군집 크기: ${sizes.join(" ")}`)

const clusterNorm = [...clusters.keys()].map((k) => ({ key: k, n: normalizeTitle(k, "product") }))

const buckets = { clear: 0, contested: 0, none: 0 }
const detail: string[] = []
for (const p of productSide) {
  const pn = normalizeTitle(p.title, p.grain)
  const candidates: Candidate[] = clusterNorm.map((c) => {
    const s = similarity(pn, c.n)
    return { key: c.key, score: s.score, shared: s.shared }
  })
  const s = suggest(candidates)
  buckets[s.kind]++
  const top = s.candidates[0]
  detail.push(
    `  ${s.kind.padEnd(10)} ${(top?.score ?? 0).toFixed(2)}  ` +
      `${(top?.shared ?? []).slice(0, 3).join(",").padEnd(24)} ${p.title.slice(0, 36)}`,
  )
}

console.log(`\n상품 단위 리스팅 ${productSide.length}개의 제안 등급`)
console.log(`  clear      ${buckets.clear}   후보 1개 미리 선택 — 사람은 확인만`)
console.log(`  contested  ${buckets.contested}   후보 복수 나열 + 선택 강제`)
console.log(`  none       ${buckets.none}   후보 없음 — [새 SKU로 등록]이 기본`)
console.log(``)
for (const d of detail.sort()) console.log(d)

const clicks = clusters.size + buckets.clear + buckets.contested + buckets.none
console.log(
  `\n첫 통과 클릭 추정: 군집 ${clusters.size} + 상품쪽 ${productSide.length} = ${clicks}` +
    `  (리스팅 낱개로 하면 ${all.length})`,
)
