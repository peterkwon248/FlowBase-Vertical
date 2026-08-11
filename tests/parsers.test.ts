import { describe, it, expect } from "vitest"
import { parseDelimited } from "../src/core/import/parsers/delimited.js"
import { dateToRaw } from "../src/core/import/parsers/sheetjs-common.js"
import { charsetFromMeta } from "../src/core/import/parsers/html-table.js"
import { parserFor } from "../src/core/import/parsers/index.js"
import { sniff } from "../src/core/import/recognition/sniff.js"
import { FIXTURES, readFixture, fixturesPresent } from "./fixtures.js"

describe("delimited — C-8이 지목한 멀티라인 quoted 셀 버그", () => {
  it("따옴표 안의 줄바꿈을 셀 내용으로 유지한다", () => {
    // upstream `parseDelimited`는 줄로 먼저 쪼개서 이 입력을 3행으로 만든다.
    const text = 'id,주소\n1,"서울시 강남구\n테헤란로 1",\n'
    const rows = parseDelimited(text, ",")
    expect(rows).toHaveLength(2)
    expect(rows[1]).toEqual(["1", "서울시 강남구\n테헤란로 1", ""])
  })

  it("따옴표 안의 구분자를 나누지 않는다", () => {
    expect(parseDelimited('a,"1,200",c\n', ",")[0]).toEqual(["a", "1,200", "c"])
  })

  it('"" 를 리터럴 따옴표로 푼다', () => {
    expect(parseDelimited('a,"그는 ""안녕"" 이라 했다",c\n', ",")[0]).toEqual([
      "a",
      '그는 "안녕" 이라 했다',
      "c",
    ])
  })

  it("빈 행을 버리지 않는다 — 행 번호가 어긋나면 오류를 짚어줄 수 없다", () => {
    // upstream은 `.filter((l) => l.length > 0)`로 이 행을 없앤다.
    const rows = parseDelimited("a,b\n\nc,d\n", ",")
    expect(rows).toHaveLength(3)
    expect(rows[1]).toEqual([""])
  })

  it("CRLF와 마지막 개행 없는 파일을 함께 처리한다", () => {
    expect(parseDelimited("a,b\r\nc,d", ",")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ])
  })

  it("따옴표 안의 CRLF도 보존한다", () => {
    const rows = parseDelimited('1,"줄1\r\n줄2"\r\n', ",")
    expect(rows).toHaveLength(1)
    expect(rows[0]?.[1]).toBe("줄1\r\n줄2")
  })
})

describe("날짜 — 타임존 함정", () => {
  it("SheetJS가 만든 UTC 자정을 달력 날짜로 읽는다", () => {
    // SheetJS는 시리얼을 UTC 자정으로 실체화한다 (#11 검증).
    expect(dateToRaw(new Date("2026-07-01T00:00:00.000Z"))).toBe("2026-07-01")
  })

  it("로컬 게터를 썼다면 깨질 입력으로 확인한다", () => {
    const d = new Date("2026-07-01T00:00:00.000Z")
    // KST(UTC+9)에서 로컬 게터는 09:00을, UTC보다 서쪽에서는 전날을 준다.
    // 결과가 실행 환경에 좌우되면 안 된다.
    expect(dateToRaw(d)).toBe("2026-07-01")
    expect(dateToRaw(d)).not.toContain("T")
  })

  it("시각이 있으면 함께 담는다", () => {
    expect(dateToRaw(new Date("2026-07-01T13:05:09.000Z"))).toBe("2026-07-01T13:05:09")
  })
})

describe("HTML — charset 선언", () => {
  it("meta 선언을 읽는다", () => {
    const b = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)))
    expect(charsetFromMeta(b('<meta charset="euc-kr">'))).toBe("euc-kr")
    expect(charsetFromMeta(b('<meta content="text/html; charset=UTF-8">'))).toBe("utf-8")
    expect(charsetFromMeta(b('<meta charset="ks_c_5601-1987">'))).toBe("euc-kr")
    expect(charsetFromMeta(b("<html><body>"))).toBeNull()
  })
})

