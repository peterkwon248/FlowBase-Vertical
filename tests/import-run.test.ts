/**
 * `runImport` — **가져오기 구현이 하나임**을 지킨다.
 *
 * 종단 경로가 두 벌이었다. `tools/harness/pnl.ts`(완전함)와 `src/app/smoke.ts`(얇음).
 * 위저드가 세 번째 벌을 만들면 «화면 숫자 = CLI 숫자»가 구조적 보장에서 검사 항목으로
 * 내려간다. 그래서 하나로 모았고, 이 파일이 그 하나가 옳은지 본다.
 *
 * ★ 얇은 쪽이 빠뜨렸던 것을 정확히 겨냥한다 ★
 * `smoke.ts`는 `mapped.rows`를 읽어 **라우팅으로 갈라진 행을 놓친다.** ESM 파일은
 * 클레임이 `fact_claim`으로 가므로, 테이블이 둘로 갈리는지가 그 결함의 리트머스다.
 */

import { describe, expect, it } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import { runImport } from "../src/core/import/run.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const PROFILE_DIR = "src/packs/kr-marketplace/profiles"
const LIB = "lib-1"
const NOW = "2026-08-14T00:00:00.000Z"

/**
 * 실파일 2종. 쿠팡 광고(8만 행)는 여기서 돌리기엔 무거워 `npm run e2e`가 맡는다.
 *
 * ★ 숫자는 3b-0 CLI가 내놓는 그 숫자다 ★
 * `tools/harness/pnl.ts`의 관통 결과(11번가 128 · ESM 146+9=155 · 리스팅 44+42=86)와
 * **원 단위까지 같아야** 「가져오기 구현이 하나」가 참이 된다. 갈리는 날 여기가 먼저 깨진다.
 * clean/raw 양쪽에서 같은 값이 나오는 것도 확인했다 — 비식별화가 구조를 건드리지 않았다.
 */
const CASES = [
  {
    fixture: 6, profile: "11st-settlement@1.json", conn: "conn-11st",
    expect: { fact_settlement: 128 },
    pipelineExcluded: 2, lostRows: 0, listings: 44,
    reasons: { subtitle: 1, "trailing-blank": 1 },
  },
  {
    fixture: 8, profile: "esm-order@1.json", conn: "conn-esm",
    // ★ 라우팅이 갈리는 자리 ★ `mapped.rows`만 읽으면 클레임 9건이 통째로 사라진다
    expect: { fact_order: 146, fact_claim: 9 },
    pipelineExcluded: 0,
    // ★ 단언이 뒤집힌 자리 ★ 전에는 "5건이 DB에 남지 않는다"를 단언했다.
    // 이제 남는다 — 발생일 없는 클레임 5행이 `reason: "error"`로 기록된다.
    lostRows: 5, listings: 42,
    reasons: { error: 5 },
  },
] as const

const ready = CASES.every((c) => {
  const f = FIXTURES.find((x) => x.id === c.fixture)
  return f !== undefined && existsSync(fixturePath(f, CLEAN_DIR))
})
const run = ready ? describe : describe.skip

if (!ready) console.warn("[import-run] fixtures/clean이 없어 건너뛴다")

async function fresh(): Promise<{ db: Driver; repo: Repository }> {
  const db = openNodeDriver(":memory:")
  await migrate(db)
  const repo = new Repository(db)
  await repo.ensureLibrary(LIB, "기본", NOW)
  return { db, repo }
}

function load(c: (typeof CASES)[number]) {
  const f = FIXTURES.find((x) => x.id === c.fixture)!
  const profile = JSON.parse(
    readFileSync(`${PROFILE_DIR}/${c.profile}`, "utf-8"),
  ) as MappingProfile
  return { bytes: new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR))), fileName: f.file, profile }
}

