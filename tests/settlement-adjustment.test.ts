/**
 * 조정 레이어의 **쓰기 경로** — ADR-020.
 *
 * ★ 이 시험이 지키는 것 ★
 * 조정은 헌장 B-3(원본 불변)과 LOCK 9(Fact 인라인 편집 금지)가 만나는 자리다.
 * 「원본을 안 고친다」는 말은 저장 구조로 증명돼야 하고, 「재가져와도 유지된다」는
 * 약속은 실제로 재가져와 봐야 참인지 안다 — 팝오버 하단의 안내문이 그 두 문장을
 * 사용자에게 그대로 말하고 있으므로, 여기서 깨지면 화면이 거짓말을 하는 것이다.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository, SETTLEMENT_DAILY, type BatchOpen } from "../src/core/store/repository.js"
import {
  loadSettlementRows,
  adjustmentKey,
  ADJUSTED_FIELD,
} from "../src/core/settlement/rows.js"
import type { Period } from "../src/core/profit/index.js"
import {
  settlementVals,
  settlementSummary,
  effectivePayout,
  parseDelta,
  adjGuard,
  emptyAdjDraft,
} from "../src/app/settlement.js"
import { shellVals, shellStateFor } from "../src/app/shell.js"

const LIB = "lib-1"
const CONN = "conn-1"
const DAY = "2026-07-15"
const PERIOD: Period = { from: "2026-07-01", to: "2026-07-31" }

async function seed(db: Driver): Promise<void> {
  await migrate(db)
  await db
    .prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`)
    .run(LIB, "기본", "2026-08-20T00:00:00Z")
  await db
    .prepare(
      `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(CONN, LIB, "kr-marketplace", "mk-a", "쇼핑몰 A", "CONNECTED", "t", "t")
}

const batch = (id: string): BatchOpen => ({
  id,
  libraryId: LIB,
  connectionId: CONN,
  sourceName: "settle.xlsx",
  sourceBytes: 100,
  containerFormat: "xlsx",
  mappingVersion: "mk-a/settlement/v@1",
  startedAt: "2026-08-20T00:00:00Z",
})

/** 정산 한 건. `net`이 조정이 얹힐 자리다. */
const settle = (n: number, net: number) => ({
  id: `s-${n}`,
  source_key: `SK-${n}`,
  settled_on: DAY,
  pay_out_on: "2026-07-20",
  gross_amount: net + 1000,
  fee_amount: 1000,
  vat_amount: 0,
  shipping_amount: 0,
  net_amount: net,
})

async function loadSettlement(db: Driver, batchId: string, rows: unknown[]): Promise<void> {
  const repo = new Repository(db)
  const b = batch(batchId)
  await repo.openBatch(b)
  await repo.loadChunk("fact_settlement", b, rows as never)
  await repo.commitBatch(batchId, "2026-08-20T00:01:00Z")
}

const addAdj = (repo: Repository, delta: number, reason: string, at: string, prev = 0) =>
  repo.addAdjustment({
    libraryId: LIB,
    connectionId: CONN,
    table: SETTLEMENT_DAILY,
    sourceKey: DAY,
    field: ADJUSTED_FIELD,
    previousValue: prev,
    newValue: delta,
    reason,
    createdAt: at,
  })

