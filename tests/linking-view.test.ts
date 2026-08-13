/**
 * 상품 연결 조회 (§21-6 · 완료 기준 a) — **카운트의 진실은 하나다.**
 *
 * ★ 이 파일이 막는 사고 ★
 * 목업의 배지 카운트가 어긋났던 이유는 `linked`/`linkedHere`가 두 곳에서 따로
 * 세어졌기 때문이다(핸드오프 이슈). 여기서 같은 실수를 하기 제일 쉬운 자리가
 * 탭 숫자다 — `todo`가 리스팅 수인가 카드 수인가.
 *
 * **카드 수로 못박았다.** 탭 숫자는 "남은 일의 양"이고 일의 단위가 카드이기
 * 때문이다. 11번가 옵션 3개는 클릭 한 번이므로 3이 아니라 1이다.
 */

import { describe, it, expect, beforeEach } from "vitest"
import { openNodeDriver } from "../src/core/store/driver-node.js"
import type { Driver } from "../src/core/store/driver.js"
import { migrate } from "../src/core/store/migrate-node.js"
import { Repository, type ListingUpsert } from "../src/core/store/repository.js"
import { loadLinkingView } from "../src/core/linking/view.js"
import { krLinkingMatcher as M } from "../src/packs/kr-marketplace/linking-matcher.js"

const LIB = "lib-1"
const A = "conn-a"
const B = "conn-b"
const NOW = "2026-08-13T10:00:00"

