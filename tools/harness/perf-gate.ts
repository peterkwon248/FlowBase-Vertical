/**
 * 성능 게이트 — ADR-001 조건 4 / 4-a.
 *
 *   쿠팡 광고 픽스처(#13, 80,138행 × 43열)
 *     시간   30초 이내 (진행 표시 포함)
 *     메모리 Worker 피크 RSS 256MB 이하
 *
 * 초과는 실패가 아니라 **판정**이다 — "SheetJS 전량 적재의 한계"가 측정으로
 * 확인되면 조건 1의 단계별 Rust 교체 조항이 발동한다.
 *
 *   npm run perf
 */

import { Worker } from "node:worker_threads"
import { fileURLToPath } from "node:url"
import { FIXTURES, fixturePath } from "../../tests/fixtures.js"

const TIME_BUDGET_MS = 30_000
const MEMORY_BUDGET_MB = 256
const SAMPLE_INTERVAL_MS = 50

const target = FIXTURES.find((f) => f.id === 13)
if (!target) throw new Error("픽스처 #13이 레지스트리에 없다")

// tsx 로더가 worker thread로 전파되지 않아 .mjs 부트스트랩을 거친다.
const workerUrl = new URL("./perf-worker-boot.mjs", import.meta.url)

console.log(`성능 게이트 — #${target.id} ${target.file}`)
console.log(`기준: ${TIME_BUDGET_MS / 1000}초 / 피크 RSS ${MEMORY_BUDGET_MB}MB\n`)

const baselineRss = process.memoryUsage().rss
let peakRss = baselineRss
let lastProgress = 0
const t0 = performance.now()

const worker = new Worker(fileURLToPath(workerUrl), {
  workerData: {
    path: fixturePath(target),
    fileName: target.file,
    chunkSize: 5_000,
  },
  // execArgv를 지정하지 않는다 — 워커는 부모의 `process.execArgv`를 물려받고,
  // 거기에 tsx가 등록한 로더가 이미 들어 있다. 직접 지정하면 그 로더를 덮어써
  // 워커가 .ts를 못 읽는다.
})

// RSS는 프로세스 전체 값이다. 워커가 무거운 일을 하는 동안의 피크를 그 워커의
// 발자국으로 본다 — 메인 스레드 몫이 섞여 있으니 보수적인 수치다.
const sampler = setInterval(() => {
  const rss = process.memoryUsage().rss
  if (rss > peakRss) peakRss = rss
}, SAMPLE_INTERVAL_MS)

interface DoneMessage {
  readonly type: "done"
  readonly format: string
  readonly sheetName: string
  readonly physicalRowCount: number
  readonly columnCount: number
  readonly headerRow: number | null
  readonly dataRowCount: number
  readonly normalizedRows: number
  readonly chunkCount: number
  readonly timings: Record<string, number>
  readonly workerPeakRssMb: number
  readonly workbookRssMb: number
}

type WorkerMessage = { type: "progress"; rows: number } | DoneMessage

const result = await new Promise<DoneMessage>((resolve, reject) => {
  worker.on("message", (m: WorkerMessage) => {
    if (m.type === "progress") {
      // 헌장 C-5 "대용량 진행" — 진행 표시가 실제로 흐르는지 확인한다.
      lastProgress = m.rows
      process.stdout.write(`\r  진행 ${lastProgress.toLocaleString()}행...`)
    } else {
      resolve(m)
    }
  })
  worker.on("error", reject)
  worker.on("exit", (code) => {
    if (code !== 0) reject(new Error(`워커가 코드 ${code}로 종료됐다`))
  })
})

clearInterval(sampler)
await worker.terminate()

const elapsedMs = Math.round(performance.now() - t0)
const peakMb = Math.round(((peakRss - baselineRss) / 1024 / 1024) * 10) / 10
const peakAbsMb = Math.round((peakRss / 1024 / 1024) * 10) / 10

const timePass = elapsedMs <= TIME_BUDGET_MS
const memPass = peakMb <= MEMORY_BUDGET_MB

process.stdout.write("\r" + " ".repeat(48) + "\r")
console.log(`파일     ${result.format} / ${result.sheetName}`)
console.log(
  `구조     물리 ${result.physicalRowCount.toLocaleString()}행 x ${result.columnCount}열, 헤더 ${result.headerRow}행`,
)
console.log(
  `처리     데이터 ${result.dataRowCount.toLocaleString()}행, 청크 ${result.chunkCount}개, 진행 보고 ${lastProgress.toLocaleString()}행`,
)
console.log(
  `단계별   읽기 ${result.timings.readMs}ms / 판정 ${result.timings.sniffMs}ms / 파싱 ${result.timings.openMs}ms / 스트림 ${result.timings.streamMs}ms`,
)
console.log(`워크북   XLSX.read 직후 증가분 +${result.workbookRssMb}MB (우리 스트리밍 이전)`)
console.log("")
console.log(
  `시간     ${(elapsedMs / 1000).toFixed(1)}초 / ${TIME_BUDGET_MS / 1000}초   ${timePass ? "통과" : "초과"}`,
)
console.log(
  `메모리   +${peakMb}MB / ${MEMORY_BUDGET_MB}MB (절대 ${peakAbsMb}MB)   ${memPass ? "통과" : "초과"}`,
)
console.log("")

if (!timePass || !memPass) {
  console.log("판정: SheetJS 전량 적재의 한계가 측정으로 확인됐다.")
  console.log(
    "      ADR-001 조건 1에 따라 Extraction 단계만 Rust로 교체하는 검토가 세션 2에서 발동한다.",
  )
  process.exitCode = 1
} else {
  console.log("판정: 두 기준 모두 통과. 단계별 Rust 교체는 발동하지 않는다.")
}
