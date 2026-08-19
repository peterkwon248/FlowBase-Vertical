/**
 * 원가 대기 (011) — **못 붙은 원가를 버리지 않는다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 파일이 지키는 것 ★
 *
 * 사용자 실파일(카드 단가표)이 200블록 전부 읽히고도 0건이 붙었다 — 상품번호가
 * 없어서다. 그때 run-reference는 품명·모델명·금액·적용일을 **버렸다.** 사람이
 * 나중에 «이 품명 = 이 상품»을 판단할 재료가 증발한 것이다.
 *
 * 가장 무거운 단언 둘:
 *   ① 재가져오기 멱등 — 대기실이 재가져오기마다 불어나면 쓰레기장이 된다
 *   ② resolved가 다리 사전 — 사람이 한 번 이은 품명은 다음 파일부터 저절로 붙는다
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it, beforeEach } from "vitest"
import { readFileSync, existsSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import { runReferenceImport } from "../src/core/import/run-reference.js"
import { analyzeImport } from "../src/core/import/analyze.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"

const read = (n: string): MappingProfile =>
  JSON.parse(readFileSync(`src/packs/kr-marketplace/profiles/${n}`, "utf-8")) as MappingProfile
const COST = read("cost-master@1.json")

/** #3 = 19시트 워크북 (원가표 시트 포함 · 리스팅과 안 겹치는 상품 171종). */
const BOOK = FIXTURES.find((f) => f.id === 3)!
const bytes = (): Uint8Array => new Uint8Array(readFileSync(fixturePath(BOOK, CLEAN_DIR)))

const LIB = "lib-1"
const NOW = "2026-08-19T00:00:00"

const ready = existsSync(fixturePath(BOOK, CLEAN_DIR))
const run = ready ? describe : describe.skip
if (!ready) console.warn("[pending-cost] fixtures/clean이 없어 건너뛴다")

