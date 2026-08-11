/**
 * fast path와 SheetJS 경로가 **같은 결과**를 내는지 확인한다.
 *
 * 빠른데 다른 답을 내면 최악이다 (헌장 A-5). 두 경로를 각각 돌려 전 행의
 * 해시를 비교한다 — 동시에 열지 않으므로 메모리가 겹치지 않는다.
 *
 *   npx tsx tools/harness/verify-fast-path.ts <픽스처번호>
 */

import { createHash } from "node:crypto"
import { openXlsxFast } from "../../src/core/import/parsers/xlsx-sax.js"
import { openWorkbook, readWorkbook } from "../../src/core/import/parsers/sheetjs-common.js"
import type { ParsedSource, RawRow } from "../../src/core/import/types.js"
import { FIXTURES, readFixture } from "../../tests/fixtures.js"

const id = Number(process.argv[2] ?? 13)
const f = FIXTURES.find((x) => x.id === id)
if (!f) throw new Error(`픽스처 #${id}가 없다`)

/** 셀 표현을 타입까지 포함해 안정적으로 직렬화한다. */
function serialize(row: RawRow): string {
  return row
    .map((c) => {
      if (c === null) return "~"
      if (typeof c === "number") return `n:${c}`
      if (typeof c === "boolean") return `b:${c}`
      return `s:${c}`
    })
    .join("")
}

interface Scan {
  readonly rows: number
  readonly digest: string
  readonly firstRows: string[]
  readonly lastRow: string
}

async function scan(src: ParsedSource): Promise<Scan> {
  const h = createHash("sha256")
  let rows = 0
  const firstRows: string[] = []
  let lastRow = ""
  for await (const chunk of src.stream(0)) {
    for (const row of chunk.rows) {
      const s = serialize(row)
      h.update(s)
      h.update("")
      if (rows < 3) firstRows.push(s.slice(0, 120))
      lastRow = s.slice(0, 120)
      rows++
    }
  }
  return { rows, digest: h.digest("hex").slice(0, 16), firstRows, lastRow }
}

const bytes = readFixture(f)
console.log(`#${id} ${f.file}  (${(bytes.length / 1024 / 1024).toFixed(1)}MB)\n`)

const fast = openXlsxFast(bytes)
if (!fast.ok) {
  console.log(`fast path 거절: ${fast.reason}`)
  process.exit(1)
}

const t1 = performance.now()
const fastScan = await scan(fast.source)
const fastMs = Math.round(performance.now() - t1)
fast.source.close()
console.log(`fast path  ${fastScan.rows.toLocaleString()}행  ${fastScan.digest}  ${fastMs}ms`)

if (global.gc) global.gc()

const t2 = performance.now()
const sheetjs = openWorkbook(readWorkbook(bytes))
const sjScan = await scan(sheetjs)
const sjMs = Math.round(performance.now() - t2)
sheetjs.close()
console.log(`SheetJS    ${sjScan.rows.toLocaleString()}행  ${sjScan.digest}  ${sjMs}ms`)

console.log("")
const rowsMatch = fastScan.rows === sjScan.rows
const digestMatch = fastScan.digest === sjScan.digest

if (rowsMatch && digestMatch) {
  console.log(`일치. 전 ${fastScan.rows.toLocaleString()}행이 셀 값·타입까지 동일하다.`)
  console.log(`속도 ${(sjMs / fastMs).toFixed(1)}배`)
} else {
  console.log(`불일치 — 행 수 ${rowsMatch ? "같음" : `${fastScan.rows} vs ${sjScan.rows}`}`)
  console.log(`         해시 ${digestMatch ? "같음" : "다름"}`)
  console.log("\nfast path 첫 행들:")
  for (const r of fastScan.firstRows) console.log("  " + r)
  console.log("SheetJS 첫 행들:")
  for (const r of sjScan.firstRows) console.log("  " + r)
  console.log(`\nfast path 마지막: ${fastScan.lastRow}`)
  console.log(`SheetJS 마지막:   ${sjScan.lastRow}`)
  process.exitCode = 1
}
