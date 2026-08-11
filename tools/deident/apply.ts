/**
 * 비식별화 적용 — `fixtures/raw/` → `fixtures/`
 *
 * 헌장 E-10. 원본은 커밋하지 않고 비식별화본만 테스트 저장소에 넣는다.
 *
 * ★ 구조를 보존해야 한다 ★
 * 행 수·컬럼 수·인코딩·헤더 위치가 바뀌면 `docs/픽스처-대조표.md`가 무효가 된다.
 * 그래서 파일을 다시 조립하지 않고 **최소 침습**으로 고친다:
 *
 *   xlsx  zip을 풀어 `sharedStrings.xml`의 해당 항목만 바꾸고 다시 압축한다.
 *         시트 XML·수식·캐시값·스타일·병합·dimension이 그대로 남는다.
 *         (#3은 셀의 96%가 수식이라 SheetJS로 다시 쓰면 계산 결과가 사라진다.)
 *   BIFF  XML이 없으므로 SheetJS로 읽어 고치고 biff8로 다시 쓴다.
 *         #6은 수식이 없어 이 방식이 안전하다.
 *
 * PII가 없는 파일은 **복사만 한다** — 바이트가 그대로여야 #13의 성능 측정이
 * 계속 유효하다.
 *
 *   npx tsx tools/deident/apply.ts
 */

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { unzipSync, zipSync } from "fflate"
import * as XLSX from "xlsx"
import { sniff } from "../../src/core/import/recognition/sniff.js"
import { parserFor } from "../../src/core/import/parsers/index.js"
import { detectHeader } from "../../src/core/import/extraction/header.js"
import type { RawRow } from "../../src/core/import/types.js"
import { FIXTURES, readFixture, fixturePath, RAW_DIR } from "../../tests/fixtures.js"
import { scanFixture, type PiiKind } from "./scan.js"
import { pseudonymize, alreadyMasked } from "./pseudonym.js"

const here = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(here, "..", "..", "fixtures", "clean")

/** 파일 안의 모든 PII 값을 모아 원본 → 가명 사전을 만든다. */
async function buildMapping(id: number): Promise<Map<string, string>> {
  // 언제나 원본을 본다 — 기본값(FIXTURE_DIR)은 비식별화본을 가리킨다.
  const hits = (await scanFixture(id, RAW_DIR)).filter((h) => h.confirmed)
  const mapping = new Map<string, string>()
  if (hits.length === 0) return mapping

  const f = FIXTURES.find((x) => x.id === id)!
  const bytes = readFixture(f, RAW_DIR)
  const top = sniff(bytes, f.file).candidates[0]!
  const src = await parserFor(top.format).open(bytes, {
    ...(top.encoding ? { encoding: top.encoding } : {}),
    ...(top.delimiter ? { delimiter: top.delimiter } : {}),
  })

  const bySheet = new Map<string, { column: number; kind: PiiKind }[]>()
  for (const h of hits) {
    const list = bySheet.get(h.sheet) ?? []
    list.push({ column: h.column, kind: h.kind })
    bySheet.set(h.sheet, list)
  }

  // 파일 안의 모든 문자열. 가명이 이 안의 값과 겹치면 다시 뽑는다 —
  // 원본에 실재하는 이름이 공개본에 나타나면 안 된다.
  const taken = new Set<string>()
  const targets: { value: string; kind: PiiKind }[] = []

  for (const sheet of src.sheets) {
    const rows: RawRow[] = []
    for await (const chunk of src.stream(sheet.index)) rows.push(...chunk.rows)
    for (const row of rows) {
      for (const cell of row) if (typeof cell === "string") taken.add(cell.trim())
    }

    const cols = bySheet.get(sheet.name)
    if (!cols) continue
    const width = Math.max(sheet.columnCount, ...rows.map((r) => r.length))
    const header = detectHeader(rows, width)
    const start = header.rowIndex === null ? 0 : header.rowIndex + 1

    for (const { column, kind } of cols) {
      for (let r = start; r < rows.length; r++) {
        const v = rows[r]?.[column]
        if (typeof v !== "string") continue
        const t = v.trim()
        if (t.length === 0 || alreadyMasked(t)) continue
        targets.push({ value: v, kind })
      }
    }
  }
  src.close()

  // 정렬해서 처리한다 — 입력 순서가 달라도 같은 결과가 나오도록.
  targets.sort((a, b) => (a.value < b.value ? -1 : a.value > b.value ? 1 : 0))
  // 회피 집합은 한 번만 만들고 배정할 때마다 키운다. 매번 새로 합치면
  // 값 수 × 문자열 수가 되어 큰 파일에서 감당이 안 된다.
  const avoid = new Set(taken)
  for (const { value, kind } of targets) {
    if (mapping.has(value)) continue
    const pseudo = pseudonymize(value, kind, avoid)
    mapping.set(value, pseudo)
    avoid.add(pseudo)
  }
  return mapping
}