async function seed(db: Driver): Promise<void> {
  await migrate(db)
  await db.prepare(`INSERT INTO library (id, name, created_at) VALUES (?,?,?)`).run(LIB, "기본", "t0")
  for (const [id, nm] of [[A, "11번가"], [B, "ESM"]] as const) {
    await db
      .prepare(
        `INSERT INTO connection (id, library_id, pack_id, marketplace_key, display_name, state, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      )
      .run(id, LIB, "kr-marketplace", id, nm, "CONNECTED", "t0", "t0")
  }
}

const L = (key: string, title: string, grain: "product" | "option"): ListingUpsert => ({
  listingKey: key,
  title,
  grain,
})
const idOf = (conn: string, key: string): string => `lst-${conn}-${key}`

describe("연결 조회 — 카드가 행이다 (§21-6)", () => {
  let db: Driver
  let repo: Repository

  beforeEach(async () => {
    db = openNodeDriver(":memory:")
    await seed(db)
    repo = new Repository(db)
    // 11번가 — 같은 상품의 옵션 셋 + 다른 상품 하나
    await repo.upsertListings(
      LIB,
      A,
      [
        L("P1|블랙", "미니팬 NS-19 · 색상:블랙-1개", "option"),
        L("P1|화이트", "미니팬 NS-19 · 색상:화이트-1개", "option"),
        L("P1|네이비", "미니팬 NS-19 · 색상:네이비-1개", "option"),
        L("P2|기본", "거리측정기 GR-40 · 기본", "option"),
      ],
      "t1",
    )
    // ESM — 상품 단위
    await repo.upsertListings(LIB, B, [L("E1", "미니팬 NS-19", "product")], "t1")
  })

  /** ★ 카운트 정의 — 이 테스트가 목업 배지 불일치의 재발을 막는다 ★ */
  it("탭 배지는 카드 수다 — 리스팅 수가 아니다", async () => {
    const v = await loadLinkingView(db, LIB, M)

    // 리스팅 5개(11번가 4 + ESM 1) → 카드 3개
    //   [미니팬 NS-19] 11번가 옵션 3 + ESM 1 = 4개 리스팅이 한 카드
    //   [거리측정기 GR-40] 1개
    expect(v.listingCounts.todo, "원자료는 5개다").toBe(5)
    expect(v.counts.todo, "일의 단위는 카드다").toBe(2)
    expect(v.todo).toHaveLength(2)

    const fan = v.todo.find((c) => c.title.startsWith("미니팬"))
    expect(fan?.listings, "옵션 3 + ESM 1이 한 카드로 접힌다").toHaveLength(4)
  })

  it("옵션부를 뗀 상품부가 카드 제목이다", async () => {
    const v = await loadLinkingView(db, LIB, M)
    const titles = v.todo.map((c) => c.title).sort()
    expect(titles).toEqual(["거리측정기 GR-40", "미니팬 NS-19"])
  })

  /** ★ 완료 기준 a — 엔진 분류가 화면 값에 1:1로 온다 ★ */
  it("SKU가 없으면 제안도 없다 — 콜드스타트는 전부 none", async () => {
    const v = await loadLinkingView(db, LIB, M)
    for (const c of v.todo) {
      expect(c.suggestionKind, "제안할 대상이 없다").toBe("none")
      expect(c.candidates).toHaveLength(0)
    }
  })

  it("SKU가 생기면 다음 카드가 그것을 후보로 든다 — 근거와 함께", async () => {
    // 미니팬 군집을 SKU로 등록한다
    const v0 = await loadLinkingView(db, LIB, M)
    const fan = v0.todo.find((c) => c.title.startsWith("미니팬"))!
    await repo.createSkuForListings(LIB, fan.listings.map((l) => l.id), fan.title, NOW)

    // 새 옵션이 뒤늦게 들어온다 (d 판정의 그 상황)
    await repo.upsertListings(LIB, A, [L("P1|그린", "미니팬 NS-19 · 색상:그린-1개", "option")], "t2")

    const v = await loadLinkingView(db, LIB, M)
    const fresh = v.todo.find((c) => c.title.startsWith("미니팬"))
    expect(fresh, "새 옵션은 unlinked로 태어난다 — 자동으로 붙지 않는다").toBeTruthy()
    expect(fresh?.suggestionKind, "기존 SKU가 뚜렷한 후보로 잡힌다").toBe("clear")

    const top = fresh?.candidates[0]
    expect(top?.name).toBe("미니팬 NS-19")
    expect(top?.shared.length, "근거가 비면 §21-1 위반이다").toBeGreaterThan(0)
    // ★ 정직함의 가격은 클릭 한 번이다 — 자동으로 붙지 않지만 후보로는 바로 뜬다
  })

  /** ★ N:1이 화면에 드러나는 자리 ★ */
  it("이어진 것은 목적지(SKU)로 묶인다 — 채널이 섞여 한 카드가 된다", async () => {
    const v0 = await loadLinkingView(db, LIB, M)
    const fan = v0.todo.find((c) => c.title.startsWith("미니팬"))!
    const skuId = await repo.createSkuForListings(LIB, fan.listings.map((l) => l.id), fan.title, NOW)

    const v = await loadLinkingView(db, LIB, M)
    expect(v.counts.todo, "미니팬 카드가 todo에서 빠진다").toBe(1)
    expect(v.counts.done).toBe(1)

    const card = v.done[0]!
    expect(card.sku?.id).toBe(skuId)
    expect(card.listings, "11번가 옵션 3 + ESM 1").toHaveLength(4)
    const channels = new Set(card.listings.map((l) => l.channel))
    expect(channels.size, "두 채널이 한 SKU 아래 모인다").toBe(2)
  })

  it("무시한 것은 자기 탭으로 간다 — 사라지지 않는다", async () => {
    const v0 = await loadLinkingView(db, LIB, M)
    const gr = v0.todo.find((c) => c.title.startsWith("거리측정기"))!
    await repo.ignoreListings(gr.listings.map((l) => l.id), NOW)

    const v = await loadLinkingView(db, LIB, M)
    expect(v.counts.ignored).toBe(1)
    expect(v.counts.todo).toBe(1)
    expect(v.ignored[0]?.listings).toHaveLength(1)
  })

  it("세 탭의 카드 합이 전체 카드다 — 어디에도 없는 리스팅이 없다", async () => {
    const v0 = await loadLinkingView(db, LIB, M)
    const fan = v0.todo.find((c) => c.title.startsWith("미니팬"))!
    await repo.createSkuForListings(LIB, [fan.listings[0]!.id], fan.title, NOW)
    await repo.ignoreListings([fan.listings[1]!.id], NOW)

    const v = await loadLinkingView(db, LIB, M)
    const total = v.listingCounts.todo + v.listingCounts.done + v.listingCounts.ignored
    expect(total, "리스팅 5개가 어느 탭에든 정확히 한 번씩 있어야 한다").toBe(5)
  })
})
