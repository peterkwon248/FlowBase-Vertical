/**
 * 주문 화면 배선의 게이트 — **행 수·합계가 CLI/스냅샷과 같다.**
 *
 * ★ 취소된 판매는 한 행이다 (2026-08-15) ★
 * 이중 기록 이후 취소된 판매는 `fact_order`와 `fact_claim` 양쪽에 선다. 목록이
 * 둘을 그대로 이어 붙이면 **같은 거래가 두 행**이 되므로, 짝이 보이면 주문 행이
 * 취소를 달고 서고 클레임 행은 서지 않는다 (`core/order/rows.ts`).
 *
 * 여기 있던 옛 문장 *"155행(주문 146 + 클레임 9)"*은 이중 기록 **전**의 산술이었다.
 * 146이라는 숫자는 이제 어디에도 없고 그 소멸은 의도된 것이다 (조건 d).
 *
 * ★ 두 세계로 나눠 잰다 ★
 * - **불변식**은 개발 DB(`.tmp/pnl.sqlite`)에 붙인다. 사용자가 무엇을 넣든 참이어야
 *   하는 것들이라 데이터가 늘어도 안 깨진다
 * - **정답지**는 픽스처에서 자기 세계를 짓는다. 손으로 검산한 수는 그 **파일**의
 *   성질이지 «개발 DB 한 상태의 사진»이 아니다 — 사진으로 박아두면 사용자가 앱을
 *   쓰는 날 게이트가 빨개진다 (`linking-screen`·`import-run`이 이미 택한 길)
 */

import { describe, expect, it } from "vitest"
import { existsSync, readFileSync } from "node:fs"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository } from "../src/core/store/repository.js"
import { runImport } from "../src/core/import/run.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { loadOrderRows } from "../src/core/order/rows.js"
import type { OrderRow } from "../src/core/order/rows.js"
import type { Period } from "../src/core/profit/index.js"
import type { MappingProfile } from "../src/core/import/mapping/index.js"
import { orderVals } from "../src/app/order.js"
import { Template } from "../src/app/generated/Template.js"
import { shellVals, shellStateFor } from "../src/app/shell.js"
import { FIXTURES, fixturePath, CLEAN_DIR } from "./fixtures.js"
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
  console.warn(`[order-rows] ${DB}가 없어 건너뛴다 — npx tsx tools/harness/pnl.ts 로 만든다`)
}

function emptyActions() {
  const noop = (): void => {}
  return { go: noop, toggleNav: noop, closeNav: noop, openNav: noop, goImport: noop, toggleTheme: noop }
}

/** 전 행에 걸친 클레임 합. **`amount`를 섞어 세지 않는다** (`OrderRow.claimAmount` 주석). */
const claimTotal = (rows: readonly OrderRow[]): number =>
  rows.reduce((a, r) => a + r.claimAmount, 0)

