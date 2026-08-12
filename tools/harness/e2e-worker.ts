/**
 * 종단 가져오기 — 파싱 → 정규화 → 매핑 → SQLite 적재.
 *
 * 세션 2 합격 기준 2. Worker에서 돈다 (ADR-001 조건 2).
 */

import { parentPort, workerData } from "node:worker_threads"
import { readFileSync } from "node:fs"
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

interface Input {
  readonly path: string
  readonly fileName: string
  readonly dbPath: string
  readonly profilePath: string
  readonly chunkSize: number
}

const { path, fileName, dbPath, profilePath, chunkSize } = workerData as Input
const post = (m: unknown): void => parentPort?.postMessage(m)

const t0 = performance.now()
const profile = JSON.parse(readFileSync(profilePath, "utf-8")) as MappingProfile
const bytes = new Uint8Array(readFileSync(path))

// ── 1. Recognition ────────────────────────────────────────────
const rec = sniff(bytes, fileName)
const top = rec.candidates[0]!
const src = await parserFor(top.format).open(bytes, { chunkSize })
const tParse = performance.now()

// ── 2. 저장 준비 ──────────────────────────────────────────────
const db = openNodeDriver(dbPath)
migrate(db)
const repo = new Repository(db)
const LIB = "lib-1"
const CONN = "conn-1"
const now = new Date(2026, 7, 12).toISOString()

db.prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`).run(LIB, "기본", now)
db.prepare(
  `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?)`,
).run(CONN, LIB, profile.packId, profile.marketplaceKey, "연결", "CONNECTED", now, now)

const batch = {
  id: "batch-1",
  libraryId: LIB,
  connectionId: CONN,
  sourceName: fileName,
  sourceBytes: bytes.length,
  containerFormat: top.format,
  mappingVersion: profileVersion(profile),
  startedAt: now,
}
repo.openBatch(batch)

// ── 3. 스트리밍: 정규화 → 매핑 → 적재 ──────────────────────────
const { chunks, getSummary } = streamSheet(src, 0, { chunkSize })
const captures = captureFromFileName(profile, fileName)
// 파일 전체를 도는 동안 하나 — 청크마다 새로 만들면 동일 행이 합쳐진다.
const keyState = newKeyState()

let headers: string[] = []
let profileMatched = false
let loaded = 0
let mappingErrors = 0
let unmapped = 0
let rowOffset = 0

for await (const chunk of chunks) {
  if (!profileMatched) {
    headers = [...getSummary().header.columns]
    const matches = matchProfiles([profile], {
      containerFormat: top.format,
      headers,
      fileName,
    })
    if (matches.length === 0) throw new Error("프로파일이 이 파일과 맞지 않는다")
    profileMatched = true
  }

  const mapped = mapRows(
    profile,
    headers,
    chunk,
    { fileName, fileNameCaptures: captures, keyState },
    rowOffset,
  )
  rowOffset += chunk.rowCount
  mappingErrors += mapped.errors.length
  unmapped = mapped.unmappedColumnCount

  // 측정용: SKIP_LOAD=1이면 적재를 건너뛴다 — SQLite가 차지하는 메모리 몫을 분리한다.
  if (mapped.rows.length > 0 && process.env.SKIP_LOAD !== "1") {
    repo.loadChunk(
      profile.targetTable as FactTable,
      batch,
      mapped.rows.map((r, i) => ({
        id: `${batch.id}-${rowOffset - chunk.rowCount + i}`,
        source_key: r.sourceKey,
        ...r.fields,
      })),
    )
    loaded += mapped.rows.length
  }
  post({ type: "progress", rows: loaded })
}

repo.commitBatch(batch.id, now)
src.close()
const tLoad = performance.now()

// ── 4. 확인 — 적재된 것을 SQL로 되센다 ────────────────────────
const counted = repo.countInRange("active_ad_spend", LIB, "spent_on", "2026-01-01", "2026-12-31")
const spend = repo.sumInRange(
  "active_ad_spend",
  "spend_amount",
  LIB,
  "spent_on",
  "2026-01-01",
  "2026-12-31",
)
db.close()

post({
  type: "done",
  format: top.format,
  mappingVersion: batch.mappingVersion,
  physicalRowCount: getSummary().sheet.physicalRowCount,
  dataRowCount: getSummary().dataRowCount,
  loaded,
  countedBack: counted,
  totalSpend: spend,
  mappingErrors,
  unmappedColumns: unmapped,
  timings: {
    parseMs: Math.round(tParse - t0),
    loadMs: Math.round(tLoad - tParse),
    totalMs: Math.round(tLoad - t0),
  },
})