describe.runIf(fixturesPresent())("파서 4종 — 픽스처 15개", () => {
  it("전부 열리고 시트가 하나 이상 나온다", async () => {
    const failed: string[] = []
    for (const f of FIXTURES) {
      const bytes = readFixture(f)
      const format = sniff(bytes, f.file).candidates[0]!.format
      try {
        const src = await parserFor(format).open(bytes)
        if (src.sheets.length === 0) failed.push(`#${f.id} 시트 0개`)
        src.close()
      } catch (e) {
        failed.push(`#${f.id} ${f.file}: ${(e as Error).message}`)
      }
    }
    expect(failed.join("\n")).toBe("")
  })

  it("#6 BIFF — 헤더가 6행에 있고 59컬럼이다 (ADR-001 조건 2 검증 대상)", async () => {
    const f = FIXTURES.find((x) => x.id === 6)!
    const src = await parserFor("biff").open(readFixture(f))
    const sheet = src.sheets[0]!
    expect(sheet.columnCount).toBe(59)

    const rows: (readonly unknown[])[] = []
    for await (const chunk of src.stream(0)) rows.push(...chunk.rows)
    // 0-기준 5행 = 1-기준 6행.
    expect(rows[5]?.slice(0, 5)).toEqual(["NO", "주문번호", "주문순번", "배송번호", "주문상태"])
    src.close()
  })

  it("#12 HTML — 표를 읽고 병합 셀을 숨기지 않는다", async () => {
    const f = FIXTURES.find((x) => x.id === 12)!
    const src = await parserFor("html-table").open(readFixture(f))
    const sheet = src.sheets[0]!
    // 병합이 있는 파일이다 — 파서가 채우지 않고 사실대로 전달해야 한다.
    expect(sheet.merges.length).toBe(36)

    const rows: (readonly unknown[])[] = []
    for await (const chunk of src.stream(0)) rows.push(...chunk.rows)

    // !ref가 A2:N127이다 — 1행은 비어 있고 헤더는 2행(0-기준 1)에 있다.
    // 절대 행 번호를 유지한다. openpyxl의 max_row와 같은 기준이라 대조표와 맞고,
    // 사용자에게 "3행이 잘못됐습니다"라고 말할 때 그 3행이 실제 3행이어야 한다.
    expect(rows[0]).toEqual([])
    expect(rows[1]?.[0]).toBe("날짜")

    // raw: true라 콤마 표기가 살아 있어야 한다 — 변환은 Normalization의 일이다.
    expect(rows[3]?.[2]).toBe("753,100")
    src.close()
  })

  it("#11 — 날짜가 07-01부터 시작한다 (하루 밀림 없음)", async () => {
    const f = FIXTURES.find((x) => x.id === 11)!
    const src = await parserFor("xlsx").open(readFixture(f))
    const rows: (readonly unknown[])[] = []
    for await (const chunk of src.stream(0)) rows.push(...chunk.rows)
    expect(rows[1]?.[0]).toBe("2026-07-01")
    src.close()
  })

  it("#1 — UTF-16 TSV가 27컬럼으로 읽힌다", async () => {
    const f = FIXTURES.find((x) => x.id === 1)!
    const bytes = readFixture(f)
    const top = sniff(bytes, f.file).candidates[0]!
    const src = await parserFor("delimited").open(bytes, {
      encoding: top.encoding!,
      delimiter: top.delimiter!,
    })
    expect(src.sheets[0]!.columnCount).toBe(27)
    const rows: (readonly unknown[])[] = []
    for await (const chunk of src.stream(0)) rows.push(...chunk.rows)
    expect(rows[0]?.[0]).toBe("날짜")
    expect(rows[1]?.[0]).toBe("합계")
    src.close()
  })

  it("#8 — 라이브러리 경고를 삼키지 않고 표면화한다", async () => {
    // #8의 zip은 data descriptor 방식이라 로컬 헤더의 크기 필드가 0이다.
    // SheetJS는 경고를 stderr로 흘리고 정상 복구한다 — 그 경고를 잡아야 한다.
    const f = FIXTURES.find((x) => x.id === 8)!
    const src = await parserFor("xlsx").open(readFixture(f))
    expect(src.warnings.length).toBeGreaterThan(0)
    expect(src.warnings.some((w) => w.includes("Bad uncompressed size"))).toBe(true)

    // 경고가 있어도 데이터는 온전하다 — 대조표: 헤더 1행 + 데이터 160행, 15컬럼.
    expect(src.sheets[0]!.columnCount).toBe(15)
    expect(src.sheets[0]!.physicalRowCount).toBe(161)
    src.close()
  })

  it("정상 파일에는 경고가 붙지 않는다", async () => {
    const f = FIXTURES.find((x) => x.id === 11)!
    const src = await parserFor("xlsx").open(readFixture(f))
    expect(src.warnings).toEqual([])
    src.close()
  })

  it("미리보기는 전체 파싱보다 적게 읽는다", async () => {
    // #13(80,138행)에서 미리보기가 전체를 읽으면 헌장 B-9 위반이다.
    const f = FIXTURES.find((x) => x.id === 13)!
    const bytes = readFixture(f)
    const t0 = performance.now()
    const preview = await parserFor("xlsx").preview(bytes, 20)
    const previewMs = performance.now() - t0
    expect(preview.length).toBeLessThanOrEqual(20)
    expect(preview[0]?.[0]).toBe("과금 방식")
    // 전체 파싱 대비 확연히 빨라야 한다 — 같은 비용이면 분리가 무의미하다.
    expect(previewMs).toBeLessThan(5_000)
  })
})
