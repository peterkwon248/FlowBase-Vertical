/**
 * 가져오기 가드 2종 — **조용한 사고를 막는다** (ADR-006 증축의 마무리).
 *
 * 파일명이 키의 일부가 되면서 새 사고 벡터가 둘 생겼다:
 *
 *   ① 캡처 실패   유저가 파일명을 바꾸면 키의 절반이 빈 문자열이 된다
 *   ② 이름만 다름  같은 바이트를 다른 이름으로 넣으면 키가 갈라져 두 번 쌓인다
 *
 * 둘 다 **조용하다** — 적재는 성공하고 숫자만 틀린다. 그래서 가드를 둔다.
 * ①은 **막고**(폴백 없음), ②는 **알린다**(검문 아님).
 */

import { describe, expect, it } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import { runImport } from "../src/core/import/run.js"
import { analyzeImport } from "../src/core/import/analyze.js"
import { matchProfiles, type MappingProfile } from "../src/core/import/mapping/index.js"
import { importVals, EMPTY_WIZARD } from "../src/app/import.js"
import { emptyVals } from "../src/app/generated/vals.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const PROFILE_DIR = "src/packs/kr-marketplace/profiles"
const NAMES = [
  "11st-settlement@1.json",
  "coupang-ad-report@1.json",
  "coupang-jet@1.json",
  "coupang-order@1.json",
  "esm-order@1.json",
]
const PROFILES: MappingProfile[] = NAMES.map(
  (n) => JSON.parse(readFileSync(`${PROFILE_DIR}/${n}`, "utf-8")) as MappingProfile,
)
const JET = PROFILES.find((p) => p.id === "coupang/order/option-period")!

const LIB = "lib-1"
const CONN = "conn-coupang"
const NOW = "2026-08-14T00:00:00.000Z"
const GOOD = "쿠팡 제트 매출_20260701~20260731.xlsx"
const RENAMED = "쿠팡제트.xlsx"
/**
 * **패턴은 맞되 이름이 다른** 파일 — 진짜 중복 벡터다.
 *
 * 패턴까지 깨진 이름(`RENAMED`)은 가드 ①이 먼저 막으므로 ②의 시험이 되지 못한다.
 * 사용자가 «8월 파일인 줄 알고 7월 파일을 8월 이름으로 저장»하는 것이 실제 사고다.
 */
const OTHER_NAME = "쿠팡 제트 매출_20260801~20260831.xlsx"

const f15 = FIXTURES.find((x) => x.id === 15)
const ready = f15 !== undefined && existsSync(fixturePath(f15, CLEAN_DIR))
const run = ready ? describe : describe.skip
if (!ready) console.warn("[import-guards] fixtures/clean이 없어 건너뛴다")

const bytes = (): Uint8Array => new Uint8Array(readFileSync(fixturePath(f15!, CLEAN_DIR)))

const fresh = async () => {
  const db = openNodeDriver(":memory:")
  await migrate(db)
  const repo = new Repository(db)
  await repo.ensureLibrary(LIB, "기본", NOW)
  await repo.ensureConnection(
    { id: CONN, libraryId: LIB, packId: "kr-marketplace", marketplaceKey: "coupang", displayName: "쿠팡" },
    NOW,
  )
  return { db, repo }
}

// ─────────────────────────────────────────────────────────────
// 가드 ① — 캡처 실패는 정지. 조용한 폴백 없음
// ─────────────────────────────────────────────────────────────

