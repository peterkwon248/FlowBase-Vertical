/**
 * 픽스처 하네스 — `expected*` 매니페스트 초안 생성기.
 *
 * 15개 픽스처를 파이프라인에 통과시켜 실측값을 뽑는다. 이 결과는
 * `docs/픽스처-대조표.md`(다른 도구로 독립 실측한 표)와 **교차 대조**된다.
 * 우리 파서로 만든 값이 곧 정답이 되는 순환을 끊는 게 그 대조의 목적이므로,
 * 여기서는 판정하지 않고 **측정만** 한다.
 *
 * 행 수는 두 가지를 모두 기록한다:
 *   physicalRowCount  시트의 물리적 최대 행 (openpyxl `max_row`와 같은 정의)
 *   dataRowCount      헤더·제목·합계·빈 행을 뺀 실데이터 행
 * 대조표는 전자 기준이고 파서의 자연스러운 출력은 후자라, 둘 다 있어야
 * "정의 차이"와 "진짜 불일치"를 가를 수 있다.
 *
 *   npm run harness
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { sniff } from "../../src/core/import/recognition/sniff.js"
import { parserFor } from "../../src/core/import/parsers/index.js"
import { extractSheet } from "../../src/core/import/extraction/index.js"
import type { RawRow } from "../../src/core/import/types.js"
import { FIXTURES, readFixture, fixturesPresent } from "../../tests/fixtures.js"

const here = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(here, "..", "..", "fixtures", "manifest")

export interface SheetManifest {
  readonly name: string
  readonly index: number
  readonly role: string
  readonly roleReason: string
  readonly physicalRowCount: number
  readonly columnCount: number
  /** 1-기준. 대조표가 "헤더 6행"처럼 1-기준으로 적혀 있다. */
  readonly headerRow: number | null
  readonly headerConfidence: number
  readonly headerColumns: readonly string[]
  readonly dataRowCount: number
  readonly excludedCounts: Record<string, number>
  readonly mergeCount: number
}

export interface FixtureManifest {
  readonly id: number
  readonly file: string
  readonly expectedProfile: string
  readonly profileConfidence: number
  readonly encoding: string | null
  readonly delimiter: string | null
  readonly extensionMismatch: boolean
  readonly identityNotes: readonly string[]
  readonly parserWarnings: number
  readonly expectedSheets: readonly SheetManifest[]
  readonly dataSheetCount: number
  readonly elapsedMs: number
}

export async function buildManifest(): Promise<FixtureManifest[]> {
  const out: FixtureManifest[] = []

  for (const f of FIXTURES) {
    const bytes = readFixture(f)
    const t0 = performance.now()
    const rec = sniff(bytes, f.file)
    const top = rec.candidates[0]!
    const parser = parserFor(top.format)

    const openOpts = {
      ...(top.encoding ? { encoding: top.encoding } : {}),
      ...(top.delimiter ? { delimiter: top.delimiter } : {}),
    }
    const src = await parser.open(bytes, openOpts)

    const sheets: SheetManifest[] = []
    for (const sheet of src.sheets) {
      const rows: RawRow[] = []
      for await (const chunk of src.stream(sheet.index)) rows.push(...chunk.rows)
      const ex = extractSheet(sheet, rows)

      const counts: Record<string, number> = {}
      for (const e of ex.excluded) counts[e.reason] = (counts[e.reason] ?? 0) + 1

      sheets.push({
        name: ex.sheet.name,
        index: ex.sheet.index,
        role: ex.sheet.role,
        roleReason: ex.sheet.reason,
        physicalRowCount: sheet.physicalRowCount,
        columnCount: sheet.columnCount,
        headerRow: ex.header.rowIndex === null ? null : ex.header.rowIndex + 1,
        headerConfidence: Number(ex.header.confidence.toFixed(3)),
        headerColumns: ex.header.columns.slice(0, 12),
        dataRowCount: ex.dataRowCount,
        excludedCounts: counts,
        mergeCount: sheet.merges.length,
      })
    }
    src.close()

    out.push({
      id: f.id,
      file: f.file,
      expectedProfile: top.format,
      profileConfidence: Number(top.confidence.toFixed(3)),
      encoding: top.encoding ?? null,
      delimiter: top.delimiter ?? null,
      extensionMismatch: rec.extensionMismatch,
      identityNotes: rec.identityNotes,
      parserWarnings: src.warnings.length,
      expectedSheets: sheets,
      dataSheetCount: sheets.filter((s) => s.role === "data").length,
      elapsedMs: Math.round(performance.now() - t0),
    })
  }

  return out
}

function render(m: FixtureManifest[]): string {
  const lines: string[] = []
  for (const f of m) {
    lines.push(
      `\n#${f.id} ${f.file}`,
      `   포맷 ${f.expectedProfile} (${f.profileConfidence})` +
        (f.encoding ? ` · ${f.encoding}` : "") +
        (f.delimiter ? ` · 구분자 ${JSON.stringify(f.delimiter)}` : "") +
        ` · 시트 ${f.expectedSheets.length}개(데이터 ${f.dataSheetCount}) · ${f.elapsedMs}ms`,
    )
    if (f.identityNotes.length) lines.push(`   정체: ${f.identityNotes.join(" ")}`)
    if (f.parserWarnings) lines.push(`   ⚠ 파서 경고 ${f.parserWarnings}건`)
    for (const s of f.expectedSheets) {
      const flag = s.role === "data" ? " " : s.role === "summary" ? "~" : "·"
      lines.push(
        `   ${flag} [${s.index}] ${s.name}` +
          `  물리 ${s.physicalRowCount}행×${s.columnCount}열` +
          `  헤더 ${s.headerRow ?? "없음"}행(${s.headerConfidence})` +
          `  데이터 ${s.dataRowCount}행` +
          (s.mergeCount ? `  병합 ${s.mergeCount}` : ""),
      )
      if (s.headerRow !== null) {
        lines.push(`       ${s.headerColumns.slice(0, 8).join(" | ")}`)
      }
    }
  }
  return lines.join("\n")
}

if (!fixturesPresent()) {
  console.error("픽스처가 fixtures/raw/ 에 없다. 하네스를 돌릴 수 없다.")
  process.exit(1)
}

const manifest = await buildManifest()
mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8")
console.log(render(manifest))
console.log(`\n→ ${join(OUT_DIR, "manifest.json")}`)
