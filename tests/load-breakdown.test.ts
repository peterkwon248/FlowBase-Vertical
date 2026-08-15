/**
 * 적재의 분해 — **「신규 + 갱신 + 병합 + 제외 = 파일 행」** (마이그레이션 007).
 *
 * ★ 왜 이 게이트가 필요한가 ★
 * 전에는 「적재 + 제외 = 파일 행」이었고, `run.ts`가 `loadChunk`의 반환값을 **버리고**
 * `rows.length`를 더했기 때문에 UPSERT가 행을 합쳐도 그 등식이 **겉으로는
 * 성립했다** — 행이 사라진 사고가 항등식을 통과해 버리는 구조였다.
 *
 * ★ 병합과 갱신은 다른 사실이다 ★
 * 갱신은 **이전 배치**의 행을 덮은 것(재가져오기의 정상 동작)이고, 병합은 **같은
 * 파일 안에서** 두 행이 같은 키를 얻은 것(사고)이다. 뭉뚱그리면 사용자가
 * «덮어써진 것»과 «합쳐져 사라진 것»을 구분할 수 없다.
 */

import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import { runImport } from "../src/core/import/run.js"
import { digestRows } from "../src/app/import.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import type { Driver } from "../src/core/store/driver.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const LIB = "lib-1"
const NOW = "2026-08-15T00:00:00"
const PROFILE = "src/packs/kr-marketplace/profiles/esm-order@1.json"

const ESM = FIXTURES.find((x) => x.id === 8)
const ready = ESM !== undefined && existsSync(fixturePath(ESM, CLEAN_DIR))
const run = ready ? describe : describe.skip
if (!ready) console.warn("[load-breakdown] ESM 픽스처가 없어 건너뛴다")

const profile = (): MappingProfile =>
  JSON.parse(readFileSync(PROFILE, "utf-8")) as MappingProfile

async function fresh(): Promise<{ db: Driver; repo: Repository }> {
  const db = openNodeDriver(":memory:")
  await migrate(db)
  const repo = new Repository(db)
  await repo.ensureLibrary(LIB, "기본", NOW)
  const p = profile()
  await repo.ensureConnection(
    { id: "c1", libraryId: LIB, packId: p.packId, marketplaceKey: p.marketplaceKey, displayName: p.displayName },
    NOW,
  )
  return { db, repo }
}

async function importOnce(repo: Repository, batchId: string, p: MappingProfile) {
  return runImport(repo, {
    bytes: new Uint8Array(readFileSync(fixturePath(ESM!, CLEAN_DIR))),
    fileName: ESM!.file,
    profile: p,
    sheetIndex: 0,
    libraryId: LIB,
    connectionId: "c1",
    batchId,
    now: NOW,
  })
}

run("정상 파일 — 병합은 0이고 화면은 아무 말도 안 한다", () => {
  it("첫 가져오기는 전부 신규다", async () => {
    const { db, repo } = await fresh()
    try {
      await importOnce(repo, "b1", profile())
      const d = (await repo.batchDigest("b1"))!

      expect(d.merged, "정상 파일에서 병합은 0").toBe(0)
      expect(d.updated, "덮을 이전 배치가 없다").toBe(0)
      // 주문 155 + 클레임 9 = 164 Fact 행 (이중 기록). 파일 행은 155다
      expect(d.inserted, "Fact 행 전부가 신규").toBe(164)
      expect(d.rowCount, "「가져온 행」은 파일 행이다").toBe(155)
    } finally {
      await db.close()
    }
  })

  it("0이면 다이제스트에 병합 줄이 없다 — 「안 일어났다」와 「안 셌다」를 같은 얼굴로 만들지 않는다", async () => {
    const { db, repo } = await fresh()
    try {
      await importOnce(repo, "b1", profile())
      const rows = digestRows((await repo.batchDigest("b1"))!, [])
      expect(rows.some((r) => r.label.includes("합쳐진"))).toBe(false)
    } finally {
      await db.close()
    }
  })

  /** 007 이전 배치는 셋 다 0이다 — 그 배치도 병합 줄이 뜨면 안 된다. */
  it("셋이 0인 옛 배치도 조용하다", () => {
    const old = {
      id: "b0", sourceName: "옛 파일.xls", containerFormat: "biff", sheetName: null,
      status: "committed", rowCount: 128, excludedCount: 0,
      startedAt: NOW, committedAt: NOW, exclusionsByReason: [],
      inserted: 0, updated: 0, merged: 0,
      // 008 이전 배치도 마찬가지다 — 0은 «온전했다»가 아니라 «안 남겼다»이고,
      // 그래서 화면은 아무 말도 하지 않는다
      incompleteRows: 0, issuesByCode: [], fileIssues: [],
    }
    expect(digestRows(old, [])).toEqual([])
  })
})

run("재가져오기 — 갱신이지 병합이 아니다", () => {
  it("같은 파일을 다시 넣으면 전부 갱신이고 병합은 그대로 0이다", async () => {
    const { db, repo } = await fresh()
    try {
      await importOnce(repo, "b1", profile())
      await importOnce(repo, "b2", profile())
      const d = (await repo.batchDigest("b2"))!

      expect(d.inserted, "새로 생긴 행은 없다").toBe(0)
      expect(d.updated, "164행 전부가 이전 배치를 덮었다").toBe(164)
      // ★ 이 줄이 이 게이트의 요점이다 ★ 덮어쓰기는 정상이고 병합은 사고다.
      // 둘을 한 숫자로 뭉쳤다면 여기서 164가 나와 거짓 경고가 떴을 것이다
      expect(d.merged, "재가져오기는 병합이 아니다").toBe(0)

      const rows = digestRows(d, [])
      expect(rows.some((r) => r.label.includes("합쳐진")), "경고가 뜨면 안 된다").toBe(false)
    } finally {
      await db.close()
    }
  })
})

