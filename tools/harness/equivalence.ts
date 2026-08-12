/**
 * 정합성 게이트 — 표현을 바꾸는 리팩터링이 답을 바꾸지 않았음을 증명한다.
 *
 * `NormalizedValue` 평탄화처럼 **표현만** 바꾸는 변경에서는 "빨라졌다·가벼워졌다"
 * 보다 "같은 답이 나온다"가 먼저다. 세션 1의 fast path 검증에서 쓴 방식과 같다 —
 * 속도는 답이 같다는 게 증명된 다음에 취한다.
 *
 * 무엇을 해시하는가:
 *
 *   cells   모든 픽스처 · 모든 시트 · 모든 셀의 `(kind, value, raw)` 3튜플
 *           → 정규화 결과 자체가 한 셀도 안 바뀌었음을 본다
 *   summary 헤더 컬럼 · 컬럼 종류 · 데이터 행 수 · 제외 행 목록(사유·detail 포함)
 *           → 구조 판정과 batch_exclusion에 들어갈 값이 그대로임을 본다
 *   mapped  #13을 쿠팡 프로파일로 매핑한 결과 (sourceKey + fields)
 *           → **실제로 적재되는 행**. 최종 산출물이다
 *
 * 표현이 아니라 의미를 해시한다. 그래서 청크가 행 배열에서 columnar로 바뀌어도
 * 값이 같으면 해시가 같다.
 *
 * 구분자로 ``·``를 쓰는 이유는 데이터에 나올 수 없는 바이트여서다 —
 * `"a"+"bc"`와 `"ab"+"c"`가 같은 해시를 내면 게이트가 셀 경계 이동을 놓친다.
 *
 *   npx tsx tools/harness/equivalence.ts            # 전체
 *   npx tsx tools/harness/equivalence.ts --only=13  # 하나만
 *   npx tsx tools/harness/equivalence.ts --save     # 기준선으로 저장
 *   npx tsx tools/harness/equivalence.ts --check    # 저장된 기준선과 대조
 */

import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { sniff } from "../../src/core/import/recognition/sniff.js"
import { parserFor } from "../../src/core/import/parsers/index.js"
import { streamSheet } from "../../src/core/import/pipeline.js"
import {
  captureFromFileName,
  mapRows,
  newKeyState,
  type MappingProfile,
} from "../../src/core/import/mapping/index.js"
import { FIXTURES, fixturePath, fixturesPresent, type FixtureDef } from "../../tests/fixtures.js"
import { KIND_NAMES, type RawCell } from "../../src/core/import/types.js"

const here = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(here, "..", "..", ".tmp")
const BASELINE = join(OUT_DIR, "equivalence-baseline.json")
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

/** 셀 안 구분자 · 셀 사이 구분자. 데이터에 나올 수 없는 바이트다. */
const FS = ""
const RS = ""

/**
 * 타입까지 구분하는 인코딩. 숫자 `123`과 문자열 `"123"`이 같은 해시를 내면
 * 대조표 함정 #3(주문번호를 숫자로 만드는 사고)을 이 게이트가 못 잡는다.
 * 문자열은 길이를 앞에 붙여 구분자 충돌을 없앤다.
 */
function enc(v: RawCell | undefined): string {
  if (v === undefined) return "?"
  if (v === null) return "~"
  switch (typeof v) {
    case "number":
      // -0과 0은 다른 값이다. NaN도 문자열로 고정한다.
      return Object.is(v, -0) ? "n-0" : "n" + String(v)
    case "boolean":
      return v ? "b1" : "b0"
    default:
      return "s" + String(v.length) + ":" + v
  }
}

interface SheetHashes {
  readonly sheet: number
  readonly cells: string
  readonly summary: string
  readonly rows: number
  readonly cellCount: number
}

