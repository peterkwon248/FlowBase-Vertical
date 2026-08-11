/**
 * 픽스처 15개 PII 전수 스캔.
 *
 * 헌장 E-10 — 실명이 든 원본은 커밋 금지. 무엇을 고쳐야 하는지 먼저 알아야
 * 하고, **PII가 없는 파일은 손대지 않아야** 한다. 특히 #13은 성능 판정 대상이라
 * 바이트가 바뀌면 그 측정이 무효가 된다.
 *
 *   npx tsx tools/deident/scan.ts
 */

import { sniff } from "../../src/core/import/recognition/sniff.js"
import { parserFor } from "../../src/core/import/parsers/index.js"
import { detectHeader } from "../../src/core/import/extraction/header.js"
import type { RawRow } from "../../src/core/import/types.js"
import { FIXTURES, readFixture } from "../../tests/fixtures.js"

/**
 * 컬럼 이름이 개인정보를 가리키는가. **순서가 의미를 갖는다** — 위에서부터 먼저
 * 맞는 규칙이 이긴다.
 *
 * 두 가지를 일부러 제외했다:
 *
 *   상품ID·옵션ID·캠페인ID   물건의 식별자지 사람의 식별자가 아니다.
 *                            `아이디|ID`를 통으로 잡았더니 #14·#15의
 *                            `노출상품ID`·`옵션ID`가 걸렸다.
 *   판매아이디               사용자 **본인의** 스토어 계정이고, 값이
 *                            `지마켓(murraymall)`처럼 **채널을 담고 있다.**
 *                            치환하면 채널 배정 신호가 사라진다.
 */
export const PII_HEADERS: readonly { re: RegExp; kind: PiiKind }[] = [
  { re: /이메일|e-?mail|메일/i, kind: "email" },
  { re: /연락처|전화|휴대폰|핸드폰|tel|phone|mobile/i, kind: "phone" },
  { re: /주소|배송지|address/i, kind: "address" },
  // 사람의 계정만. 상품·옵션·캠페인 식별자는 여기 오지 않는다.
  { re: /(구매자|주문자|회원|고객|수취인|수령인)\s*(아이디|ID)/i, kind: "userid" },
  // 끝에서 잡는다 — `구매자ID`가 이름 규칙에 걸리지 않게 한다.
  { re: /(구매자|수령인|수취인|주문자|회원|고객|받는\s*분|보내는\s*분)\s*(명|이름)?$/, kind: "name" },
  { re: /성명$|주문자\s*이름|수취인\s*이름/, kind: "name" },
]

export type PiiKind = "name" | "phone" | "address" | "email" | "userid"

/**
 * 값 자체가 개인정보 모양인가.
 *
 * **문자열 전체가 그 모양이어야 한다.** 처음엔 부분일치로 썼더니
 * `363.30115273775215`(평균 클릭비용) 안의 `011-5273-7752`를 전화번호로 잡았다.
 * 긴 소수는 어떤 숫자 패턴이든 품고 있으므로 부분일치는 쓸 수 없다.
 */
const VALUE_PATTERNS: readonly { re: RegExp; kind: PiiKind }[] = [
  { re: /^01[016789][-\s]?\d{3,4}[-\s]?\d{4}$/, kind: "phone" },
  { re: /^0\d{1,2}[-\s]\d{3,4}[-\s]\d{4}$/, kind: "phone" },
  { re: /^[\w.+-]+@[\w-]+\.[\w.]+$/, kind: "email" },
  {
    re: /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청[북남]도|충[북남]|전라[북남]도|전[북남]|경상[북남]도|경[북남]|제주)[가-힣\d\s]*(시|군|구)/,
    kind: "address",
  },
]

/**
 * 값 모양만으로 인명을 판정하지 않는다.
 *
 * 한국어 2~4자 단어에서 성씨로 시작하는 것을 세어봤더니 `배송완료`·`구매확정`·
 * `신용카드`·`고객변심` 같은 상태값이 대량으로 걸렸다. 오탐은 멀쩡한 데이터를
 * 파괴하므로 이 신호는 **판정이 아니라 검토 대상 표시**로만 쓴다.
 *
 * 인명 열은 헤더로 찾는다 — 실제 픽스처에서 구매자명·수령인명·주문자 이름·
 * 수취인 이름·회원명·성명이 전부 헤더에 그렇게 적혀 있다.
 */
function nameShapedRatio(values: readonly string[]): number {
  const shaped = values.filter((v) => {
    const t = v.trim()
    return t.length >= 2 && t.length <= 4 && /^[가-힣]+$/.test(t)
  }).length
  return values.length === 0 ? 0 : shaped / values.length
}

