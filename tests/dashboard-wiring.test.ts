/**
 * 대시보드 배선 1단의 게이트 — **화면 숫자 = CLI 숫자.**
 *
 * "배선 성공"의 정의를 "예쁘게 뜬다"가 아니라 **"CLI와 같은 숫자"**로 박는다.
 * 지금까지 쌓은 검증 사슬(독립 실측 = CLI = e2e = 앱)이 화면까지 한 줄로
 * 이어지는 자리다.
 *
 * ★ 왜 이게 성립하는가 ★
 * 화면과 CLI가 **같은 DB를 같은 `loadPnlSnapshot`으로** 읽는다. 숫자가 같은
 * 것은 검사로 확인한 우연이 아니라 구조의 결과다 — 이 테스트는 그 구조가
 * 실제로 지켜졌는지를 본다.
 *
 * DB는 3b-0 CLI(`npx tsx tools/harness/pnl.ts`)가 만든다. 원본 픽스처가 필요해
 * 다른 기기에서는 없을 수 있으므로, 없으면 **조용히 통과시키지 않고 건너뛴다**.
 */

import { describe, expect, it } from "vitest"
import { existsSync } from "node:fs"
import { createElement } from "react"
import { renderToString } from "react-dom/server"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import { loadPnlSnapshot } from "../src/core/profit/snapshot.js"
import { pnlGaps } from "../src/core/profit/gaps.js"
import type { Period } from "../src/core/profit/index.js"
import { dashboardVals } from "../src/app/dashboard.js"
import { Template } from "../src/app/generated/Template.js"
import { emptyVals } from "../src/app/generated/vals.js"
import { shellVals, shellStateFor } from "../src/app/shell.js"
import { compact, signed, won } from "../src/app/format.js"

const DB = ".tmp/pnl.sqlite"
const PERIOD: Period = { from: "2026-07-01", to: "2026-07-31" }
const LIB = "lib-1"

/**
 * 3b-0 CLI가 낸 값. 손으로 검산한 정답지다.
 *
 * ★ 라이브러리 전체 합계로는 더 이상 쓸 수 없다 (2026-08-14) ★
 * 이 숫자들은 «CLI가 만든 DB» 한 상태의 사진이었다. 위저드가 서고 사용자가 실제로
 * 파일을 넣기 시작하자(쿠팡 매출 2종 +79M) 합계가 바뀌었고, 광고 배치를 되돌리자
 * 광고비가 0이 됐다 — **둘 다 정상 동작인데 게이트가 빨개졌다.**
 *
 * 그래서 정답지의 유효 범위를 **연결 단위**로 좁힌다. 「ESM 주문 146건 =
 * 7,896,500원」은 그 batch가 살아 있는 한 참이고, 라이브러리 합계는 파일이 들어올
 * 때마다 바뀌는 것이 **정상**이다. 화면 대조는 아래에서 스냅샷 파생으로 한다.
 */
const ESM_CLI = { revenue: 7_896_500, claims: 388_700, orderCount: 146 }

const ready = existsSync(DB)
const run = ready ? describe : describe.skip

if (!ready) {
  console.warn(`[dashboard-wiring] ${DB}가 없어 건너뛴다 — npx tsx tools/harness/pnl.ts 로 만든다`)
}

