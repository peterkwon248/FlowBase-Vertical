/**
 * 성능 게이트의 실제 작업자. ADR-001 조건 2 — 파싱은 Worker에서.
 *
 * 메인 스레드에서 재면 Worker가 실제로 쓰는 메모리를 알 수 없고, UI 블로킹
 * 여부도 확인할 수 없다.
 */

import { parentPort, workerData } from "node:worker_threads"
import { readFileSync } from "node:fs"
import { sniff } from "../../src/core/import/recognition/sniff.js"
import { parserFor } from "../../src/core/import/parsers/index.js"
import { streamSheet } from "../../src/core/import/pipeline.js"

interface Input {
  readonly path: string
  readonly fileName: string
  readonly chunkSize: number
}

const { path, fileName, chunkSize } = workerData as Input
const post = (m: unknown): void => parentPort?.postMessage(m)

const t0 = performance.now()
const bytes = new Uint8Array(readFileSync(path))
const tRead = performance.now()

const rec = sniff(bytes, fileName)
const top = rec.candidates[0]!
const tSniff = performance.now()

const rssBeforeOpen = process.memoryUsage().rss
const src = await parserFor(top.format).open(bytes, {
  ...(top.encoding ? { encoding: top.encoding } : {}),
  ...(top.delimiter ? { delimiter: top.delimiter } : {}),
  chunkSize,
})
const tOpen = performance.now()
// 워크북만의 발자국 — 우리 스트리밍 코드가 시작하기 전 값이다. 이 수치가
// 예산을 넘으면 원인은 우리 쪽 누적이 아니라 SheetJS의 전량 적재다.
const rssAfterOpen = process.memoryUsage().rss

const { chunks, getSummary } = streamSheet(src, 0, { chunkSize })

let rows = 0
let chunkCount = 0
// 실제 적재를 흉내 낸다 — 청크를 받아 세고 즉시 버린다. SQLite는 세션 2다.
for await (const chunk of chunks) {
  rows += chunk.rowCount
  chunkCount++
  post({ type: "progress", rows })
}
const tStream = performance.now()

const summary = getSummary()
src.close()

post({
  type: "done",
  format: top.format,
  sheetName: summary.sheet.name,
  physicalRowCount: summary.sheet.physicalRowCount,
  columnCount: summary.sheet.columnCount,
  headerRow: summary.header.rowIndex === null ? null : summary.header.rowIndex + 1,
  dataRowCount: summary.dataRowCount,
  normalizedRows: rows,
  chunkCount,
  timings: {
    readMs: Math.round(tRead - t0),
    sniffMs: Math.round(tSniff - tRead),
    openMs: Math.round(tOpen - tSniff),
    streamMs: Math.round(tStream - tOpen),
    totalMs: Math.round(tStream - t0),
  },
  workerPeakRssMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10,
  // 워크북 적재만의 증가분 — 책임 소재를 가른다.
  workbookRssMb: Math.round(((rssAfterOpen - rssBeforeOpen) / 1024 / 1024) * 10) / 10,
})