export interface PiiHit {
  readonly sheet: string
  readonly column: number
  readonly header: string
  readonly kind: PiiKind
  readonly evidence: string
  readonly samples: string[]
  /** true면 치환 대상, false면 사람이 눈으로 확인할 후보다. */
  readonly confirmed: boolean
}

/**
 * `dir`을 명시하지 않으면 `FIXTURE_DIR`(기본 비식별화본)을 본다.
 * **원본을 대상으로 스캔하려면 반드시 `RAW_DIR`을 넘겨야 한다** — 검증 도구가
 * 이걸 빠뜨려 가명을 원본 값으로 착각한 적이 있다.
 */
export async function scanFixture(id: number, dir?: string): Promise<PiiHit[]> {
  const f = FIXTURES.find((x) => x.id === id)!
  const bytes = readFixture(f, dir)
  const top = sniff(bytes, f.file).candidates[0]!
  const src = await parserFor(top.format).open(bytes, {
    ...(top.encoding ? { encoding: top.encoding } : {}),
    ...(top.delimiter ? { delimiter: top.delimiter } : {}),
  })

  const hits: PiiHit[] = []

  for (const sheet of src.sheets) {
    const rows: RawRow[] = []
    let n = 0
    for await (const chunk of src.stream(sheet.index)) {
      rows.push(...chunk.rows)
      n += chunk.rows.length
      if (n > 400) break // 표본이면 충분하다
    }
    if (rows.length === 0) continue

    const width = Math.max(sheet.columnCount, ...rows.map((r) => r.length))
    const header = detectHeader(rows, width)
    const start = header.rowIndex === null ? 0 : header.rowIndex + 1

    for (let c = 0; c < width; c++) {
      const name = header.columns[c] ?? ""
      const values = rows
        .slice(start)
        .map((r) => r[c])
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      if (values.length === 0) continue

      const byHeader = PII_HEADERS.find((p) => p.re.test(name))
      // 값 패턴은 과반이 그 모양일 때만 인정한다 — 한 줄 우연으로 열 전체를
      // 개인정보로 몰지 않는다.
      const byValue = VALUE_PATTERNS.find(
        (p) => values.filter((v) => p.re.test(v)).length / values.length >= 0.5,
      )
      const shaped = nameShapedRatio(values)

      let kind: PiiKind | null = null
      let evidence = ""
      let confirmed = false
      if (byHeader) {
        kind = byHeader.kind
        evidence = `헤더 "${name}"`
        confirmed = true
      } else if (byValue) {
        kind = byValue.kind
        evidence = `값의 과반이 ${byValue.kind} 형식`
        confirmed = true
      } else if (shaped >= 0.9 && values.length >= 10 && new Set(values).size > values.length * 0.5) {
        // 2~4자 한글이 대부분이면서 값이 대체로 서로 다르다 — 상태값은 몇 가지가
        // 반복되므로 고유값 비율로 갈린다. 그래도 단정하지 않고 검토로 넘긴다.
        kind = "name"
        evidence = `2~4자 한글 ${(shaped * 100).toFixed(0)}%, 고유값 다수 — 검토 필요`
        confirmed = false
      }
      if (!kind) continue

      hits.push({
        sheet: sheet.name,
        column: c,
        header: name,
        kind,
        evidence,
        samples: [...new Set(values)].slice(0, 3),
        confirmed,
      })
    }
  }
  src.close()
  return hits
}

if (process.argv[1]?.endsWith("scan.ts")) {
  let confirmed = 0
  let review = 0
  const dirty: number[] = []

  for (const f of FIXTURES) {
    const hits = await scanFixture(f.id)
    if (hits.length === 0) {
      console.log(`#${String(f.id).padStart(2)} ${f.file}  —  PII 없음, 손대지 않는다`)
      continue
    }
    dirty.push(f.id)
    console.log(`#${String(f.id).padStart(2)} ${f.file}`)
    for (const h of hits) {
      if (h.confirmed) confirmed++
      else review++
      const mark = h.confirmed ? "치환" : "검토"
      console.log(
        `     [${mark}·${h.kind}] ${h.sheet} / ${h.column + 1}열 "${h.header}" — ${h.evidence}` +
          `\n            예: ${h.samples.map((s) => (s.length > 26 ? s.slice(0, 25) + "…" : s)).join(" · ")}`,
      )
    }
  }
  console.log(`\n치환 대상 ${confirmed}개 열 · 검토 대상 ${review}개 열`)
  console.log(`손대야 하는 픽스처: ${dirty.map((d) => "#" + d).join(" ") || "(없음)"}`)
  console.log(`손대지 않는 픽스처: ${FIXTURES.filter((f) => !dirty.includes(f.id)).map((f) => "#" + f.id).join(" ")}`)
}
