/**
 * 시트 분류를 **이름 힌트 있음 / 없음** 두 가지로 돌려 비교한다.
 *
 * 대조표 함정 #1(타임스탬프 시트명)이 말하는 대로 이름은 힌트고 구조가 본체다.
 * 이름으로 내린 판정이 구조 판정과 어긋나면 그건 이름에 기댄 것이므로,
 * 어긋나는 항목을 드러내는 게 이 도구의 목적이다.
 *
 *   npx tsx tools/harness/classify-check.ts <픽스처번호>
 */

import { sniff } from "../../src/core/import/recognition/sniff.js"
import { parserFor } from "../../src/core/import/parsers/index.js"
import { classifySheet } from "../../src/core/import/extraction/sheets.js"
import type { RawRow } from "../../src/core/import/types.js"
import { FIXTURES, readFixture } from "../../tests/fixtures.js"

const id = Number(process.argv[2])
const f = FIXTURES.find((x) => x.id === id)
if (!f) throw new Error(`픽스처 #${id}가 없다`)

const bytes = readFixture(f)
const top = sniff(bytes, f.file).candidates[0]!
const src = await parserFor(top.format).open(bytes, {
  ...(top.encoding ? { encoding: top.encoding } : {}),
  ...(top.delimiter ? { delimiter: top.delimiter } : {}),
})

console.log(`#${id} ${f.file}\n`)
console.log("시트".padEnd(24) + "이름힌트O".padEnd(12) + "구조만".padEnd(12) + "구조 근거")
console.log("-".repeat(110))

let disagreements = 0
for (const sheet of src.sheets) {
  const rows: RawRow[] = []
  for await (const chunk of src.stream(sheet.index)) rows.push(...chunk.rows)
  const width = Math.max(sheet.columnCount, ...rows.map((r) => r.length), 0)

  const withName = classifySheet(sheet.name, rows, width)
  const structOnly = classifySheet(sheet.name, rows, width, { ignoreNameHints: true })
  const same = withName.role === structOnly.role
  if (!same) disagreements++

  const label = sheet.name.length > 22 ? sheet.name.slice(0, 21) + "…" : sheet.name
  console.log(
    label.padEnd(24) +
      withName.role.padEnd(12) +
      (same ? structOnly.role : `${structOnly.role} ←불일치`).padEnd(12) +
      structOnly.reason.slice(0, 60),
  )
}
src.close()

console.log("-".repeat(110))
console.log(
  disagreements === 0
    ? "이름 힌트를 꺼도 결론이 같다 — 이름에 기대지 않았다."
    : `불일치 ${disagreements}건 — 이 시트들은 이름 때문에 결론이 갈린다.`,
)
