/**
 * §22 커버리지 — **부재가 일급인지** 본다.
 *
 * 이 파일이 존재하는 이유는 사건 하나다. 리허설에서 사용자가 *"ESM은 수수료가
 * 0원이네"*를 **DB를 직접 조회해서** 알아냈다. 앱은 그 사실을 알고 있었지만
 * 말하지 않았다. 여기 있는 단언들은 "앱이 먼저 말하는가"를 묻는다.
 */

import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { coverage, openedBy, PNL_METRICS, type DocType } from "../src/core/coverage/index.js"
import { loadCoverage, type ConnectionCoverage } from "../src/core/coverage/load.js"
import { coverageNote, coverageStrip } from "../src/app/channel.js"
import { digestRows } from "../src/app/import.js"
import { krDocTypeResolver } from "../src/packs/kr-marketplace/markets/index.js"
import { marketDict, marketDicts } from "../src/packs/kr-marketplace/markets/index.js"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import { runImport } from "../src/core/import/run.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const LIB = "lib-1"
const NOW = "2026-08-14T00:00:00.000Z"
const PROFILE_DIR = "src/packs/kr-marketplace/profiles"

const entry = (c: ReturnType<typeof coverage>, id: string) =>
  c.entries.find((e) => e.metric === id)!

describe("§22-1 판정 — 지표가 입력을 선언한다", () => {
  it("아무것도 없으면 전부 잠긴다 — 그리고 «잠김»은 «0»이 아니다", () => {
    const c = coverage([], { settlementGross: 0 })
    expect(c.entries.every((e) => !e.open)).toBe(true)
    expect(c.hasLocked).toBe(true)
    // 크기를 모르면 숫자를 지어내지 않는다 (헌장 A-5)
    expect(c.entries.every((e) => e.lockedValue === null)).toBe(true)
  })

  it("정산만 있으면 수수료는 열리고 매출은 잠긴다", () => {
    const c = coverage(["settlement"], { settlementGross: 4_969_100 })
    expect(entry(c, "fee").open).toBe(true)
    expect(entry(c, "revenue").open).toBe(false)
    expect(entry(c, "revenue").missing).toEqual(["order"])
  })

  it("주문만 있으면 매출은 열리고 수수료는 잠긴다 — ESM이 이 모양이다", () => {
    const c = coverage(["order"], { settlementGross: 0 })
    expect(entry(c, "revenue").open).toBe(true)
    expect(entry(c, "fee").open).toBe(false)
    // 정산 파일이 아예 없으니 «잠긴 수수료»의 크기는 계산할 길이 없다
    expect(entry(c, "fee").lockedValue).toBeNull()
  })

  it("★ 잠긴 매출은 크기를 말한다 — 정산 파일이 그 금액을 들고 있으니까 ★", () => {
    const c = coverage(["settlement"], { settlementGross: 4_969_100 })
    expect(entry(c, "revenue").lockedValue).toBe(4_969_100)
  })

  it("정산이 있어도 금액이 0이면 크기를 말하지 않는다", () => {
    const c = coverage(["settlement"], { settlementGross: 0 })
    expect(entry(c, "revenue").lockedValue).toBeNull()
  })

  /**
   * ★ 이 단언이 §22의 핵심 결정을 지킨다 ★
   *
   * 처음 설계는 마켓이 «필요 서류»를 선언하는 것이었다. 그러면 광고를 하지 않는
   * 셀러의 화면에 영원히 빨간 칸이 남는다. 뒤집은 결과가 이것이다 — 기여이익은
   * 광고 파일을 **요구하지 않는다.**
   *
   * 이 단언이 깨지는 날은 누군가 `contribution.requires`에 `ad`를 넣은 날이고,
   * 그 순간 앱은 광고를 안 하는 사용자에게 숙제를 내기 시작한다.
   */
  it("기여이익은 광고 파일을 요구하지 않는다 — 광고 안 하는 셀러에게 결핍이 아니다", () => {
    const spec = PNL_METRICS.find((m) => m.id === "contribution")!
    expect(spec.requires).not.toContain("ad")
    expect([...spec.requires].sort()).toEqual(["cost", "order", "settlement"])

    const c = coverage(["order", "settlement", "cost"], { settlementGross: 0 })
    expect(entry(c, "contribution").open, "광고 없이도 기여이익은 열린다").toBe(true)
    expect(entry(c, "ad-spend").open, "광고비는 자기 지표로 따로 잠긴다").toBe(false)
  })

  it("held는 선언 순서로 정규화된다 — 화면이 매번 다른 순서를 그리지 않게", () => {
    const a = coverage(["ad", "order"] as DocType[], { settlementGross: 0 })
    const b = coverage(["order", "ad"] as DocType[], { settlementGross: 0 })
    expect(a.held).toEqual(b.held)
    expect(a.held).toEqual(["order", "ad"])
  })
})

