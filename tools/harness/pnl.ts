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
import {
  Repository,
  type FactTable,
  type ListingUpsert,
  type LoadStats,
} from "../../src/core/store/repository.js"
import { runImport } from "../../src/core/import/run.js"
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

/**
 * 실파일 4종 — 채널이 서로 다르다. 아래 '관통 결과'가 그걸 드러낸다.
 *
 * ★ 쿠팡 제트(#15)를 넣은 이유 (2026-08-20 · 014) ★
 * 광고비 배분이 **같은 연결 안에서** 리스팅을 찾는다. 쿠팡 광고(#13)만 있고
 * 쿠팡 **주문**이 없으면 붙을 리스팅이 하나도 없어 배분이 늘 0이다 — 새 코드가
 * 개발 DB에서 **한 번도 안 돌게** 된다. 두 파일 다 2026-07이라 기간도 맞는다.
 *
 * 순서가 중요하다: 주문이 리스팅을 만들고 광고가 그걸 가리킨다. 적재는 순서와
 * 무관하지만(조회 때 잇는다) 읽는 사람에게는 이 순서가 사실에 가깝다.
 */
const TARGETS = [
  { fixture: 6, profile: "11st-settlement@1.json", conn: "conn-11st", market: "11st" },
  { fixture: 8, profile: "esm-order@1.json", conn: "conn-esm", market: "esm" },
  { fixture: 15, profile: "coupang-jet@1.json", conn: "conn-coupang", market: "coupang" },
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
/** 채널별 리스팅 적재 결과 — ②(연결 화면) 설계의 입력이 되는 숫자다. */
const listingStats = new Map<string, LoadStats>()

for (const t of TARGETS) {
  const f = FIXTURES.find((x) => x.id === t.fixture)!
  const profile = JSON.parse(readFileSync(join(PROFILE_DIR, t.profile), "utf-8")) as MappingProfile
  const bytes = new Uint8Array(readFileSync(fixturePath(f, DIR)))

  // 한 연결에 파일이 **둘 이상** 온다 (쿠팡: 주문 + 광고). 그게 배분이 성립하는
  // 조건이므로 두 번째 파일에서 터지면 안 된다.
  await db
    .prepare(
      `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT (id) DO NOTHING`,
    )
    // display_name은 **프로파일이 선언한 채널 통칭**이다. `label`(문서 이름)이 아니다 —
    // 화면의 채널 열에 "11번가 결제일 정산확정"이 뜨면 안 된다.
    .run(
      t.conn, LIB, profile.packId, profile.marketplaceKey,
      profile.displayName, "CONNECTED", NOW, NOW,
    )

  /**
   * ★ 적재는 `runImport` **하나**다 (2026-08-14) ★
   *
   * 여기 있던 루프는 `runImport`가 생기기 전의 «완전한 쪽»이었고, 그 뒤로도 남아
   * **두 번째 벌**로 살아 있었다. 적대적 검토가 잡았다 — 이 루프는 `mapped.items`를
   * 읽지 않아 같은 파일이 CLI에서는 품목 0, 위저드에서는 146이 됐다.
   * «화면 숫자 = CLI 숫자»가 구조적 보장에서 **검사 항목**으로 내려간 상태였다.
   *
   * 이제 CLI도 앱과 **같은 함수**를 부른다. Recognition·파서 열기·리스팅 UPSERT·
   * 제외 기록·커밋이 전부 그 안에 있으므로 여기서 다시 하지 않는다.
   */
  const r = await runImport(repo, {
    bytes,
    fileName: f.file,
    profile,
    sheetIndex: 0,
    libraryId: LIB,
    connectionId: t.conn,
    // batch = 파일 하나다. 쿠팡은 주문·광고 두 파일이므로 마켓으로 가르면 부딪힌다.
    batchId: `batch-${t.market}-${t.fixture}`,
    now: NOW,
  })
  if (r.listings) listingStats.set(t.market, r.listings)

  loaded.push({
    market: t.market,
    file: f.file,
    table: [...r.perTable].map(([tbl, c]) => `${tbl}:${c}`).join(" + ") || profile.targetTable,
    rows: r.loaded,
    excluded: r.excluded.length,
    errors: r.mappingErrors.length,
    unmapped: r.unmappedColumnCount,
  })
}

console.log("적재")
for (const l of loaded) {
  console.log(
    `  ${l.market.padEnd(8)} ${l.table.padEnd(34)} ${l.rows.toLocaleString().padStart(7)}행` +
      ` · 제외 ${l.excluded} · 매핑오류 ${l.errors} · 미매핑컬럼 ${l.unmapped}`,
  )
}

// ── 리스팅 — ②(연결 화면)의 설계 입력이다 ────────────────────────
// 몇 개가 생겼는지가 연결 화면의 무게를 정한다. 20개면 최소형으로 족하고
// 200개면 일괄 액션이 필수다.
if (listingStats.size > 0) {
  console.log(`\n마켓 리스팅 (연결 대상)`)
  for (const [market, s] of listingStats) {
    console.log(`  ${market.padEnd(8)} 신규 ${String(s.inserted).padStart(4)} · 갱신 ${s.updated}`)
  }
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
