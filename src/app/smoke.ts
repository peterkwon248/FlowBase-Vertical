/**
 * Tauri 스모크 — **#13이 진짜 앱에서 진짜 DB로 들어가는가.**
 *
 * 세션 2의 종단 게이트(`npm run e2e`)와 **같은 코드 경로**를 웹뷰에서 한 번 돈다.
 * 다른 것은 딱 두 곳이다:
 *
 * ```
 * readFileSync(path)   →  fetch(...).arrayBuffer()     파일을 웹이 읽는다
 * openNodeDriver(...)  →  openTauriDriver(...)          적재가 IPC를 탄다
 * ```
 *
 * 목적은 **IPC 직렬화 서프라이즈 감지**다. 파싱·정규화·매핑은 이미 Node에서
 * 쟀고(약 5초) 여기서 달라질 이유가 없다. 달라지는 것은 적재뿐이고, 청크를
 * JSON으로 굴려 프로세스 경계를 넘기는 비용이 얼마인지가 이 측정의 전부다.
 *
 * ★ 13회 정식 게이트가 아니다 ★ 단회 스모크이고, 초과하면 튜닝하지 않고
 * 원인을 갈라 보고한다 (파싱이냐 IPC냐 SQLite냐).
 */

import { sniff } from "@core/import/recognition/sniff.js"
import { parserFor } from "@core/import/parsers/index.js"
import { streamSheet } from "@core/import/pipeline.js"
import {
  captureFromFileName,
  mapRows,
  matchProfiles,
  newKeyState,
  profileVersion,
  type MappingProfile,
} from "@core/import/mapping/index.js"
import { openTauriDriver } from "@core/store/driver-tauri.js"
import { migrate } from "@core/store/migrate-web.js"
import { Repository, type FactTable } from "@core/store/repository.js"
import profileJson from "@packs/kr-marketplace/profiles/coupang-ad-report@1.json"

declare const __PROJECT_ROOT__: string

/** #13 — 80,138 물리행 × 43열. 성능 판정용 픽스처다. */
const FIXTURE = "쿠팡 광고 보고서_20260701_20260731.xlsx"
const CHUNK_SIZE = 1_000

const root = __PROJECT_ROOT__.replace(/\\/g, "/").replace(/\/$/, "")
const FIXTURE_URL = `/@fs/${root}/fixtures/clean/${FIXTURE}`
const DB_PATH = `${root}/.tmp/tauri-smoke.sqlite`

export interface SmokeResult {
  ok: boolean
  error?: string
  format?: string
  physicalRowCount?: number
  dataRowCount?: number
  loaded?: number
  countedBack?: number
  totalSpend?: number
  mappingErrors?: number
  unmappedColumns?: number
  fetchMs?: number
  parseMs?: number
  loadMs?: number
  totalMs?: number
  heapPeakMb?: number
}

/** 웹뷰가 재줄 수 있는 것만. 프로세스 RSS는 밖에서 폴링해야 한다. */
function heapMb(): number {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
  return m ? Math.round(m.usedJSHeapSize / 1024 / 1024) : 0
}

/** 결과를 DB에 남긴다 — 웹뷰 콘솔은 밖에서 읽을 수 없으므로 이게 유일한 통로다. */
async function record(db: Awaited<ReturnType<typeof openTauriDriver>>, r: SmokeResult): Promise<void> {
  await db.exec(`CREATE TABLE IF NOT EXISTS smoke_result (k TEXT PRIMARY KEY, v TEXT)`)
  const put = db.prepare(`INSERT OR REPLACE INTO smoke_result (k, v) VALUES (?,?)`)
  await put.run("__at", new Date().toISOString())
  for (const [k, v] of Object.entries(r)) await put.run(k, String(v))
}

