/**
 * 기준 데이터의 문 — **원가가 들어오고 손익이 움직인다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 파일이 지키는 것 ★
 *
 * 앱은 커버리지 화면에서 *"매입원가 — 잠김, 필요: cost"*라고 **말해 왔는데
 * 넣을 문이 없었다.** 말과 행동이 어긋난 자리였고, 이 테스트가 그 문이 실제로
 * 열려 있는지 잰다.
 *
 * 가장 중요한 단언은 마지막 하나다 — **원가를 넣으면 기여이익이 내려간다.**
 * 「원가 행이 35개 생겼다」는 저장 계층의 사실이고, 「손익이 움직였다」가
 * 사용자가 겪는 사실이다. 둘 사이가 끊기면 원가를 넣어도 화면이 그대로다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it, beforeEach } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import { runImport } from "../src/core/import/run.js"
import { runReferenceImport } from "../src/core/import/run-reference.js"
import { analyzeImport } from "../src/core/import/analyze.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const PROFILE_DIR = "src/packs/kr-marketplace/profiles"
const read = (n: string): MappingProfile =>
  JSON.parse(readFileSync(`${PROFILE_DIR}/${n}`, "utf-8")) as MappingProfile

const COST = read("cost-master@1.json")
const ESM = read("esm-order@1.json")

/** #3 = 19시트 워크북 (원가표가 시트 9) · #8 = ESM 주문 (리스팅을 만든다) */
const BOOK = FIXTURES.find((f) => f.id === 3)!
const ORDERS = FIXTURES.find((f) => f.id === 8)!
const bytesOf = (f: typeof BOOK): Uint8Array =>
  new Uint8Array(readFileSync(fixturePath(f, CLEAN_DIR)))

const LIB = "lib-1"
const NOW = "2026-08-19T00:00:00Z"
const PERIOD = { from: "2026-07-01", to: "2026-07-31" }

const ready = [BOOK, ORDERS].every((f) => existsSync(fixturePath(f, CLEAN_DIR)))
const run = ready ? describe : describe.skip
if (!ready) console.warn("[reference-import] fixtures/clean이 없어 건너뛴다")