describe("§22-2 팩 사전 — 문구 재료는 팩에 산다 (LOCK 4)", () => {
  it("연결의 marketplace_key로 사전을 찾는다", () => {
    expect(marketDict("11st")?.displayName).toBe("11번가")
    expect(marketDict("esm")?.displayName).toBe("ESM (G마켓·옥션)")
    expect(marketDict("coupang")?.displayName).toBe("쿠팡")
  })

  it("모르는 마켓은 null이다 — 기본 사전을 지어내지 않는다 (ADR-010 계열)", () => {
    expect(marketDict("naver")).toBeNull()
  })

  it("사전마다 order·settlement·ad 셋을 말한다", () => {
    for (const m of marketDicts()) {
      for (const dt of ["order", "settlement", "ad"]) {
        expect(m.docTypes[dt]?.label, `${m.marketplaceKey}/${dt}`).toBeTruthy()
        expect(m.docTypes[dt]!.gives.length, `${m.marketplaceKey}/${dt}`).toBeGreaterThan(0)
      }
    }
  })

  it("mapping_version을 성격으로 되돌린다 — 문자열을 쪼개지 않는다", () => {
    const resolve = krDocTypeResolver()
    expect(resolve("11st/settlement/order-line@1")).toBe("settlement")
    expect(resolve("esm/order/order-line@1")).toBe("order")
    expect(resolve("coupang/ad/campaign-breakdown@1")).toBe("ad")
    expect(resolve("모르는/것@9")).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────
// §22-3 문장 — core가 아니라 화면이 만든다
// ─────────────────────────────────────────────────────────────

const fake = (
  held: DocType[],
  counts: Partial<Record<DocType, number>>,
  gross = 0,
  skuCount = 0,
): ConnectionCoverage => ({
  connectionId: "c1",
  channel: "11번가",
  marketplaceKey: "11st",
  state: "CONNECTED",
  counts: { order: 0, settlement: 0, ad: 0, cost: 0, ...counts },
  skuCount,
  lastImportAt: "2026-08-14T00:00:00",
  coverage: coverage(held, { settlementGross: gross }),
})

describe("§22-3 3절 문장", () => {
  const dict = marketDict("11st")

  it("정산만 있는 채널 — ①있다 ②잠겼다+값", () => {
    const s = coverageNote(fake(["settlement"], { settlement: 128 }, 4_969_100), dict)
    expect(s).toContain("정산 128건이 들어와 있습니다")
    expect(s).toContain("주문 파일이 없어 매출 4,969,100원이 손익에 반영되지 않습니다")
  })

  /**
   * ★ 실기기에서 잡힌 결함 — 못 지킬 약속 ★
   *
   * 이 자리는 *"주문 파일을 넣으면 열립니다"*라고 말했다. 사용자가 그대로 따라
   * 쿠팡 매출 파일을 넣자 *"맞는 매핑 프로파일이 없습니다 — 이 파일은 넣을 수
   * 없습니다"*가 떴다. 오늘 마켓×성격 9칸 중 읽을 수 있는 것은 3칸뿐이다.
   */
  it("★ 읽을 수 없는 양식에 «넣으면 열립니다»라고 하지 않는다 ★", () => {
    const s = coverageNote(fake(["settlement"], { settlement: 128 }, 4_969_100), dict)
    expect(s, "11번가 주문 프로파일은 없다").not.toContain("주문 파일을 넣으면 열립니다")
    expect(s).toContain("주문 파일은 아직 읽을 수 없습니다")
    expect(s).toContain("매핑 프로파일이 없습니다")
  })

  it("읽을 수 있으면 그때는 «넣으면 열립니다»라고 한다", () => {
    // 프로파일이 생긴 세계를 가정한다 — 그날 문장이 스스로 바뀌어야 한다.
    const future = { ...dict!, readable: ["settlement", "order"] as const }
    const s = coverageNote(fake(["settlement"], { settlement: 128 }, 4_969_100), future)
    expect(s).toContain("주문 파일을 넣으면 열립니다")
    expect(s).not.toContain("읽을 수 없습니다")
  })

  /**
   * ★ 이 단언이 한 번 뒤집혔다 (2026-08-14) ★
   *
   * 쿠팡은 `["ad"]`였다. 매출 프로파일 2종이 들어오자 **파생값이 스스로**
   * `["ad", "order"]`가 됐고, 이 테스트가 그 변화를 잡아 «판정 완료»를 알렸다.
   * 손으로 적었다면 아무 일도 일어나지 않았을 자리다.
   */
  it("팩이 읽을 수 있는 성격을 프로파일에서 파생시킨다 — 손으로 적지 않는다", () => {
    const sorted = (k: string) => [...(marketDict(k)?.readable ?? [])].sort()
    expect(sorted("11st")).toEqual(["settlement"])
    expect(sorted("esm")).toEqual(["order"])
    expect(sorted("coupang"), "매출 2종이 들어오며 order가 붙었다").toEqual(["ad", "order"])
  })

  it("★ 프로파일이 생기자 문장이 스스로 «넣으면 열립니다»로 바뀌었다 ★", () => {
    const cp = marketDict("coupang")
    const s = coverageNote(
      { ...fake(["ad"], { ad: 80_137 }), channel: "쿠팡", marketplaceKey: "coupang" },
      cp,
    )
    expect(s).toContain("주문 파일을 넣으면 열립니다")
    expect(s, "이제 «읽을 수 없습니다»라고 하지 않는다").not.toContain("주문 파일은 아직 읽을 수 없습니다")
    // 정산은 여전히 프로파일이 없다 — 한 채널 안에서 둘이 갈린다
    expect(s).toContain("정산 파일은 아직 읽을 수 없습니다")
  })

  it("스트립이 «아직 안 넣음»과 «넣어도 못 읽음»을 가른다", () => {
    const strip = coverageStrip(fake(["settlement"], { settlement: 128 }, 4_969_100), dict)
    const by = Object.fromEntries(strip.map((s) => [s.label, s.via]))
    expect(by["정산"]).toBe("파일")
    expect(by["주문"], "11번가 주문 프로파일이 없다").toBe("양식 미지원")
    expect(by["광고"]).toBe("양식 미지원")

    const future = { ...dict!, readable: ["settlement", "order"] as const }
    const s2 = Object.fromEntries(coverageStrip(fake(["settlement"], {}, 1), future).map((s) => [s.label, s.via]))
    expect(s2["주문"], "읽을 수 있으면 «미수집»이다").toBe("미수집")
  })

  it("★ 사용자가 DB를 캐물어 알아낸 사실을 앱이 먼저 말한다 ★", () => {
    const s = coverageNote(fake(["order"], { order: 146 }), dict)
    expect(s).toContain("주문 146건이 들어와 있습니다")
    expect(s).toContain("정산 파일이 없어 수수료가 손익에 잡히지 않습니다")
  })

  it("크기를 모르면 숫자를 지어내지 않는다", () => {
    const s = coverageNote(fake(["order"], { order: 146 }), dict)
    expect(s).not.toMatch(/\d[\d,]*원/)
  })

  it("광고는 문장에 등장하지 않는다 — 잠긴 지표는 조용하다", () => {
    const s = coverageNote(fake(["order", "settlement", "cost"], { order: 1, settlement: 1, cost: 1 }, 0, 1), dict)
    expect(s, "전부 열렸으면 할 말이 없다").toBe("")
  })

  it("잠긴 것이 없으면 빈 문장 — 노트 상자가 아예 안 뜬다", () => {
    const cc = fake(["order", "settlement", "cost"], { order: 5, settlement: 5, cost: 3 }, 0, 3)
    expect(cc.coverage.entries.find((e) => e.metric === "ad-spend")!.open).toBe(false)
    expect(coverageNote(cc, dict)).toBe("")
  })

  it("조사가 이름에 맞게 붙는다 — 매출«이» · 수수료«가»", () => {
    expect(coverageNote(fake(["order"], { order: 1 }), dict)).toContain("수수료가")
    expect(coverageNote(fake(["ad"], { ad: 1 }), dict)).toContain("매출이")
  })

  it("스트립은 4칸 — 목업의 6칸 중 «상품·반품»을 미수집으로 지어내지 않는다", () => {
    const strip = coverageStrip(fake(["settlement"], { settlement: 128 }, 4_969_100), dict)
    expect(strip.map((s) => s.label)).toEqual(["주문", "정산", "광고", "원가"])
    expect(strip[1]!.via).toBe("파일")
    // 11번가 주문 프로파일이 없으므로 «미수집»이 아니라 «양식 미지원»이다
    expect(strip[0]!.via).toBe("양식 미지원")
    expect(strip[3]!.via).toBe("미입력")
  })

  it("반쯤 채워진 원가는 «없음»과 다르게 보인다", () => {
    const strip = coverageStrip(fake(["order"], { order: 1, cost: 3 }, 0, 10), dict)
    expect(strip[3]!.via, "3/10처럼 진행을 그대로 보인다").toBe("3/10")
  })
})

describe("§22-4 다이제스트 한 줄 — 이 파일로 열린 것", () => {
  it("정산 파일은 수수료를 연다", () => {
    const cc = fake(["settlement"], { settlement: 128 }, 4_969_100)
    expect(openedBy(cc.coverage, "settlement")).toEqual(["수수료"])
  })

  it("주문 파일은 매출과 수량을 연다", () => {
    const cc = fake(["order"], { order: 146 })
    expect(openedBy(cc.coverage, "order")).toEqual(["매출", "판매 수량"])
  })

  it("아무것도 못 열었으면 빈 목록 — 줄을 그리지 않는다", () => {
    expect(openedBy(coverage([], { settlementGross: 0 }), "order")).toEqual([])
  })

  /** 다이제스트가 실제로 그리는 목록. 제외 사유와 **같은 모양의 줄** 하나다. */
  const digest = (excl: { reason: string; count: number }[]) => ({
    id: "b1",
    sourceName: "2026년 7월_11st 결제일 정산확정 건.xls",
    containerFormat: "biff",
    sheetName: "Sheet",
    status: "committed",
    rowCount: 128,
    excludedCount: excl.reduce((a, x) => a + x.count, 0),
    startedAt: NOW,
    committedAt: NOW,
    exclusionsByReason: excl,
  })

  it("제외 목록 뒤에 «이 파일로 열린 것»이 붙는다", () => {
    const rows = digestRows(digest([{ reason: "subtitle", count: 1 }]), ["수수료"])
    expect(rows.length).toBe(2)
    expect(rows[0]!.value).toBe("1건")
    expect(rows[1]!.label).toBe("이 파일로 열린 것")
    expect(rows[1]!.value).toBe("수수료")
  })

  it("여럿을 열면 가운뎃점으로 잇는다", () => {
    const rows = digestRows(digest([]), ["매출", "판매 수량"])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.value).toBe("매출 · 판매 수량")
  })

  it("연 것이 없으면 줄도 없다 — 할 말이 없으면 안 한다", () => {
    expect(digestRows(digest([]), [])).toEqual([])
  })

  it("«error» 사유는 다른 색으로 나온다 — LOCK 6의 그 5건", () => {
    const rows = digestRows(digest([{ reason: "error", count: 5 }]), ["매출", "판매 수량"])
    expect(rows[0]!.color).not.toBe(rows[1]!.color)
  })
})

// ─────────────────────────────────────────────────────────────
// 실파일 — §22를 낳은 상황 그 자체
// ─────────────────────────────────────────────────────────────

const CASES = [
  { fixture: 6, profile: "11st-settlement@1.json", conn: "conn-11st" },
  { fixture: 8, profile: "esm-order@1.json", conn: "conn-esm" },
]

const ready = CASES.every((c) => {
  const f = FIXTURES.find((x) => x.id === c.fixture)
  return f !== undefined && existsSync(fixturePath(f, CLEAN_DIR))
})
const run = ready ? describe : describe.skip
if (!ready) console.warn("[coverage] fixtures/clean이 없어 실파일 절을 건너뛴다")

run("§22 실파일 — 반쪽씩 들어온 두 채널", () => {
  it("11번가는 정산만 · ESM은 주문만 — 각자 다른 것이 잠긴다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await migrate(db)
      const repo = new Repository(db)
      await repo.ensureLibrary(LIB, "기본", NOW)

      for (const c of CASES) {
        const f = FIXTURES.find((x) => x.id === c.fixture)!
        const profile = JSON.parse(
          readFileSync(`${PROFILE_DIR}/${c.profile}`, "utf-8"),
        ) as MappingProfile
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
        await runImport(repo, {
          bytes: new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR))),
          fileName: f.file,
          profile,
          sheetIndex: 0,
          libraryId: LIB,
          connectionId: c.conn,
          batchId: `batch-${c.conn}`,
          now: NOW,
        })
      }

      const list = await loadCoverage(db, LIB, krDocTypeResolver())
      const byId = new Map(list.map((c) => [c.connectionId, c]))

      const st = byId.get("conn-11st")!
      expect(st.coverage.held, "정산 파일 하나만 들어왔다").toEqual(["settlement"])
      expect(st.counts.settlement).toBe(128)
      expect(st.counts.order).toBe(0)
      expect(entry(st.coverage, "fee").open, "수수료는 열렸다").toBe(true)
      expect(entry(st.coverage, "revenue").open, "매출은 잠겼다").toBe(false)

      // ★ §22-3 ②가 말하라는 그 숫자 ★
      expect(
        entry(st.coverage, "revenue").lockedValue,
        "주문 파일이 없어 손익에 반영되지 않은 매출",
      ).toBe(4_969_100)

      const esm = byId.get("conn-esm")!
      expect(esm.coverage.held, "주문 파일 하나만 들어왔다").toEqual(["order"])
      expect(esm.counts.order).toBe(146)
      expect(entry(esm.coverage, "revenue").open, "매출은 열렸다").toBe(true)
      expect(entry(esm.coverage, "fee").open, "★ 사용자가 DB를 캐물어 알아낸 그 사실 ★").toBe(
        false,
      )

      // 두 채널 다 원가가 없으므로 기여이익은 어디서도 안 열린다
      expect(list.every((c) => !entry(c.coverage, "contribution").open)).toBe(true)
      expect(list.every((c) => c.coverage.hasLocked)).toBe(true)
    } finally {
      await db.close()
    }
  })

  it("원가는 «하나라도»가 아니라 «전부»여야 열린다 — 반쪽 원가는 이익을 부풀린다", async () => {
    const db = openNodeDriver(":memory:")
    try {
      await migrate(db)
      const repo = new Repository(db)
      await repo.ensureLibrary(LIB, "기본", NOW)

      const f = FIXTURES.find((x) => x.id === 8)!
      const profile = JSON.parse(
        readFileSync(`${PROFILE_DIR}/esm-order@1.json`, "utf-8"),
      ) as MappingProfile
      await repo.ensureConnection(
        {
          id: "conn-esm",
          libraryId: LIB,
          packId: profile.packId,
          marketplaceKey: profile.marketplaceKey,
          displayName: profile.displayName,
        },
        NOW,
      )
      await runImport(repo, {
        bytes: new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR))),
        fileName: f.file,
        profile,
        sheetIndex: 0,
        libraryId: LIB,
        connectionId: "conn-esm",
        batchId: "batch-esm",
        now: NOW,
      })

      // 리스팅을 **두 묶음**으로 나눠 SKU를 둘 만든다. 한 번에 넘기면 SKU가
      // 하나로 뭉쳐(연결 화면의 «묶어서 등록») 1/1이 되어 시험이 성립하지 않는다.
      const ids = (
        await db
          .prepare(`SELECT id FROM marketplace_listing WHERE library_id = ? ORDER BY id`)
          .all(LIB)
      ).map((r) => String(r["id"]))
      const half = Math.floor(ids.length / 2)
      await repo.createSkuForListings(LIB, ids.slice(0, half), "user", NOW)
      await repo.createSkuForListings(LIB, ids.slice(half), "user", NOW)

      const skus = (
        await db.prepare(`SELECT id FROM sku WHERE library_id = ? ORDER BY id`).all(LIB)
      ).map((r) => String(r["id"]))
      expect(skus.length, "SKU가 둘이어야 «전부 vs 일부»를 시험할 수 있다").toBe(2)
      const sku = skus[0]!
      await db
        .prepare(
          `INSERT INTO cost_history (library_id, sku_id, kind, amount, effective_from, entered_at, entered_by)
           VALUES (?,?,'COGS',1000,'2026-07-01',?, 'user')`,
        )
        .run(LIB, sku, NOW)

      const list = await loadCoverage(db, LIB, krDocTypeResolver())
      const esm = list.find((c) => c.connectionId === "conn-esm")!
      expect(esm.coverage.held, "원가가 덜 들어왔으면 아직 열린 게 아니다").not.toContain("cost")
      expect(entry(esm.coverage, "cogs").open).toBe(false)
      expect(esm.counts.cost, "그래도 «몇 개 넣었는지»는 센다").toBe(1)

      // 나머지 하나까지 채우면 열린다 — 부재가 «해소되는» 쪽도 못박아 둔다
      await db
        .prepare(
          `INSERT INTO cost_history (library_id, sku_id, kind, amount, effective_from, entered_at, entered_by)
           VALUES (?,?,'COGS',2000,'2026-07-01',?, 'user')`,
        )
        .run(LIB, skus[1]!, NOW)

      const after = (await loadCoverage(db, LIB, krDocTypeResolver())).find(
        (c) => c.connectionId === "conn-esm",
      )!
      expect(after.coverage.held, "전부 채우면 열린다").toContain("cost")
      expect(entry(after.coverage, "cogs").open).toBe(true)
    } finally {
      await db.close()
    }
  })
})