describe("조정 — 쓰기 경로 (ADR-020)", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver()
    await seed(db)
    repo = new Repository(db)
    // 지급액 원본 합계 = 30,000
    await loadSettlement(db, "b-1", [settle(1, 10_000), settle(2, 20_000)])
  })

  it("조정이 없으면 유효 지급액 = 원본이다", async () => {
    const [row] = await loadSettlementRows(db, LIB, PERIOD)
    expect(row?.net).toBe(30_000)
    expect(row?.adjSum).toBe(0)
    expect(row?.adjustments).toHaveLength(0)
  })

  it("★ 원본은 그대로 있고 조정만 얹힌다 — 팝오버 안내문이 참이다 ★", async () => {
    await addAdj(repo, -1_200, "실입금 차액", "2026-08-20T10:00:00", 30_000)

    const [row] = await loadSettlementRows(db, LIB, PERIOD)
    expect(row?.net, "원본이 바뀌면 안 된다").toBe(30_000)
    expect(row?.adjSum).toBe(-1_200)
    expect(effectivePayout(row!)).toBe(28_800)

    // Fact 행 자체는 손대지 않았다 — 저장 구조로 확인한다 (LOCK 3).
    const raw = await db
      .prepare(`SELECT SUM(net_amount) AS n FROM fact_settlement WHERE library_id = ?`)
      .all(LIB)
    expect(Number(raw[0]?.["n"])).toBe(30_000)
  })

  it("★ 합은 SQL이 내고 스택은 조회가 낸다 — 둘이 갈리지 않는다 ★", async () => {
    await addAdj(repo, -1_200, "실입금 차액", "2026-08-20T10:00:00")
    await addAdj(repo, 500, "누락분 가산", "2026-08-20T10:05:00")
    await addAdj(repo, 700, "반품 취소분", "2026-08-20T10:09:00")

    const [row] = await loadSettlementRows(db, LIB, PERIOD)
    const fromStack = row!.adjustments.reduce((a, x) => a + x.delta, 0)
    expect(row?.adjSum, "SQL 합과 스택 합이 같아야 한다").toBe(fromStack)
    expect(row?.adjSum).toBe(0)
    expect(row?.adjustments, "합이 0이어도 스택은 3건이다").toHaveLength(3)
  })

  it("스택은 시간순이다 — 넣은 차례가 그대로 보인다", async () => {
    await addAdj(repo, -100, "첫째", "2026-08-20T10:00:00")
    await addAdj(repo, -200, "둘째", "2026-08-20T10:01:00")
    const [row] = await loadSettlementRows(db, LIB, PERIOD)
    expect(row?.adjustments.map((a) => a.reason)).toEqual(["첫째", "둘째"])
  })

  // ── 재가져오기 (ADR-020 A2 — delta를 고른 이유) ────────────────────

  it("★★ 재가져오기로 원본이 갱신돼도 조정은 **새 원본 위에** 얹힌다 ★★", async () => {
    await addAdj(repo, -1_200, "실입금 차액", "2026-08-20T10:00:00", 30_000)

    // 마켓이 정산서를 고쳐 보냈다 — 같은 source_key라 UPSERT다 (LOCK 2).
    await loadSettlement(db, "b-2", [settle(1, 12_000), settle(2, 20_000)])

    const [row] = await loadSettlementRows(db, LIB, PERIOD)
    expect(row?.net, "원본만 갱신된다").toBe(32_000)
    expect(row?.adjSum, "조정은 살아 있다").toBe(-1_200)
    // ★ 절대값 대체였다면 여기서 28,800이 나온다 — 갱신된 원본을 무시한 값이다.
    expect(effectivePayout(row!), "새 원본 + delta").toBe(30_800)
  })

  it("batch를 되돌려도 조정은 남고, 같은 행이 다시 들어오면 다시 적용된다 (ADR-004)", async () => {
    await addAdj(repo, -1_200, "실입금 차액", "2026-08-20T10:00:00")

    await repo.undoBatch("b-1", "2026-08-20T11:00:00Z")
    expect(await loadSettlementRows(db, LIB, PERIOD), "행이 사라졌다").toHaveLength(0)

    await loadSettlement(db, "b-3", [settle(1, 10_000), settle(2, 20_000)])
    const [row] = await loadSettlementRows(db, LIB, PERIOD)
    expect(row?.adjSum, "조정은 batch를 모른다").toBe(-1_200)
  })

  // ── 무효화 (ADR-020 A6) ───────────────────────────────────────────

  it("★ 거두는 것은 지우는 것이 아니다 — 행은 남고 합에서만 빠진다 ★", async () => {
    await addAdj(repo, -1_200, "실입금 차액", "2026-08-20T10:00:00")
    await addAdj(repo, -800, "오타", "2026-08-20T10:02:00")

    const before = await loadSettlementRows(db, LIB, PERIOD)
    const target = before[0]!.adjustments.find((a) => a.reason === "오타")!
    await repo.revokeAdjustment(target.id, "2026-08-20T12:00:00")

    const [row] = await loadSettlementRows(db, LIB, PERIOD)
    expect(row?.adjSum, "거둔 것은 합에서 빠진다").toBe(-1_200)
    expect(row?.adjustments, "스택에서도 사라진다").toHaveLength(1)

    const all = await db.prepare(`SELECT COUNT(*) AS n FROM adjustment`).all()
    expect(Number(all[0]?.["n"]), "DB에는 흔적이 남는다").toBe(2)
  })

  it("이미 거둔 것을 다시 거둬도 거둔 시각이 덮이지 않는다", async () => {
    await addAdj(repo, -1_200, "실입금 차액", "2026-08-20T10:00:00")
    const [before] = await loadSettlementRows(db, LIB, PERIOD)
    const id = before!.adjustments[0]!.id

    await repo.revokeAdjustment(id, "2026-08-20T12:00:00")
    await repo.revokeAdjustment(id, "2026-08-20T13:00:00")

    const rows = await db.prepare(`SELECT revoked_at FROM adjustment WHERE id = ?`).all(id)
    expect(rows[0]?.["revoked_at"]).toBe("2026-08-20T12:00:00")
  })

  it("「원본으로 복원」은 활성 조정을 전부 거둔다 — 한 문장이다", async () => {
    await addAdj(repo, -100, "하나", "2026-08-20T10:00:00")
    await addAdj(repo, -200, "둘", "2026-08-20T10:01:00")
    await addAdj(repo, -300, "셋", "2026-08-20T10:02:00")

    await repo.revokeAdjustmentsFor(CONN, SETTLEMENT_DAILY, DAY, "2026-08-20T12:00:00")

    const [row] = await loadSettlementRows(db, LIB, PERIOD)
    expect(row?.adjSum).toBe(0)
    expect(row?.adjustments).toHaveLength(0)
    expect(row?.net, "원본은 언제나 그대로였다").toBe(30_000)
  })

  // ── 대사 (헌장 B-3) ───────────────────────────────────────────────

  it("★★ 조정으로 불일치를 일치로 만들 수 없다 — 대사는 원본끼리다 ★★", async () => {
    // 이 정산은 주문에 이어지지 않는다(주문을 넣지 않았다).
    const [before] = await loadSettlementRows(db, LIB, PERIOD)
    expect(before?.linked).toBe(0)
    expect(before?.count).toBe(2)

    // 금액을 아무리 고쳐도 «이어지지 않았다»는 사실은 그대로다.
    await addAdj(repo, -30_000, "억지로 맞춰 보기", "2026-08-20T10:00:00")
    const [after] = await loadSettlementRows(db, LIB, PERIOD)
    expect(after?.linked, "대사가 조정에 흔들리면 안 된다").toBe(0)
    expect(after?.count).toBe(2)
  })

  // ── 화면 (ADR-020 A8) ─────────────────────────────────────────────

  it("★ 지급액·조정 칸·요약 줄이 **같은 수**를 말한다 ★", async () => {
    await addAdj(repo, -1_200, "실입금 차액", "2026-08-20T10:00:00")
    const rows = await loadSettlementRows(db, LIB, PERIOD)

    const vals = shellVals(shellStateFor(false), {
      go: () => {}, toggleNav: () => {}, closeNav: () => {},
      openNav: () => {}, goImport: () => {}, toggleTheme: () => {},
    } as never)
    settlementVals(vals, rows, PERIOD)

    const r = (vals.setRows as { payout: string; adj: string; hasAdj: boolean; adjTip: string }[])[0]!
    expect(r.payout, "지급액은 유효값이다").toBe("28,800")
    expect(r.adj, "조정 칸은 delta 합이다").toBe("-1,200")
    expect(r.hasAdj, "얹힌 것이 있다는 표시").toBe(true)
    expect(r.adjTip).toContain("원본 지급액 30,000 → 28,800")
    expect(settlementSummary(rows), "요약 줄도 같은 수여야 한다").toContain("지급액 28,800원")
  })

  it("합이 0이어도 «—»으로 감추지 않는다 (LOCK 6)", async () => {
    await addAdj(repo, 500, "가산", "2026-08-20T10:00:00")
    await addAdj(repo, -500, "취소", "2026-08-20T10:01:00")
    const rows = await loadSettlementRows(db, LIB, PERIOD)

    const vals = shellVals(shellStateFor(false), {
      go: () => {}, toggleNav: () => {}, closeNav: () => {},
      openNav: () => {}, goImport: () => {}, toggleTheme: () => {},
    } as never)
    settlementVals(vals, rows, PERIOD)

    const r = (vals.setRows as { adj: string; hasAdj: boolean }[])[0]!
    expect(r.adj, "0은 «없음»이 아니다").toBe("0")
    expect(r.hasAdj).toBe(true)
  })

  it("팝오버는 누른 묶음 것만 열린다", async () => {
    const rows = await loadSettlementRows(db, LIB, PERIOD)
    const key = adjustmentKey(rows[0]!.settledOn, rows[0]!.connectionId)

    const vals = shellVals(shellStateFor(false), {
      go: () => {}, toggleNav: () => {}, closeNav: () => {},
      openNav: () => {}, goImport: () => {}, toggleTheme: () => {},
    } as never)
    settlementVals(vals, rows, PERIOD, { ...emptyAdjDraft(), openKey: key })
    expect((vals.setRows as { adjOpen: boolean }[])[0]?.adjOpen).toBe(true)

    settlementVals(vals, rows, PERIOD, { ...emptyAdjDraft(), openKey: "다른 것" })
    expect((vals.setRows as { adjOpen: boolean }[])[0]?.adjOpen).toBe(false)
  })
})