// ─────────────────────────────────────────────────────────────
// 합성 — 픽스처가 도달 못 하는 세계 (ADR-007)
// ─────────────────────────────────────────────────────────────

/**
 * 오늘 프로파일은 **전부 불변식을 지킨다**(`tests/profile-validate.test.ts`).
 * 즉 병합이 일어나는 세계는 픽스처로 만들 수 없다 — 그 축이 상수 0으로 눌려 있다.
 * 그래서 프로파일을 일부러 망가뜨린다. 답하는 것은 **«계기판이 살아 있는가»**뿐이고
 * 값의 정확성은 정상 프로파일 쪽 게이트가 답한다.
 */
run("[합성] 키가 무너지면 병합이 보인다", () => {
  /**
   * ★ 이것이 이 작업 전체가 막으려는 바로 그 사고다 ★
   *
   * `coupang-order@1`의 행 식별 키는 「주문번호 + 옵션ID」인데 **「주문번호」가
   * `requiredHeaders`에 없었다**(2026-08-15 수정). 즉 쿠팡이 그 컬럼 이름만 바꿔도
   * 프로파일은 계속 매칭되고, 키는 「옵션ID」 하나로 줄어든다.
   *
   * 그러면 어떻게 되는지를 실측했다: **141행 중 113행이 합쳐져 28행만 남는다.**
   * 같은 상품 옵션을 산 서로 다른 사람의 주문이 한 행이 되는 것이고, 지금까지는
   * 그래도 「적재 141행 · 제외 0」이라고 보고했다.
   */
  it("[합성] 쿠팡 키에서 주문번호가 빠지면 141행 중 113행이 합쳐진다", async () => {
    const cp = FIXTURES.find((x) => x.id === 14)!
    if (!existsSync(fixturePath(cp, CLEAN_DIR))) return
    const p = JSON.parse(
      readFileSync("src/packs/kr-marketplace/profiles/coupang-order@1.json", "utf-8"),
    ) as MappingProfile
    // 「주문번호」가 파일에서 사라진 상태와 같은 키가 된다
    ;(p as unknown as { sourceKey: { columns: string[] } }).sourceKey.columns = ["옵션ID"]

    const db = openNodeDriver(":memory:")
    await migrate(db)
    const repo = new Repository(db)
    await repo.ensureLibrary(LIB, "기본", NOW)
    await repo.ensureConnection(
      { id: "c1", libraryId: LIB, packId: p.packId, marketplaceKey: p.marketplaceKey, displayName: p.displayName },
      NOW,
    )
    try {
      await runImport(repo, {
        bytes: new Uint8Array(readFileSync(fixturePath(cp, CLEAN_DIR))),
        fileName: cp.file, profile: p, sheetIndex: 0,
        libraryId: LIB, connectionId: "c1", batchId: "b1", now: NOW,
      })
      const d = (await repo.batchDigest("b1"))!

      expect(d.merged, "실측 — 113행이 합쳐진다").toBe(113)
      expect(d.inserted, "남는 것은 28행").toBe(28)
      expect(d.rowCount, "「가져온 행」은 여전히 141이라고 말한다").toBe(141)
      expect(d.excludedCount, "버려진 행은 없다 — 제외가 아니라 병합이다").toBe(0)

      const line = digestRows(d, []).find((r) => r.label.includes("합쳐진"))
      expect(line, "다이제스트가 말해야 한다").toBeDefined()
      expect(line!.value).toContain("행 식별이 유일하지 않을 수 있습니다")
    } finally {
      await db.close()
    }
  })

  it("[합성] 키 컬럼이 파일에 아예 없으면 전 행이 한 행으로 합쳐지고 그 사실이 보인다", async () => {
    const { db, repo } = await fresh()
    try {
      const p = profile() as unknown as { sourceKey: { columns: string[] } }
      p.sourceKey.columns = ["이_파일에_없는_컬럼"]
      await importOnce(repo, "b1", p as unknown as MappingProfile)
      const d = (await repo.batchDigest("b1"))!

      // 전부 같은 키("")를 얻는다 → 테이블마다 1행만 남는다
      const orders = Number(
        (await db.prepare(`SELECT COUNT(*) AS n FROM fact_order`).get())?.["n"] ?? -1,
      )
      expect(orders, "155행이 1행으로 무너진다").toBe(1)

      // ★ 이것이 지금까지 보이지 않던 사고다 ★
      expect(d.inserted + d.merged, "신규 + 병합이 Fact 행 수와 맞는다").toBe(164)
      expect(d.merged).toBe(162)
      expect(digestRows(d, []).some((r) => r.label.includes("합쳐진"))).toBe(true)
    } finally {
      await db.close()
    }
  })

  /**
   * 이중 기록은 같은 `source_key`를 `fact_order`와 `fact_claim`에 **일부러** 넣는다.
   * 테이블을 안 가르고 세면 그 정상 동작 9건이 전부 병합으로 잡힌다.
   */
  it("이중 기록은 병합이 아니다 — 테이블별로 센다", async () => {
    const { db, repo } = await fresh()
    try {
      await importOnce(repo, "b1", profile())
      const d = (await repo.batchDigest("b1"))!
      expect(d.merged, "클레임 9건은 같은 키지만 다른 테이블이다").toBe(0)
    } finally {
      await db.close()
    }
  })
})
