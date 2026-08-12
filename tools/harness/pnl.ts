/**
 * 3b-0 — 실파일 관통 CLI (헤드리스).
 *
 * 실파일을 넣으면 파이프라인 전 단계(Recognition→Extraction→Normalization→
 * Mapping→Load)를 거쳐 SQLite에 적재하고, ADR-009 기준으로 손익 5줄을 낸다.
 * **UI 없이 데이터 경로와 회계가 맞는지부터 닫는 것**이 목적이다.
 *
 *   npx tsx tools/harness/pnl.ts                 # 기본 기간(2026-07)
 *   npx tsx tools/harness/pnl.ts 2026-07-01 2026-07-31
 *   npx tsx tools/harness/pnl.ts --clean         # 비식별화본으로 (기본은 원본)
 *
 * ★ 날짜 범위에 BETWEEN을 쓰지 않는다 ★
 * `ordered_at`이 `2026-07-31T16:41:20`처럼 시각을 가지면 `BETWEEN ? AND '2026-07-31'`은
 * 문자열 비교라 그 행을 범위 밖으로 판정한다 — 기간의 마지막 날이 통째로 사라진다.
 * 실측으로 97,600원이 그렇게 빠졌다 (tests/range-boundary.test.ts).
 *
 * 출력의 5줄은 **정답지 템플릿과 같은 형식**이다 — 대조가 즉시 되도록.
 */

import { readFileSync, rmSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join, dirname } from "node:path"
import { sniff } from "../../src/core/import/recognition/sniff.js"
import { parserFor } from "../../src/core/import/parsers/index.js"
import { streamSheet } from "../../src/core/import/pipeline.js"
import {
  captureFromFileName,
  mapRows,
  matchProfiles,
  newKeyState,
  profileVersion,
  type MappingProfile,
} from "../../src/core/import/mapping/index.js"
import { openNodeDriver } from "../../src/core/store/driver-node.js"
import { migrate } from "../../src/core/store/migrate.js"
import { Repository, type FactTable } from "../../src/core/store/repository.js"
import { computePnl, prorateFixed, type Period } from "../../src/core/profit/index.js"
import { FIXTURES, fixturePath, RAW_DIR, CLEAN_DIR } from "../../tests/fixtures.js"

const here = dirname(fileURLToPath(import.meta.url))
const TMP = join(here, "..", "..", ".tmp")
const DB_PATH = join(TMP, "pnl.sqlite")
const PROFILE_DIR = join(here, "..", "..", "src", "packs", "kr-marketplace", "profiles")

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"))
const useClean = process.argv.includes("--clean")
const period: Period = { from: args[0] ?? "2026-07-01", to: args[1] ?? "2026-07-31" }
const DIR = useClean ? CLEAN_DIR : RAW_DIR

/** 실파일 3종 — 채널이 서로 다르다. 아래 '관통 결과'가 그걸 드러낸다. */
const TARGETS = [
  { fixture: 6, profile: "11st-settlement@1.json", conn: "conn-11st", market: "11st" },
  { fixture: 8, profile: "esm-order@1.json", conn: "conn-esm", market: "esm" },
  { fixture: 13, profile: "coupang-ad-report@1.json", conn: "conn-coupang", market: "coupang" },
]

const LIB = "lib-1"
const NOW = "2026-08-12T00:00:00.000Z"

mkdirSync(TMP, { recursive: true })
for (const s of ["", "-wal", "-shm"]) {
  try {
    rmSync(DB_PATH + s)
  } catch {
    /* 없으면 그만 */
  }
}

