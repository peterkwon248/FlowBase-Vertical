/**
 * data descriptor 방식 zip으로 포장한 합성 xlsx 생성기.
 *
 * ★ 왜 필요한가 ★
 * 픽스처 #8 원본은 zip 로컬 헤더의 크기·CRC 필드가 0이고 실제 값이 데이터 뒤의
 * data descriptor에 오는 형식이다. SheetJS는 이를 만나면
 * `Bad uncompressed size: … != 0`을 **stderr로 흘리고 계속 진행한다** — 헌장 A-5가
 * 금지하는 조용한 실패의 전형이라, 우리 파서는 이 경고를 잡아 표면화한다.
 *
 * 그런데 비식별화 과정에서 #8을 재압축하면서 그 성질이 사라졌다. 원본에만 남은
 * 성질에 테스트를 걸면 CI에서 영영 안 돌고, 안 도는 테스트는 없는 테스트다.
 * 그래서 같은 성질을 갖는 **개인정보 없는 합성 파일**을 만든다.
 *
 *   npx tsx tools/fixtures/make-datadesc-xlsx.ts
 */

import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { deflateSync } from "fflate"

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, "..", "..", "fixtures", "synthetic")

// ─── CRC32 ────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// ─── 바이트 쓰기 도구 ──────────────────────────────────────────
class Writer {
  private parts: Uint8Array[] = []
  length = 0

  push(b: Uint8Array): void {
    this.parts.push(b)
    this.length += b.length
  }

  u16(n: number): void {
    this.push(new Uint8Array([n & 0xff, (n >> 8) & 0xff]))
  }

  u32(n: number): void {
    this.push(new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]))
  }

  bytes(): Uint8Array {
    const out = new Uint8Array(this.length)
    let at = 0
    for (const p of this.parts) {
      out.set(p, at)
      at += p.length
    }
    return out
  }
}

const enc = new TextEncoder()

interface Entry {
  readonly name: string
  readonly data: Uint8Array
}

/**
 * zip을 쓴다. **모든 항목이 data descriptor 방식이다:**
 *   - 로컬 헤더의 CRC·압축크기·원본크기 = 0
 *   - 범용 플래그 bit 3 (0x0008) 설정
 *   - 데이터 뒤에 descriptor(시그니처 + CRC + 크기 2종)
 *   - 중앙 디렉터리에는 실제 값
 *
 * ★ 압축은 DEFLATE여야 한다 (method 8) ★
 * 처음에 STORE(method 0)로 만들었더니 SheetJS가 경고가 아니라 예외를 던졌다.
 * 당연하다 — 로컬 헤더의 크기가 0인데 STORE면 데이터가 어디서 끝나는지 알 방법이
 * 없다. DEFLATE 스트림은 자기 종료라 크기를 몰라도 끝을 찾을 수 있고, 그래서
 * 리더가 "크기가 이상하지만 읽긴 읽었다"는 상태에 도달한다 — 그게 #8 원본에서
 * 관찰된 상황이고 우리가 재현하려는 것이다.
 */
