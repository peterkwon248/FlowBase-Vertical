import { describe, it, expect } from "vitest"
import { sniff } from "../src/core/import/recognition/sniff.js"
import { detectEncoding, decodeText } from "../src/core/import/recognition/encoding.js"
import { detectDelimiter } from "../src/core/import/recognition/delimiter.js"
import { FIXTURES, readFixture, fixturesPresent } from "./fixtures.js"

describe("Recognition — 매직 바이트 스니퍼", () => {
  it.runIf(fixturesPresent())("픽스처 15개의 컨테이너 포맷을 전부 맞춘다", () => {
    const wrong: string[] = []
    for (const f of FIXTURES) {
      const r = sniff(readFixture(f), f.file)
      const top = r.candidates[0]
      if (top?.format !== f.expectedFormat) {
        wrong.push(`#${f.id} ${f.file}\n  기대 ${f.expectedFormat} / 실제 ${top?.format} (${top?.confidence.toFixed(2)})`)
      }
    }
    expect(wrong.join("\n")).toBe("")
  })

  it.runIf(fixturesPresent())("확장자가 아니라 내용으로 판정한다", () => {
    // 이름을 속이는 3개가 핵심. 확장자를 따라갔다면 여기서 깨진다.
    const deceptive = FIXTURES.filter((f) => f.deceptiveName)
    expect(deceptive.map((f) => f.id)).toEqual([1, 2, 12])

    for (const f of deceptive) {
      const r = sniff(readFixture(f), f.file)
      expect(r.identityNotes.length, `#${f.id} 정체 고지가 비어 있다`).toBeGreaterThan(0)
    }

    // #12만 컨테이너 포맷 자체가 어긋난다 (.xls → HTML 표).
    const f12 = FIXTURES.find((f) => f.id === 12)!
    expect(sniff(readFixture(f12), f12.file).extensionMismatch).toBe(true)

    // #1은 포맷은 delimited로 일치하지만 구분자·인코딩이 어긋난다.
    const f1 = FIXTURES.find((f) => f.id === 1)!
    const r1 = sniff(readFixture(f1), f1.file)
    expect(r1.extensionMismatch).toBe(false)
    expect(r1.identityNotes.some((n) => n.includes("TAB"))).toBe(true)
    expect(r1.identityNotes.some((n) => n.includes("UTF-16"))).toBe(true)
  })

  it.runIf(fixturesPresent())("인코딩과 구분자를 맞춘다", () => {
    for (const f of FIXTURES) {
      if (!f.expectedEncoding && !f.expectedDelimiter) continue
      const top = sniff(readFixture(f), f.file).candidates[0]
      if (f.expectedEncoding) {
        expect(top?.encoding, `#${f.id} 인코딩`).toBe(f.expectedEncoding)
      }
      if (f.expectedDelimiter) {
        expect(top?.delimiter, `#${f.id} 구분자`).toBe(f.expectedDelimiter)
      }
    }
  })

  it.runIf(fixturesPresent())("모든 판정에 근거를 남긴다", () => {
    // 헌장 A-5 정직 원칙 — 근거 없는 판정은 조용한 실패의 씨앗이다.
    for (const f of FIXTURES) {
      for (const c of sniff(readFixture(f), f.file).candidates) {
        expect(c.evidence.length, `#${f.id} ${c.format}`).toBeGreaterThan(0)
      }
    }
  })
})

describe("Recognition — 단위", () => {
  it("BOM으로 인코딩을 잡는다", () => {
    expect(detectEncoding(new Uint8Array([0xff, 0xfe, 0x41, 0x00])).encoding).toBe("utf-16le")
    expect(detectEncoding(new Uint8Array([0xfe, 0xff, 0x00, 0x41])).encoding).toBe("utf-16be")
    expect(detectEncoding(new Uint8Array([0xef, 0xbb, 0xbf, 0x41])).encoding).toBe("utf-8")
  })

  it("BOM 없는 EUC-KR을 UTF-8과 구분한다", () => {
    // "한국" — EUC-KR은 UTF-8로 디코드하면 깨진다.
    expect(detectEncoding(new Uint8Array([0xc7, 0xd1, 0xb1, 0xb9])).encoding).toBe("euc-kr")
    // "한국" — UTF-8
    const utf8 = new TextEncoder().encode("한국")
    expect(detectEncoding(utf8).encoding).toBe("utf-8")
  })

  it("BOM을 디코드 결과에서 떼어낸다", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("날짜")])
    const guess = detectEncoding(bytes)
    expect(decodeText(bytes, guess)).toBe("날짜")
  })

  it("셀 안의 콤마에 속지 않는다", () => {
    // 금액에 콤마가 있지만 진짜 구분자는 TAB이다.
    const text = ["상품\t금액\t비고", "A\t1,200\t-", "B\t3,000\t-"].join("\n")
    expect(detectDelimiter(text).delimiter).toBe("\t")
  })

  it("따옴표 안의 구분자를 세지 않는다", () => {
    const text = ['이름,비고', '"김,철수",정상', '"이,영희",정상'].join("\n")
    const g = detectDelimiter(text)
    expect(g.delimiter).toBe(",")
    // 따옴표 밖 콤마는 행마다 1개다 — 2개로 셌다면 따옴표 처리가 깨진 것이다.
    expect(g.evidence[0]).toContain("1개")
  })
})