run("대시보드 1단 — 화면 숫자 = CLI 숫자", () => {
  async function snapshot() {
    const db = openNodeDriver(DB, { pragmas: false })
    try {
      return await loadPnlSnapshot(db, LIB, PERIOD)
    } finally {
      await db.close()
    }
  }

  it("ESM 정답지 — 손으로 검산한 값이 그대로 살아 있다", async () => {
    const db = openNodeDriver(DB, { pragmas: false })
    try {
      const q = async (sql: string) => (await db.prepare(sql).get(LIB, PERIOD.from, PERIOD.to))!
      const o = await q(
        `SELECT COUNT(*) AS n, COALESCE(SUM(total_amount),0) AS s FROM active_order
          WHERE library_id = ? AND connection_id = 'conn-esm'
            AND ordered_at >= ? AND ordered_at < date(?, '+1 day')`,
      )
      const c = await q(
        `SELECT COALESCE(SUM(amount),0) AS s FROM active_claim
          WHERE library_id = ? AND connection_id = 'conn-esm'
            AND claimed_at >= ? AND claimed_at < date(?, '+1 day')`,
      )
      expect(Number(o["n"]), "ESM 주문 건수").toBe(ESM_CLI.orderCount)
      expect(Number(o["s"]), "ESM 매출").toBe(ESM_CLI.revenue)
      expect(Number(c["s"]), "ESM 클레임").toBe(ESM_CLI.claims)
    } finally {
      await db.close()
    }
  })

  it("손익 3층이 스스로 어긋나지 않는다 — 합계는 데이터가 정한다", async () => {
    const s = await snapshot()
    // 절대값을 박지 않는다. **관계**가 참이면 계산기가 옳다.
    expect(s.pnl.productContribution).toBeLessThanOrEqual(s.pnl.revenue)
    expect(s.pnl.netProfit).toBeLessThanOrEqual(s.pnl.productContribution)
    expect(s.orderCount, "주문이 하나도 없으면 이 게이트는 무의미하다").toBeGreaterThan(0)
  })

  function render(s: Awaited<ReturnType<typeof snapshot>>): string {
    const vals = shellVals(shellStateFor(false), {
      go: () => {},
      toggleNav: () => {},
      closeNav: () => {},
      openNav: () => {},
      goImport: () => {},
      toggleTheme: () => {},
    })
    dashboardVals(vals, s, PERIOD)
    vals.firstRun = false
    vals.notFirstRun = true
    vals.v.dash = true
    return renderToString(createElement(Template, { vals }))
  }

  it("★ 화면 HTML에 그 숫자가 실제로 뜬다 — 스냅샷과 원 단위로 같다 ★", async () => {
    const s = await snapshot()
    const html = render(s)

    // ★ 기대값을 **스냅샷에서 파생시킨다** ★
    // 손으로 박으면 파일이 하나 들어올 때마다 게이트가 빨개진다 — 그건 회귀가
    // 아니라 데이터가 는 것이다. 이 테스트의 이름이 «화면 숫자 = 스냅샷 숫자»이므로
    // 물어야 할 것도 그것이다. 포맷터는 화면이 쓰는 바로 그 함수를 쓴다.
    expect(html, "총매출이 화면에 없다").toContain(won(s.pnl.revenue))
    expect(html, "순이익이 화면에 없다").toContain(signed(s.pnl.netProfit))

    // ── 축약 표기 — KPI 스트립 ─────────────────────────────────
    expect(html, "총매출 KPI가 없다").toContain(`${compact(s.pnl.revenue)}원`)
    expect(html, "순이익 KPI가 없다").toContain(`${compact(s.pnl.netProfit)}원`)
    /**
     * ★ 「주문 N건」 → 「판매 N건 · 취소 M건」 (조건 d, 2026-08-14) ★
     *
     * 이중 기록 이후 판매 건수에는 취소된 것도 들어 있다. 「주문 155건」만 쓰면
     * 사용자가 옛 146과 대조하다 9건이 어디서 왔는지 못 찾는다 — 그 차이를 숫자로
     * 보인다. 146이라는 숫자는 이제 어디에도 없고, 그 소멸은 의도된 것이다.
     */
    expect(html, "판매 건수가 없다").toContain(`판매 ${won(s.orderCount)}건`)
    if (s.claimCount > 0) {
      expect(html, "취소 건수를 짝으로 안 쓰면 155의 출처가 안 보인다").toContain(
        `취소 ${won(s.claimCount)}건`,
      )
    }

    // ── 비용 구성 카드 — `showCost` 복원의 결과 ────────────────
    // 이 문자열이 없으면 카드 자체가 안 그려진 것이다. 이게 원래 막혀 있던 자리다.
    expect(html, "비용 구성 카드가 안 그려졌다").toContain("매출 대비 비용 구성")
    expect(html, "클레임 항목이 없다").toContain("클레임")
    // 광고비 항목은 **광고 데이터가 있을 때만** 뜬다. 사용자가 광고 배치를
    // 되돌리면 0이 되고 항목이 사라지는 것이 정상이다 (0을 그리면 없는 비용을
    // 있는 것처럼 말한다). 그래서 조건부로 본다.
    const ad = s.pnl.adDirect + s.pnl.adUnallocated
    if (ad > 0) expect(html, "광고비 항목이 없다").toContain("광고비")
  })

  /**
   * ★ 이 단언은 §21 패치가 **뒤집은** 것이다 ★
   *
   * 1단에서 이 자리는 `not.toContain("388,700원")`이었다. 비용 구성 범례가 `pct`만
   * 그리고 원 단위 금액은 `mixTip`(호버 툴팁) 안에만 있었기 때문이다 — 서버 렌더에서
   * `mixTip`은 `null`이라 HTML에 없었다.
   *
   * 그때 **마크업을 고쳐 금액을 넣지 않고 부재를 단언으로 박았다.** 승인 없이 목업에
   * 없는 표시를 만드는 것은 E-1이고, 테스트를 조용히 완화하면 사라진 이유를 아무도
   * 모르게 되기 때문이다. 그 단언이 지금 깨졌고, **깨진 것이 §21 완료 신호**다
   * (작업 리듬 9번 — "현재의 한계는 단언으로 박는다").
   *
   * §21-4가 도넛을 가로 막대로 바꾸면서 금액이 라벨 옆으로 나왔다. 부수 효과로
   * §9의 «S/M hover 의존 인터랙션 금지»도 함께 지켜진다 — 금액을 보려고 호버할
   * 필요가 없어졌다.
   */
  it("★ 뒤집힌 단언 ★ 가로 막대가 원 단위 금액을 화면으로 꺼냈다", async () => {
    const s = await snapshot()
    const html = render(s)
    // 금액도 스냅샷에서 파생시킨다 — 「호버해야 보이던 것이 화면에 나왔다」가
    // 이 단언의 내용이지 특정 숫자가 아니다.
    expect(html, "클레임 금액이 화면에 없다").toContain(`${won(s.pnl.claims)}원`)
    const adTotal = s.pnl.adDirect + s.pnl.adUnallocated
    if (adTotal > 0) {
      expect(html, "광고비 금액이 화면에 없다").toContain(`${won(adTotal)}원`)
    }
    // 도넛이 실제로 빠졌는지는 여기서 보지 않는다 — `convert-gate`의 §21 구간
    // 선언(`data-s21="cost-bars"`가 정확히 하나)이 그 자리를 지킨다. 여기서
    // "기여이익률"의 부재를 확인하려 하면 **KPI 카드의 같은 라벨**에 걸린다.
  })

  it("비용 구성이 실제 항목을 담는다 — 클레임이 사라지지 않는다", async () => {
    const s = await snapshot()
    const vals = emptyVals()
    dashboardVals(vals, s, PERIOD)
    const labels = (vals.costMix as { label: string }[]).map((m) => m.label)
    expect(labels).toContain("클레임")
    // ★ 0인 항목은 빼고 그린다 — 그게 이 카드의 규칙이다 ★
    // 원가·할인은 기준 데이터가 아직 없어서 0이고, 광고비는 **사용자가 그 배치를
    // 되돌리면** 0이 된다. 둘 다 «없는 비용을 0원으로 그리지 않는다»는 같은 규칙에
    // 걸리므로, 광고비의 등장 여부는 데이터가 정한다.
    expect(labels).not.toContain("매출원가")
    const ad = s.pnl.adDirect + s.pnl.adUnallocated
    if (ad > 0) expect(labels, "광고비가 있는데 안 그렸다").toContain("광고비")
    else expect(labels, "광고비 0을 그리면 없는 비용을 있는 것처럼 말한다").not.toContain("광고비")
  })

  /**
   * ★ 정직성이 화면으로 넘어왔는가 ★
   *
   * CLI는 손익 5줄 밑에 "이 숫자가 담지 못한 것"을 늘 함께 출력해왔다. 화면이
   * 숫자만 가져오고 단서를 두고 오면 사용자는 −8,192,734를 완성된 순이익으로
   * 읽는다 — 지금 그것은 한 연결의 광고비를 다른 연결의 매출에서 뺀 미완성
   * 합성이다. **단서 없는 표시가 정확히 조용히 틀린 숫자다** (헌장 A-5).
   *
   * ★ 왜 전부를 세는가 ★
   * 판정이 core 하나여도 화면이 그중 몇 개만 그리면 정직성은 반쯤 사라진다.
   * 개수를 묶어두면 새 단서가 생겼을 때 화면이 따라오지 않는 순간 여기서 깨진다.
   */
  it("이 숫자가 담지 못한 것 — CLI가 말하던 단서가 화면에도 있다", async () => {
    const s = await snapshot()
    const gaps = pnlGaps(s)
    const html = render(s)

    expect(gaps.length, "단서가 없을 리 없다 — 원가도 고정비도 비어 있다").toBeGreaterThan(0)
    expect(html, "단서 카드가 안 그려졌다").toContain("이 숫자가 담지 못한 것")

    // 화면이 단서를 골라 그리지 않는다 — 전부 그린다
    for (const g of gaps) {
      expect(html, `단서 "${g.label}"이 화면에 없다`).toContain(g.label)
    }

    // 가장 무거운 단서. 이게 빠지면 순이익을 채널 성과로 읽게 된다
    expect(gaps.map((g) => g.id), "연결 섞임 단서가 없다").toContain("connections-mixed")
  })

  /**
   * 진짜 앱 창을 띄워 눈으로 본 뒤에야 걸린 것이다 — 전 게이트가 녹색이었다.
   * 헤더 부제가 상수 `"2026년 8월"`(목업 L3667)이라 7월 데이터 위에 8월이 적혀
   * 있었고, 히어로는 "2026년 7월 순이익"이라 **한 화면에 두 달이 동시에** 있었다.
   * 빈 값이면 모르고 넘어가지만 **틀린 값은 사용자가 믿는다.**
   */
  it("헤더 부제가 보고 있는 기간과 같다 — 한 화면에 두 달이 있으면 안 된다", async () => {
    const html = render(await snapshot())
    expect(html, "부제가 기간을 따르지 않는다").toContain("2026년 7월")
    expect(html, "다른 달이 헤더에 남아 있다").not.toContain("2026년 8월 손익")
  })

  /**
   * ★ 문장의 **존재 조건**을 데이터에 묶었다 (§21 패치 · 결함 47 잔여분) ★
   *
   * 값(`delta`)은 1단에서 이미 비웠지만 **문장**이 살아 있었다 — "vs 7월 같은 기간",
   * "전월 대비" ×6, "숫자 = 8월 누계 · … 막대는 8/1 → 8/8". 값이 비어도 화면은
   * 여전히 비교가 있는 것처럼 말했고, 그중 마지막 문장은 **한 문장에 거짓이 셋**이었다.
   *
   * 고친 방향이 요점이다 — **문장을 고친 것이 아니라 존재 조건을 데이터에 묶었다.**
   * 8월 파일이 들어와 `hasPriorPeriod`가 참이 되는 날 문장들이 **스스로 살아난다.**
   * 그때 가서 누가 다시 켜는 작업이 생기면 안 된다.
   */
  it("비교가 없으면 비교 문장도 없다 — 데이터가 들어오면 스스로 살아난다", async () => {
    const s = await snapshot()
    expect(s.hasPriorPeriod, "DB에 7월 한 달치뿐이라 비교 대상이 없는 것이 사실이다").toBe(false)

    const html = render(s)
    expect(html, "히어로에 없는 비교가 적혀 있다").not.toContain("vs 7월 같은 기간")
    expect(html, "KPI에 없는 비교 라벨이 남아 있다").not.toContain("전월 대비")
    expect(html, "지표 설명문이 없는 8월·전월비교·일별막대를 말한다").not.toContain("8월 누계")
  })

  it('"동기화"는 화면에 없다 — 목업 카피가 아니라 사실을 쓴다 (LOCK 10)', async () => {
    const html = render(await snapshot())
    expect(html, "양방향·자동이 실존하기 전까지 쓰지 않는 낱말이다").not.toContain("동기화")
  })

  it("데이터가 없으면 배선하지 않는다 — 빈 값이 그대로 남는다", () => {
    const vals = emptyVals()
    expect(vals.heroRev).toBe("")
    expect(vals.costMix).toEqual([])
  })
})