describe("조정 입력 — 가드 (ADR-020 A5)", () => {
  it("부호를 받는다 — 「깎였다」를 넣을 수 있어야 한다", () => {
    expect(parseDelta("-1200")).toBe(-1_200)
    expect(parseDelta("+3,000")).toBe(3_000)
    expect(parseDelta("1 200원")).toBe(1_200)
  })

  it("0은 조정이 아니다", () => {
    expect(parseDelta("0")).toBeNull()
    expect(parseDelta("")).toBeNull()
    expect(parseDelta("-")).toBeNull()
    expect(parseDelta("천원")).toBeNull()
  })

  it("★ 사유 없이는 못 넣는다 — 왜 고쳤는지가 반드시 남는다 ★", () => {
    const d = { ...emptyAdjDraft(), amount: "-1200" }
    const g = adjGuard(d)
    expect(g.can).toBe(false)
    expect(g.why).toContain("사유")
  })

  it("공백만 쓴 사유는 사유가 아니다", () => {
    expect(adjGuard({ ...emptyAdjDraft(), amount: "-1200", why: "   " }).can).toBe(false)
  })

  it("아직 아무것도 안 쓴 상태는 «틀림»이 아니다 — 열자마자 빨간 줄이 뜨지 않는다", () => {
    const g = adjGuard(emptyAdjDraft())
    expect(g.can).toBe(false)
    expect(g.why, "이유를 말할 자리는 비어 있다").toBe("")
  })

  it("금액과 사유가 다 있으면 누를 수 있다", () => {
    const g = adjGuard({ ...emptyAdjDraft(), amount: "-1200", why: "실입금 차액" })
    expect(g.can).toBe(true)
    expect(g.why).toBe("")
  })

  it("못 누를 때 버튼이 파랗지 않다 — «고장»으로 읽히지 않게", () => {
    const vals = shellVals(shellStateFor(false), {
      go: () => {}, toggleNav: () => {}, closeNav: () => {},
      openNav: () => {}, goImport: () => {}, toggleTheme: () => {},
    } as never)
    settlementVals(vals, [], PERIOD, { ...emptyAdjDraft(), amount: "-1200" })
    expect(vals.adjBlocked).toBe(true)
    expect(vals.adjAddOpacity).toBe("0.45")
    expect(vals.adjBlockWhy).toContain("사유")
  })
})