async function hashFixture(f: FixtureDef): Promise<SheetHashes[]> {
  const bytes = new Uint8Array(readFileSync(fixturePath(f)))
  const rec = sniff(bytes, f.file)
  const top = rec.candidates[0]!
  const src = await parserFor(top.format).open(bytes, { chunkSize: 5_000 })

  const out: SheetHashes[] = []
  try {
    for (let s = 0; s < src.sheets.length; s++) {
      const cells = createHash("sha256")
      const { chunks, getSummary } = streamSheet(src, s, { chunkSize: 5_000 })
      let rows = 0
      let cellCount = 0

      for await (const chunk of chunks) {
        for (let r = 0; r < chunk.rowCount; r++) {
          // 행 경계를 해시에 넣는다 — 셀을 다른 행으로 옮기는 실수를 잡는다.
          let line = "#" + String(rows) + "|"
          const base = r * chunk.width
          for (let c = 0; c < chunk.width; c++) {
            const i = base + c
            const kind = KIND_NAMES[chunk.kinds[i]!]!
            line += kind + FS + enc(chunk.values[i] ?? null) + FS + enc(chunk.raws[i] ?? null) + RS
            cellCount++
          }
          cells.update(line)
          rows++
        }
      }

      const sum = getSummary()
      const summary = createHash("sha256")
      summary.update("cols:" + sum.header.columns.map(enc).join(RS) + "\n")
      summary.update("headerRow:" + String(sum.header.rowIndex) + "\n")
      summary.update("kinds:" + sum.columnKinds.map((k) => k.kind).join(",") + "\n")
      summary.update("dataRows:" + String(sum.dataRowCount) + "\n")
      // 제외 행은 batch_exclusion에 그대로 들어간다 — detail 문자열까지 본다.
      for (const e of sum.excluded) {
        summary.update("ex:" + String(e.rowIndex) + "|" + e.reason + "|" + e.detail + "\n")
      }

      out.push({
        sheet: s,
        cells: cells.digest("hex").slice(0, 16),
        summary: summary.digest("hex").slice(0, 16),
        rows,
        cellCount,
      })
    }
  } finally {
    src.close()
  }
  return out
}

/** #13의 매핑 결과 — 실제로 SQLite에 들어가는 행 그 자체. */
async function hashMapped(f: FixtureDef): Promise<{ mapped: string; rows: number; errors: number }> {
  const profile = JSON.parse(readFileSync(PROFILE, "utf-8")) as MappingProfile
  const bytes = new Uint8Array(readFileSync(fixturePath(f)))
  const rec = sniff(bytes, f.file)
  const top = rec.candidates[0]!
  const src = await parserFor(top.format).open(bytes, { chunkSize: 1_000 })

  const h = createHash("sha256")
  let rows = 0
  let errors = 0
  try {
    const { chunks, getSummary } = streamSheet(src, 0, { chunkSize: 1_000 })
    const captures = captureFromFileName(profile, f.file)
    const keyState = newKeyState()
    let headers: string[] = []
    let offset = 0

    for await (const chunk of chunks) {
      if (headers.length === 0) headers = [...getSummary().header.columns]
      const mapped = mapRows(
        profile,
        headers,
        chunk,
        { fileName: f.file, fileNameCaptures: captures, keyState },
        offset,
      )
      offset += chunk.rowCount
      errors += mapped.errors.length

      for (const r of mapped.rows) {
        // 필드 순서는 프로파일이 정하지만, 해시는 이름순으로 고정해
        // 키 순서 변화에 흔들리지 않게 한다.
        const keys = Object.keys(r.fields).sort()
        let line = enc(r.sourceKey) + "|"
        for (const k of keys) line += k + "=" + enc(r.fields[k]) + RS
        h.update(line)
        rows++
      }
    }
  } finally {
    src.close()
  }
  return { mapped: h.digest("hex").slice(0, 16), rows, errors }
}

// ── 실행 ──────────────────────────────────────────────────────

const args = process.argv.slice(2)
const onlyArg = args.find((a) => a.startsWith("--only="))
const only = onlyArg ? Number(onlyArg.slice("--only=".length)) : null
const save = args.includes("--save")
const check = args.includes("--check")