run("기준 데이터 가져오기 — 원가", () => {
  let db: Driver
  let repo: Repository

  /** 주문을 먼저 넣는다 — 리스팅이 있어야 원가가 붙을 자리가 생긴다. */
  beforeEach(async () => {
    db = openNodeDriver()
    await migrate(db)
    repo = new Repository(db)
    await repo.ensureLibrary(LIB, "기본", NOW)
    await repo.ensureConnection(
      {
        id: "conn-esm",
        libraryId: LIB,
        packId: ESM.packId,
        marketplaceKey: ESM.marketplaceKey,
        displayName: ESM.displayName,
      },
      NOW,
    )
    await runImport(repo, {
      bytes: bytesOf(ORDERS),
      fileName: ORDERS.file,
      profile: ESM,
      sheetIndex: 0,
      libraryId: LIB,
      connectionId: "conn-esm",
      batchId: "b-esm",
      now: NOW,
    })
  })

  /** 워크북에서 원가표 시트를 찾아 넣는다 — 시트 번호를 박아 두지 않는다. */
  async function importCost(effectiveFrom = "2026-01-01", replace = false) {
    const bytes = bytesOf(BOOK)
    const a = await analyzeImport(bytes, BOOK.file, [COST])
    const hit = a.sheetMatches.find((m) => m.profiles.length > 0)
    expect(hit, "워크북에서 원가표 시트를 못 찾았다").toBeDefined()
    return runReferenceImport(repo, {
      bytes,
      fileName: BOOK.file,
      profile: COST,
      sheetIndex: hit!.sheetIndex,
      libraryId: LIB,
      effectiveFrom,
      now: NOW,
      ...(replace ? { replace: true } : {}),
    })
  }

  it("★ 전 시트 탐색이 워크북 안의 원가표를 찾아낸다 — 19시트 중에서", async () => {
    const a = await analyzeImport(bytesOf(BOOK), BOOK.file, [COST])
    const hits = a.sheetMatches.filter((m) => m.profiles.length > 0)
    expect(hits.length, "원가표 시트를 못 찾았다").toBeGreaterThan(0)
    expect(hits.map((h) => h.sheetName)).toContain("상품별원가 raw")
  })

  it("★ 넓은 양식이 좁은 양식을 삼키지 않는다 — `B2B_매출정리`는 원가표가 아니다 ★", async () => {
    // 원가표의 7열이 B2B_매출정리(101열)에 **전부 포함된다**(실측). 필수 헤더만으로는
    // 갈리지 않아 매출 파일이 원가표로 100% 판정됐다. `forbiddenHeaders`가 그걸 막는다.
    const a = await analyzeImport(bytesOf(BOOK), BOOK.file, [COST])
    const names = a.sheetMatches.filter((m) => m.profiles.length > 0).map((m) => m.sheetName)
    expect(names, "매출 파일이 원가표로 붙었다").not.toContain("B2B_매출정리")
  })

  it("원가가 들어가고, SKU가 없던 리스팅에는 1:1로 만들어 붙인다", async () => {
    const r = await importCost()
    expect(r.inserted, "원가가 한 건도 안 들어갔다").toBeGreaterThan(0)
    expect(r.createdSkus, "SKU를 만들지 않았다").toBe(r.inserted)

    const c = await db.prepare(`SELECT COUNT(*) n FROM cost_history WHERE kind = ?`).get("COGS")
    expect(Number(c?.["n"])).toBe(r.inserted)
    const s = await db.prepare(`SELECT COUNT(*) n FROM sku`).get()
    expect(Number(s?.["n"])).toBe(r.createdSkus)
  })

  it("★ 도구가 넣었다는 사실이 남는다 — 사람이 넣은 값과 구별된다", async () => {
    await importCost()
    const rows = await db.prepare(`SELECT DISTINCT entered_by FROM cost_history`).all()
    expect(rows.map((r) => r["entered_by"])).toEqual(["import"])
  })

  it("★ 못 찾는 상품이 있는 것이 **정상**이다 — 실패로 부르지 않는다", async () => {
    const r = await importCost()
    // 원가표에는 아직 안 판 상품·다른 채널 상품이 섞여 있다.
    expect(r.unmatched, "전부 맞았다면 이 픽스처 조합이 바뀐 것이다").toBeGreaterThan(0)
    expect(r.unmatchedSample.length, "무엇이 안 맞았는지 말하지 않는다").toBeGreaterThan(0)
    // 그래도 맞은 것은 들어갔다 — 하나가 안 맞는다고 전체를 버리지 않는다
    expect(r.inserted).toBeGreaterThan(0)
  })

  it("두 번 넣어도 늘지 않는다 — 같은 (SKU · 종류 · 적용일)은 건너뛴다", async () => {
    const first = await importCost()
    const second = await importCost()
    expect(second.inserted, "같은 값이 또 들어갔다").toBe(0)
    expect(second.skipped).toBe(first.inserted)
    expect(second.createdSkus, "SKU가 또 만들어졌다").toBe(0)

    const c = await db.prepare(`SELECT COUNT(*) n FROM cost_history`).get()
    expect(Number(c?.["n"])).toBe(first.inserted)
  })

  it("적용일이 다르면 **새 이력**이다 — 원가는 바뀌고 과거는 남는다 (ADR-005)", async () => {
    const a = await importCost("2026-01-01")
    const b = await importCost("2026-06-01")
    expect(b.inserted, "다른 적용일인데 건너뛰었다").toBe(a.inserted)

    const c = await db.prepare(`SELECT COUNT(*) n FROM cost_history`).get()
    expect(Number(c?.["n"])).toBe(a.inserted * 2)
  })

  it("★★ 원가를 넣으면 **손익이 움직인다** — 이게 사용자가 겪는 사실이다 ★★", async () => {
    const before = await loadPnlSnapshot(db, LIB, PERIOD)
    expect(before.pnl.cogs, "원가를 넣기 전인데 매입원가가 있다").toBe(0)

    const r = await importCost()
    const after = await loadPnlSnapshot(db, LIB, PERIOD)

    expect(after.pnl.cogs, "원가를 넣었는데 손익이 그대로다").toBeGreaterThan(0)
    expect(after.pnl.revenue, "매출이 흔들렸다 — 원가는 매출을 건드리면 안 된다").toBe(
      before.pnl.revenue,
    )
    // 기여이익은 원가만큼 정확히 내려간다
    expect(before.pnl.productContribution - after.pnl.productContribution).toBe(after.pnl.cogs)
    expect(r.inserted).toBeGreaterThan(0)
  })

  it("`reference` 블록이 없는 프로파일로 부르면 거부한다 — 사실 경로와 섞이지 않는다", async () => {
    await expect(
      runReferenceImport(repo, {
        bytes: bytesOf(ORDERS),
        fileName: ORDERS.file,
        profile: ESM,
        sheetIndex: 0,
        libraryId: LIB,
        effectiveFrom: "2026-01-01",
        now: NOW,
      }),
    ).rejects.toThrow(/기준 데이터 프로파일이 아니다/)
  })
})