run("주문 화면 — 화면 숫자 = CLI 숫자", () => {
  async function load() {
    const db = openNodeDriver(DB, { pragmas: false })
    try {
      return {
        snap: await loadPnlSnapshot(db, LIB, PERIOD),
        rows: await loadOrderRows(db, LIB, PERIOD),
      }
    } finally {
      await db.close()
    }
  }

  /**
   * ★ 절대값을 박지 않는다 (2026-08-14) ★
   * 「주문 146 · 155행」은 «CLI가 만든 DB» 한 상태의 사진이었다. 위저드가 서고
   * 사용자가 실제로 파일을 넣자(쿠팡 매출 2종) 숫자가 늘었고 게이트가 빨개졌다 —
   * **회귀가 아니라 데이터가 는 것**이다. 이 테스트가 지켜야 할 것은 특정 숫자가
   * 아니라 «목록이 센 것 = 스냅샷이 센 것»이다.
   */
  it("행 수가 적재된 행 수와 같다 — 목록과 스냅샷이 갈리지 않는다", async () => {
    const { snap, rows } = await load()
    const orders = rows.filter((r) => r.kind === "order")
    const alone = rows.filter((r) => r.kind === "claim")

    // ★ 옛 단언은 항진명제였다 ★ `kind`가 둘뿐이라 «orders + claims === rows.length»는
    // 구조적으로 깨질 수 없었다 — 자기가 묻는 질문을 스스로 지운 테스트다
    // (ADR-007 «픽스처의 사각»의 다른 얼굴). 스냅샷을 축으로 세워 실제로 묻는다.
    expect(orders.length, "스냅샷의 orderCount와 같다").toBe(snap.orderCount)
    expect(rows.length, "목록은 주문 + 홀로 선 클레임뿐이다").toBe(orders.length + alone.length)
    expect(orders.length, "주문이 0이면 이 게이트는 무의미하다").toBeGreaterThan(0)
  })

  /**
   * ★ 같은 거래를 두 번 그리지 않는다 (조건 b) ★
   * 홀로 선 클레임은 **짝이 이 기간에 없을 때만** 허용된다. 통합된 취소는 주문
   * 행에 붙어 있으므로, 클레임 총합은 두 자리를 합쳐야 손익과 맞는다.
   */
  it("취소가 겹쳐 세지지 않는다 — 통합 + 홀로 선 것의 합이 손익과 같다", async () => {
    const { snap, rows } = await load()
    const merged = rows.filter((r) => r.kind === "order" && r.claimType !== null)
    const alone = rows.filter((r) => r.kind === "claim")

    expect(claimTotal(rows), "손익의 claims와 같다").toBe(snap.pnl.claims)
    expect(merged.length + alone.length, "취소 건수가 스냅샷과 같다").toBe(snap.claimCount)
  })

  it("합계가 손익과 원 단위로 같다", async () => {
    const { snap, rows } = await load()
    const orderSum = rows
      .filter((r) => r.kind === "order")
      .reduce((a, r) => a + r.amount, 0)

    // 취소된 판매도 «팔리기는 했다» — 빼는 것은 계산기의 몫이다 (부호를 붙이지 않는다)
    expect(orderSum, "손익의 revenue와 같다").toBe(snap.pnl.revenue)
  })

  /**
   * ★ 미분화의 단언 (작업 리듬 10번) ★
   * 클레임 9건 전부가 날짜 추정이라는 것이 오늘의 사실이고, 대시보드 단서 카드가
   * 세는 그 9건과 **같은 집합**이다. 두 곳이 갈리는 날 여기서 먼저 깨진다.
   *
   * **`kind`가 아니라 `claimType`으로 센다** — 통합된 취소는 주문 행에 있다.
   */
  it("날짜 추정 클레임 수가 단서 카드와 같다", async () => {
    const { snap, rows } = await load()
    const withClaim = rows.filter((r) => r.claimType !== null)
    const est = withClaim.filter((r) => r.claimDateEstimated).length

    expect(est, "목록이 센 추정 건수").toBe(snap.proxyDatedClaims)
    // 클레임은 ESM에서만 오고 전부 프록시 일자다 — 다른 클레임 양식이 생기면 바뀐다
    expect(est, "오늘은 클레임 전부가 추정이다").toBe(withClaim.length)
  })

  it("표가 화면에 그려진다 — 취소가 성격이 보이게 선다", async () => {
    const { rows } = await load()
    const nSale = rows.filter((r) => r.kind === "order").length
    const nClaim = rows.filter((r) => r.claimType !== null).length
    const vals = shellVals(shellStateFor(false), emptyActions() as never)
    orderVals(vals, rows, PERIOD)
    vals.firstRun = false
    vals.notFirstRun = true
    vals.v.orders = true

    const html = renderToString(createElement(Template, { vals }))

    expect(html, "빈 상태가 떠 있다").not.toContain("주문이 없습니다")
    // 대시보드와 같은 낱말을 쓴다 (조건 d) — 두 화면이 갈리면 옛 146을 찾게 된다
    expect(html, "범위 줄이 없다").toContain(`판매 ${nSale.toLocaleString("ko-KR")}건`)
    expect(html, "취소 건수가 없다").toContain(`취소 ${nClaim.toLocaleString("ko-KR")}건`)
    // 취소 행이 자기 성격을 말한다
    expect(html, "클레임 유형 표기가 없다").toMatch(/취소|반품|환불|교환/)
    // 날짜가 추정인 것을 숨기지 않는다 — 통합 행은 취소 칩에, 홀로 선 행은 날짜에
    if (rows.some((r) => r.claimDateEstimated)) {
      expect(html, "추정 표기가 없다").toMatch(/일자 추정|\(추정\)/)
    }
  })

  /**
   * ★ 한 행이 같은 말을 두 번 하지 않는다 ★
   * 홀로 선 클레임 행은 날짜가 곧 클레임 발생일이라 «(추정)»이 이미 붙는다.
   * 거기에 칩까지 «일자 추정»을 달면 한 행이 두 번 말한다 — 실제로 그렇게 났고
   * (`.tmp/orders.html`에서 9 · 9로 나왔다) 조건을 좁혀 고쳤다.
   */
  it("추정 표기가 한 행에서 되풀이되지 않는다", async () => {
    const { rows } = await load()
    const vals = shellVals(shellStateFor(false), emptyActions() as never)
    orderVals(vals, rows, PERIOD)
    const cells = vals.orderRows as { at: string; claim: string }[]

    for (const c of cells) {
      const twice = c.at.includes("(추정)") && c.claim.includes("일자 추정")
      expect(twice, `한 행이 추정을 두 번 말한다: ${c.at} / ${c.claim}`).toBe(false)
    }
    // 그러나 어느 한쪽에서는 반드시 말한다
    const estimated = rows.filter((r) => r.claimDateEstimated).length
    const said = cells.filter((c) => c.at.includes("(추정)") || c.claim.includes("일자 추정")).length
    expect(said, "추정 클레임 수만큼 정확히 말한다").toBe(estimated)
  })

  it("사실 화면이므로 편집 어포던스를 그리지 않는다 (§21-1 · 헌장 규칙 9)", async () => {
    const { rows } = await load()
    const vals = shellVals(shellStateFor(false), emptyActions() as never)
    orderVals(vals, rows, PERIOD)
    for (const r of vals.orderRows as { unlinked: boolean }[]) {
      expect(r.unlinked, "연결하기 버튼을 그리면 안 된다").toBe(false)
    }
  })
})

