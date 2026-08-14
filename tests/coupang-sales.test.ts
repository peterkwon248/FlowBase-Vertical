/**
 * 쿠팡 매출 2종 — **판매자 배송(건별)과 로켓그로스(기간 집계)를 함께 받는다.**
 *
 * ★ 왜 집계 파일이 손익 입력인가 ★
 * §22-5는 «집계형은 대사 상대»라고 했지만 그 규칙의 목적은 **같은 사실의 요약본**이
 * 이중으로 들어오는 것을 막는 데 있었다. 로켓그로스는 쿠팡이 **건별 데이터를 주지
 * 않아** 이 집계가 유일한 원본이다. 개정: «건별이 존재하지 않는 사실의 집계는 그
 * 사실의 원본이다» (2026-08-14 판정).
 *
 * 실측이 그 무게를 말한다 — 로켓그로스가 판매자 배송의 **14배**이고, 이 파일이
 * 없으면 쿠팡 매출의 93%가 사라진다.
 */

import { describe, expect, it } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import { runImport } from "../src/core/import/run.js"
import { analyzeImport } from "../src/core/import/analyze.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
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
const byId = (id: string): MappingProfile => PROFILES.find((p) => p.id === id)!

const LIB = "lib-1"
const CONN = "conn-coupang"
const NOW = "2026-08-14T00:00:00.000Z"

const CASES = [
  {
    fixture: 14,
    profileId: "coupang/order/order-option",
    rows: 141,
    revenue: 5_272_380,
    listings: 28,
  },
  {
    fixture: 15,
    profileId: "coupang/order/option-period",
    rows: 147, // 데이터 148 − TOTAL 1
    revenue: 73_740_340,
    listings: 147,
  },
]

const ready = CASES.every((c) => {
  const f = FIXTURES.find((x) => x.id === c.fixture)
  return f !== undefined && existsSync(fixturePath(f, CLEAN_DIR))
})
const run = ready ? describe : describe.skip
if (!ready) console.warn("[coupang-sales] fixtures/clean이 없어 건너뛴다")

const bytesOf = (id: number) => {
  const f = FIXTURES.find((x) => x.id === id)!
  return { bytes: new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR))), name: f.file }
}