if (!fixturesPresent()) {
  console.error("픽스처가 없다. fixtures/clean/ 을 확인해라.")
  process.exit(1)
}

const targets = only === null ? FIXTURES : FIXTURES.filter((f) => f.id === only)
if (targets.length === 0) {
  console.error("픽스처 #" + String(only) + "는 없다.")
  process.exit(1)
}

console.log("정합성 게이트 — 픽스처 " + String(targets.length) + "개\n")

const report: Record<string, unknown> = {}
for (const f of targets) {
  const t0 = performance.now()
  const sheets = await hashFixture(f)
  const totalCells = sheets.reduce((a, s) => a + s.cellCount, 0)
  const totalRows = sheets.reduce((a, s) => a + s.rows, 0)
  report["#" + String(f.id)] = { sheets }

  let tail = ""
  if (f.id === 13) {
    const m = await hashMapped(f)
    ;(report["#" + String(f.id)] as Record<string, unknown>).mapped = m
    tail = " · 매핑 " + m.rows.toLocaleString() + "행 [" + m.mapped + "]"
  }
  console.log(
    "#" +
      String(f.id).padStart(2) +
      " " +
      f.file.slice(0, 40).padEnd(40) +
      " 시트 " +
      String(sheets.length) +
      " · " +
      totalRows.toLocaleString() +
      "행 · " +
      totalCells.toLocaleString() +
      "셀" +
      tail +
      " (" +
      String(Math.round(performance.now() - t0)) +
      "ms)",
  )
}

mkdirSync(OUT_DIR, { recursive: true })
const json = JSON.stringify(report, null, 2)

if (save) {
  writeFileSync(BASELINE, json)
  console.log("\n기준선 저장 → " + BASELINE)
} else if (check) {
  if (!existsSync(BASELINE)) {
    console.error("\n기준선이 없다. 먼저 --save로 만들어라: " + BASELINE)
    process.exit(1)
  }
  const base = JSON.parse(readFileSync(BASELINE, "utf-8")) as Record<string, unknown>
  const diffs: string[] = []
  for (const key of Object.keys(report)) {
    const a = JSON.stringify(base[key])
    const b = JSON.stringify(report[key])
    if (a === undefined) {
      diffs.push(key + ": 기준선에 없다")
      continue
    }
    if (a === b) continue

    diffs.push(key + ": 다르다")
    const bs = (base[key] as { sheets?: SheetHashes[] }).sheets ?? []
    const rs = (report[key] as { sheets?: SheetHashes[] }).sheets ?? []
    for (let i = 0; i < Math.max(bs.length, rs.length); i++) {
      const x = bs[i]
      const y = rs[i]
      if (JSON.stringify(x) === JSON.stringify(y)) continue
      diffs.push(
        "    시트 " +
          String(i) +
          ": cells " +
          (x?.cells ?? "없음") +
          " → " +
          (y?.cells ?? "없음") +
          " · summary " +
          (x?.summary ?? "없음") +
          " → " +
          (y?.summary ?? "없음") +
          " · 행 " +
          String(x?.rows ?? "?") +
          " → " +
          String(y?.rows ?? "?") +
          " · 셀 " +
          String(x?.cellCount ?? "?") +
          " → " +
          String(y?.cellCount ?? "?"),
      )
    }
    const bm = JSON.stringify((base[key] as { mapped?: unknown }).mapped)
    const rm = JSON.stringify((report[key] as { mapped?: unknown }).mapped)
    if (bm !== rm) diffs.push("    매핑: " + String(bm) + " → " + String(rm))
  }
  if (diffs.length > 0) {
    console.log("\n답이 달라졌다 —\n")
    for (const d of diffs) console.log(d)
    process.exitCode = 1
  } else {
    console.log(
      "\n기준선과 동일 — " +
        String(targets.length) +
        "개 픽스처의 모든 셀·구조·매핑 결과가 일치한다.",
    )
  }
} else {
  console.log("\n(--save로 기준선 저장 · --check로 대조)")
}