function writeZipWithDataDescriptors(
  entries: readonly Entry[],
  {
    omitDescriptor = false,
    descriptorUsizeZero = false,
  }: { omitDescriptor?: boolean; descriptorUsizeZero?: boolean } = {},
): Uint8Array {
  const w = new Writer()
  const central: {
    name: string
    crc: number
    csize: number
    usize: number
    offset: number
  }[] = []

  for (const e of entries) {
    const offset = w.length
    const name = enc.encode(e.name)
    const crc = crc32(e.data)
    const deflated = deflateSync(e.data, { level: 6 })

    w.u32(0x04034b50) // 로컬 파일 헤더 시그니처
    w.u16(20) // 필요 버전
    w.u16(0x0008) // ★ bit 3 — 크기·CRC는 데이터 뒤에 온다
    w.u16(8) // ★ method 8 = deflate (자기 종료 스트림)
    w.u16(0) // 시각
    w.u16(0) // 날짜
    w.u32(0) // ★ CRC = 0
    w.u32(0) // ★ 압축 크기 = 0
    w.u32(0) // ★ 원본 크기 = 0
    w.u16(name.length)
    w.u16(0) // extra 없음
    w.push(name)
    w.push(deflated)

    // data descriptor.
    //
    // ★ 여기가 재현의 핵심이다 ★
    //   descriptor를 아예 빼면  → 리더가 데이터 경계를 못 찾아 **예외**를 던진다
    //   전부 올바르게 쓰면      → 리더가 크기를 복원해 경고가 없다
    //   압축 크기만 맞고 원본 크기가 0이면 → 데이터는 읽히는데 크기 검증만 어긋난다
    //
    // 마지막이 #8 원본의 상태이고 `Bad uncompressed size: 1053 != 0`이 그 결과다.
    // 읽기는 성공했는데 라이브러리가 stderr로 불평만 하고 넘어가는 바로 그 상황 —
    // 헌장 A-5가 조용한 실패라 부르는 것.
    if (!omitDescriptor) {
      w.u32(0x08074b50)
      w.u32(crc)
      w.u32(deflated.length)
      w.u32(descriptorUsizeZero ? 0 : e.data.length)
    }

    central.push({ name: e.name, crc, csize: deflated.length, usize: e.data.length, offset })
  }

  const cdStart = w.length
  for (const c of central) {
    const name = enc.encode(c.name)
    w.u32(0x02014b50)
    w.u16(20) // 만든 버전
    w.u16(20) // 필요 버전
    w.u16(0x0008)
    w.u16(0)
    w.u16(0)
    w.u16(0)
    w.u32(c.crc) // 여기에는 실제 값이 있다
    w.u32(c.csize)
    w.u32(c.usize)
    w.u16(name.length)
    w.u16(0)
    w.u16(0)
    w.u16(0)
    w.u16(0)
    w.u32(0)
    w.u32(c.offset)
    w.push(name)
  }
  const cdSize = w.length - cdStart

  w.u32(0x06054b50) // EOCD
  w.u16(0)
  w.u16(0)
  w.u16(central.length)
  w.u16(central.length)
  w.u32(cdSize)
  w.u32(cdStart)
  w.u16(0)

  return w.bytes()
}

// ─── 최소 xlsx 구성 ────────────────────────────────────────────
// 개인정보가 없는 합성 데이터. 구조만 갖추면 되므로 작게 만든다.
const ROWS = [
  ["날짜", "채널", "수량", "금액"],
  ["2026-07-01", "채널A", "3", "30000"],
  ["2026-07-02", "채널B", "1", "9900"],
  ["2026-07-03", "채널A", "7", "77000"],
]

function sheetXml(rows: readonly (readonly string[])[]): string {
  const cols = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((v, c) => {
          const ref = `${cols[c]}${r + 1}`
          // 숫자는 숫자로, 나머지는 인라인 문자열로 — sharedStrings를 만들지 않는다.
          return /^\d+$/.test(v)
            ? `<c r="${ref}"><v>${v}</v></c>`
            : `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`
        })
        .join("")
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join("")
  const last = `${cols[(rows[0]?.length ?? 1) - 1]}${rows.length}`
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}"/><sheetData>${body}</sheetData></worksheet>`
}

const entries: Entry[] = [
  {
    name: "[Content_Types].xml",
    data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ),
  },
  {
    name: "_rels/.rels",
    data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
  },
  {
    name: "xl/workbook.xml",
    data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="합성시트" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
  },
  {
    name: "xl/_rels/workbook.xml.rels",
    data: enc.encode(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
  },
  { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheetXml(ROWS)) },
]

mkdirSync(OUT, { recursive: true })

const zip = writeZipWithDataDescriptors(entries, { descriptorUsizeZero: true })
const dest = join(OUT, "datadesc.xlsx")
writeFileSync(dest, zip)

console.log(`${dest}`)
console.log(`  ${zip.length} 바이트 · 항목 ${entries.length}개`)
console.log(`  로컬 헤더 crc/크기 = 0 (flags bit 3), 중앙 디렉터리에만 실제 값`)
console.log(`  시트 "합성시트" — ${ROWS.length}행 × ${ROWS[0]!.length}열, 개인정보 없음`)