export async function runSmoke(log: (s: string) => void): Promise<SmokeResult> {
  const t0 = performance.now()
  let heapPeak = heapMb()
  const mark = (): void => {
    const h = heapMb()
    if (h > heapPeak) heapPeak = h
  }
  // 실패해도 사유를 남겨야 한다. 첫 시도가 정확히 여기서 막혔다 —
  // 오류는 창 안에만 있고 밖에서는 "DB에 아무것도 없다"만 보였다.
  let opened: Awaited<ReturnType<typeof openTauriDriver>> | null = null

  try {
    log(`픽스처를 읽는다 — ${FIXTURE}`)
    const res = await fetch(FIXTURE_URL)
    if (!res.ok) throw new Error(`픽스처를 못 읽었다 (${res.status}) — ${FIXTURE_URL}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    const tFetch = performance.now()
    log(`  ${bytes.length.toLocaleString()}바이트 · ${Math.round(tFetch - t0)}ms`)
    mark()

    // ── 1. Recognition ──────────────────────────────────────────
    const rec = sniff(bytes, FIXTURE)
    const top = rec.candidates[0]
    if (!top) throw new Error("스니퍼가 후보를 내지 못했다")
    const src = await parserFor(top.format).open(bytes, { chunkSize: CHUNK_SIZE })
    const tParse = performance.now()
    log(`형식 ${top.format} · 파서 준비 ${Math.round(tParse - tFetch)}ms`)
    mark()

    // ── 2. 저장 준비 ────────────────────────────────────────────
    const db = await openTauriDriver(DB_PATH)
    opened = db
    await migrate(db)
    const repo = new Repository(db)
    const profile = profileJson as unknown as MappingProfile
    const LIB = "lib-1"
    const CONN = "conn-1"
    const now = new Date(2026, 7, 12).toISOString()

    // 재실행을 견디게 — 스모크는 여러 번 돌 수 있다. 외래키가 켜져 있으므로
    // 자식부터 지운다. 테이블 이름은 `batch`다(`import_batch`가 아니다) —
    // 첫 시도가 정확히 이 이름 때문에 조용히 멈췄다.
    await db.exec("DELETE FROM fact_ad_spend")
    await db.exec("DELETE FROM batch")
    await db.exec("DELETE FROM connection")
    await db.exec("DELETE FROM library")

    await db
      .prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`)
      .run(LIB, "기본", now)
    await db
      .prepare(
        `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(CONN, LIB, profile.packId, profile.marketplaceKey, "연결", "CONNECTED", now, now)

    const batch = {
      id: "batch-1",
      libraryId: LIB,
      connectionId: CONN,
      sourceName: FIXTURE,
      sourceBytes: bytes.length,
      containerFormat: top.format,
      mappingVersion: profileVersion(profile),
      startedAt: now,
    }
    await repo.openBatch(batch)
    mark()

    // ── 3. 스트리밍: 정규화 → 매핑 → 적재 ────────────────────────
    const { chunks, getSummary } = streamSheet(src, 0, { chunkSize: CHUNK_SIZE })
    const captures = captureFromFileName(profile, FIXTURE)
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
          fileName: FIXTURE,
        })
        if (matches.length === 0) throw new Error("프로파일이 이 파일과 맞지 않는다")
        profileMatched = true
      }

      const mapped = mapRows(
        profile,
        headers,
        chunk,
        { fileName: FIXTURE, fileNameCaptures: captures, keyState },
        rowOffset,
      )
      rowOffset += chunk.rowCount
      mappingErrors += mapped.errors.length
      unmapped = mapped.unmappedColumnCount

      if (mapped.rows.length > 0) {
        await repo.loadChunk(
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
      mark()
      if (loaded % 20_000 === 0 && loaded > 0) log(`  적재 ${loaded.toLocaleString()}행…`)
    }

    await repo.commitBatch(batch.id, now)
    src.close()
    const tLoad = performance.now()
    mark()

    // ── 4. 확인 — 적재된 것을 SQL로 되센다 ──────────────────────
    const counted = await repo.countInRange(
      "active_ad_spend",
      LIB,
      "spent_on",
      "2026-01-01",
      "2026-12-31",
    )
    const spend = await repo.sumInRange(
      "active_ad_spend",
      "spend_amount",
      LIB,
      "spent_on",
      "2026-01-01",
      "2026-12-31",
    )

    const summary = getSummary()
    const result: SmokeResult = {
      ok: true,
      format: top.format,
      physicalRowCount: summary.sheet.physicalRowCount,
      dataRowCount: summary.dataRowCount,
      loaded,
      countedBack: counted,
      totalSpend: spend,
      mappingErrors,
      unmappedColumns: unmapped,
      fetchMs: Math.round(tFetch - t0),
      parseMs: Math.round(tParse - tFetch),
      loadMs: Math.round(tLoad - tParse),
      totalMs: Math.round(tLoad - t0),
      heapPeakMb: heapPeak,
    }

    // 결과를 DB에 남긴다 — 웹뷰 콘솔은 밖에서 읽을 수 없다.
    await db.exec(`CREATE TABLE IF NOT EXISTS smoke_result (k TEXT PRIMARY KEY, v TEXT)`)
    const put = db.prepare(`INSERT OR REPLACE INTO smoke_result (k, v) VALUES (?,?)`)
    for (const [k, v] of Object.entries(result)) await put.run(k, String(v))
    await db.close()

    return result
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e) }
  }
}


