/**
 * 개인 프로파일 (계획 B2) — **사용자의 확정이 프로파일이 되고, 기존 판은 불변이다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 파일이 지키는 것 ★
 *
 * ① 파생의 v1 컷 라인 — 고칠 수 있는 것은 target 교체·미매핑 열 부여·«쓰지
 *    않음»뿐. 행 식별 키·라우팅·리스팅 열은 **거부**된다 (이유 문장과 함께).
 * ② 최소 한 벌 — 날짜·금액이 다 지워지는 파생은 저장 전에 막힌다.
 * ③ B-6 — 버전 `u1`·`u2`는 단조 증가이고 **u1은 재편집 후에도 그대로다.**
 *    batch가 `mapping_version=…@u1`을 기록하므로 u1이 변하면 이력이 거짓이 된다.
 * ④ 병합 — 같은 자연키면 사용자 최신이 내장을 가린다 («직접 지정한 매핑은
 *    덮어쓰지 않습니다»의 이행).
 * ⑤ ★ 후보 열은 확인 없이 자동 사용되지 않는다 ★ — 초안에 없는 열은 파생판의
 *    매핑에 나타나지 않는다. 자동 사용은 언제나 사람의 확정을 지난 뒤다 (ADR-017).
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import {
  deriveProfile,
  editableHeaders,
  mergeProfiles,
} from "../src/core/import/mapping/derive.js"
import { profileVersion, type MappingProfile } from "../src/core/import/mapping/index.js"
import { validateProfiles } from "../src/core/import/mapping/validate.js"
import { buildAliasIndex, judgeColumns } from "../src/core/import/judge.js"

const read = (n: string): MappingProfile =>
  JSON.parse(readFileSync(`src/packs/kr-marketplace/profiles/${n}`, "utf-8")) as MappingProfile

/** 11번가 정산 — 편집 가능한 매핑과 구조 역할이 다 있는 실물. */
const SETTLE = read("11st-settlement@1.json")
/** 원가 카드 — `reference` 프로파일 (fieldMappings가 비어 있는 게 정상). */
const COST_CARD = read("cost-card@1.json")

const NOW = "2026-08-19T00:00:00"