const db = openNodeDriver(DB_PATH)
await migrate(db)
const repo = new Repository(db)
await db.prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`).run(LIB, "기본", NOW)

console.log(`3b-0 실파일 관통 — ${useClean ? "비식별화본" : "원본"} · 기간 ${period.from} ~ ${period.to}\n`)

interface Loaded {
  readonly market: string
  readonly file: string
  readonly table: string
  readonly rows: number
  readonly excluded: number
  readonly errors: number
  readonly unmapped: number
}
const loaded: Loaded[] = []

for (const t of TARGETS) {
  const f = FIXTURES.find((x) => x.id === t.fixture)!
  const profile = JSON.parse(readFileSync(join(PROFILE_DIR, t.profile), "utf-8")) as MappingProfile
  const bytes = new Uint8Array(readFileSync(fixturePath(f, DIR)))

  // ── Recognition ──
  const rec = sniff(bytes, f.file)
  const top = rec.candidates[0]!
  const src = await parserFor(top.format).open(bytes, { chunkSize: 1_000 })

  await db
    .prepare(
      `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(t.conn, LIB, profile.packId, profile.marketplaceKey, profile.label, "CONNECTED", NOW, NOW)

  const batch = {
    id: `batch-${t.market}`,
    libraryId: LIB,
    connectionId: t.conn,
    sourceName: f.file,
    sourceBytes: bytes.length,
    containerFormat: top.format,
    mappingVersion: profileVersion(profile),
    startedAt: NOW,
  }
  await repo.openBatch(batch)

  const { chunks, getSummary } = streamSheet(src, 0, { chunkSize: 1_000 })
  const captures = captureFromFileName(profile, f.file)
  const keyState = newKeyState()
  let headers: string[] = []
  let matched = false
  let n = 0
  let errors = 0
  let unmapped = 0
  let offset = 0
  const perTable = new Map<string, number>()

  for await (const chunk of chunks) {
    if (!matched) {
      headers = [...getSummary().header.columns]
      const m = matchProfiles([profile], { containerFormat: top.format, headers, fileName: f.file })
      if (m.length === 0) throw new Error(`프로파일이 맞지 않는다: ${t.profile} ← ${f.file}`)
      matched = true
    }
    const mapped = mapRows(
      profile,
      headers,
      chunk,
      { fileName: f.file, fileNameCaptures: captures, keyState },
      offset,
    )
    offset += chunk.rowCount
    errors += mapped.errors.length
    unmapped = mapped.unmappedColumnCount

    // ★ byTable로 읽는다 ★ `rows`만 보면 라우팅으로 다른 테이블에 간 행을
    // 통째로 놓친다 (ESM은 클레임이 fact_claim으로 갈라진다).
    for (const [table, rows] of mapped.byTable) {
      if (rows.length === 0) continue
      await repo.loadChunk(
        table as FactTable,
        batch,
        rows.map((r, i) => ({
          id: `${batch.id}-${table}-${offset - chunk.rowCount + i}`,
          source_key: r.sourceKey,
          ...r.fields,
        })),
      )
      perTable.set(table, (perTable.get(table) ?? 0) + rows.length)
      n += rows.length
    }
  }

  const sum = getSummary()
  await repo.recordExclusions(
    batch.id,
    sum.excluded.map((e) => ({ rowIndex: e.rowIndex, reason: e.reason, detail: e.detail })),
  )
  await repo.commitBatch(batch.id, NOW)
  src.close()

  loaded.push({
    market: t.market,
    file: f.file,
    table: [...perTable].map(([t, c]) => `${t}:${c}`).join(" + ") || profile.targetTable,
    rows: n,
    excluded: sum.excluded.length,
    errors,
    unmapped,
  })
}

console.log("적재")
for (const l of loaded) {
  console.log(
    `  ${l.market.padEnd(8)} ${l.table.padEnd(34)} ${l.rows.toLocaleString().padStart(7)}행` +
      ` · 제외 ${l.excluded} · 매핑오류 ${l.errors} · 미매핑컬럼 ${l.unmapped}`,
  )
}

// ── 집계 — 전부 SQL에 위임한다 (헌장 B-2) ──────────────────────
const revenue = await repo.sumInRange("active_order", "total_amount", LIB, "ordered_at", period.from, period.to)
const orders = await repo.countInRange("active_order", LIB, "ordered_at", period.from, period.to)
const adSpend = await repo.sumInRange("active_ad_spend", "spend_amount", LIB, "spent_on", period.from, period.to)

/**
 * 수수료는 **주문 귀속**이다 — 정산일이 아니라 주문의 ordered_at 달에 잡힌다
 * (ADR-009 ① · profit/index.ts 주석). `order_source_key`로 이어 붙인다.
 *
 * 지금은 11번가 정산에 대응하는 11번가 **주문** 파일이 없어서 조인이 비어 있다.
 * 그 사실을 숨기지 않고 두 값을 나란히 낸다 (헌장 A-5).
 */
const feeJoined = await db
  .prepare(
    `SELECT COALESCE(SUM(s.fee_amount),0) AS fee, COALESCE(SUM(s.vat_amount),0) AS vat,
            COALESCE(SUM(s.shipping_amount),0) AS ship, COUNT(*) AS n
       FROM active_settlement s
       JOIN active_order o ON o.source_key = s.order_source_key
                          AND o.ordered_at >= ? AND o.ordered_at < date(?, '+1 day')
      WHERE s.library_id = ?`,
  )
  .get(period.from, period.to, LIB)

