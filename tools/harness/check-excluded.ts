/**
 * 특정 시트에서 무엇이 왜 제외됐는지 찍는다. 판정 근거를 사람이 확인할 때 쓴다.
 *
 *   npx tsx tools/harness/check-excluded.ts <픽스처번호> <시트인덱스>
 */

import { sniff } from "../../src/core/import/recognition/sniff.js"
import { parserFor } from "../../src/core/import/parsers/index.js"
import { extractSheet } from "../../src/core/import/extraction/index.js"
import type { RawRow } from "../../src/core/import/types.js"
import { FIXTURES, readFixture } from "../../tests/fixtures.js"

const id = Number(process.argv[2])
const sheetIndex = Number(process.argv[3] ?? 0)

const f = FIXTURES.find((x) => x.id === id)
if (!f) throw new Error(`픽스처 #${id}가 없다`)

const bytes = readFixture(f)
const top = sniff(bytes, f.file).candidates[0]!
const src = await parserFor(top.format).open(bytes, {
  ...(top.encoding ? { encoding: top.encoding } : {}),
  ...(top.delimiter ? { delimiter: top.delimiter } : {}),
})

const sheet = src.sheets[sheetIndex]!
const rows: RawRow[] = []
for await (const chunk of src.stream(sheetIndex)) rows.push(...chunk.rows)
const ex = extractSheet(sheet, rows)

console.log(`#${id} 시트[${sheetIndex}] "${sheet.name}"`)
console.log(`역할 ${ex.sheet.role} — ${ex.sheet.reason}`)
console.log(`헤더 ${ex.header.rowIndex === null ? "없음" : ex.header.rowIndex + 1}행 (확신 ${ex.header.confidence.toFixed(3)})`)
console.log(`근거: ${ex.header.evidence.join(" / ")}`)
console.log(`데이터 ${ex.dataRowCount}행\n제외 ${ex.excluded.length}건:`)
for (const e of ex.excluded.slice(0, 20)) {
  console.log(`  ${e.rowIndex + 1}행 [${e.reason}] ${e.detail}`)
}
if (ex.excluded.length > 20) console.log(`  … 외 ${ex.excluded.length - 20}건`)
src.close()
