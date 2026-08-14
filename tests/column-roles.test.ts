/**
 * 결함 53 — **«쓰는 컬럼»을 «안 쓰는 컬럼»이라 말하지 않는다.**
 *
 * 발견 경로가 특이하다. 전 게이트 녹색이었고, 사용자가 7월 리허설에서 확인 화면을
 * 보다가 물어서 드러났다:
 *
 * > *"진행상태·구매금액·결제일만 데이터로 받겠다는 거냐? 나머지는 전부 저장 안 함인데"*
 *
 * 화면은 3개를 쓴다고 말했지만 실제로는 **6개**를 쓰고 있었다. `주문번호`·`상품번호`는
 * `source_key`를 구성하고 `상품명`은 상품 연결 화면에 뜨는 제목의 출처다.
 *
 * ★ 같은 누락이 core에도 있었다 ★ `mapRows`의 인라인 `usedColumns` 집합이
 * `sourceKey.columns`를 빠뜨려 `unmappedColumnCount`를 과다 계상하고 있었다.
 * 두 곳을 `columnRoles` 하나로 합쳤고, 이 파일이 그 하나를 지킨다.
 */

import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { columnRoles, type MappingProfile } from "../src/core/import/mapping/index.js"
import { analyzeImport } from "../src/core/import/analyze.js"
import { importVals, roleField, roleWhy, EMPTY_WIZARD } from "../src/app/import.js"
import { emptyVals } from "../src/app/generated/vals.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const PROFILE_DIR = "src/packs/kr-marketplace/profiles"
const NAMES = ["11st-settlement@1.json", "coupang-ad-report@1.json", "esm-order@1.json"]
const PROFILES: MappingProfile[] = NAMES.map(
  (n) => JSON.parse(readFileSync(`${PROFILE_DIR}/${n}`, "utf-8")) as MappingProfile,
)
const byKey = (k: string): MappingProfile => PROFILES.find((p) => p.marketplaceKey === k)!

describe("columnRoles — 프로파일이 실제로 읽는 컬럼", () => {
  it("★ 11번가 `주문순번`은 «쓰지 않는 컬럼»이 아니다 — 행 식별의 절반이다 ★", () => {
    const u = columnRoles(byKey("11st"))
    expect(u.byColumn.has("주문순번"), "이 단언이 결함 53의 핵심이다").toBe(true)
    expect(u.byColumn.get("주문순번")!.roles).toEqual(["source-key"])
    // 프로파일 주석의 실측: 주문번호 단독은 113/128로 유일하지 않다.
    // 사용자가 «안 쓰는 열»로 읽고 빼면 UPSERT 멱등이 무너진다.
    expect(byKey("11st").sourceKey.columns).toEqual(["주문번호", "주문순번"])
  })

  it("★ ESM — 사용자가 화면에서 본 그 세 컬럼 ★", () => {
    const u = columnRoles(byKey("esm"))
    expect(u.byColumn.get("주문번호")!.roles).toContain("source-key")
    expect(u.byColumn.get("상품번호")!.roles).toEqual(
      expect.arrayContaining(["source-key", "listing-key"]),
    )
    expect(u.byColumn.get("상품명")!.roles).toContain("listing-title")
  })

  it("ESM `진행상태`는 3역이다 — 필드 · 필수 · 행을 표로 가른다", () => {
    const c = columnRoles(byKey("esm")).byColumn.get("진행상태")!
    expect(c.roles).toEqual(expect.arrayContaining(["field", "routing"]))
    expect(c.target).toBe("status")
    expect(c.required).toBe(true)
  })

  /**
   * ★ 6 → 7 (품목 적재, 2026-08-14) ★
   * `수량`이 들어왔다. 이 컬럼은 **저장되는데 주문 표에는 안 보인다** —
   * `fact_order_item`으로 가기 때문이다. 그래서 역할도 `field`가 아니라
   * `item-field`이고, 확인 화면이 «품목 · quantity»라고 말한다. 결함 53이
   * «쓰는 컬럼을 안 쓴다고 말하는» 사고였으므로 여기가 그 재발 지점이다.
   */
  it("ESM이 실제로 쓰는 컬럼은 3개가 아니라 7개다", () => {
    const u = columnRoles(byKey("esm"))
    expect([...u.byColumn.keys()].sort()).toEqual(
      ["결제일", "구매금액", "상품명", "상품번호", "수량", "주문번호", "진행상태"].sort(),
    )
    expect(u.byColumn.get("수량")!.roles, "품목으로 간다는 사실이 역할에 남아야 한다").toEqual(
      ["item-field"],
    )
    expect(u.byColumn.get("수량")!.target).toBe("quantity")
  })

  it("쿠팡은 content 전략 — 선언된 키 컬럼이 없고 행 전체가 식별에 참여한다", () => {
    const u = columnRoles(byKey("coupang"))
    expect(u.contentKeyed, "여기서 «안 쓰는 컬럼»은 어떤 열에도 참이 아니다").toBe(true)
    expect(byKey("coupang").sourceKey.columns).toBeUndefined()
  })

  it("11번가는 natural 전략이라 contentKeyed가 아니다", () => {
    expect(columnRoles(byKey("11st")).contentKeyed).toBe(false)
  })

  it("헤더 쪽 공백에 흔들리지 않는다 — 양쪽 trim", () => {
    const p = byKey("esm")
    const spaced: MappingProfile = { ...p, sourceKey: { ...p.sourceKey, columns: ["  주문번호  "] } }
    expect(columnRoles(spaced).byColumn.has("주문번호")).toBe(true)
  })
})

