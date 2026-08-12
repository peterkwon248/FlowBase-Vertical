/**
 * 세션 2 합격 기준 2 — 종단 게이트.
 *
 *   #13 전체 가져오기 (파싱 → 정규화 → 매핑 → SQLite 적재 완료)
 *     30초 / 피크 256MB
 *
 * 세션 1의 게이트를 적재까지 확장한 것이다. 1차 판정은 `node:sqlite` 기준이며,
 * **드라이버 교체 후 재측정이 세션 3 개시 조건이다** — 적재 성능은 드라이버에
 * 따라 달라지므로 1차 통과를 최종 통과로 보지 않는다.
 *
 *   npm run e2e
 */

import { Worker } from "node:worker_threads"
import { fileURLToPath } from "node:url"
import { rmSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { FIXTURES, fixturePath } from "../../tests/fixtures.js"

const TIME_BUDGET_MS = 30_000
const MEMORY_BUDGET_MB = 256

const here = dirname(fileURLToPath(import.meta.url))
const TMP = join(here, "..", "..", ".tmp")
const DB_PATH = join(TMP, "e2e.sqlite")
const PROFILE = join(
  here,
  "..",
  "..",
  "src",
  "packs",
  "kr-marketplace",
  "profiles",
  "coupang-ad-report@1.json",
)

const target = FIXTURES.find((f) => f.id === 13)!
mkdirSync(TMP, { recursive: true })
for (const suffix of ["", "-wal", "-shm"]) {
  try {
    rmSync(DB_PATH + suffix)
  } catch {
    /* 없으면 그만 */
  }
}

console.log(`종단 게이트 — #${target.id} ${target.file}`)
console.log(`기준: ${TIME_BUDGET_MS / 1000}초 / 피크 RSS ${MEMORY_BUDGET_MB}MB (적재 완료까지)\n`)

const baseline = process.memoryUsage().rss
let peak = baseline
let lastProgress = 0
const t0 = performance.now()

const worker = new Worker(fileURLToPath(new URL("./e2e-worker-boot.mjs", import.meta.url)), {
  workerData: {
    path: fixturePath(target),
    fileName: target.file,
    dbPath: DB_PATH,
    profilePath: PROFILE,
    chunkSize: 1_000,
  },
})

const sampler = setInterval(() => {
  const rss = process.memoryUsage().rss
  if (rss > peak) peak = rss
}, 50)

interface Done {
  readonly type: "done"
  readonly format: string
  readonly mappingVersion: string
  readonly physicalRowCount: number
  readonly dataRowCount: number
  readonly loaded: number
  readonly countedBack: number
  readonly totalSpend: number
  readonly mappingErrors: number
  readonly unmappedColumns: number
  readonly timings: Record<string, number>
}

const result = await new Promise<Done>((resolve, reject) => {
  worker.on("message", (m: { type: "progress"; rows: number } | Done) => {
    if (m.type === "progress") {
      lastProgress = m.rows
      process.stdout.write(`\r  적재 ${lastProgress.toLocaleString()}행...`)
    } else resolve(m)
  })
  worker.on("error", reject)
  worker.on("exit", (code) => {
    if (code !== 0) reject(new Error(`워커가 코드 ${code}로 종료됐다`))
  })
})

clearInterval(sampler)
await worker.terminate()

const elapsed = Math.round(performance.now() - t0)
const peakMb = Math.round(((peak - baseline) / 1024 / 1024) * 10) / 10

process.stdout.write("\r" + " ".repeat(48) + "\r")
console.log(`프로파일  ${result.mappingVersion}`)
console.log(
  `구조      물리 ${result.physicalRowCount.toLocaleString()}행 → 데이터 ${result.dataRowCount.toLocaleString()}행`,
)
console.log(
  `적재      ${result.loaded.toLocaleString()}행 · SQL 되세기 ${result.countedBack.toLocaleString()}행 · 광고비 합계 ${result.totalSpend.toLocaleString()}원`,
)
console.log(
  `매핑      오류 ${result.mappingErrors}건 · 미매핑 컬럼 ${result.unmappedColumns}개 (버린 것을 센다)`,
)
console.log(`단계별    파싱+정규화 ${result.timings.parseMs}ms · 매핑+적재 ${result.timings.loadMs}ms`)
console.log("")

const timePass = elapsed <= TIME_BUDGET_MS
const memPass = peakMb <= MEMORY_BUDGET_MB
const rowPass = result.loaded === result.dataRowCount && result.countedBack === result.loaded

console.log(`시간      ${(elapsed / 1000).toFixed(1)}초 / ${TIME_BUDGET_MS / 1000}초   ${timePass ? "통과" : "초과"}`)
console.log(`메모리    +${peakMb}MB / ${MEMORY_BUDGET_MB}MB   ${memPass ? "통과" : "초과"}`)
console.log(
  `행 수     적재 ${result.loaded.toLocaleString()} = 데이터 ${result.dataRowCount.toLocaleString()} = 되세기 ${result.countedBack.toLocaleString()}   ${rowPass ? "일치" : "불일치"}`,
)
console.log("")

if (timePass && memPass && rowPass) {
  console.log("합격 기준 2 — 1차 통과 (node:sqlite 기준).")
  console.log("드라이버 교체 후 재측정이 세션 3 개시 조건이다.")
} else {
  console.log("합격 기준 2 — 미달.")
  process.exitCode = 1
}
