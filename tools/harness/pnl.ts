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
import { migrate } from "../../src/core/store/migrate-node.js"
import { Repository, type FactTable } from "../../src/core/store/repository.js"
import { type Period } from "../../src/core/profit/index.js"
import { loadPnlSnapshot } from "../../src/core/profit/snapshot.js"
import { pnlGaps } from "../../src/core/profit/gaps.js"
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
    // display_name은 **프로파일이 선언한 채널 통칭**이다. `label`(문서 이름)이 아니다 —
    // 화면의 채널 열에 "11번가 결제일 정산확정"이 뜨면 안 된다.
    .run(
      t.conn, LIB, profile.packId, profile.marketplaceKey,
      profile.displayName, "CONNECTED", NOW, NOW,
    )

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

// ── 집계 + 계산 — **공용 스냅샷 하나로 간다** ─────────────────
//
// 이 조회를 여기 두면 화면 배선에서 같은 SQL을 다시 쓰게 되고, 그 순간
// 두 번째 진실이 생긴다. CLI도 화면도 `loadPnlSnapshot`의 소비자일 뿐이다.
const snap = await loadPnlSnapshot(db, LIB, period)
const { pnl } = snap
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
//
// ★ 판정은 여기 없다 ★ `core/profit/gaps.ts`에 있다. 조건을 이 파일에 두면
// 화면을 배선할 때 같은 조건을 다시 쓰게 되고, 그때부터 CLI와 화면이 서로 다른
// 것을 "빠졌다"고 말한다. 숫자를 한 곳에서 계산하는 것과 같은 이유다.
console.log(`\n이 숫자가 담지 못한 것`)
for (const g of pnlGaps(snap)) console.log(`  · ${g.detail}`)

await db.close()
console.log(`\nDB: ${DB_PATH}`)