run("원가 대기 — 못 붙은 행이 남는다", () => {
  let db: Driver
  let repo: Repository
  let sheetIndex = 0

  beforeEach(async () => {
    db = openNodeDriver()
    await migrate(db)
    repo = new Repository(db)
    await repo.ensureLibrary(LIB, "기본", NOW)
    const a = await analyzeImport(bytes(), BOOK.file, [COST])
    const hit = a.sheetMatches.find((m) => m.profiles.length > 0)
    expect(hit, "원가표 시트를 못 찾았다").toBeDefined()
    sheetIndex = hit!.sheetIndex
  })

  const importCost = () =>
    runReferenceImport(repo, {
      bytes: bytes(),
      fileName: BOOK.file,
      profile: COST,
      sheetIndex,
      libraryId: LIB,
      effectiveFrom: "2026-01-01",
      now: NOW,
    })

  it("★ 리스팅이 하나도 없으면 전부 대기로 간다 — 버리지 않는다 ★", async () => {
    const r = await importCost()
    expect(r.inserted).toBe(0)
    expect(r.unmatched).toBeGreaterThan(0)
    expect(r.stashed, "못 붙은 행이 대기실에 안 남았다").toBe(r.unmatched)
    expect(r.bridged).toBe(0)

    const rows = await repo.pendingCosts(LIB, "pending")
    expect(rows.length).toBe(r.stashed)
    // 사람이 판단할 재료가 실려 있다 — 품명·금액·적용일
    const one = rows[0]!
    expect(one.title).not.toBe("")
    expect(one.amount).toBeGreaterThan(0)
    expect(one.effectiveFrom).toBe("2026-01-01")
  })

  it("★ 재가져오기 멱등 — 대기실이 불어나지 않는다 ★", async () => {
    const first = await importCost()
    const second = await importCost()
    expect(second.stashed).toBe(first.stashed)
    const rows = await repo.pendingCosts(LIB)
    expect(rows.length, "재가져오기가 대기 행을 복제했다").toBe(first.stashed)
  })

  it("★★ resolved가 다리 사전이다 — 한 번 이으면 다음 파일부터 저절로 붙는다 ★★", async () => {
    const first = await importCost()
    expect(first.bridged).toBe(0)

    // 사람이 대기 행 하나를 SKU에 잇는다 (연결 화면이 하는 그 일)
    await db
      .prepare(`INSERT INTO product (id, library_id, name, created_at, updated_at) VALUES (?,?,?,?,?)`)
      .run("prd-1", LIB, "상품", NOW, NOW)
    await db
      .prepare(
        `INSERT INTO sku (id, library_id, product_id, code, name, status, created_at, updated_at)
         VALUES ('sku-1',?,'prd-1','SKU-1','SKU-1','ACTIVE',?,?)`,
      )
      .run(LIB, NOW, NOW)
    const target = (await repo.pendingCosts(LIB, "pending"))[0]!
    const res = await repo.resolvePendingCost({ id: target.id, skuId: "sku-1", now: NOW })
    expect(res.costInserted, "확정이 원가를 안 넣었다").toBe(true)

    // 같은 파일이 다시 온다 — 그 품명은 이제 저절로 붙는다
    const second = await importCost()
    expect(second.bridged, "지난 판단이 재사용되지 않았다").toBe(1)
    expect(second.stashed).toBe(first.stashed - 1)

    // 원가는 확정 1건 + 같은 (SKU·종류·적용일)이라 브리지는 건너뛴다 — 안 는다
    const c = await db
      .prepare(`SELECT COUNT(*) n FROM cost_history WHERE sku_id = 'sku-1'`)
      .get()
    expect(Number(c?.["n"])).toBe(1)
  })

  it("확정은 원가 넣기와 상태 갱신이 **한 트랜잭션**이다 — 어중간이 없다", async () => {
    await importCost()
    const target = (await repo.pendingCosts(LIB, "pending"))[0]!
    // SKU가 없으면 addCost의 FK가 터진다 — 그때 상태도 pending으로 남아야 한다
    await expect(
      repo.resolvePendingCost({ id: target.id, skuId: "sku-없음", now: NOW }),
    ).rejects.toThrow()
    const after = (await repo.pendingCosts(LIB)).find((r) => r.id === target.id)!
    expect(after.state, "원가는 실패했는데 상태만 resolved가 됐다").toBe("pending")
  })

  it("이미 확정된 행은 다시 확정할 수 없다 — 되돌리기는 v2다", async () => {
    await importCost()
    await db
      .prepare(`INSERT INTO product (id, library_id, name, created_at, updated_at) VALUES (?,?,?,?,?)`)
      .run("prd-1", LIB, "상품", NOW, NOW)
    await db
      .prepare(
        `INSERT INTO sku (id, library_id, product_id, code, name, status, created_at, updated_at)
         VALUES ('sku-1',?,'prd-1','SKU-1','SKU-1','ACTIVE',?,?)`,
      )
      .run(LIB, NOW, NOW)
    const target = (await repo.pendingCosts(LIB, "pending"))[0]!
    await repo.resolvePendingCost({ id: target.id, skuId: "sku-1", now: NOW })
    await expect(
      repo.resolvePendingCost({ id: target.id, skuId: "sku-1", now: NOW }),
    ).rejects.toThrow(/이미 확정된/)
  })

  it("「쓰지 않음」은 삭제가 아니다 — 세어지고, 거둘 수 있고, 재가져오기가 안 깨운다", async () => {
    await importCost()
    const target = (await repo.pendingCosts(LIB, "pending"))[0]!
    await repo.dismissPendingCost(target.id)
    expect((await repo.pendingCosts(LIB, "dismissed")).length).toBe(1)

    // ★ 재가져오기가 무시 판단을 초기화하면 판단이 아니라 메모다 ★
    await importCost()
    const still = (await repo.pendingCosts(LIB)).find((r) => r.id === target.id)!
    expect(still.state, "재가져오기가 dismissed를 pending으로 되돌렸다").toBe("dismissed")

    await repo.undoDismissPendingCost(target.id)
    expect((await repo.pendingCosts(LIB)).find((r) => r.id === target.id)!.state).toBe("pending")
  })

  it("★ 대기실은 손익에 안 들어간다 — 확정 전 금액은 계산 밖이다 (B-5) ★", async () => {
    await importCost()
    const snap = await loadPnlSnapshot(db, LIB, { from: "2026-07-01", to: "2026-07-31" })
    expect(snap.pnl.cogs, "확정 전 원가가 손익에 새어 들어갔다").toBe(0)
  })
})