// ─────────────────────────────────────────────────────────────
// ESM 정답지 — 픽스처에서 자기 세계를 짓는다
// ─────────────────────────────────────────────────────────────

/**
 * 손으로 검산한 정답지는 **그 파일의 성질**이다. 개발 DB에 붙여 두면
 * 사용자가 앱에서 파일을 다시 넣는 순간 빨개지는데, 그건 회귀가 아니라
 * 데이터가 는 것이다 — 그 혼동을 없애려고 세계를 직접 짓는다.
 *
 * 이 수들은 [픽스처-대조표](../docs/픽스처-대조표.md)의 A항과 원 단위로 같다.
 */
const ESM = FIXTURES.find((x) => x.id === 8)
const esmReady = ESM !== undefined && existsSync(fixturePath(ESM, CLEAN_DIR))
const runEsm = esmReady ? describe : describe.skip
if (!esmReady) console.warn("[order-rows] ESM 픽스처가 없어 정답지를 건너뛴다")

runEsm("ESM 정답지 — 이중 기록 이후", () => {
  async function world(): Promise<OrderRow[]> {
    const db = openNodeDriver(":memory:")
    await migrate(db)
    const repo = new Repository(db)
    const now = "2026-08-15T00:00:00"
    await repo.ensureLibrary(LIB, "기본", now)
    const profile = JSON.parse(
      readFileSync("src/packs/kr-marketplace/profiles/esm-order@1.json", "utf-8"),
    ) as MappingProfile
    await repo.ensureConnection(
      {
        id: "conn-esm",
        libraryId: LIB,
        packId: profile.packId,
        marketplaceKey: profile.marketplaceKey,
        displayName: profile.displayName,
      },
      now,
    )
    await runImport(repo, {
      bytes: new Uint8Array(readFileSync(fixturePath(ESM!, CLEAN_DIR))),
      fileName: ESM!.file,
      profile,
      sheetIndex: 0,
      libraryId: LIB,
      connectionId: "conn-esm",
      batchId: "b1",
      now,
    })
    try {
      return await loadOrderRows(db, LIB, PERIOD)
    } finally {
      await db.close()
    }
  }

  it("판매 155 · 매출 8,285,200 — 취소된 것도 팔리기는 했다", async () => {
    const rows = await world()
    const orders = rows.filter((r) => r.kind === "order")
    expect(orders.length, "판매 건수").toBe(155)
    expect(orders.reduce((a, r) => a + r.amount, 0), "총매출(클레임 전)").toBe(8_285_200)
  })

  it("취소 9 · 388,700 — 전부 주문 행에 통합된다", async () => {
    const rows = await world()
    const merged = rows.filter((r) => r.kind === "order" && r.claimType !== null)
    const alone = rows.filter((r) => r.kind === "claim")

    expect(merged.length, "통합된 취소").toBe(9)
    // ★ 이 줄이 이 작업의 전부다 ★ 옛 동작은 여기서 9였고, 그 9행이 같은 거래를
    // 두 번째로 그리고 있었다 (목록 164행 vs 적재 155행)
    expect(alone.length, "홀로 선 클레임은 없다 — 짝이 전부 보인다").toBe(0)
    expect(claimTotal(rows), "클레임 금액").toBe(388_700)
  })

  it("목록 행 수가 적재된 행 수와 같다 — 겹쳐 세지도 빠뜨리지도 않는다", async () => {
    const rows = await world()
    expect(rows.length, "155행 적재 → 155행 목록").toBe(155)
  })

  it("순매출이 정답지와 원 단위로 같다", async () => {
    const rows = await world()
    const gross = rows.filter((r) => r.kind === "order").reduce((a, r) => a + r.amount, 0)
    expect(gross - claimTotal(rows), "순매출").toBe(7_896_500)
  })

  /**
   * ★ 짝이 없는 클레임은 접히지 않는다 ★
   * 월경계 클레임(8월에 오는 7월 주문의 취소)이 그 경우다. 기간을 클레임만
   * 남도록 좁혀서 «주문이 안 보이면 클레임이 자기 행으로 선다»를 확인한다 —
   * 이게 깨지면 취소가 화면에서 조용히 사라진다.
   */
  it("주문이 기간 밖이면 클레임이 홀로 선다 — 취소가 사라지지 않는다", async () => {
    const db = openNodeDriver(":memory:")
    await migrate(db)
    const repo = new Repository(db)
    const now = "2026-08-15T00:00:00"
    await repo.ensureLibrary(LIB, "기본", now)
    const profile = JSON.parse(
      readFileSync("src/packs/kr-marketplace/profiles/esm-order@1.json", "utf-8"),
    ) as MappingProfile
    await repo.ensureConnection(
      { id: "conn-esm", libraryId: LIB, packId: profile.packId,
        marketplaceKey: profile.marketplaceKey, displayName: profile.displayName },
      now,
    )
    await runImport(repo, {
      bytes: new Uint8Array(readFileSync(fixturePath(ESM!, CLEAN_DIR))),
      fileName: ESM!.file, profile, sheetIndex: 0,
      libraryId: LIB, connectionId: "conn-esm", batchId: "b1", now,
    })
    try {
      // 주문을 기간에서 밀어낸다 — 클레임 일자는 그대로 둔다
      await db.prepare(`UPDATE fact_order SET ordered_at = '2026-06-01T00:00:00'`).run()
      const rows = await loadOrderRows(db, LIB, PERIOD)
      const alone = rows.filter((r) => r.kind === "claim")

      expect(alone.length, "짝이 안 보이므로 홀로 선다").toBe(9)
      expect(claimTotal(rows), "금액이 그대로 살아 있다").toBe(388_700)
      // 홀로 선 행에서는 추정 표기가 **날짜**에 붙는다
      expect(alone.every((r) => r.dateEstimated), "발생일이 프록시다").toBe(true)
    } finally {
      await db.close()
    }
  })
})