describe("역할 → 문구 (문장은 화면이 만든다)", () => {
  it("Canonical 필드가 없어도 «하는 일»을 말한다", () => {
    expect(roleField(["source-key"])).toBe("행 식별 키")
    expect(roleField(["listing-title"])).toBe("리스팅 제목")
    expect(roleField(["listing-key"])).toBe("리스팅 키")
    expect(roleField([])).toBe("저장 안 함")
  })

  it("3역이면 셋 다 말한다", () => {
    expect(roleWhy(["field", "routing"], true)).toBe("프로파일이 선언 · 필수 · 행이 갈 표를 정한다")
  })

  it("행 식별 컬럼은 «쓰인다»고 말한다 — 값은 안 내보낸다 (헌장 C-4)", () => {
    const s = roleWhy(["source-key"], false)
    expect(s).toBe("행 식별에 쓰인다")
    expect(s, "내부 키 값을 화면에 내보내지 않는다").not.toContain("source_key")
  })
})

// ─────────────────────────────────────────────────────────────
// 실파일 — 사용자가 실제로 보던 그 화면
// ─────────────────────────────────────────────────────────────

const esmFixture = FIXTURES.find((f) => f.id === 8)
const ready = esmFixture !== undefined && existsSync(fixturePath(esmFixture, CLEAN_DIR))
const run = ready ? describe : describe.skip
if (!ready) console.warn("[column-roles] fixtures/clean이 없어 실파일 절을 건너뛴다")

run("확인 화면 — ESM 실파일", () => {
  it("★ 어떤 컬럼도 «쓰는데 안 쓴다»고 표시되지 않는다 ★", async () => {
    const f = esmFixture!
    const bytes = new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR)))
    const a = await analyzeImport(bytes, f.file, PROFILES)

    const vals = emptyVals()
    importVals(vals, { ...EMPTY_WIZARD, analysis: a })
    const rows = vals.colRows as { header: string; field: string; why: string; conf: string }[]

    const use = columnRoles(byKey("esm"))
    for (const r of rows) {
      const used = use.byColumn.has(r.header.trim())
      if (used) {
        expect(r.why, `«${r.header}»는 쓰는 컬럼인데 안 쓴다고 말한다`).not.toContain(
          "쓰지 않는 컬럼",
        )
        expect(r.field, `«${r.header}»`).not.toBe("저장 안 함")
        expect(r.conf).toBe("선언")
      }
    }

    // 사용자가 물었던 바로 그 세 줄
    const row = (h: string) => rows.find((r) => r.header === h)!

    // ★ `주문번호`는 두 겹으로 틀렸었다 ★ 옛 코드는 `profile.fieldMappings`만 봐서
    // **클레임 route의 매핑**(`주문번호 → order_source_key`)도 함께 놓치고 있었다.
    expect(row("주문번호").field).toBe("order_source_key")
    expect(row("주문번호").why).toContain("행 식별에 쓰인다")

    expect(row("상품번호").field).toBe("행 식별 키")
    expect(row("상품번호").why).toContain("리스팅을 식별한다")
    expect(row("상품명").field).toBe("리스팅 제목")
    expect(row("상품명").why).toBe("상품 연결에 뜨는 제목")

    // 진짜로 안 쓰는 것은 여전히 그렇게 말한다 — 반대 방향도 지킨다
    expect(row("구매자명").field).toBe("저장 안 함")
    expect(row("구매자명").why).toBe("이 프로파일이 쓰지 않는 컬럼")

    /**
     * ★ 단언이 뒤집힌 자리 (품목 적재, 2026-08-14) ★
     * 전에는 «fact_order_item이 비어 있다 — 진짜 미매핑이다»였다. 이제 수량은
     * **저장된다.** 다만 주문 표에는 안 보이므로 그냥 «quantity»라고만 하면
     * 사용자가 주문 화면을 뒤지게 된다 — 어느 표에 사는지까지 말한다.
     */
    expect(row("수량").field).toBe("품목 · quantity")
    expect(row("수량").why).toContain("품목으로 저장된다")
  })

  it("«쓰는 컬럼» 카운터가 표와 같은 집합을 센다 — 화면이 자기모순을 말하지 않는다", async () => {
    const f = esmFixture!
    const bytes = new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR)))
    const a = await analyzeImport(bytes, f.file, PROFILES)

    const vals = emptyVals()
    importVals(vals, { ...EMPTY_WIZARD, analysis: a })
    const counts = vals.importCounts as { label: string; value: string }[]
    const rows = vals.colRows as { conf: string }[]

    const cell = counts.find((c) => c.label === "쓰는 컬럼")!
    const declaredInTable = rows.filter((r) => r.conf === "선언").length
    expect(cell.value, `표는 ${declaredInTable}개를 «선언»으로 그린다`).toBe(
      `${declaredInTable}/${declaredInTable}`,
    )
  })
})