run("runImport — 파일 하나를 끝까지 넣는다", () => {
  for (const c of CASES) {
    it(`${c.profile} — 적재 행이 테이블별로 갈린다`, async () => {
      const { db, repo } = await fresh()
      try {
        const { bytes, fileName, profile } = load(c)
        await repo.ensureConnection(
          {
            id: c.conn,
            libraryId: LIB,
            packId: profile.packId,
            marketplaceKey: profile.marketplaceKey,
            displayName: profile.displayName,
          },
          NOW,
        )

        const r = await runImport(repo, {
          bytes,
          fileName,
          profile,
          sheetIndex: 0,
          libraryId: LIB,
          connectionId: c.conn,
          batchId: `batch-${c.conn}`,
          now: NOW,
        })

        // ★ 여기가 얇은 경로의 결함을 잡는 자리다 ★
        expect(Object.fromEntries(r.perTable), "테이블별 적재가 CLI와 다르다").toEqual(c.expect)
        expect(r.loaded, "적재 합계는 테이블별 합과 같다").toBe(
          Object.values(c.expect).reduce((a, b) => a + b, 0),
        )
        expect(r.excluded.length, "파이프라인이 거른 행").toBe(c.pipelineExcluded)
        expect(r.lostRows, "매핑이 버린 행").toBe(c.lostRows)
        expect(
          r.listings ? r.listings.inserted + r.listings.updated : 0,
          "리스팅 종류 수 — 상품 연결 화면이 세는 그 수다",
        ).toBe(c.listings)

        // ★ 잃은 것이 DB에 남는다 (LOCK 6) ★
        const d = (await repo.batchDigest(`batch-${c.conn}`))!
        expect(d.excludedCount, "제외 합계").toBe(c.pipelineExcluded + c.lostRows)
        expect(
          Object.fromEntries(d.exclusionsByReason.map((x) => [x.reason, x.count])),
          "사유별 제외",
        ).toEqual(c.reasons)

        // 적재 수가 **DB에 실제로 있는 행 수**와 같다. 통계만 맞고 행이 없으면
        // 「센 것」과 「넣은 것」이 갈린 것이다.
        for (const [table, n] of r.perTable) {
          const row = await db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get()
          expect(Number(row?.["c"]), `${table} 실제 행 수`).toBe(n)
        }
      } finally {
        await db.close()
      }
    })
  }

  it("배치가 어느 시트에서 왔는지 남는다 — 지금까지 늘 NULL이었다", async () => {
    const { db, repo } = await fresh()
    try {
      const c = CASES[0]
      const { bytes, fileName, profile } = load(c)
      await repo.ensureConnection(
        { id: c.conn, libraryId: LIB, packId: profile.packId, marketplaceKey: profile.marketplaceKey, displayName: profile.displayName },
        NOW,
      )
      await runImport(repo, {
        bytes, fileName, profile, sheetIndex: 0,
        libraryId: LIB, connectionId: c.conn, batchId: "b1", now: NOW,
      })

      const d = await repo.batchDigest("b1")
      expect(d, "다이제스트가 없다").toBeTruthy()
      expect(d!.sheetName, "시트 이름이 비어 있다").toBeTruthy()
      expect(d!.status).toBe("committed")
      expect(d!.sourceName).toBe(fileName)
      // 제외는 0건일 수도 있다 — **0건인 것도 사실**이라 배열이 비는 것이 정상이다
      expect(Array.isArray(d!.exclusionsByReason)).toBe(true)
      const byReason = d!.exclusionsByReason.reduce((a, x) => a + x.count, 0)
      expect(byReason, "사유별 합이 excluded_count와 같다").toBe(d!.excludedCount)
    } finally {
      await db.close()
    }
  })

  /** ★ 채널 이름의 출처는 프로파일이다 — 문서 이름이 아니다 (헌장 C-4) ★ */
  it("연결 이름은 displayName이지 label이 아니다", async () => {
    const { db, repo } = await fresh()
    try {
      const { profile } = load(CASES[0])
      await repo.ensureConnection(
        { id: "c1", libraryId: LIB, packId: profile.packId, marketplaceKey: profile.marketplaceKey, displayName: profile.displayName },
        NOW,
      )
      const row = await db.prepare(`SELECT display_name FROM connection WHERE id = 'c1'`).get()
      expect(String(row?.["display_name"])).toBe(profile.displayName)
      // 문서 제목이 채널 열에 뜨면 안 된다
      expect(String(row?.["display_name"])).not.toBe(profile.label)
    } finally {
      await db.close()
    }
  })

  it("같은 연결을 두 번 만들어도 터지지 않는다 — 재가져오기가 정상 경로다", async () => {
    const { db, repo } = await fresh()
    try {
      const { profile } = load(CASES[0])
      const c = { id: "c1", libraryId: LIB, packId: profile.packId, marketplaceKey: profile.marketplaceKey, displayName: profile.displayName }
      await repo.ensureConnection(c, NOW)
      await repo.ensureConnection(c, NOW)
      await repo.ensureLibrary(LIB, "기본", NOW)
      const row = await db.prepare(`SELECT COUNT(*) AS c FROM connection`).get()
      expect(Number(row?.["c"])).toBe(1)
    } finally {
      await db.close()
    }
  })
})