const feeAll = await db
  .prepare(
    `SELECT COALESCE(SUM(fee_amount),0) AS fee, COALESCE(SUM(vat_amount),0) AS vat,
            COALESCE(SUM(shipping_amount),0) AS ship, COALESCE(SUM(gross_amount),0) AS gross,
            COALESCE(SUM(net_amount),0) AS net, COUNT(*) AS n
       FROM active_settlement
        WHERE library_id = ? AND settled_on >= ? AND settled_on < date(?, '+1 day')`,
  )
  .get(LIB, period.from, period.to)

/**
 * 클레임 — **발생일 기준**이다 (ADR-009 ①). 원거래 월로 소급하지 않는다.
 * 부호는 저장값이 아니라 `claim_type`이 정하므로 유형과 금액을 그대로 넘긴다.
 */
const claimRows = await db
  .prepare(
    `SELECT claim_type, amount, date_precision FROM active_claim
      WHERE library_id = ? AND claimed_at >= ? AND claimed_at < date(?, '+1 day')`,
  )
  .all(LIB, period.from, period.to)
const claims = claimRows.map((r) => ({ type: String(r.claim_type), amount: Number(r.amount) }))
const proxyDated = claimRows.filter((r) => r.date_precision === "proxy").length

// 기준 데이터가 아직 없다 — 원가·운영비·고정비는 사람이 넣는 값이다.
const cogs = 0
const ops = 0
const fixedMonthly = 0
const fixed = prorateFixed(fixedMonthly, period)

const pnl = computePnl({
  period,
  revenue,
  fee: Number(feeJoined?.fee ?? 0),
  vat: Number(feeJoined?.vat ?? 0),
  shipping: Number(feeJoined?.ship ?? 0),
  claims,
  cogs,
  adDirect: 0,
  adUnallocated: adSpend,
  ops,
  fixed,
})

const won = (n: number): string => `${n < 0 ? "-" : ""}${Math.abs(n).toLocaleString()}원`
const line = (label: string, v: number): string => `  ${label.padEnd(14)}${won(v).padStart(16)}`

console.log(`\n손익 — ${period.from} ~ ${period.to} (ADR-009 기준)\n`)
console.log(line("총매출", pnl.revenue))
console.log(line("수수료·부가세", -(pnl.fee + pnl.vat)))
console.log(line("배송·클레임", -(pnl.shipping + pnl.claims)))
console.log(line("광고비", -(pnl.adDirect + pnl.adUnallocated)))
console.log(line("원가", -pnl.cogs))
console.log(`  ${"─".repeat(30)}`)
console.log(line("순이익", pnl.netProfit))

console.log(`\n3층`)
console.log(line("상품 기여이익", pnl.productContribution))
console.log(line("채널 기여이익", pnl.channelContribution))
console.log(line("회사 순이익", pnl.netProfit))

// ── 정직 구간 — 이 숫자가 무엇을 담지 못했는지 ────────────────
console.log(`\n이 숫자가 담지 못한 것`)
const gaps: string[] = []
if (Number(feeJoined?.n ?? 0) === 0 && Number(feeAll?.n ?? 0) > 0) {
  gaps.push(
    `수수료 ${won(Number(feeAll?.fee ?? 0))}가 손익에서 빠졌다 — 정산 ${Number(feeAll?.n)}건이 주문에 이어지지 않는다.\n` +
      `    11번가 정산 파일은 있는데 11번가 **주문** 파일이 없어 order_source_key 조인이 비어 있다.\n` +
      `    (정산 자체 합계: 판매 ${won(Number(feeAll?.gross ?? 0))} · 공제 ${won(Number(feeAll?.fee ?? 0))} · 정산 ${won(Number(feeAll?.net ?? 0))})`,
  )
}
if (proxyDated > 0) {
  gaps.push(
    `클레임 ${proxyDated}건의 발생일이 **추정**이다 — ESM 양식에 클레임 일자 컬럼이 없어
` +
      `    결제일을 프록시로 썼다(date_precision='proxy'). 실제 반품일이 다음 달이면
` +
      `    그 달에 잡혀야 하지만 파일이 말해주지 않는다 (ADR-009 ①-보완)`,
  )
}
if (cogs === 0) gaps.push("원가 0 — cost_history가 비어 있다. 기준 데이터라 파일이 아니라 사람이 넣는다")
if (fixedMonthly === 0) gaps.push("고정비·운영비 0 — 같은 이유")
gaps.push(
  `채널이 섞여 있다 — 매출은 ESM(주문 ${orders}건), 광고비는 쿠팡, 수수료는 11번가다.\n` +
    `    한 채널의 완결된 손익이 아니므로 순이익을 채널 성과로 읽으면 안 된다`,
)
for (const g of gaps) console.log(`  · ${g}`)

await db.close()
console.log(`\nDB: ${DB_PATH}`)