describe("파생 — v1 컷 라인 (deriveProfile)", () => {
  it("매핑된 열의 target 교체가 된다", () => {
    const r = deriveProfile(SETTLE, new Map([["선결제배송비", "vat_amount"]]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const m = r.profile.fieldMappings.find((x) => x.source === "선결제배송비")
    expect(m?.target).toBe("vat_amount")
    // 교체 매핑은 소박하다 — 옛 target에 묶였던 선언을 승계하지 않는다
    expect(m?.signPolicy).toBeUndefined()
  })

  it("미매핑 열에 target을 부여한다 — 부분 인지의 이행 경로", () => {
    const r = deriveProfile(SETTLE, new Map([["구매자할인쿠폰", "fee_amount"]]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const m = r.profile.fieldMappings.find((x) => x.source === "구매자할인쿠폰")
    expect(m?.target).toBe("fee_amount")
    expect(m?.kind).toBe("number") // 등록부의 kind를 따른다
  })

  it("«쓰지 않음»이 매핑을 지운다 — 원본 프로파일은 그대로다 (순수 함수)", () => {
    const before = SETTLE.fieldMappings.length
    const r = deriveProfile(SETTLE, new Map([["선결제배송비", null]]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.profile.fieldMappings.find((x) => x.source === "선결제배송비")).toBeUndefined()
    expect(SETTLE.fieldMappings.length).toBe(before)
  })

  it("★ 행 식별 키 열은 거부된다 — field 역할이 겹쳐 있어도 ★", () => {
    // 「주문번호」는 field(order_source_key)이자 source-key다. 바꾸면 기존
    // 데이터와 새 데이터가 서로를 못 알아본다 — 이유 문장과 함께 거부.
    const r = deriveProfile(SETTLE, new Map([["주문번호", "campaign_key"]]))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.why).toContain("주문번호")
    expect(r.why).toContain("행 식별 키")
  })

  it("리스팅 식별 열도 거부된다", () => {
    const r = deriveProfile(SETTLE, new Map([["상품번호", "campaign_key"]]))
    expect(r.ok).toBe(false)
  })

  it("등록부에 없는 target은 문에서 막힌다 (ADR-010 계보)", () => {
    const r = deriveProfile(SETTLE, new Map([["구매자할인쿠폰", "totl_amount"]]))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.why).toContain("등록부")
  })

  it("빈 초안은 파생이 아니다", () => {
    expect(deriveProfile(SETTLE, new Map()).ok).toBe(false)
  })

  it("★ 최소 한 벌 — 날짜를 다 지우면 이유와 함께 거부된다 ★", () => {
    const r = deriveProfile(
      SETTLE,
      new Map([
        ["정산확정일", null],
        ["송금완료일", null],
      ]),
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.why).toContain("날짜")
  })

  it("reference 프로파일은 fieldMappings가 비어도 최소 한 벌을 통과한다", () => {
    // 원가 카드의 값은 reference 블록(편집 불가)에 산다 — fieldMappings 잣대로
    // 재면 아무 초안도 저장 못 하게 된다.
    const { canEdit } = editableHeaders(COST_CARD)
    // 블록 리더의 필드 중 아무 역할 없는 열 — 실물은 「권장소비자가」다.
    // 반면 「품명」은 행 식별 키라 잠긴다.
    expect(canEdit("권장소비자가")).toBe(true)
    expect(canEdit("품명")).toBe(false)
    const r = deriveProfile(COST_CARD, new Map([["권장소비자가", "amount"]]))
    expect(r.ok).toBe(true)
  })

  it("파생판은 프로파일 검증(validateProfiles)을 통과한다 — 저장의 전제", () => {
    const r = deriveProfile(SETTLE, new Map([["구매자할인쿠폰", "fee_amount"]]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(validateProfiles([r.profile]).size).toBe(0)
  })

  it("★ 후보 열은 확인 없이 자동 사용되지 않는다 (ADR-017) ★", () => {
    // 「구매금액」은 별칭 충돌 실측(4뜻) — 판정은 후보로 내린다. 후보인 채로는
    // 파생판 어디에도 나타나지 않는다: 초안(사람의 답)에 든 열만 매핑이 된다.
    const idx = buildAliasIndex([SETTLE, read("esm-order@1.json"), read("esm-powerclick@1.json")])
    const verdict = judgeColumns(
      [{ ordinal: 0, header: "구매금액", sample: "1000", kind: "number", confidence: 0.9, reason: "t" }],
      idx,
    ).verdicts[0]!
    expect(verdict.tier).toBe("candidate")
    expect(verdict.target).toBeNull()

    // 사람이 다른 열만 확정했다 — 후보 열은 파생판에 없다.
    const r = deriveProfile(SETTLE, new Map([["구매자할인쿠폰", "fee_amount"]]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.profile.fieldMappings.find((m) => m.source === "구매금액")).toBeUndefined()
  })
})

describe("저장 — mapping_profile 첫 사용 (B-6 불변)", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver()
    await migrate(db)
    repo = new Repository(db)
  })

  const derived = (): MappingProfile => {
    const r = deriveProfile(SETTLE, new Map([["구매자할인쿠폰", "fee_amount"]]))
    if (!r.ok) throw new Error(r.why)
    return r.profile
  }

  it("첫 저장은 u1이고 본문에도 같은 버전이 박힌다", async () => {
    const v = await repo.saveUserProfile(derived(), NOW)
    expect(v).toBe("u1")
    const { profiles } = await repo.userProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0]!.version).toBe("u1")
    // profileVersion이 batch의 mapping_version을 만든다 — @u1이어야 한다.
    expect(profileVersion(profiles[0]!)).toBe("11st/settlement/order-line@u1")
  })

  it("★ 재편집은 u2 신설이고 u1은 재편집 후에도 그대로다 ★", async () => {
    await repo.saveUserProfile(derived(), NOW)
    const first = await db
      .prepare(`SELECT definition FROM mapping_profile WHERE version = 'u1'`)
      .get()

    // 재편집 — u1을 발판으로 다른 초안.
    const { profiles } = await repo.userProfiles()
    const again = deriveProfile(profiles[0]!, new Map([["선결제배송비", null]]))
    expect(again.ok).toBe(true)
    if (!again.ok) return
    const v2 = await repo.saveUserProfile(again.profile, "2026-08-20T00:00:00")
    expect(v2).toBe("u2")

    const firstAfter = await db
      .prepare(`SELECT definition FROM mapping_profile WHERE version = 'u1'`)
      .get()
    expect(firstAfter?.["definition"], "u1이 변했다 — batch 이력이 거짓이 된다").toBe(
      first?.["definition"],
    )
  })

  it("userProfiles는 최신이 앞이다 — 병합이 그 순서를 가정한다", async () => {
    await repo.saveUserProfile(derived(), NOW)
    const { profiles: p1 } = await repo.userProfiles()
    const again = deriveProfile(p1[0]!, new Map([["선결제배송비", null]]))
    if (!again.ok) throw new Error(again.why)
    await repo.saveUserProfile(again.profile, NOW) // 같은 시각 — 번호로 가른다
    const { profiles } = await repo.userProfiles()
    expect(profiles.map((p) => p.version)).toEqual(["u2", "u1"])
  })

  it("본문이 안 읽히는 행은 세어서 넘긴다 — 조용히 버리지 않는다 (LOCK 6)", async () => {
    await repo.saveUserProfile(derived(), NOW)
    await db
      .prepare(
        `INSERT INTO mapping_profile
           (version, pack_id, marketplace_key, doc_type, grain, definition, source, installed_at)
         VALUES ('u9', 'kr-marketplace', '11st', 'settlement', 'order-line', '{썩은 json', 'user', ?)`,
      )
      .run(NOW)
    const { profiles, broken } = await repo.userProfiles()
    expect(profiles).toHaveLength(1)
    expect(broken).toBe(1)
  })
})

describe("종단 — 파생판이 실파일을 적재하고 @u1이 이력에 남는다", () => {
  it("★ 미매핑 열 부여 → 저장 → 재가져오기 → batch.mapping_version=…@u1 ★", async () => {
    const { existsSync, readFileSync: rf } = await import("node:fs")
    const path = "fixtures/clean/2026년 7월_11st 결제일 정산확정 건.xls"
    if (!existsSync(path)) {
      console.warn("[user-profile] fixtures/clean이 없어 종단 검증을 건너뛴다")
      return
    }
    const { analyzeImport } = await import("../src/core/import/analyze.js")
    const { runImport } = await import("../src/core/import/run.js")

    const db = openNodeDriver()
    await migrate(db)
    const repo = new Repository(db)
    await repo.ensureLibrary("lib-1", "기본", NOW)

    // 사람의 확정: 미매핑 「도서산간배송비」에 target 부여 + 「선결제배송비」는 쓰지 않음.
    const r = deriveProfile(
      SETTLE,
      new Map<string, string | null>([
        ["도서산간배송비", "shipping_amount"],
        ["선결제배송비", null],
      ]),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    await repo.saveUserProfile(r.profile, NOW)

    // 재가져오기 — 판정 후보는 병합본이다. 내장 @1은 가려지고 @u1이 선다.
    const { profiles: user } = await repo.userProfiles()
    const merged = mergeProfiles([SETTLE], user)
    expect(merged.map(profileVersion)).toEqual(["11st/settlement/order-line@u1"])

    const bytes = new Uint8Array(rf(path))
    const a = await analyzeImport(bytes, "2026년 7월_11st 결제일 정산확정 건.xls", merged)
    const hit = a.sheetMatches.find((m) => m.profiles.length > 0)
    expect(hit, "파생판이 실파일을 못 알아본다").toBeDefined()

    await repo.ensureConnection(
      { id: "conn-11st", libraryId: "lib-1", packId: "kr-marketplace", marketplaceKey: "11st", displayName: "11번가" },
      NOW,
    )
    const got = await runImport(repo, {
      bytes,
      fileName: "2026년 7월_11st 결제일 정산확정 건.xls",
      profile: hit!.profiles[0]!.profile,
      sheetIndex: hit!.sheetIndex,
      libraryId: "lib-1",
      connectionId: "conn-11st",
      batchId: "batch-u1-test",
      now: NOW,
    })
    expect(got.loaded).toBeGreaterThan(100)

    const batch = await db
      .prepare(`SELECT mapping_version FROM batch WHERE id = 'batch-u1-test'`)
      .get()
    expect(batch?.["mapping_version"], "해석 이력이 내 확정판을 가리키지 않는다").toBe(
      "11st/settlement/order-line@u1",
    )

    // 부여한 열이 실제로 적재됐다 — 파생이 화면 주석이 아니라 적재의 사실이 됐다.
    const rows = await db
      .prepare(`SELECT COUNT(*) AS n FROM fact_settlement WHERE batch_id = 'batch-u1-test'`)
      .get()
    expect(Number(rows?.["n"])).toBeGreaterThan(100)
    await db.close()
  })
})

describe("병합 — 사용자 최신이 내장을 가린다", () => {
  it("같은 자연키의 내장이 목록에서 사라지고 내 확정판이 그 자리에 선다", () => {
    const user: MappingProfile = { ...SETTLE, version: "u1" }
    const merged = mergeProfiles([SETTLE, COST_CARD], [user])
    expect(merged).toHaveLength(2)
    const versions = merged.map(profileVersion)
    expect(versions).toContain("11st/settlement/order-line@u1")
    expect(versions).not.toContain("11st/settlement/order-line@1")
    expect(versions).toContain(profileVersion(COST_CARD)) // 다른 키는 그대로
  })

  it("사용자 판이 여럿이면 **앞의 것**(최신)이 이긴다", () => {
    const u1: MappingProfile = { ...SETTLE, version: "u1" }
    const u2: MappingProfile = { ...SETTLE, version: "u2" }
    const merged = mergeProfiles([SETTLE], [u2, u1]) // userProfiles 순서 = 최신 앞
    expect(merged.map(profileVersion)).toEqual(["11st/settlement/order-line@u2"])
  })

  it("내장에 짝이 없는 개인 프로파일도 잃지 않는다", () => {
    const orphan: MappingProfile = { ...SETTLE, marketplaceKey: "naver", version: "u1" }
    const merged = mergeProfiles([COST_CARD], [orphan])
    expect(merged.map(profileVersion)).toContain("naver/settlement/order-line@u1")
  })
})