run("가드 ① — 파일명에서 기간을 못 읽으면 멈춘다", () => {
  it("후보에서 빼지 않고 «막힌 후보»로 남긴다 — 할 일이 다르기 때문이다", () => {
    const headers = [
      "노출상품ID", "옵션ID", "옵션명", "상품타입", "카테고리",
      "순 판매 금액(전체 거래 금액 - 취소 금액)", "전체 거래 금액",
    ]
    const ok = matchProfiles(PROFILES, { containerFormat: "xlsx", headers, fileName: GOOD })
    const bad = matchProfiles(PROFILES, { containerFormat: "xlsx", headers, fileName: RENAMED })

    expect(ok[0]!.profile.id).toBe("coupang/order/option-period")
    expect(ok[0]!.blockedBy, "제대로 된 이름이면 막히지 않는다").toBeUndefined()

    // ★ 후보 자체는 남는다 ★ 「맞는 프로파일이 없습니다」는 거짓이 된다 —
    //   양식은 알아봤고 파일명이 모자란 것이다.
    const jet = bad.find((p) => p.profile.id === "coupang/order/option-period")
    expect(jet, "양식은 알아봤어야 한다").toBeDefined()
    expect(jet!.blockedBy?.missingCaptures).toEqual(["from"])
  })

  it("★ 적재 경로가 막는다 — 화면 메시지만이면 하네스가 우회한다 ★", async () => {
    const { db, repo } = await fresh()
    try {
      await expect(
        runImport(repo, {
          bytes: bytes(), fileName: RENAMED, profile: JET, sheetIndex: 0,
          libraryId: LIB, connectionId: CONN, batchId: "b-1", now: NOW,
        }),
      ).rejects.toThrow(/파일명에서 from를 읽지 못했다/)

      const n = await db.prepare(`SELECT COUNT(*) AS n FROM fact_order`).get()
      expect(Number(n!["n"]), "한 행도 안 들어갔다").toBe(0)
    } finally {
      await db.close()
    }
  })

  it("오류 문구가 «원본 파일명 예시»를 든다 — 정규식을 사용자에게 내밀지 않는다", async () => {
    const { db, repo } = await fresh()
    try {
      await expect(
        runImport(repo, {
          bytes: bytes(), fileName: RENAMED, profile: JET, sheetIndex: 0,
          libraryId: LIB, connectionId: CONN, batchId: "b-1", now: NOW,
        }),
      ).rejects.toThrow(/쿠팡 제트 매출_20260701~20260731\.xlsx/)
    } finally {
      await db.close()
    }
  })

  it("화면도 막는다 — [확인하고 가져오기]가 눌리지 않고 이유가 뜬다", async () => {
    const a = await analyzeImport(bytes(), RENAMED, PROFILES)
    const vals = emptyVals()
    importVals(vals, { ...EMPTY_WIZARD, analysis: a })

    expect(vals.impCanRun, "막힌 후보로는 넣을 수 없다").toBe(false)
    expect(String(vals.profileMeta)).toContain("파일명에서 이 양식이 필요로 하는 값을 읽지 못했습니다")
    expect(String(vals.profileMeta)).toContain("쿠팡 제트 매출_20260701~20260731.xlsx")
    expect(String(vals.profileMeta), "«프로파일이 없다»는 거짓이다").not.toContain(
      "맞는 매핑 프로파일이 없습니다",
    )
  })

  it("캡처를 요구하지 않는 양식은 이름이 달라도 그대로 들어간다", () => {
    // 11번가·ESM·쿠팡 광고는 `fileNameCaptures`가 없다 — 가드가 이들을 건드리면 안 된다.
    for (const p of PROFILES.filter((x) => (x.sourceKey.fileNameCaptures ?? []).length === 0)) {
      const m = matchProfiles([p], {
        containerFormat: p.recognitionRules.containerFormats[0]!,
        headers: [...p.recognitionRules.requiredHeaders],
        fileName: "이름을 마음대로 바꾼 파일.xlsx",
      })
      expect(m[0]?.blockedBy, `${p.id}가 막혔다`).toBeUndefined()
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 가드 ② — 같은 바이트·다른 이름은 알린다 (막지 않는다)
// ─────────────────────────────────────────────────────────────

run("가드 ② — 같은 바이트가 이미 들어왔으면 넣기 전에 말한다", () => {
  it("batch에 파일 지문이 남는다 — 001부터 있던 배관이 처음 쓰인다", async () => {
    const { db, repo } = await fresh()
    try {
      await runImport(repo, {
        bytes: bytes(), fileName: GOOD, profile: JET, sheetIndex: 0,
        libraryId: LIB, connectionId: CONN, batchId: "b-1", now: NOW,
      })
      const b = await db.prepare(`SELECT source_hash FROM batch WHERE id = 'b-1'`).get()
      expect(String(b!["source_hash"]), "SHA-1 hex 40자").toMatch(/^[0-9a-f]{40}$/)
    } finally {
      await db.close()
    }
  })

  it("★ 파일명이 달라도 같은 바이트를 찾아낸다 ★", async () => {
    const { db, repo } = await fresh()
    try {
      await runImport(repo, {
        bytes: bytes(), fileName: GOOD, profile: JET, sheetIndex: 0,
        libraryId: LIB, connectionId: CONN, batchId: "b-1", now: NOW,
      })
      const a = await analyzeImport(bytes(), "쿠팡 제트 매출_20260801~20260831.xlsx", PROFILES)
      const prior = await repo.batchesWithHash(LIB, a.contentHash)

      expect(prior.length, "이름이 달라도 같은 파일이다").toBe(1)
      expect(String(prior[0]!["source_name"])).toBe(GOOD)
    } finally {
      await db.close()
    }
  })

  it("★ 고지하되 **막지 않는다** — 검문이 아니다 (§22 금지 조항 계열) ★", async () => {
    const a = await analyzeImport(bytes(), OTHER_NAME, PROFILES)
    const vals = emptyVals()
    importVals(vals, {
      ...EMPTY_WIZARD,
      analysis: a,
      priorSame: [{ sourceName: GOOD, at: "2026-08-03", undone: false }],
    })
    expect(vals.impCanRun, "중복 고지는 버튼을 잠그지 않는다").toBe(true)

    // 대조 — 캡처 실패(가드 ①)는 같은 자리에서 **막는다.** 두 가드의 성격이 다르다.
    const blocked = emptyVals()
    importVals(blocked, { ...EMPTY_WIZARD, analysis: await analyzeImport(bytes(), RENAMED, PROFILES) })
    expect(blocked.impCanRun).toBe(false)
  })

  it("고지 문구가 «언제·무슨 이름으로» 들어왔는지 말한다", async () => {
    const a = await analyzeImport(bytes(), OTHER_NAME, PROFILES)
    const vals = emptyVals()
    importVals(vals, {
      ...EMPTY_WIZARD,
      analysis: a,
      priorSame: [{ sourceName: GOOD, at: "2026-08-03", undone: false }],
    })

    const note = String(vals.impDupNote)
    expect(note).toContain("2026-08-03")
    expect(note).toContain(GOOD)
    expect(note, "이름만 다르다는 사실을 짚는다").toContain("파일명만 다릅니다")
    expect(note, "막지 않는다 — 그래도 넣을 수 있다").toContain("그래도 넣으면")
  })

  it("되돌린 배치였으면 그 사실도 말한다 — 재적재는 정당한 동선이다", async () => {
    const a = await analyzeImport(bytes(), GOOD, PROFILES)
    const vals = emptyVals()
    importVals(vals, {
      ...EMPTY_WIZARD,
      analysis: a,
      priorSame: [{ sourceName: GOOD, at: "2026-08-03", undone: true }],
    })
    expect(String(vals.impDupNote)).toContain("되돌려진 배치입니다")
    // 같은 이름이면 «파일명만 다릅니다»를 붙이지 않는다
    expect(String(vals.impDupNote)).not.toContain("파일명만 다릅니다")
  })

  it("처음 넣는 파일이면 원래 UPSERT 문구 그대로다", async () => {
    const a = await analyzeImport(bytes(), GOOD, PROFILES)
    const vals = emptyVals()
    importVals(vals, { ...EMPTY_WIZARD, analysis: a })
    expect(String(vals.impDupNote)).toContain("UPSERT")
  })
})
