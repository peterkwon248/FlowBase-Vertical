/**
 * 비식별화 검증 — 두 가지를 확인한다.
 *
 *   1. 원본 PII 값이 비식별화본에 **하나도 남아 있지 않다**
 *   2. 구조가 보존됐다 — 시트 수·행 수·컬럼 수·헤더 위치·포맷·인코딩
 *
 * 2번이 깨지면 `docs/픽스처-대조표.md`가 무효가 되고, 1번이 깨지면 커밋하면
 * 안 되는 파일을 커밋하게 된다.
 *
 *   npx tsx tools/deident/verify.ts
 */

import { sniff } from "../../src/core/import/recognition/sniff.js"
import { parserFor } from "../../src/core/import/parsers/index.js"
import { extractSheet } from "../../src/core/import/extraction/index.js"
import type { RawRow } from "../../src/core/import/types.js"
import { FIXTURES, readFixture, RAW_DIR, CLEAN_DIR, fixturesPresent } from "../../tests/fixtures.js"
import { scanFixture } from "./scan.js"
import { alreadyMasked } from "./pseudonym.js"

interface Shape {
  readonly format: string
  readonly encoding: string | null
  readonly sheets: {
    name: string
    physicalRowCount: number
    columnCount: number
    headerRow: number | null
    dataRowCount: number
    role: string
  }[]
}

async function shapeOf(
  id: number,
  dir: string,
  piiColumns?: Map<string, number[]>,
): Promise<{ shape: Shape; values: Set<string>; piiValues: Set<string> }> {
  const f = FIXTURES.find((x) => x.id === id)!
  const bytes = readFixture(f, dir)
  const rec = sniff(bytes, f.file)
  const top = rec.candidates[0]!
  const src = await parserFor(top.format).open(bytes, {
    ...(top.encoding ? { encoding: top.encoding } : {}),
    ...(top.delimiter ? { delimiter: top.delimiter } : {}),
  })

  const shape: Shape = { format: top.format, encoding: top.encoding ?? null, sheets: [] }
  const values = new Set<string>()
  const piiValues = new Set<string>()

  for (const sheet of src.sheets) {
    const rows: RawRow[] = []
    for await (const chunk of src.stream(sheet.index)) rows.push(...chunk.rows)
    const ex = extractSheet(sheet, rows)
    shape.sheets.push({
      name: sheet.name,
      physicalRowCount: sheet.physicalRowCount,
      columnCount: sheet.columnCount,
      headerRow: ex.header.rowIndex,
      dataRowCount: ex.dataRowCount,
      role: ex.sheet.role,
    })
    for (const row of rows) {
      for (const cell of row) if (typeof cell === "string") values.add(cell)
    }
    // PII 열의 값을 **전부** 모은다. 표본 몇 개만 보면 나머지가 샜는지 알 수 없다.
    const cols = piiColumns?.get(sheet.name)
    if (cols) {
      const start = ex.header.rowIndex === null ? 0 : ex.header.rowIndex + 1
      for (let r = start; r < rows.length; r++) {
        for (const c of cols) {
          const v = rows[r]?.[c]
          if (typeof v !== "string") continue
          const t = v.trim()
          if (t.length < 2 || alreadyMasked(t)) continue
          piiValues.add(v)
        }
      }
    }
  }
  src.close()
  return { shape, values, piiValues }
}

if (!fixturesPresent(RAW_DIR)) {
  console.error("원본이 fixtures/raw/에 없다 — 대조할 수 없다.")
  process.exit(1)
}
if (!fixturesPresent(CLEAN_DIR)) {
  console.error("비식별화본이 fixtures/clean/에 없다. 먼저 apply.ts를 돌려라.")
  process.exit(1)
}

let leaks = 0
let shapeBreaks = 0

for (const f of FIXTURES) {
  // ★ 반드시 원본을 스캔한다 ★ 기본값은 비식별화본을 가리키므로, 빠뜨리면
  // 가명을 원본 값으로 착각해 "잔존"이 거짓으로 뜬다 (실제로 겪었다).
  const hits = (await scanFixture(f.id, RAW_DIR)).filter((h) => h.confirmed)

  const piiColumns = new Map<string, number[]>()
  for (const h of hits) {
    piiColumns.set(h.sheet, [...(piiColumns.get(h.sheet) ?? []), h.column])
  }

  const raw = await shapeOf(f.id, RAW_DIR, piiColumns)
  const clean = await shapeOf(f.id, CLEAN_DIR)

  const problems: string[] = []

  // ── 1. 원본 PII 값이 하나라도 남았는가 ──────────────────
  const survived: string[] = []
  for (const original of raw.piiValues) {
    if (clean.values.has(original)) survived.push(original)
    if (survived.length >= 5) break
  }
  if (survived.length > 0) {
    leaks++
    problems.push(
      `원본 값 잔존: ${survived.map((s) => `"${s.length > 20 ? s.slice(0, 19) + "…" : s}"`).join(", ")}`,
    )
  }

  // ── 2. 구조가 보존됐는가 ────────────────────────────────
  if (raw.shape.format !== clean.shape.format) {
    problems.push(`포맷 ${raw.shape.format} → ${clean.shape.format}`)
  }
  if (raw.shape.encoding !== clean.shape.encoding) {
    problems.push(`인코딩 ${raw.shape.encoding} → ${clean.shape.encoding}`)
  }
  if (raw.shape.sheets.length !== clean.shape.sheets.length) {
    problems.push(`시트 수 ${raw.shape.sheets.length} → ${clean.shape.sheets.length}`)
  } else {
    for (const [i, a] of raw.shape.sheets.entries()) {
      const b = clean.shape.sheets[i]!
      const diffs: string[] = []
      if (a.name !== b.name) diffs.push(`이름 ${a.name}→${b.name}`)
      if (a.physicalRowCount !== b.physicalRowCount)
        diffs.push(`물리행 ${a.physicalRowCount}→${b.physicalRowCount}`)
      if (a.columnCount !== b.columnCount) diffs.push(`컬럼 ${a.columnCount}→${b.columnCount}`)
      if (a.headerRow !== b.headerRow) diffs.push(`헤더 ${a.headerRow}→${b.headerRow}`)
      if (a.dataRowCount !== b.dataRowCount)
        diffs.push(`데이터행 ${a.dataRowCount}→${b.dataRowCount}`)
      if (a.role !== b.role) diffs.push(`역할 ${a.role}→${b.role}`)
      if (diffs.length) problems.push(`[${a.name}] ${diffs.join(", ")}`)
    }
  }

  if (problems.length > 0) {
    shapeBreaks++
    console.log(`#${String(f.id).padStart(2)} ${f.file}`)
    for (const p of problems) console.log(`     ✗ ${p}`)
  } else {
    console.log(
      `#${String(f.id).padStart(2)} 통과 — 시트 ${clean.shape.sheets.length}개, 구조 동일` +
        (hits.length ? `, PII 열 ${hits.length}개 치환됨` : ", PII 없음"),
    )
  }
}

console.log("")
if (leaks === 0 && shapeBreaks === 0) {
  console.log("전부 통과. 원본 값 잔존 없음, 구조 보존 확인.")
} else {
  console.log(`잔존 ${leaks}건 · 구조 변경 ${shapeBreaks}건 — 커밋 금지.`)
  process.exitCode = 1
}