/**
 * ★ 통합이 삼킬 뻔한 것 — 부분 취소 금액 ★
 *
 * 적대적 검토(작업 리듬 7-c)에서 살아남은 하나다. 통합 행의 금액 열은 **판매액**을
 * 찍으므로, 전액 취소가 아니면 «클레임 행이 말하던 금액»이 통합과 함께 사라진다.
 * 오늘 ESM 픽스처는 전부 전액 취소라 **픽스처만으로는 영영 안 잡히는 자리**다 —
 * ADR-007 «픽스처가 깨끗하면 두 답이 같아진다»의 또 한 얼굴이라, 세계를 일부러
 * 더럽혀서 묻는다.
 */
runEsm("부분 취소 — 통합해도 금액을 잃지 않는다", () => {
  it("취소액이 판매액과 다르면 취소 칩이 금액을 말한다", async () => {
    const db = openNodeDriver(":memory:")
    await migrate(db)
    const repo = new Repository(db)
    const now = "2026-08-15T00:00:00"
    await repo.ensureLibrary(LIB, "기본", now)
    const profile = JSON.parse(
      readFileSync("src/packs/kr-marketplace/profiles/esm-order@1.json", "utf-8"),
    ) as MappingProfile
    await repo.ensureConnection(
      { id: "conn-esm", libraryId: LIB, packId: profile.packId,
        marketplaceKey: profile.marketplaceKey, displayName: profile.displayName },
      now,
    )
    await runImport(repo, {
      bytes: new Uint8Array(readFileSync(fixturePath(ESM!, CLEAN_DIR))),
      fileName: ESM!.file, profile, sheetIndex: 0,
      libraryId: LIB, connectionId: "conn-esm", batchId: "b1", now,
    })
    try {
      // 한 건만 부분 환불로 바꾼다 — 나머지 8건은 전액 그대로다
      await db
        .prepare(`UPDATE fact_claim SET amount = 1000 WHERE source_key = (
                    SELECT source_key FROM fact_claim ORDER BY source_key LIMIT 1)`)
        .run()
      const rows = await loadOrderRows(db, LIB, PERIOD)
      const partial = rows.filter((r) => r.claimType !== null && r.claimAmount !== r.amount)
      expect(partial.length, "부분 취소 한 건").toBe(1)

      const vals = shellVals(shellStateFor(false), emptyActions() as never)
      orderVals(vals, rows, PERIOD)
      const cells = (vals.orderRows as { claim: string }[]).map((r) => r.claim)

      expect(cells.some((c) => c.includes("1,000원")), "부분 취소액이 화면에 없다").toBe(true)
      // 전액 취소 행은 같은 수를 두 번 말하지 않는다
      expect(cells.filter((c) => c.includes("원")).length, "전액 취소는 금액을 덧붙이지 않는다").toBe(1)
    } finally {
      await db.close()
    }
  })
})

