/**
 * `LinkingMatcher`의 한국 마켓 구현 — **core가 기대는 인터페이스를 팩이 채운다.**
 *
 * 방향이 중요하다: 팩이 core를 import하지 core가 팩을 import하지 않는다 (LOCK 4).
 * core는 "닮은 정도를 아는 무언가"만 알고, 그게 옵션 접미를 떼고 판촉어를 거른다는
 * 것은 모른다.
 */

import type {
  Grain,
  LinkingMatcher,
  SkuRef,
  SuggestionKind,
  ViewCandidate,
} from "../../core/linking/view.js"
import { normalizeTitle, similarity, suggest } from "./listing-match.js"

export const krLinkingMatcher: LinkingMatcher = {
  productPart(title: string, grain: Grain): string {
    return normalizeTitle(title, grain).product
  },

  suggest(
    cardTitle: string,
    skus: readonly SkuRef[],
  ): { kind: SuggestionKind; candidates: readonly ViewCandidate[] } {
    const card = normalizeTitle(cardTitle, "product")
    const byId = new Map(skus.map((s) => [s.id, s]))

    const scored = skus.map((s) => {
      const sim = similarity(card, normalizeTitle(s.name, "product"))
      return {
        key: s.id,
        score: sim.score,
        shared: sim.shared,
        compositionMismatch: sim.compositionMismatch,
      }
    })

    const r = suggest(scored)
    const candidates: ViewCandidate[] = r.candidates.flatMap((c) => {
      const s = byId.get(c.key)
      if (!s) return []
      return [
        {
          skuId: s.id,
          name: s.name,
          code: s.code,
          score: c.score,
          shared: c.shared,
          // 판정은 팩이 하고 문장은 화면이 짓는다 (ADR-026 결정 3 · LOCK 4).
          caution: c.compositionMismatch ? ("composition" as const) : null,
        },
      ]
    })
    return { kind: r.kind, candidates }
  },
}

// ── 원가 다리 매처 — 대기 행(011) → 리스팅 군집 ─────────────────
import type { CostBridgeMatcher } from "../../core/linking/pending-cost.js"
import { prepareCostBridge } from "./listing-match.js"

/**
 * `CostBridgeMatcher`의 한국 마켓 구현. 실제 판정은 `prepareCostBridge`에 있고
 * (모델 정확 일치 우선 · 이름 유사도 폴백), 여기는 인터페이스에 꽂을 뿐이다.
 */
export const krCostBridgeMatcher: CostBridgeMatcher = {
  prepare(listings) {
    return prepareCostBridge(listings)
  },
}
