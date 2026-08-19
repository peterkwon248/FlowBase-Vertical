/**
 * 원가 대기 화면 조회 — **사람이 «이 품명 = 이 상품»을 판단하는 자리의 재료.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 연결 화면의 이웃인가 ★
 *
 * «두 이름이 같은 물건인가»는 데이터에 답이 없어 사람이 정하는 판단이고(§21-6),
 * 이 앱에서 그 판단의 자리는 상품 연결 화면이다. 원가 대기(011)의 행도 정확히
 * 같은 판단이라 같은 화면의 탭으로 들어간다 — 새 판단 표면을 만들지 않는다.
 *
 * ★ 매처는 주입받는다 (LOCK 4) ★
 * 「제목 두 개가 닮았다」·「모델 코드가 제목에 들어 있다」는 전부 마켓 지식이라
 * 팩(`listing-match.ts`)에 있고, 코어는 인터페이스로만 안다 — `LinkingMatcher`와
 * 같은 꼴이다.
 * ─────────────────────────────────────────────────────────────
 */

import type { Driver } from "../store/driver.js"

export type BridgeSuggestionKind = "clear" | "contested" | "none"

/** 후보 하나 — 리스팅 **군집**이다. 확정하면 군집 전체가 한 SKU에 이어진다. */
export interface BridgeViewCandidate {
  readonly key: string
  readonly title: string
  readonly listingIds: readonly string[]
  /** 군집에 이미 SKU가 있으면 그 id — 확정이 곧장 원가를 넣는다. */
  readonly skuId: string | null
  readonly score: number
  readonly shared: readonly string[]
  /** `model` = 코드 일치(확률이 아니라 사실) · `name` = 이름 유사도. */
  readonly via: "model" | "name"
}

/**
 * 팩이 구현한다. **연결하지 않고 점수만 낸다.**
 *
 * `prepare`가 군집·정규화를 한 번 하고, 행마다 `suggest`를 부른다 — 대기 행
 * 175개가 군집 준비를 175번 반복하면 조회가 수백 ms로 는다 (실측 479ms → 준비
 * 분리 후 행당 유사도 계산만 남는다).
 */
export interface CostBridgeMatcher {
  prepare(
    listings: readonly {
      readonly id: string
      readonly title: string
      readonly grain: "product" | "option"
      readonly skuId: string | null
    }[],
  ): {
    suggest(pending: { readonly title: string; readonly model: string | null }): {
      readonly kind: BridgeSuggestionKind
      readonly candidates: readonly BridgeViewCandidate[]
    }
  }
}

export interface PendingCostCard {
  readonly id: number
  readonly title: string
  readonly model: string | null
  readonly amount: number
  readonly effectiveFrom: string
  readonly sourceName: string
  readonly kind: BridgeSuggestionKind
  readonly candidates: readonly BridgeViewCandidate[]
}

export interface PendingCostView {
  readonly pending: readonly PendingCostCard[]
  /** 무시한 행 — 삭제가 아니라 세고 있는 부재다 (§20 규칙 3). 거둘 수 있다. */
  readonly dismissed: readonly {
    readonly id: number
    readonly title: string
    readonly amount: number
  }[]
  /** 지난 판단 수 — «다리 사전»의 크기. 화면이 «N건은 저절로 붙는다»를 말한다. */
  readonly resolvedCount: number
}

export async function loadPendingCostView(
  db: Driver,
  libraryId: string,
  matcher: CostBridgeMatcher,
): Promise<PendingCostView> {
  const listings = (
    await db
      .prepare(
        `SELECT id, title, grain, sku_id FROM marketplace_listing
          WHERE library_id = ? AND link_state != 'ignored'`,
      )
      .all(libraryId)
  ).map((r) => ({
    id: String(r["id"]),
    title: String(r["title"]),
    grain: String(r["grain"]) as "product" | "option",
    skuId: r["sku_id"] === null || r["sku_id"] === undefined ? null : String(r["sku_id"]),
  }))

  const rows = await db
    .prepare(`SELECT * FROM pending_cost WHERE library_id = ? ORDER BY title`)
    .all(libraryId)

  const bridge = matcher.prepare(listings)
  const pending: PendingCostCard[] = []
  const dismissed: { id: number; title: string; amount: number }[] = []
  let resolvedCount = 0

  for (const r of rows) {
    const state = String(r["state"])
    if (state === "resolved") {
      resolvedCount++
      continue
    }
    const id = Number(r["id"])
    const title = String(r["title"])
    const amount = Number(r["amount"] ?? 0)
    if (state === "dismissed") {
      dismissed.push({ id, title, amount })
      continue
    }
    const model =
      r["model_code"] === null || r["model_code"] === undefined ? null : String(r["model_code"])
    const s = bridge.suggest({ title, model })
    pending.push({
      id,
      title,
      model,
      amount,
      effectiveFrom: String(r["effective_from"]),
      sourceName: String(r["source_name"]),
      kind: s.kind,
      candidates: s.candidates,
    })
  }

  return { pending, dismissed, resolvedCount }
}
