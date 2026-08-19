/**
 * 다중 시트 기준 적재 (ADR-019 B) — **14번 넣던 것이 한 번이 된다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 사건 ★ 사용자 실파일(13.3MB · 15시트 단가표)은 카드 시트가 14장이다.
 * runReferenceImport가 시트 하나만 받아서 같은 파일을 14번 넣어야 했고,
 * 호출마다 워크북을 재파싱하므로(open이 시간의 98%) 나이브 루프는 앱 정지였다.
 *
 * 이제 sheetIndexes 배열을 받아 **1회 파싱 + 시트 루프**로 돈다. 이 파일이
 * 그 계약을 고정한다: 합계 = 시트별 합 · 시트 간 충돌은 세어 말한다 · 한 시트의
 * 실패가 나머지를 죽이지 않는다 · 재실행은 멱등이다.
 *
 * 실파일은 사업 데이터라 커밋하지 않는다 — tests/synth.ts가 같은 구조를 합성한다.
 * ─────────────────────────────────────────────────────────────
 */

import { describe, expect, it, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import { runReferenceImport } from "../src/core/import/run-reference.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import { cardSheet, coverSheet, workbookBytes } from "./synth.js"

const COST_CARD = JSON.parse(
  readFileSync("src/packs/kr-marketplace/profiles/cost-card@1.json", "utf-8"),
) as MappingProfile

const LIB = "lib-1"
const NOW = "2026-08-19T00:00:00Z"

describe("다중 시트 기준 적재 — 한 번 열고 여러 시트를 돈다", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver()
    await migrate(db)
    repo = new Repository(db)
    await repo.ensureLibrary(LIB, "기본", NOW)
  })

  const runSheets = (bytes: Uint8Array, sheetIndexes: readonly number[]) =>
    runReferenceImport(repo, {
      bytes,
      fileName: "단가표.xlsx",
      profile: COST_CARD,
      sheetIndexes,
      libraryId: LIB,
      effectiveFrom: "2026-01-01",
      now: NOW,
    })

  it("★ 두 시트가 한 번에 들어간다 — 합계 = 시트별 합 ★", async () => {
    const bytes = workbookBytes([
      ["공유정보", coverSheet],
      ["충전기", cardSheet(["워치독", "MW-DOC", 9200], ["무선충전", "M-DOC", 13300])],
      ["계절상품", cardSheet(["쿨매트", "CM-1", 7700], ["손선풍기", "HF-2", 3300])],
    ])
    const r = await runSheets(bytes, [1, 2])

    expect(r.perSheet.length).toBe(2)
    expect(r.perSheet.map((s) => s.sheetName)).toEqual(["충전기", "계절상품"])
    expect(r.perSheet.every((s) => s.failed === null)).toBe(true)
    // 리스팅이 없으니 전부 대기실로 — 카드 4장 = 대기 4행
    expect(r.unmatched).toBe(4)
    expect(r.stashed).toBe(4)
    expect(r.stashed, "합계가 시트별 합과 다르다").toBe(
      r.perSheet.reduce((t, s) => t + s.stashed, 0),
    )
    const rows = await repo.pendingCosts(LIB, "pending")
    expect(rows.length).toBe(4)
    expect(r.conflictCount).toBe(0)
  })

  it("시트 간 같은 품명·같은 금액 — 한 행으로 합쳐지고 충돌은 0이다", async () => {
    // 실파일의 실측 그대로: 같은 물건이 두 카테고리 시트에 실려 있었다 (같은 값).
    const bytes = workbookBytes([
      ["여름", cardSheet(["쿨매트", "CM-1", 7700], ["손선풍기", "HF-2", 3300])],
      ["가전", cardSheet(["쿨매트", "CM-1", 7700], ["워치독", "MW-DOC", 9200])],
    ])
    const r = await runSheets(bytes, [0, 1])

    expect(r.conflictCount, "같은 값인데 충돌로 셌다").toBe(0)
    const rows = await repo.pendingCosts(LIB, "pending")
    expect(rows.length, "같은 품명이 두 행이 됐다 (UPSERT 키가 안 먹었다)").toBe(3)
  })

  it("★ 시트 간 같은 품명·다른 금액 — 마지막 값이 남고, 그 사실을 센다 ★", async () => {
    const bytes = workbookBytes([
      ["여름", cardSheet(["쿨매트", "CM-1", 7700], ["손선풍기", "HF-2", 3300])],
      ["가전", cardSheet(["쿨매트", "CM-1", 8800], ["워치독", "MW-DOC", 9200])],
    ])
    const r = await runSheets(bytes, [0, 1])

    expect(r.conflictCount, "다른 금액이 조용히 덮였다 (LOCK 6)").toBe(1)
    expect(r.conflicts[0]).toMatchObject({
      where: "pending",
      prior: 7700,
      next: 8800,
      kept: 8800, // 대기실은 마지막 값 — ADR-016 «값만 최신»과 같은 방향
    })
    const rows = await repo.pendingCosts(LIB, "pending")
    const cool = rows.find((x) => x.title === "쿨매트")!
    expect(cool.amount, "대기실 값이 마지막 시트 값이 아니다").toBe(8800)
  })

  it("★ 한 시트의 실패가 나머지를 죽이지 않는다 — 실패는 일급 항목이다 ★", async () => {
    // 표지 시트는 카드가 아니라 블록 리더가 던진다. 그 시트만 실패로 남고
    // 나머지는 들어간다 — 「9번째 시트에서 죽어 8장만 들어간」 침묵을 막는 자리.
    const bytes = workbookBytes([
      ["공유정보", coverSheet],
      ["충전기", cardSheet(["워치독", "MW-DOC", 9200], ["무선충전", "M-DOC", 13300])],
    ])
    const r = await runSheets(bytes, [0, 1])

    const failed = r.perSheet.find((s) => s.sheetIndex === 0)!
    expect(failed.failed, "실패 사유가 비었다").not.toBeNull()
    const ok = r.perSheet.find((s) => s.sheetIndex === 1)!
    expect(ok.failed).toBeNull()
    expect(ok.stashed, "성공한 시트까지 죽었다").toBe(2)
    expect(r.stashed).toBe(2)
  })

  it("없는 시트 번호도 실패 항목으로 남는다 — 던지지 않는다", async () => {
    const bytes = workbookBytes([
      ["충전기", cardSheet(["워치독", "MW-DOC", 9200], ["무선충전", "M-DOC", 13300])],
    ])
    const r = await runSheets(bytes, [0, 7])
    expect(r.perSheet.find((s) => s.sheetIndex === 7)?.failed).toContain("없다")
    expect(r.stashed).toBe(2)
  })

  it("빈 시트 목록은 거부한다 — 조용히 0건으로 끝나지 않는다", async () => {
    const bytes = workbookBytes([["충전기", cardSheet(["워치독", "MW-DOC", 9200], ["무선충전", "M-DOC", 13300])]])
    await expect(runSheets(bytes, [])).rejects.toThrow(/sheetIndexes가 비었다/)
  })

  it("★ 다중 시트 재실행도 멱등이다 — 대기실이 불어나지 않는다 ★", async () => {
    const bytes = workbookBytes([
      ["여름", cardSheet(["쿨매트", "CM-1", 7700], ["손선풍기", "HF-2", 3300])],
      ["가전", cardSheet(["워치독", "MW-DOC", 9200], ["멀티탭", "MT-3", 4400])],
    ])
    const first = await runSheets(bytes, [0, 1])
    const second = await runSheets(bytes, [0, 1])
    expect(second.stashed).toBe(first.stashed)
    const rows = await repo.pendingCosts(LIB)
    expect(rows.length, "재실행이 대기 행을 복제했다").toBe(4)
  })

  it("★ 연결된 원가의 시트 간 충돌 — 먼저 값이 남고, «같은 값» 문장이 거짓이 되지 않는다 ★", async () => {
    // 리스팅 키 = 품명 (cost-card의 선언). 「쿨매트」가 이미 SKU에 연결돼 있다.
    await repo.ensureConnection(
      { id: "conn-1", libraryId: LIB, packId: "kr-marketplace", marketplaceKey: "seller", displayName: "셀러" },
      NOW,
    )
    await db
      .prepare(`INSERT INTO product (id, library_id, name, created_at, updated_at) VALUES ('prd-1',?,'상품',?,?)`)
      .run(LIB, NOW, NOW)
    await db
      .prepare(
        `INSERT INTO sku (id, library_id, product_id, code, name, status, created_at, updated_at)
         VALUES ('sku-1',?,'prd-1','SKU-1','SKU-1','ACTIVE',?,?)`,
      )
      .run(LIB, NOW, NOW)
    await db
      .prepare(
        `INSERT INTO marketplace_listing (id, library_id, connection_id, listing_key, title, sku_id, link_state, updated_at)
         VALUES ('lst-1',?,'conn-1','쿨매트','쿨매트','sku-1','linked',?)`,
      )
      .run(LIB, NOW)

    const bytes = workbookBytes([
      ["여름", cardSheet(["쿨매트", "CM-1", 7700], ["손선풍기", "HF-2", 3300])],
      ["가전", cardSheet(["쿨매트", "CM-1", 8800], ["워치독", "MW-DOC", 9200])],
    ])
    const r = await runSheets(bytes, [0, 1])

    // 첫 시트가 7700을 넣고, 둘째 시트의 8800은 skip — 값이 다르므로 충돌이다
    expect(r.inserted).toBe(1)
    expect(r.skipped).toBe(1)
    const costConflict = r.conflicts.find((c) => c.where === "cost")
    expect(costConflict, "연결된 원가의 금액 충돌을 못 셌다").toBeDefined()
    expect(costConflict).toMatchObject({ prior: 7700, next: 8800, kept: 7700 })

    const kept = await db
      .prepare(`SELECT amount FROM cost_history WHERE sku_id = 'sku-1' AND kind = 'COGS'`)
      .get()
    expect(Number(kept?.["amount"]), "먼저 값이 아니라 나중 값이 남았다").toBe(7700)
  })
})
