/**
 * 상품 연결 화면이 읽는 **단 하나의 조회** — 조회 단일화 네 번째 적용.
 *
 * `loadPnlSnapshot` · `loadSettlementRows` · `loadOrderRows`에 이어 네 번째다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 카운트의 진실도 여기서 나온다 ★
 *
 * 목업의 배지 카운트가 어긋났던 이유는 `linked`/`linkedHere`가 **두 곳에서 따로**
 * 세어졌기 때문이다(핸드오프 이슈). 여기서 같은 실수를 하기 제일 쉬운 자리가
 * 탭 숫자다 — `todo`가 **리스팅 수**냐 **카드 수**냐.
 *
 * **카드 수로 못박는다.** 탭 숫자는 "남은 일의 양"을 말하는데, 일의 단위가
 * 카드이기 때문이다. 11번가 옵션 3개는 클릭 한 번으로 끝나므로 `3`이 아니라 `1`이다.
 * 리스팅 수는 카드가 자기 안에서 `옵션 3개`로 따로 말한다.
 *
 * 화면은 이 숫자를 **다시 세지 않는다.** 세는 순간 두 번째 진실이 생긴다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 왜 매처를 주입받는가 (LOCK 4) ★
 * 제목 정규화·유사도는 마켓 지식이라 `packs/`에 산다. 그렇다고 core가 팩을
 * import하면 계층이 뒤집힌다 — core는 특정 팩에 기대면 안 된다. 그래서 **인터페이스
 * 뒤로 받는다.** core는 "닮은 정도를 아는 무언가"만 알고 그게 한국 마켓 규칙인지는
 * 모른다 (AI Provider를 인터페이스 뒤에 둔 것과 같은 꼴 · LOCK 7).
 */

import type { Driver } from "../store/driver.js"
import { KEY_SEP } from "../import/mapping/listing.js"

export type Grain = "product" | "option"
export type LinkState = "linked" | "ignored" | "unlinked"

export interface LinkingListing {
  readonly id: string
  /**
   * ⚠ **내부 키다. 화면에 그대로 내보내지 않는다** (헌장 C-4 · `source_key`와 같은 계열).
   *
   * 여러 컬럼을 `U+0001`로 이어 붙인 합성값이라(ADR-006) 그대로 그리면 보이지 않는
   * 제어문자가 HTML에 섞이고, 합성 방식 자체가 우리 구현 사정이지 사용자가 알아야 할
   * 사실이 아니다. 화면이 쓸 것은 아래 `keyParts`다.
   */
  readonly listingKey: string
  /**
   * `listingKey`를 만든 **조각들** — 마켓이 준 값 그대로다 (11번가는 `[상품번호, 옵션명]`,
   * ESM은 `[상품번호]`).
   *
   * 합성한 쪽이 분해도 한다. 화면이 구분자를 알아야 한다면 그건 내부 규약이 화면까지
   * 샌 것이고, 화면이 늘 때마다 같은 split이 복사된다.
   *
   * core는 어느 조각이 무엇인지 **모른다** — 그건 프로파일의 `keyColumns`가 아는 것이고
   * 마켓 지식이다 (LOCK 4). 그래서 이름표 없이 순서대로 준다.
   */
  readonly keyParts: readonly string[]
  readonly title: string
  readonly grain: Grain
  readonly channel: string
  readonly linkState: LinkState
  readonly skuId: string | null
}

export interface SkuRef {
  readonly id: string
  readonly name: string
  readonly code: string
}

/** 제안 후보 하나. 점수와 **근거**를 함께 든다 (§21-6 ③). */
export interface ViewCandidate {
  readonly skuId: string
  readonly name: string
  readonly code: string
  readonly score: number
  readonly shared: readonly string[]
}

export type SuggestionKind = "clear" | "contested" | "none"

/**
 * 매처 — 팩이 구현한다. **연결하지 않고 점수만 낸다.**
 */
export interface LinkingMatcher {
  /** 제목에서 묶음 기준이 되는 부분. 옵션 단위면 옵션부를 뗀다. */
  productPart(title: string, grain: Grain): string
  /** 카드 제목과 SKU들을 견주어 등급과 후보를 낸다. */
  suggest(
    cardTitle: string,
    skus: readonly SkuRef[],
  ): { kind: SuggestionKind; candidates: readonly ViewCandidate[] }
}

/**
 * 화면의 행 단위 — **연결의 목적지**다 (§21-6).
 *
 * 리스팅이 아니라 카드가 행이다. 11번가 옵션 여럿이 한 카드로 접히고, 그 카드가
 * 한 SKU가 된다.
 */
