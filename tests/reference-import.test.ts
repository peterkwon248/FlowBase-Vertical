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
import { sniff } from "../src/core/import/recognition/sniff.js"
import { parserFor } from "../src/core/import/parsers/index.js"
import { streamSheet } from "../src/core/import/pipeline.js"
import type { SheetCell } from "../src/core/store/sheet-block.js"
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
      sheetIndexes: [hit!.sheetIndex],
      libraryId: LIB,
      effectiveFrom,
      now: NOW,
      ...(replace ? { replace: true } : {}),
    })
  }

  /**
   * 같은 시트를 **파서로 직접** 읽어 앞의 n행을 준다 — 보관된 표의 대조 기준.
   * `runReferenceImport`와 같은 경로(sniff → parser → streamSheet)를 지나야
   * 「원본」이 같은 뜻이 된다. 여기서 파서를 달리 부르면 두 벌의 해석이 생긴다.
   */
  async function firstRowsOf(sheetIndex: number, n: number): Promise<SheetCell[][]> {
    const bytes = bytesOf(BOOK)
    const top = sniff(bytes, BOOK.file).candidates[0]!
    const src = await parserFor(top.format).open(bytes, {
      chunkSize: 1_000,
      ...(top.encoding === undefined ? {} : { encoding: top.encoding }),
      ...(top.delimiter === undefined ? {} : { delimiter: top.delimiter }),
    })
    try {
      const { chunks } = streamSheet(src, sheetIndex, {
        chunkSize: 1_000,
        ...(COST.blockRead === undefined ? {} : { blockRead: COST.blockRead }),
      })
      const out: SheetCell[][] = []
      for await (const chunk of chunks) {
        for (let i = 0; i < chunk.rowCount && out.length < n; i++) {
          const off = i * chunk.width
          out.push(Array.from(chunk.values.slice(off, off + chunk.width)) as SheetCell[])
        }
        if (out.length >= n) break
      }
      return out
    } finally {
      src.close()
    }
  }

  /**
   * ★★ 사용자가 겪은 그것 — 「13MB 단가표를 넣었는데 기록에 한 줄도 없었다」 ★★
   *
   * 015 이전: `runImport`(Fact)는 `recordFileSighting`을 부르는데 **기준 가져오기는
   * 안 불렀다.** 실측(2026-08-21 · `public/demo.sqlite`)에서 `cost_history` 35행과
   * `pending_cost` 171행을 만든 원가 파일이 `file_sighting`에는 **0행**이었다.
   * 넣은 사람은 그것을 실패로 읽는다.
   */
  it("★★ 원가 파일이 통에 한 줄로 남는다 — batch가 없어도 (015 · ADR-023) ★★", async () => {
    await importCost()

    // ⚠ `beforeEach`가 ESM 주문 파일도 넣는다 — 그쪽은 batch가 붙은 목격을 남긴다.
    // **둘 다 한 장부에 서는 것이 이 마이그레이션의 요점**이므로 먼저 그것을 본다.
    const all = await db.prepare(`SELECT source_name FROM file_sighting`).all()
    expect(all.length, "Fact 파일과 원가 파일이 같은 장부에 서야 한다").toBe(2)

    const sights = await db
      .prepare(`SELECT id, source_name, profile_id, batch_id FROM file_sighting WHERE source_name = ?`)
      .all(BOOK.file)
    expect(sights.length, "원가 파일이 통에 안 남았다 — 사용자가 겪은 그 자리다").toBe(1)
    // 기준 데이터는 batch를 만들지 않는다. 그것이 결함이 아니라 **이 표가 생긴 이유**다.
    expect(sights[0]!["batch_id"], "기준 가져오기에 batch가 붙으면 안 된다").toBeNull()
    expect(String(sights[0]!["profile_id"])).toBe(COST.id)
  })

  it("★ 「무엇이 됐나」가 함께 남는다 — 수 하나로 뭉개지지 않는다 ★", async () => {
    const r = await importCost()

    const rows = await db
      .prepare(
        `SELECT o.kind, o.count FROM sighting_outcome o
           JOIN file_sighting s ON s.id = o.sighting_id
          ORDER BY o.kind`,
      )
      .all()
    const got = new Map(rows.map((x) => [String(x["kind"]), Number(x["count"])]))

    // 결과가 실제 반환값과 **같은 수**여야 한다 — 화면과 엔진이 다른 말을 하면
    // 그 기록은 없느니만 못하다.
    expect(got.get("cost"), "넣은 원가 수가 안 맞는다").toBe(r.inserted)
    if (r.stashed > 0) expect(got.get("pending_cost")).toBe(r.stashed)
    if (r.createdSkus > 0) expect(got.get("sku_created")).toBe(r.createdSkus)
    // 0인 종류는 줄을 만들지 않는다 — 할 말이 없는데 말하지 않는다
    for (const [, v] of got) expect(v).toBeGreaterThan(0)
  })

  /**
   * ★ 이 시험이 설계를 한 번 바꿨다 ★
   * 처음엔 종류별 UPSERT였다. 그러면 1회차의 `cost 35`가 남은 채 2회차의
   * `cost_skipped 35`가 더해져서 장부가 **「35건 넣음 · 35건 건너뜀」**이라고
   * 두 실행을 섞어 말했다. 「무엇이 됐나」는 **지금 상태**에 대한 질문이라
   * `recordOutcomes`가 지우고 다시 넣는 것으로 바꿨다.
   */
  it("★ 재가져오기는 결과를 **갈아치운다** — 두 실행을 섞어 말하지 않는다 ★", async () => {
    await importCost()
    const first = await db
      .prepare(`SELECT kind, count FROM sighting_outcome ORDER BY kind`)
      .all()
    expect(first.map((r) => String(r["kind"]))).toContain("cost")

    // 같은 적용일로 다시 넣으면 전부 건너뛴다 (멱등).
    await importCost()
    const second = await db
      .prepare(`SELECT kind, count FROM sighting_outcome ORDER BY kind`)
      .all()
    const kinds = second.map((r) => String(r["kind"]))
    expect(kinds, "1회차의 «넣었다»가 남아 두 실행이 겹쳐 보인다").not.toContain("cost")
    expect(kinds).toContain("cost_skipped")

    // 목격 자체는 한 줄 그대로고 «몇 번 봤나»만 오른다 (009의 UPSERT)
    const s = await db
      .prepare(`SELECT COUNT(*) c, MAX(seen_count) n FROM file_sighting WHERE source_name = ?`)
      .all(BOOK.file)
    expect(Number(s[0]!["c"])).toBe(1)
    expect(Number(s[0]!["n"]), "다시 본 횟수가 안 올랐다").toBeGreaterThan(1)
  })

  it("★ 원가 행이 어느 파일에서 왔는지 안다 (015) ★", async () => {
    await importCost()
    const rows = await db
      .prepare(
        `SELECT COUNT(*) c FROM cost_history
          WHERE entered_by = 'import' AND source_hash IS NOT NULL`,
      )
      .all()
    expect(Number(rows[0]!["c"]), "도구가 넣은 원가에 출처가 없다").toBeGreaterThan(0)

    // 그 해시가 통의 그 줄과 이어진다 — 계보가 끊기지 않는다
    const joined = await db
      .prepare(
        `SELECT COUNT(*) c FROM cost_history ch
           JOIN file_sighting fs ON fs.source_hash = ch.source_hash
          WHERE ch.entered_by = 'import'`,
      )
      .all()
    expect(Number(joined[0]!["c"]), "원가와 통이 이어지지 않는다").toBeGreaterThan(0)
  })

  /**
   * ★★ 017 — **기준 경로에도 표를 담는다** ★★
   *
   * 016이 파싱된 표 보관(`sheet_block`)을 세웠는데 `runImport`(Fact 경로)에만
   * 붙였다. 그래서 원가 파일은 **장부에는 서는데 표로는 못 열었다** — 하필
   * 사용자가 문제 삼은 그 파일이다. 「한 줄 남았다」와 「열어 볼 수 있다」는
   * 다른 사실이고, 이 시험이 둘째를 잰다.
   *
   * 원본과 대조하는 방법이 요점이다 — 보관된 첫 행을 **파서를 다시 돌린 결과**와
   * 맞춘다. 「블록이 생겼다」만 재면 빈 블록도 통과하고, 그러면 이 층의 존재
   * 이유(「원본 표를 다시 본다」)가 안 지켜진 채로 초록이 뜬다.
   */
  it("★★ 원가 파일도 표로 담긴다 — 꺼낸 첫 행이 원본과 같다 (017 · ADR-027) ★★", async () => {
    await importCost()

    const sights = await db
      .prepare(`SELECT id, sheet_index FROM file_sighting WHERE source_name = ?`)
      .all(BOOK.file)
    expect(sights.length).toBe(1)
    const sightingId = Number(sights[0]!["id"])
    const sheetIndex = Number(sights[0]!["sheet_index"])

    const total = await repo.sheetRowCount(sightingId)
    expect(total, "원가 파일이 0블록이다 — 장부에는 섰는데 표로 못 연다").toBeGreaterThan(0)

    const page = await repo.sheetPage(sightingId, 0, 1)
    expect(page.total).toBe(total)
    expect(page.rows.length).toBe(1)

    // 파서를 다시 돌려 같은 시트의 첫 행을 얻는다 — 「원본」의 정의는 이것이다.
    const origin = await firstRowsOf(sheetIndex, 1)
    expect(page.rows[0], "담긴 표가 원본과 다르다 — 다시 본 표가 다르면 없느니만 못하다")
      .toEqual(origin[0])
  })

  /**
   * ★ 「2번 봤다」 함정 ★ Fact 경로는 열 목록과 batch id가 루프 뒤에야 손에
   * 들어와서 `recordFileSighting`을 두 번 부르고 `countAsSeen: false`로 막는다.
   * 기준 경로는 두 번째 호출이 쓸 것이 없어 아예 안 부른다 — **그 사실을 여기서
   * 못박는다.** 다시 부르는 날 이 줄이 붉어진다.
   */
  it("★ 파일 하나를 넣으면 「1번 봤다」다 — 담기가 목격을 늘리지 않는다 ★", async () => {
    await importCost()
    const r = await db
      .prepare(`SELECT seen_count FROM file_sighting WHERE source_name = ?`)
      .all(BOOK.file)
    expect(Number(r[0]!["seen_count"]), "한 번 넣었는데 두 번 봤다고 센다").toBe(1)
  })

  it("재가져오기가 블록을 쌓지 않는다 — 표는 갈아치워진다", async () => {
    await importCost()
    const first = await db.prepare(`SELECT COUNT(*) c FROM sheet_block`).all()
    await importCost()
    const second = await db.prepare(`SELECT COUNT(*) c FROM sheet_block`).all()
    expect(Number(second[0]!["c"]), "블록이 불어났다").toBe(Number(first[0]!["c"]))
  })

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

    // ★ 종류를 가려 센다 (ADR-029) ★ 같은 파일이 `COGS`와 `LOGISTICS`를 함께 넣으므로
    // 전체를 세면 「원가가 두 배로 들어갔다」로 읽힌다. 멱등을 재는 자리는 **주 종류**다.
    const c = await db.prepare(`SELECT COUNT(*) n FROM cost_history WHERE kind = 'COGS'`).get()
    expect(Number(c?.["n"])).toBe(first.inserted)

    /**
     * ★ 곁가지도 멱등이다 — 두 번 넣어도 배송비가 불어나지 않는다 (ADR-029) ★
     * UNIQUE가 `(library, sku, kind, effective_from)`라 종류가 달라도 각자 한 번씩만
     * 앉는다. 이 줄이 없으면 「원가는 멱등인데 배송비만 두 배」를 아무도 안 잡는다.
     */
    const firstLog = first.extras.find((e) => e.kind === "LOGISTICS")?.added ?? 0
    expect(firstLog, "배송비가 한 건도 안 들어갔다 — 곁가지 열을 못 읽었다").toBeGreaterThan(0)
    expect(second.extras.find((e) => e.kind === "LOGISTICS")?.added ?? 0, "두 번째 실행이 또 넣었다").toBe(0)

    const l1 = await db.prepare(`SELECT COUNT(*) n FROM cost_history WHERE kind = 'LOGISTICS'`).get()
    expect(Number(l1?.["n"]), "배송비가 재가져오기로 불어났다").toBe(firstLog)
  })

  it("적용일이 다르면 **새 이력**이다 — 원가는 바뀌고 과거는 남는다 (ADR-005)", async () => {
    const a = await importCost("2026-01-01")
    const b = await importCost("2026-06-01")
    expect(b.inserted, "다른 적용일인데 건너뛰었다").toBe(a.inserted)

    const c = await db.prepare(`SELECT COUNT(*) n FROM cost_history WHERE kind = 'COGS'`).get()
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
    /**
     * ★ 기여이익은 «원가 + 출고 배송비»만큼 내려간다 (ADR-029) ★
     *
     * 2026-08-21까지 이 줄은 `toBe(after.pnl.cogs)`였다. 같은 원가표가 `배송비` 열도
     * 들고 오고(→ `LOGISTICS`), 그것이 3층의 «배송» 줄에 합산되면서 낙폭이 커졌다.
     * **그게 이 변경의 전부다** — 파일에 있는데 앱이 버리던 돈이 이제 손익에 든다.
     *
     * 항등식으로 못박는다: 두 항 말고 다른 것이 움직이면 이 줄이 붉어진다.
     */
    const shipDelta = after.pnl.shipping - before.pnl.shipping
    expect(shipDelta, "원가표의 배송비가 손익에 안 들어갔다").toBeGreaterThan(0)
    expect(after.shippingBasis.costTable, "출처가 원가표로 안 잡혔다").toBe(shipDelta)
    expect(before.pnl.productContribution - after.pnl.productContribution).toBe(
      after.pnl.cogs + shipDelta,
    )
    expect(r.inserted).toBeGreaterThan(0)
  })

  it("`reference` 블록이 없는 프로파일로 부르면 거부한다 — 사실 경로와 섞이지 않는다", async () => {
    await expect(
      runReferenceImport(repo, {
        bytes: bytesOf(ORDERS),
        fileName: ORDERS.file,
        profile: ESM,
        sheetIndexes: [0],
        libraryId: LIB,
        effectiveFrom: "2026-01-01",
        now: NOW,
      }),
    ).rejects.toThrow(/기준 데이터 프로파일이 아니다/)
  })
})
