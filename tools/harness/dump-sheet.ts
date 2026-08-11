/**
 * 특정 시트의 원시 행을 그대로 찍는다. 헤더 탐지·분류를 튜닝할 때 쓰는 도구다.
 *
 *   npx tsx tools/harness/dump-sheet.ts <픽스처번호> [시트인덱스] [행수]
 */

import { sniff } from "../../src/core/import/recognition/sniff.js"
import { parserFor } from "../../src/core/import/parsers/index.js"
import type { RawRow } from "../../src/core/import/types.js"
import { FIXTURES, readFixture } from "../../tests/fixtures.js"

const id = Number(process.argv[2])
const sheetIndex = Number(process.argv[3] ?? 0)
const limit = Number(process.argv[4] ?? 12)

const f = FIXTURES.find((x) => x.id === id)
if (!f) {
  console.error(`픽스처 #${id}가 없다`)
  process.exit(1)
}

const bytes = readFixture(f)
const top = sniff(bytes, f.file).candidates[0]!
const src = await parserFor(top.format).open(bytes, {
  ...(top.encoding ? { encoding: top.encoding } : {}),
  ...(top.delimiter ? { delimiter: top.delimiter } : {}),
})

const sheet = src.sheets[sheetIndex]
if (!sheet) {
  console.error(`시트 ${sheetIndex}가 없다. 있는 것: ${src.sheets.map((s) => s.name).join(", ")}`)
  process.exit(1)
}

console.log(`#${id} ${f.file}`)
console.log(`시트[${sheetIndex}] "${sheet.name}" — 물리 ${sheet.physicalRowCount}행 × ${sheet.columnCount}열`)
console.log(`병합 ${sheet.merges.length}개:`, JSON.stringify(sheet.merges.slice(0, 6)))
console.log("")

const rows: RawRow[] = []
for await (const chunk of src.stream(sheetIndex)) rows.push(...chunk.rows)

const show = (c: unknown): string => {
  if (c === null || c === undefined) return "·"
  const s = String(c).replace(/\n/g, "⏎")
  return s.length > 18 ? s.slice(0, 17) + "…" : s
}

for (let r = 0; r < Math.min(limit, rows.length); r++) {
  const row = rows[r] ?? []
  console.log(`${String(r).padStart(3)} (${String(row.length).padStart(2)}칸) ${row.slice(0, 10).map(show).join(" | ")}`)
}
console.log(`…\n마지막 3행:`)
for (let r = Math.max(0, rows.length - 3); r < rows.length; r++) {
  const row = rows[r] ?? []
  console.log(`${String(r).padStart(3)} (${String(row.length).padStart(2)}칸) ${row.slice(0, 10).map(show).join(" | ")}`)
}
src.close()