run("쿠팡 매출 2종", () => {
  it("판정 — 각 파일이 자기 프로파일을 1등으로 고른다", async () => {
    for (const c of CASES) {
      const { bytes, name } = bytesOf(c.fixture)
      const a = await analyzeImport(bytes, name, PROFILES)
      expect(a.profiles.length, `${name} — 후보가 없다`).toBeGreaterThan(0)
      expect(a.profiles[0]!.profile.id, name).toBe(c.profileId)
    }
  })

  it("★ 서로를 오인하지 않는다 — 둘 다 쿠팡·옵션 단위라 헤더가 갈라야 한다 ★", async () => {
    for (const c of CASES) {
      const { bytes, name } = bytesOf(c.fixture)
      const a = await analyzeImport(bytes, name, PROFILES)
      const other = CASES.find((x) => x !== c)!
      const rival = a.profiles.find((p) => p.profile.id === other.profileId)
      expect(rival, `${name}이 ${other.profileId}에도 매칭됐다`).toBeUndefined()
    }
  })

  for (const c of CASES) {
    it(`${c.profileId} — 적재 행·매출·리스팅이 실측과 같다`, async () => {
      const db = openNodeDriver(":memory:")
      try {
        await migrate(db)
        const repo = new Repository(db)
        await repo.ensureLibrary(LIB, "기본", NOW)
        const profile = byId(c.profileId)
        await repo.ensureConnection(
          {
            id: CONN,
            libraryId: LIB,
            packId: profile.packId,
            marketplaceKey: profile.marketplaceKey,
            displayName: profile.displayName,
          },
          NOW,
        )

        const { bytes, name } = bytesOf(c.fixture)
        const r = await runImport(repo, {
          bytes,
          fileName: name,
          profile,
          sheetIndex: 0,
          libraryId: LIB,
          connectionId: CONN,
          batchId: "b-1",
          now: NOW,
        })

        // ★ 품목이 함께 들어온다 (2026-08-14) ★ 두 프로파일 다 «한 행 = 품목 하나»라
        // 헤더와 품목이 1:1이다. 그 1:1이 깨지는 날(주문 단위 헤더로 바꾸면 그렇게
        // 된다) 이 단언이 먼저 알려 준다.
        expect(Object.fromEntries(r.perTable)).toEqual({
          fact_order: c.rows,
          fact_order_item: c.rows,
        })
        expect(r.listings ? r.listings.inserted + r.listings.updated : 0).toBe(c.listings)

        const sum = await db.prepare(`SELECT SUM(total_amount) AS s FROM fact_order`).get()
        expect(Number(sum!["s"]), "손으로 센 합계와 원 단위까지 같아야 한다").toBe(c.revenue)

        const uniq = await db
          .prepare(`SELECT COUNT(DISTINCT source_key) AS u, COUNT(*) AS n FROM fact_order`)
          .get()
        expect(Number(uniq!["u"]), "source_key가 유일하다").toBe(Number(uniq!["n"]))
      } finally {
        await db.close()
      }
    })
  }

  it("★ 기간 집계는 날짜가 파일명에서 오고, 그 사실이 행에 남는다 ★", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await migrate(db)
      const repo = new Repository(db)
      await repo.ensureLibrary(LIB, "기본", NOW)
      const profile = byId("coupang/order/option-period")
      await repo.ensureConnection(
        { id: CONN, libraryId: LIB, packId: profile.packId, marketplaceKey: "coupang", displayName: "쿠팡" },
        NOW,
      )
      const { bytes, name } = bytesOf(15)
      await runImport(repo, {
        bytes, fileName: name, profile, sheetIndex: 0,
        libraryId: LIB, connectionId: CONN, batchId: "b-1", now: NOW,
      })

      const row = await db
        .prepare(`SELECT ordered_at, period_end, date_precision FROM fact_order LIMIT 1`)
        .get()
      expect(row!["ordered_at"], "파일명 20260701 → 기간 시작일").toBe("2026-07-01")
      expect(row!["period_end"], "파일명 20260731 → 기간 끝").toBe("2026-07-31")
      expect(row!["date_precision"], "실제 주문일이 아님을 값 옆에 남긴다").toBe("period")

      const all = await db
        .prepare(`SELECT COUNT(*) AS n FROM fact_order WHERE date_precision = 'period'`)
        .get()
      expect(Number(all!["n"]), "전 행이 기간 표기를 갖는다").toBe(147)
    } finally {
      await db.close()
    }
  })

  /**
   * ★ 이 단언이 «8월 파일이 7월을 덮는다» 사고를 막는다 ★
   * 기간이 키에 없으면 옵션ID가 키가 되고, 다음 달 파일이 같은 옵션의 행을
   * UPSERT로 갈아엎어 지난달 매출이 통째로 사라진다.
   */
  it("★ 같은 옵션이라도 기간이 다르면 다른 행이다 — 파일명이 키에 들어간다 ★", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await migrate(db)
      const repo = new Repository(db)
      await repo.ensureLibrary(LIB, "기본", NOW)
      const profile = byId("coupang/order/option-period")
      await repo.ensureConnection(
        { id: CONN, libraryId: LIB, packId: profile.packId, marketplaceKey: "coupang", displayName: "쿠팡" },
        NOW,
      )
      const { bytes } = bytesOf(15)

      // 같은 바이트를 **다른 기간의 파일명**으로 한 번 더 넣는다 — 8월 파일 흉내다.
      for (const [batch, file] of [
        ["b-7", "쿠팡 제트 매출_20260701~20260731.xlsx"],
        ["b-8", "쿠팡 제트 매출_20260801~20260831.xlsx"],
      ]) {
        await runImport(repo, {
          bytes, fileName: file!, profile, sheetIndex: 0,
          libraryId: LIB, connectionId: CONN, batchId: batch!, now: NOW,
        })
      }

      const n = await db.prepare(`SELECT COUNT(*) AS n FROM fact_order`).get()
      expect(Number(n!["n"]), "두 달이 겹쳐 덮이지 않고 나란히 쌓인다").toBe(294)

      const months = await db
        .prepare(`SELECT ordered_at, COUNT(*) AS n FROM fact_order GROUP BY ordered_at ORDER BY ordered_at`)
        .all()
      expect(months.map((m) => String(m["ordered_at"]))).toEqual(["2026-07-01", "2026-08-01"])
    } finally {
      await db.close()
    }
  })

  it("두 파일은 옵션이 겹치지 않는다 — 물류 경로가 갈린다 (이중계상 불가)", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await migrate(db)
      const repo = new Repository(db)
      await repo.ensureLibrary(LIB, "기본", NOW)
      for (const c of CASES) {
        const profile = byId(c.profileId)
        await repo.ensureConnection(
          { id: CONN, libraryId: LIB, packId: profile.packId, marketplaceKey: "coupang", displayName: "쿠팡" },
          NOW,
        )
        const { bytes, name } = bytesOf(c.fixture)
        await runImport(repo, {
          bytes, fileName: name, profile, sheetIndex: 0,
          libraryId: LIB, connectionId: CONN, batchId: `b-${c.fixture}`, now: NOW,
        })
      }

      const listings = await db
        .prepare(`SELECT COUNT(*) AS n FROM marketplace_listing WHERE library_id = ?`)
        .get(LIB)
      expect(Number(listings!["n"]), "28 + 147, 충돌 0").toBe(175)

      const total = await db.prepare(`SELECT SUM(total_amount) AS s FROM fact_order`).get()
      expect(Number(total!["s"]), "쿠팡 7월 매출 전량").toBe(5_272_380 + 73_740_340)
    } finally {
      await db.close()
    }
  })
})