/**
 * ★ «내부 키가 화면에 새지 않는다»는 여기 있었다 → `tests/screen-safety.test.ts` ★
 *
 * 정산·주문 둘을 한 번에 지키려고 이 파일에 뒀던 것인데, 그 이유가 **다음 화면에서도
 * 같은 실수가 나오기 때문**이었다. 실제로 상품 연결에서 났고(합성 키의 U+0001),
 * 그때 파일 이름이 `order-rows`에 묶여 있는 것이 오히려 «공용»이라는 목적을 가렸다.
 *
 * 내용은 한 곳 그대로다 — 옮긴 것은 이름뿐이다.
 */

/**
 * ★ 주문 화면의 상품·수량이 «—»였다 (2026-08-20 · 조사 1.11) ★
 *
 * ─────────────────────────────────────────────────────────────
 * `order.ts:101`의 주석이 「`fact_order_item`이 **비어 있다**」였는데
 * **거짓이었다** — `run.ts:364` `repo.loadChunk("fact_order_item", …)`가 적재한다.
 * 실측: 실 DB 434행 · 데모 1,286행, 전부 리스팅 제목이 붙어 있다.
 *
 * 진짜 원인은 **조회**였다. `loadOrderRows`의 SQL에 `fact_order_item`이 아예 없었다.
 * 그 결과 **같은 데이터로 대시보드 상품별 표는 품목 단위로 그려지는데 주문 화면만
 * 비어 있었고, 사용자는 두 화면 중 어느 쪽이 맞는지 알 수 없었다.**
 *
 * 잘못된 주석이 왜 위험한지의 표본이다 — 「데이터가 없다」로 읽은 다음 사람은
 * 프로파일 매핑을 의심하러 가고, 정작 한 줄짜리 조인은 안 본다.
 * ─────────────────────────────────────────────────────────────
 *
 * 절대값을 걸지 않는다 — 사용자가 파일을 더 넣으면 수가 는다. **불변식**을 문다.
 */