export interface LinkingCard {
  /** 군집 키(상품부) 또는 SKU id. */
  readonly key: string
  readonly title: string
  /** 이 카드가 접고 있는 리스팅들. 카드가 "옵션 N개"라고 말하는 근거다. */
  readonly listings: readonly LinkingListing[]
  /** `todo`에서만 채워진다. */
  readonly suggestionKind: SuggestionKind
  readonly candidates: readonly ViewCandidate[]
  /** 이미 이어진 카드의 목적지. `done`에서만 있다. */
  readonly sku: SkuRef | null
}

export interface LinkingView {
  readonly todo: readonly LinkingCard[]
  readonly done: readonly LinkingCard[]
  readonly ignored: readonly LinkingCard[]
  /** ★ 탭 배지 — **카드 수**다. 화면이 다시 세지 않는다. ★ */
  readonly counts: { readonly todo: number; readonly done: number; readonly ignored: number }
  /** 참고용 원자료 수. 카드 수와 다른 것이 정상이다. */
  readonly listingCounts: { readonly todo: number; readonly done: number; readonly ignored: number }
}

export async function loadLinkingView(
  db: Driver,
  libraryId: string,
  matcher: LinkingMatcher,
): Promise<LinkingView> {
  const rows = await db
    .prepare(
      `SELECT l.id, l.listing_key, l.title, l.grain, l.link_state, l.sku_id,
              COALESCE(cn.display_name, '(이름 없는 연결)') AS ch
         FROM marketplace_listing l
         LEFT JOIN connection cn ON cn.id = l.connection_id
        WHERE l.library_id = ?
        ORDER BY l.title`,
    )
    .all(libraryId)

  const skuRows = await db
    .prepare(`SELECT id, name, code FROM sku WHERE library_id = ? ORDER BY code`)
    .all(libraryId)
  const skus: SkuRef[] = skuRows.map((r) => ({
    id: String(r["id"]),
    name: String(r["name"]),
    code: String(r["code"]),
  }))
  const skuById = new Map(skus.map((s) => [s.id, s]))

  const listings: LinkingListing[] = rows.map((r) => ({
    id: String(r["id"]),
    listingKey: String(r["listing_key"]),
    keyParts: String(r["listing_key"]).split(KEY_SEP),
    title: String(r["title"]),
    grain: String(r["grain"]) === "option" ? "option" : "product",
    channel: String(r["ch"]),
    linkState: (["linked", "ignored", "unlinked"] as const).find((s) => s === r["link_state"]) ?? "unlinked",
    skuId: r["sku_id"] == null ? null : String(r["sku_id"]),
  }))

  /** 상품부로 접는다. **완전 일치만** — 검토 전에 접는 층은 결정론적이어야 한다. */
  const fold = (ls: readonly LinkingListing[]): Map<string, LinkingListing[]> => {
    const m = new Map<string, LinkingListing[]>()
    for (const l of ls) {
      const k = matcher.productPart(l.title, l.grain)
      const b = m.get(k)
      if (b) b.push(l)
      else m.set(k, [l])
    }
    return m
  }

  const todo: LinkingCard[] = []
  for (const [key, ls] of fold(listings.filter((l) => l.linkState === "unlinked"))) {
    const s = matcher.suggest(key, skus)
    todo.push({ key, title: key, listings: ls, suggestionKind: s.kind, candidates: s.candidates, sku: null })
  }

  const ignored: LinkingCard[] = []
  for (const [key, ls] of fold(listings.filter((l) => l.linkState === "ignored"))) {
    ignored.push({ key, title: key, listings: ls, suggestionKind: "none", candidates: [], sku: null })
  }

  // 이어진 것은 **목적지로 묶는다** — 같은 SKU에 붙은 리스팅이 한 카드다.
  // 이것이 N:1이 화면에 드러나는 자리이고, 11번가 옵션 3개와 ESM 상품 1개가
  // 한 카드 아래 모인다.
  const doneMap = new Map<string, LinkingListing[]>()
  for (const l of listings) {
    if (l.linkState !== "linked" || l.skuId === null) continue
    const b = doneMap.get(l.skuId)
    if (b) b.push(l)
    else doneMap.set(l.skuId, [l])
  }
  const done: LinkingCard[] = [...doneMap].map(([skuId, ls]) => {
    const sku = skuById.get(skuId) ?? null
    return {
      key: skuId,
      title: sku?.name ?? skuId,
      listings: ls,
      suggestionKind: "none" as const,
      candidates: [],
      sku,
    }
  })

  const n = (cs: readonly LinkingCard[]): number => cs.reduce((a, c) => a + c.listings.length, 0)

  return {
    todo,
    done,
    ignored,
    counts: { todo: todo.length, done: done.length, ignored: ignored.length },
    listingCounts: { todo: n(todo), done: n(done), ignored: n(ignored) },
  }
}
