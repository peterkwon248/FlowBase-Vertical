/**
 * 정산 화면 배선의 게이트 — **정산 화면 숫자 = 손익 단서 숫자.**
 *
 * ★ 왜 이게 이 화면의 합격 기준인가 ★
 * 대시보드의 단서 카드는 *"정산 106건이 주문에 이어지지 않는다 · 수수료 983,085원
 * 빠짐"*이라고 **요약**한다. 정산 화면은 그 106건이 **어느 날짜의 무엇인지**를
 * 보여준다. 같은 사실의 요약과 상세이므로 갈리면 사용자는 어느 쪽을 믿어야 할지
 * 알 수 없다 (헌장 A-5).
 *
 * 두 화면이 같은 답을 내는 것은 검사로 확인한 우연이 아니라 구조의 결과다 —
 * 둘 다 `active_settlement`를 같은 기간 조건으로 읽는다. 이 테스트는 그 구조가
 * 실제로 지켜졌는지를 본다.
 */

import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { loadSettlementRows } from "../src/core/settlement/rows.js"
import { pnlGaps } from "../src/core/profit/gaps.js"
import type { Period } from "../src/core/profit/index.js"
import { settlementVals } from "../src/app/settlement.js"
import { Template } from "../src/app/generated/Template.js"
import { shellVals, shellStateFor } from "../src/app/shell.js"
import { DEV_SNAPSHOT } from "./dev-db.js"

/**
 * ★ 개발용 DB를 **직접 열지 않는다** — 스냅샷을 읽는다 ★
 * 세 파일이 같은 물리 파일을 워커별로 동시에 열다 `database is locked`로 깨졌다.
 * 진단과 처방은 `tests/dev-db.ts`에 있다. 읽는 내용은 그대로다.
 */
const DB = DEV_SNAPSHOT
const PERIOD: Period = { from: "2026-07-01", to: "2026-07-31" }
const LIB = "lib-1"

const ready = existsSync(DB)
const run = ready ? describe : describe.skip

if (!ready) {
  console.warn(`[settlement-rows] ${DB}가 없어 건너뛴다 — npx tsx tools/harness/pnl.ts 로 만든다`)
}

run("정산 화면 — 화면 숫자 = 손익 단서 숫자", () => {
  async function load() {
    const db = openNodeDriver(DB, { pragmas: false })
    try {
      return {
        snap: await loadPnlSnapshot(db, LIB, PERIOD),
        rows: await loadSettlementRows(db, LIB, PERIOD),
      }
    } finally {
      await db.close()
    }
  }

  it("묶음 합계가 손익의 정산 원자료와 원 단위로 같다", async () => {
    const { snap, rows } = await load()
    const sum = (f: (r: (typeof rows)[number]) => number): number => rows.reduce((a, r) => a + f(r), 0)

    expect(sum((r) => r.count), "건수").toBe(snap.settlement.all.count)
    expect(sum((r) => r.fee), "수수료").toBe(snap.settlement.all.fee)
    expect(sum((r) => r.vat), "부가세").toBe(snap.settlement.all.vat)
    expect(sum((r) => r.shipping), "배송비").toBe(snap.settlement.all.shipping)
    expect(sum((r) => r.gross), "판매금액").toBe(snap.settlement.all.gross)
    // 지급액은 **마켓이 준 값**이다. 우리가 다시 계산하지 않는다 (헌장 B-3)
    expect(sum((r) => r.net), "지급액").toBe(snap.settlement.all.net)
  })

  /**
   * ★ 두 조인이 갈라지면 여기서 먼저 깨진다 ★
   *
   * 손익 쪽 `joined`는 "이 **기간의 주문**에 이어졌나"(`ordered_at`이 기간 안)를
   * 묻고, 정산 화면의 `linked`는 "**어떤 주문에든** 이어지나"를 묻는다. 묻는 것이
   * 다르므로 언젠가 값이 갈릴 수 있고, 갈리는 순간 두 화면이 모순으로 보인다.
   *
   * 오늘은 둘 다 0이다 — 정산 파일만 있고 같은 연결의 주문 파일이 없어서다.
   * 그 사실을 못박아 두면, 주문 파일이 들어와 값이 갈리는 날 이 테스트가 먼저
   * 깨지고 **그때 두 숫자의 관계를 설명할 기회**가 생긴다.
   */
  it("두 조인이 오늘 같은 답을 낸다 — 갈리는 날 여기서 깨진다", async () => {
    const { snap, rows } = await load()
    const linked = rows.reduce((a, r) => a + r.linked, 0)
    expect(linked, "정산 화면이 센 연결 건수").toBe(0)
    expect(snap.settlement.joined.count, "손익이 센 연결 건수").toBe(0)
  })

  it("단서 카드가 말한 그 건수가 이 화면의 미연결 건수다", async () => {
    const { snap, rows } = await load()
    const gap = pnlGaps(snap).find((g) => g.id === "settlement-unjoined")
    expect(gap, "미연결 단서가 있어야 한다").toBeTruthy()

    const unlinked = rows.reduce((a, r) => a + (r.count - r.linked), 0)
    // 단서 문구가 말하는 건수와 표가 보여주는 건수가 같아야 한다
    expect(gap?.detail).toContain(`정산 ${unlinked.toLocaleString("ko-KR")}건`)
  })

  it("표가 화면에 그려진다 — 원본 금액이 그대로 뜬다", async () => {
    const { rows } = await load()
    const noop = (): void => {}
    const vals = shellVals(shellStateFor(false), {
      go: noop, toggleNav: noop, closeNav: noop,
      openNav: noop, goImport: noop, toggleTheme: noop,
    } as never)
    settlementVals(vals, rows, PERIOD)
    vals.firstRun = false
    vals.notFirstRun = true
    vals.v.settlement = true

    const html = renderToString(createElement(Template, { vals }))

    expect(html, "빈 상태가 떠 있다").not.toContain("정산 내역이 없습니다")
    expect(html, "요약이 없다").toContain("정산 106건")
    // 첫 묶음(2026-07-31 · 15건 · 판매 656,900)이 표에 그대로 있다
    expect(html, "정산일이 없다").toContain("2026-07-31")
    expect(html, "판매금액 원본이 없다").toContain("656,900")
    // 대사 — 주문에 이어지지 않은 것이 이 기간의 사실이다
    expect(html, "대사 상태가 없다").toContain("주문 미연결")
  })

  it("조정 어포던스를 그리지 않는다 — 쓰기 경로가 아직 없다 (§21-1)", async () => {
    const { rows } = await load()
    const vals = shellVals(shellStateFor(false), {
      go: () => {}, toggleNav: () => {}, closeNav: () => {},
      openNav: () => {}, goImport: () => {}, toggleTheme: () => {},
    } as never)
    settlementVals(vals, rows, PERIOD)
    for (const r of vals.setRows as { hasAdj: boolean; canAck: boolean; adj: string }[]) {
      expect(r.hasAdj, "조정 마커를 그리면 안 된다").toBe(false)
      expect(r.canAck, "확인함 버튼을 그리면 안 된다").toBe(false)
      expect(r.adj, "조정 값이 없으면 —").toBe("—")
    }
  })
})