run("주문 화면 — 품목이 «—»가 아니다 (조사 1.11)", () => {
  /** 이 블록 전용 로더 — 위 describe의 `load`는 그 스코프 안에 산다. */
  async function load(): Promise<{ rows: readonly OrderRow[] }> {
    const db = openNodeDriver(DB, { pragmas: false })
    try {
      return { rows: await loadOrderRows(db, LIB, PERIOD) }
    } finally {
      await db.close()
    }
  }

  it("★ 품목이 적재돼 있으면 주문 행이 그것을 든다 ★", async () => {
    const { rows } = await load()
    const orders = rows.filter((r) => r.kind === "order")
    if (orders.length === 0) return // 데이터가 없는 기기에서는 판정하지 않는다

    const withItems = orders.filter((r) => r.items !== null)
    expect(
      withItems.length,
      "주문이 있는데 품목을 든 행이 하나도 없다 — 조인이 빠졌다",
    ).toBeGreaterThan(0)
  })

  it("품목을 들면 수량이 1 이상이다 — 0은 「모른다」와 구분돼야 한다", async () => {
    const { rows } = await load()
    for (const r of rows) {
      if (r.items === null) continue
      expect(r.items.count, "품목 줄 수가 0인데 객체가 있다").toBeGreaterThan(0)
      expect(r.items.quantity, "수량이 음수다").toBeGreaterThanOrEqual(0)
    }
  })

  /**
   * ★ 품목 조인이 주문 행을 불리면 금액이 중복 계상된다 ★
   * 주문 하나에 품목이 여럿일 수 있으므로 **먼저 주문 단위로 접고** 붙였다.
   * 그냥 조인하면 여기서 행 수가 늘고, 매출 합이 조용히 부풀어 오른다.
   */
  it("★ 품목 조인이 행을 불리지 않는다 — 금액 중복 계상 방지 ★", async () => {
    const { rows } = await load()
    const orders = rows.filter((r) => r.kind === "order")
    const keys = orders.map((r) => `${r.at}|${r.channel}|${r.amount}|${r.status}`)
    // 같은 키가 품목 수만큼 반복되면 접기가 깨진 것이다. 완전 중복이 없어야 한다는
    // 뜻은 아니므로(같은 값의 다른 주문이 실재한다) **품목 수와 견준다.**
    const dup = keys.length - new Set(keys).size
    const totalItemLines = orders.reduce((a, r) => a + (r.items?.count ?? 0), 0)
    expect(
      dup,
      `행이 품목 수만큼 불었다 — 부질의로 접지 않고 조인했다 (중복 ${dup} · 품목 줄 ${totalItemLines})`,
    ).toBeLessThan(totalItemLines)
  })

  it("홀로 선 클레임은 품목이 null이다 — 0건이 아니라 «없다»다 (§22)", async () => {
    const { rows } = await load()
    for (const r of rows) {
      if (r.kind !== "claim") continue
      expect(r.items, "홀로 선 클레임에 품목이 달렸다").toBeNull()
    }
  })
})
