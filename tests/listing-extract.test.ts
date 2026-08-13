/**
 * 리스팅 추출 — **파일 전체에서 중복을 걷어낸 종류의 목록**을 만든다.
 *
 * Fact 매핑이 "행 하나 → 행 하나"인 것과 달리 리스팅은 "행 여럿 → 종류 하나"다.
 * 주문 146행이 상품 12종을 가리키면 리스팅은 12개여야 한다 — 146개가 나오면
 * 연결 화면이 같은 상품을 146번 물어보게 된다.
 *
 * 그리고 **입도의 비대칭이 선언으로 남는지**를 본다 (마이그레이션 004 · LOCK 4).
 */

import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { collectListings, KEY_SEP, type ListingRule } from "../src/core/import/mapping/listing.js"
import type { NormalizedChunk } from "../src/core/import/types.js"
import type { ListingUpsert } from "../src/core/store/repository.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"

/** 열 이름과 행 값으로 columnar 청크를 만든다 (ADR-007 표현). */
function chunkOf(headers: string[], rows: (string | number | null)[][]): NormalizedChunk {
  const width = headers.length
  const values: (string | number | null)[] = []
  const raws: (string | null)[] = []
  const kinds: number[] = []
  for (const r of rows) {
    for (let c = 0; c < width; c++) {
      values.push(r[c] ?? null)
      raws.push(r[c] === null || r[c] === undefined ? null : String(r[c]))
      kinds.push(0)
    }
  }
  return { width, rowCount: rows.length, values, raws, kinds } as unknown as NormalizedChunk
}

const HEAD = ["주문번호", "상품번호", "상품명", "옵션명"]

describe("리스팅 추출 — 종류의 목록", () => {
  it("같은 상품이 여러 행에 나와도 리스팅은 하나다", () => {
    const rule: ListingRule = { grain: "product", keyColumns: ["상품번호"], titleColumns: ["상품명"] }
    const chunk = chunkOf(HEAD, [
      ["o1", "P1", "티셔츠", ""],
      ["o2", "P1", "티셔츠", ""],
      ["o3", "P2", "바지", ""],
    ])
    const into = new Map<string, ListingUpsert>()
    collectListings(rule, HEAD, chunk, into)

    expect(into.size, "행 수가 아니라 종류 수여야 한다").toBe(2)
    expect(into.get("P1")?.title).toBe("티셔츠")
    expect(into.get("P1")?.grain).toBe("product")
  })

  it("청크를 가로질러 모은다 — 파일이 나뉘어 와도 종류는 하나다", () => {
    const rule: ListingRule = { grain: "product", keyColumns: ["상품번호"], titleColumns: ["상품명"] }
    const into = new Map<string, ListingUpsert>()
    collectListings(rule, HEAD, chunkOf(HEAD, [["o1", "P1", "티셔츠", ""]]), into)
    collectListings(rule, HEAD, chunkOf(HEAD, [["o2", "P1", "티셔츠", ""]]), into)
    expect(into.size).toBe(1)
  })

  /** ★ 비대칭이 여기서 생긴다 ★ */
  it("옵션 단위 규칙은 같은 상품을 옵션 수만큼 만든다", () => {
    const rule: ListingRule = {
      grain: "option",
      keyColumns: ["상품번호", "옵션명"],
      titleColumns: ["상품명", "옵션명"],
    }
    const chunk = chunkOf(HEAD, [
      ["o1", "P1", "티셔츠", "블랙"],
      ["o2", "P1", "티셔츠", "화이트"],
      ["o3", "P1", "티셔츠", "블랙"],
    ])
    const into = new Map<string, ListingUpsert>()
    collectListings(rule, HEAD, chunk, into)

    expect(into.size, "옵션이 다르면 다른 리스팅이다").toBe(2)
    expect(into.get(`P1${KEY_SEP}블랙`)?.title).toBe("티셔츠 · 블랙")
    for (const l of into.values()) expect(l.grain).toBe("option")
  })

  it("키 컬럼이 비면 리스팅을 만들지 않는다 — 식별자 없는 리스팅은 매번 새로 생긴다", () => {
    const rule: ListingRule = { grain: "product", keyColumns: ["상품번호"], titleColumns: ["상품명"] }
    const chunk = chunkOf(HEAD, [
      ["o1", "", "이름만 있음", ""],
      ["o2", "P2", "바지", ""],
    ])
    const into = new Map<string, ListingUpsert>()
    collectListings(rule, HEAD, chunk, into)
    expect(into.size).toBe(1)
    expect(into.has("P2")).toBe(true)
  })

  it("선언한 키 컬럼이 파일에 없으면 아무것도 만들지 않는다", () => {
    const rule: ListingRule = { grain: "product", keyColumns: ["없는컬럼"], titleColumns: ["상품명"] }
    const into = new Map<string, ListingUpsert>()
    collectListings(rule, HEAD, chunkOf(HEAD, [["o1", "P1", "티셔츠", ""]]), into)
    expect(into.size, "반쪽 키로 만들면 다음 파일과 이어지지 않는다").toBe(0)
  })
})

/**
 * ★ 비대칭은 추론이 아니라 선언이다 (LOCK 4) ★
 *
 * 프로파일 JSON이 스스로 `grain`을 적는다. 코드가 "11번가면 옵션이겠거니" 하면
 * 그 추론은 마켓 지식이 되어 core로 새고, 새 채널이 올 때마다 틀린다.
 */
describe("프로파일이 자기 입도를 선언한다", () => {
  const load = (f: string): MappingProfile =>
    JSON.parse(readFileSync(`src/packs/kr-marketplace/profiles/${f}`, "utf8")) as MappingProfile

  it("ESM은 상품 단위 · 11번가는 옵션 단위", () => {
    const esm = load("esm-order@1.json")
    const st = load("11st-settlement@1.json")

    expect(esm.listing?.grain).toBe("product")
    expect(esm.listing?.keyColumns).toEqual(["상품번호"])

    expect(st.listing?.grain).toBe("option")
    expect(st.listing?.keyColumns).toEqual(["상품번호", "옵션명"])
  })

  it("광고 보고서는 리스팅을 만들지 않는다 — 상품 식별자가 없는 문서다", () => {
    expect(load("coupang-ad-report@1.json").listing).toBeUndefined()
  })
})