const XML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
}
const escapeXml = (s: string): string => s.replace(/[&<>]/g, (c) => XML_ESCAPES[c]!)

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x?([0-9a-fA-F]+);/g, (_, d: string) =>
      String.fromCodePoint(parseInt(d, /^x/i.test(d) ? 16 : 10)),
    )
    .replace(/&amp;/g, "&")
}

/** XML 안의 모든 `<t>` 내용을 사전에 따라 바꾼다. */
function replaceInXml(xml: string, mapping: Map<string, string>): { xml: string; hits: number } {
  let hits = 0
  const out = xml.replace(
    /(<t(?:\s[^>]*)?>)([\s\S]*?)(<\/t>)/g,
    (whole, open: string, body: string, close: string) => {
      const plain = decodeXml(body)
      const replacement = mapping.get(plain) ?? mapping.get(plain.trim())
      if (replacement === undefined) return whole
      hits++
      return `${open}${escapeXml(replacement)}${close}`
    },
  )
  return { xml: out, hits }
}

/**
 * xlsx — `<t>` 내용만 바꾸고 나머지는 그대로 다시 압축한다.
 *
 * 문자열이 어디 있는지는 파일마다 다르다. 대부분은 `sharedStrings.xml`에
 * 모여 있지만, #8은 **인라인 문자열**(`<c t="inlineStr"><is><t>…`)을 써서
 * sharedStrings가 아예 없다. 그래서 sharedStrings에서 못 찾은 게 남아 있으면
 * 워크시트 XML까지 훑는다.
 */
function rewriteXlsx(bytes: Uint8Array, mapping: Map<string, string>): { out: Uint8Array; hits: number } {
  const files = unzipSync(bytes)
  const dec = new TextDecoder("utf-8")
  const enc = new TextEncoder()
  let hits = 0

  const ss = files["xl/sharedStrings.xml"]
  if (ss) {
    const r = replaceInXml(dec.decode(ss), mapping)
    files["xl/sharedStrings.xml"] = enc.encode(r.xml)
    hits += r.hits
  }

  if (hits < mapping.size) {
    for (const name of Object.keys(files)) {
      if (!/^xl\/worksheets\/.*\.xml$/.test(name)) continue
      const r = replaceInXml(dec.decode(files[name]!), mapping)
      if (r.hits === 0) continue
      files[name] = enc.encode(r.xml)
      hits += r.hits
    }
  }

  // 원본과 같은 zip 바이트를 만들 필요는 없다 — 내용이 같으면 된다.
  return { out: zipSync(files, { level: 6 }), hits }
}

/** BIFF — SheetJS로 읽어 셀을 고치고 biff8로 다시 쓴다. */
function rewriteBiff(bytes: Uint8Array, mapping: Map<string, string>): { out: Uint8Array; hits: number } {
  const wb = XLSX.read(bytes, { type: "array", dense: true, cellStyles: false, cellDates: false })
  let hits = 0
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const data = (ws as unknown as { "!data"?: { v?: unknown; t?: string }[][] })["!data"] ?? []
    for (const row of data) {
      if (!row) continue
      for (const cell of row) {
        if (!cell || typeof cell.v !== "string") continue
        const replacement = mapping.get(cell.v) ?? mapping.get(cell.v.trim())
        if (replacement === undefined) continue
        cell.v = replacement
        hits++
      }
    }
  }
  const out = XLSX.write(wb, { type: "array", bookType: "biff8" }) as ArrayBuffer
  return { out: new Uint8Array(out), hits }
}

mkdirSync(OUT_DIR, { recursive: true })

let touched = 0
let copied = 0

for (const f of FIXTURES) {
  const mapping = await buildMapping(f.id)
  const dest = join(OUT_DIR, f.file)

  if (mapping.size === 0) {
    // 바이트 그대로 복사한다 — #13의 성능 측정이 계속 유효해야 한다.
    copyFileSync(fixturePath(f, RAW_DIR), dest)
    copied++
    console.log(`#${String(f.id).padStart(2)} 복사 — PII 없음`)
    continue
  }

  const bytes = readFixture(f, RAW_DIR)
  const isBiff = f.expectedFormat === "biff"
  const { out, hits } = isBiff ? rewriteBiff(bytes, mapping) : rewriteXlsx(bytes, mapping)
  writeFileSync(dest, out)
  touched++
  console.log(
    `#${String(f.id).padStart(2)} 치환 — 고유값 ${mapping.size.toLocaleString()}개 / 셀 ${hits.toLocaleString()}곳` +
      ` (${isBiff ? "BIFF 재작성" : "sharedStrings 수술"})`,
  )
}

console.log(`\n치환 ${touched}개 · 그대로 복사 ${copied}개 → fixtures/clean/`)
