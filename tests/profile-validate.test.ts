/**
 * 프로파일 자기 정합성 — **키·라우팅·리스팅 키 컬럼 ⊆ requiredHeaders.**
 *
 * ★ 왜 규칙 하나인가 ★
 * 이 불변식이 깨지면 세 자리가 **각자 다르게** 조용히 무너진다(`validate.ts` 머리말).
 * 셋을 각자 방어하면 방어가 세 벌이 되어 언젠가 갈리므로, 상류에서 «어길 수 있는
 * 상태»를 없앤다.
 *
 * ★ 이 파일이 하네스 경로를 막는다 ★
 * `loadProfiles()`는 번들러 전용(`import.meta.glob`)이라 `tsx`로 도는 하네스는
 * 그 문을 지나지 않는다. 그래서 **디스크의 전 프로파일을 여기서 돈다** — 화면과
 * 저장 양쪽에 가드를 둔 원가 입력과 같은 판단이다.
 */

import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { validateProfile, validateProfiles, formatDefects } from "../src/core/import/mapping/validate.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"

const DIR = "src/packs/kr-marketplace/profiles"
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".json"))

const read = (f: string): MappingProfile =>
  JSON.parse(readFileSync(`${DIR}/${f}`, "utf-8")) as MappingProfile

describe("불변식 — 디스크의 프로파일 전부가 자기 정합적이다", () => {
  it("프로파일 파일이 하나 이상 있다 — 0개면 이 게이트는 무의미하다", () => {
    expect(FILES.length).toBeGreaterThan(0)
  })

  it("전부 통과한다", () => {
    const defects = validateProfiles(FILES.map(read))
    expect(defects.size, `자기모순인 프로파일:\n${formatDefects(defects)}`).toBe(0)
  })

  /**
   * ★ 이 불변식은 «원래 지켜지고 있던 것»이 아니다 ★
   * 규칙을 세우자 **두 프로파일이 이미 어기고 있었다** — `coupang-order@1`의
   * 「주문번호」(행 식별 키), `11st-settlement@1`의 「상품번호」「옵션명」(리스팅 키).
   * 지금까지 안 터진 이유는 그 컬럼이 파일에 우연히 있었기 때문이지 규칙이
   * 있어서가 아니었다. 그 사실을 기록으로 남긴다.
   */
  it("고쳤던 두 자리가 다시 어긋나지 않는다", () => {
    expect(validateProfile(read("coupang-order@1.json"))).toEqual([])
    expect(validateProfile(read("11st-settlement@1.json"))).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────
// 합성 — 가드를 부러뜨려 본다 (ADR-007 «픽스처가 도달 못 하는 세계»)
// ─────────────────────────────────────────────────────────────

/**
 * 아래는 **합성 프로파일**이다. 실파일이 이렇게 생겼다는 증거가 아니라
 * «이렇게 생긴 프로파일이 들어오면»이라는 가정이고, 답하는 것은
 * «가드가 살아 있는가»뿐이다 — 값의 정확성은 묻지 않는다.
 */
describe("합성 — 셋을 각각 부러뜨리면 각각 잡힌다", () => {
  const base = (): MappingProfile => read("esm-order@1.json")

  it("[합성] 키 컬럼이 requiredHeaders에 없으면 잡는다", () => {
    const p = base() as unknown as { sourceKey: { columns: string[] } }
    p.sourceKey.columns = ["주문번호", "선언만_있는_컬럼"]
    const d = validateProfile(p as unknown as MappingProfile)
    expect(d).toHaveLength(1)
    expect(d[0]!.where).toBe("sourceKey")
    expect(d[0]!.columns, "이름을 그대로 준다 — 개수가 아니라").toEqual(["선언만_있는_컬럼"])
  })

  it("[합성] 라우팅 컬럼이 requiredHeaders에 없으면 잡는다 — ADR-010 보증의 구멍", () => {
    const p = base() as unknown as { rowRouting: { column: string } }
    p.rowRouting.column = "없는상태컬럼"
    const d = validateProfile(p as unknown as MappingProfile)
    expect(d).toHaveLength(1)
    expect(d[0]!.where).toBe("rowRouting")
  })

  it("[합성] 리스팅 키 컬럼이 requiredHeaders에 없으면 잡는다", () => {
    const p = base() as unknown as { listing: { keyColumns: string[] } }
    p.listing.keyColumns = ["없는상품번호"]
    const d = validateProfile(p as unknown as MappingProfile)
    expect(d).toHaveLength(1)
    expect(d[0]!.where).toBe("listing")
  })

  it("[합성] 셋이 동시에 어긋나면 셋 다 나온다 — 하나만 고치고 끝내지 않게", () => {
    const p = base() as unknown as {
      sourceKey: { columns: string[] }
      rowRouting: { column: string }
      listing: { keyColumns: string[] }
    }
    p.sourceKey.columns = ["없는키"]
    p.rowRouting.column = "없는상태"
    p.listing.keyColumns = ["없는리스팅키"]
    expect(validateProfile(p as unknown as MappingProfile)).toHaveLength(3)
  })

  /**
   * `content` 전략은 **행 전체가 키**라 특정 컬럼에 기대지 않는다. 여기에 규칙을
   * 걸면 43열짜리 광고 보고서의 전 컬럼을 `requiredHeaders`에 적으라는 말이 된다.
   */
  it("content 전략은 키 컬럼 검사를 하지 않는다", () => {
    const ad = read("coupang-ad-report@1.json")
    expect(ad.sourceKey.strategy, "이 프로파일이 content가 아니면 전제가 바뀐 것이다").toBe(
      "content",
    )
    expect(validateProfile(ad)).toEqual([])
  })

  it("헤더 이름은 trim해서 비교한다 — 조회부와 같은 규칙이어야 한다", () => {
    const p = base() as unknown as { sourceKey: { columns: string[] } }
    p.sourceKey.columns = ["  주문번호  ", "상품번호"]
    expect(validateProfile(p as unknown as MappingProfile)).toEqual([])
  })
})
