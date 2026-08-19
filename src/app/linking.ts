/**
 * 상품 연결 화면 배선 (§21-6) — **기준(Reference) 화면이다.**
 *
 * 사실 화면(주문·정산)과 반대로 여기는 **쓰기 어포던스를 그린다.** 연결은 사람이
 * 내리는 판단이고, 그 판단을 기록하는 것이 이 화면의 존재 이유다 (데이터 3종 분류 —
 * 연결은 «기준»이라 수동 편집 + 이력이 정상이다).
 *
 * ★ 이 파일은 세지 않는다 ★
 * 탭 배지도 군집 크기도 `core/linking/view.ts`가 이미 센 값을 옮길 뿐이다.
 * 여기서 `filter().length`를 한 번이라도 쓰면 카운트의 진실이 둘이 되고, 그게
 * 목업 배지가 어긋났던 바로 그 경로다.
 *
 * ★ 행 단위는 카드다 (§21-6) ★
 * 목업 `linkRows`는 리스팅-평면이었다. 같은 이름을 쓰지만 담기는 것은 **카드**다 —
 * 11번가 옵션 3개가 한 줄이고, 클릭 한 번이 그 셋을 함께 잇는다.
 */

import type { LinkingCard, LinkingView, ViewCandidate } from "@core/linking/view.js"
import type { PendingCostCard, PendingCostView } from "@core/linking/pending-cost.js"
import type { TemplateVals } from "./generated/vals.js"
import { won } from "./format.js"

const DIM = "var(--fg-4)"
const G = "var(--pnl-pos)"
const YEL = "var(--pnl-warn)"
const NONE = "—"

/** 목업의 탭 순서·이름 그대로. `skip`은 우리 어휘로 `ignored`다. */
const TABS = [
  { id: "todo", label: "확인 필요" },
  { id: "done", label: "연결됨" },
  { id: "skip", label: "무시함" },
  /**
   * ★ 신설 (2026-08-19, D2) — 원가 대기 (011) ★
   * «이 품명 = 이 상품»은 리스팅 연결과 같은 종류의 판단이라(§21-6 — 데이터에
   * 답이 없어 사람이 정한다) 같은 화면의 탭으로 들어온다. 새 판단 표면을 만들지
   * 않는다. 목업에 없는 탭이지만 탭 바는 배열을 그대로 그리므로 마크업 이탈이
   * 아니고, 본문 구간만 `link-cost-pending`으로 신설한다.
   */
  { id: "cost", label: "원가 대기" },
] as const

export type LinkTab = (typeof TABS)[number]["id"]

/** 화면이 일으키는 쓰기. 리포지토리는 App이 들고 있고 여기는 부르기만 한다. */
export interface LinkingActions {
  pickTab: (tab: LinkTab) => void
  /** 카드의 리스팅 전부를 새 SKU 하나로 등록한다 — 군집의 이행 (§21-6 ①②). */
  newSku: (card: LinkingCard) => void
  /** 카드의 리스팅 전부를 기존 SKU에 잇는다. */
  link: (card: LinkingCard, skuId: string) => void
  ignore: (card: LinkingCard) => void
  /** 연결 해제 · 무시 되돌리기 — 둘 다 `unlinked`로 되돌린다. */
  undo: (card: LinkingCard) => void
  /** 일괄형의 선택 토글. */
  toggle: (key: string) => void
  toggleAll: () => void
  /** 선택된 카드들을 **각각** 새 SKU로 등록한다. 하나로 합치지 않는다. */
  bulkNewSku: () => void
  /**
   * 원가 대기 행을 후보 군집에 잇는다 — 군집에 SKU가 없으면 만들고(1:1) 원가를
   * 넣는다. 점수는 넘기지 않는다 — 자동 확정은 구조적으로 불가능해야 한다.
   */
  resolveCost: (card: PendingCostCard, cand: PendingCostCard["candidates"][number]) => void
  dismissCost: (card: PendingCostCard) => void
  undoDismissCost: (id: number) => void
}

export const NOOP_LINKING_ACTIONS: LinkingActions = {
  pickTab: () => {},
  newSku: () => {},
  link: () => {},
  ignore: () => {},
  undo: () => {},
  toggle: () => {},
  toggleAll: () => {},
  bulkNewSku: () => {},
  resolveCost: () => {},
  dismissCost: () => {},
  undoDismissCost: () => {},
}

/**
 * 카드의 모든 리스팅이 **같은 자리에 같은 값**을 가진 식별자 조각.
 *
 * 11번가 옵션 군집이면 상품번호가 남고(옵션명은 저마다 다르다), 제목만 같고 상품번호가
 * 다른 ESM 중복이면 아무것도 남지 않는다 — 그 «없음»이 사실이므로 `—`로 나간다.
 *
 * 자리로만 비교한다. 어느 조각이 상품번호인지는 프로파일이 아는 마켓 지식이고
 * 화면이 알 일이 아니다 (LOCK 4).
 */
function sharedParts(card: LinkingCard): readonly string[] {
  const first = card.listings[0]
  if (!first) return []
  return first.keyParts.filter((_, i) =>
    card.listings.every((l) => l.keyParts[i] === first.keyParts[i]),
  )
}

function sharedIdent(card: LinkingCard): string {
  const parts = sharedParts(card)
  return parts.length > 0 ? parts.join(" · ") : NONE
}

/**
 * 접힌 줄이 서로 **구별되는** 자리 — 카드가 공유하지 않는 조각만 남긴다.
 *
 * ★ 처음엔 조각을 전부 그렸다가 렌더에서 고쳤다 ★
 * 11번가 옵션 군집은 상품번호가 같으므로 전부 그리면 `9242083577 · 색상:민트-1개`가
 * 줄마다 반복되고, 정작 눈이 찾아야 할 «민트 / 블랙»이 그 반복에 묻힌다. 카드 머리가
 * 이미 상품번호를 말하고 있으니 줄은 **다른 것만** 말하면 된다.
 *
 * 규칙 하나가 두 경우를 덮는다 — 11번가 옵션 군집은 옵션명이 남고, 제목만 같고
 * 상품번호가 다른 ESM 중복은 상품번호가 남는다. 그 둘이 정확히 각 경우의 구별점이다.
 */
function distinctIdent(card: LinkingCard, keyParts: readonly string[]): string {
  const shared = new Set(sharedParts(card))
  const rest = keyParts.filter((p) => !shared.has(p))
  // 조각이 전부 같으면 구별점이 없다 — 그때는 숨기지 말고 전부 보인다.
  return (rest.length > 0 ? rest : keyParts).join(" · ")
}

/**
 * 일치도 색.
 *
 * ★ 목업의 0.6 / 0.35 상수를 쓰지 않는다 ★
 * 그 숫자에는 근거가 없고, 무엇보다 **엔진의 등급과 어긋날 수 있다** — `contested`로
 * 판정된 후보가 초록으로 칠해지면 화면이 엔진과 다른 말을 한다. 그래서 색을 점수가
 * 아니라 **등급**에 묶는다. 둘이 갈릴 경로 자체가 없어진다.
 *
 * 임계값(0.74 · margin 0.15 · shared 2)은 실측에서 나왔고 `listing-match.ts`에 산다.
 */
function confColor(kind: LinkingCard["suggestionKind"]): string {
  return kind === "clear" ? G : kind === "contested" ? YEL : DIM
}

/**
 * ★ 버튼 위계는 **등급을 따른다** — §20 루프의 첫 수확 ★
 *
 * 사용자가 2d에서 리스팅 86개를 연결하며 **61번 전부 [새 SKU로 등록]을 눌렀다.**
 * 제안은 보였다("이렇게 보였던 거 같아"). 즉 시각 위계 문제가 아니라 **버튼 위계**
 * 문제였다 — 파란 primary가 카드 머리에 늘 떠 있고, 옳은 행동인 [연결]은 그 아래
 * 작은 보조 버튼이었다. 사람은 눈에 띄는 것을 누른다.
 *
 * §21-6이 이미 다르게 적어 뒀는데 내가 다르게 만들었다:
 *
 *   "[새 SKU로 등록] — … **후보가 없을 때의 기본값**"
 *   "`clear`는 후보 1개를 *미리 선택된 상태로* 제시"
 *
 * 「기본 액션」을 「항상 primary」로 읽은 것이 오독이다. 이제 등급이 정한다:
 *
 * ```
 * none       [새 SKU로 등록] primary   후보가 없으니 그것이 유일한 길이다
 * clear      [연결] primary            후보 1개가 «미리 선택된» 것의 시각적 표현
 * contested  둘 다 보조                미리 고르지 않는다 — 사람이 골라야 한다
 * ```
 *
 * `contested`에서 아무것도 primary가 아닌 것이 요점이다. 애매한 것을 골라주면
 * 사람의 확정이 검토가 아니라 **통과의례**가 된다 (§20 신뢰 전제).
 */
const PRIMARY = "v-btn v-btn--primary"
const SECONDARY = "v-btn"

function candRow(card: LinkingCard, c: ViewCandidate, act: LinkingActions) {
  return {
    conf: `${Math.round(c.score * 100)}%`,
    confColor: confColor(card.suggestionKind),
    label: c.name,
    sku: c.code,
    /**
     * ★ §21-6 ③ — 근거는 툴팁 뒤로 숨기지 않는다 ★
     * 제안 점수는 derived 값이고 §21-1이 derived에 근거 진입로를 **의무**로 건다.
     * 공간이 부족하면 SKU 코드 열을 줄이지 이 줄을 접지 않는다.
     */
    shared: c.shared.length > 0 ? `겹침: ${c.shared.join(", ")}` : "겹침 없음",
    // clear의 후보는 하나뿐이고 그것이 «미리 선택된» 것이다. contested는 여럿이라
    // 어느 것도 primary가 아니다 — 고르는 일을 사람에게 남긴다.
    pickClass: card.suggestionKind === "clear" ? PRIMARY : SECONDARY,
    pick: () => act.link(card, c.skuId),
  }
}

function cardRow(
  card: LinkingCard,
  tab: LinkTab,
  picked: ReadonlySet<string>,
  act: LinkingActions,
) {
  const n = card.listings.length
  const channels = [...new Set(card.listings.map((l) => l.channel))]
  // 오늘 접힌 카드는 전부 단일 채널이지만(실측), **구조가 그것을 전제하지 않는다.**
  // `done`은 목적지(SKU)로 묶으므로 11번가 옵션과 ESM 상품이 한 카드에 온다 —
  // 거기서 채널 하나만 그리면 화면이 거짓말을 한다 (작업 리듬 11).
  const grains = new Set(card.listings.map((l) => l.grain))

  return {
    ch: channels.join(" · "),
    // 채널별 색은 목업이 시드 팔레트에서 꺼내 쓰던 것이다. 우리에겐 채널 색이라는
    // 기준 데이터가 없으므로 중립색으로 둔다 — 주문 화면과 같은 판단.
    chColor: "var(--fg-2)",
    // 출처. 우리는 파일 가져오기뿐이다 (LOCK 10 — 목업의 "API"를 옮기지 않는다).
    src: "파일",
    listing: card.title,
    ext: sharedIdent(card),
    // 판매가 — 리스팅에 저장하지 않는다. 추출기가 뽑는 것은 식별자와 이름뿐이고
    // 가격은 주문/정산 쪽 사실이다. 없는 것을 지어내지 않는다 (§21-3 미구현 기록).
    price: NONE,

    // ── §21-6 ① 군집 ────────────────────────────────────────────────
    // 접기는 **상품부 완전 일치**로만 일어난다 (작업 리듬 12). 유사도로 접으면
    // 사람은 이미 하나로 접힌 것을 보고, 접기 전 상태를 상상해야 알아챌 수 있다.
    folded: n > 1,
    foldLabel:
      grains.has("option") && !grains.has("product")
        ? `같은 상품으로 보이는 옵션 ${n}개`
        : `같은 상품으로 보이는 리스팅 ${n}개`,
    items: card.listings.map((l) => ({
      ch: l.channel,
      // ⚠ `listingKey`가 아니라 **조각**이다. 합성 키에는 U+0001이 들어 있다 (C-4).
      ident: distinctIdent(card, l.keyParts),
    })),

    cands: card.candidates.map((c) => candRow(card, c, act)),
    /**
     * ★ 후보가 없으면 «추천 SKU» 머리글도 없다 ★
     * 목업은 이 블록을 `linkTabTodo`만으로 그렸다 — SKU가 이미 있는 세계를 전제해서
     * 후보가 빌 일이 없었기 때문이다. 콜드스타트(SKU 0)에서는 61장 전부가 **아무것도
     * 없는 머리글**을 이고 서고, 그건 «계산 중»처럼 읽힌다.
     *
     * 고치는 방향은 문구가 아니라 **존재 조건을 데이터에 묶는 것**이다 (결함 47과 같은
     * 처방). 첫 SKU가 생기는 순간 스스로 살아난다. 그 자리를 지금 채우는 것이
     * §21-6 ②의 [새 SKU로 등록]이다 — «후보가 없을 때의 기본값».
     */
    hasCands: card.candidates.length > 0,

    // ── §21-6 ② 새 SKU ──────────────────────────────────────────────
    // 후보가 없을 때의 기본 액션이다. 이것이 없으면 SKU 0개 상태에서 화면이
    // 작동 자체를 못 한다 — 목업은 SKU가 이미 있는 세계를 전제하고 그렸다.
    newSku: () => act.newSku(card),
    // 후보가 없을 때만 primary다 (§21-6 ②의 «후보가 없을 때의 기본값»).
    // 후보가 있는데 이게 파랗게 떠 있으면 사람은 그걸 누른다 — 실제로 61번 눌렀다.
    newSkuClass: card.suggestionKind === "none" ? PRIMARY : SECONDARY,
    picked: picked.has(card.key),
    toggle: () => act.toggle(card.key),

    ignore: () => act.ignore(card),
    undo: () => act.undo(card),

    // done 탭
    linkedLabel: card.sku?.name ?? "",
    linkedSku: card.sku?.code ?? "",
    key: sharedIdent(card),
  }
}

export function linkingVals(
  vals: TemplateVals,
  view: LinkingView,
  tab: LinkTab,
  picked: ReadonlySet<string>,
  act: LinkingActions = NOOP_LINKING_ACTIONS,
  /** 원가 대기 (011). `null`이면 못 읽은 것이고 탭은 0으로 그린다. */
  pendingCost: PendingCostView | null = null,
): void {
  const cards =
    tab === "todo" ? view.todo : tab === "done" ? view.done : tab === "skip" ? view.ignored : []

  vals.linkTabs = TABS.map((t) => ({
    label: t.label,
    // ★ 카드 수다. 화면이 다시 세지 않는다 — `view.counts`·`pendingCost`가 유일한 출처다 ★
    count: String(
      t.id === "cost"
        ? (pendingCost?.pending.length ?? 0)
        : t.id === "skip"
          ? view.counts.ignored
          : view.counts[t.id],
    ),
    on: tab === t.id ? "active" : "",
    pick: () => act.pickTab(t.id),
  }))
  vals.linkTabTodo = tab === "todo"
  vals.linkTabDone = tab === "done"
  vals.linkTabSkip = tab === "skip"
  vals.linkTabCost = tab === "cost"

  vals.linkEmpty = tab === "cost" ? (pendingCost?.pending.length ?? 0) === 0 : cards.length === 0
  vals.linkEmptyMsg =
    tab === "todo"
      ? "연결을 기다리는 리스팅이 없습니다."
      : tab === "done"
        ? "아직 연결한 리스팅이 없습니다."
        : tab === "skip"
          ? "무시한 리스팅이 없습니다."
          : "확인을 기다리는 원가가 없습니다. 원가 파일을 가져오면 상품에 못 붙은 행이 여기 쌓입니다."

  vals.linkRows = cards.map((c) => cardRow(c, tab, picked, act))
  costVals(vals, tab, pendingCost, act)

  // ── §21-6 ② 일괄형 ──────────────────────────────────────────────
  // "선택 N개를 **각각** 새 SKU로 등록" — 하나로 합치지 않는다. 합치는 것은
  // 서로 다른 상품을 한 SKU로 만드는 되돌리기 어려운 행위라 사람이 카드마다 본다.
  const n = [...picked].filter((k) => cards.some((c) => c.key === k)).length
  vals.linkPicked = n > 0
  vals.linkPickedLabel = `선택 ${n}개를 각각 새 SKU로 등록`
  vals.linkPickAll = () => act.toggleAll()
  vals.linkPickAllLabel = n === cards.length && n > 0 ? "선택 해제" : "모두 선택"
  vals.linkBulkNewSku = () => act.bulkNewSku()

  // 상단 안내문과 done 탭 꼬리말은 **정적 텍스트**라 `Template.tsx`에 산다 —
  // 목업 원문이 두 가지를 약속했다: "동기화"(LOCK 10 · 우리는 파일만 가져온다)와
  // "자동으로 붙습니다"(ADR-012가 보증하지 않는다). 결함 48, `DEVIATIONS`가 지킨다.
}

// ── 원가 대기 탭 (D2 · 마이그레이션 011) ─────────────────────────

/** 후보의 근거 한 줄 — %가 아니라 문장이 우선이다 (§20 규칙 2). */
function candWhy(c: PendingCostCard["candidates"][number]): string {
  if (c.via === "model") {
    // 코드 일치는 확률이 아니라 사실이다 — %를 말하지 않는다.
    return `모델 일치 「${c.shared.join(" ")}」`
  }
  return `겹침: ${c.shared.slice(0, 4).join(" · ")} — ${Math.round(c.score * 100)}%`
}

function costVals(
  vals: TemplateVals,
  tab: LinkTab,
  pc: PendingCostView | null,
  act: LinkingActions,
): void {
  if (tab !== "cost" || pc === null) {
    vals.linkCostRows = []
    vals.linkCostDismissed = []
    vals.linkCostNote = ""
    return
  }

  vals.linkCostRows = pc.pending.map((card) => ({
    title: card.title,
    meta: [
      card.model === null ? "" : `모델 ${card.model}`,
      `${won(card.amount)}원`,
      `${card.effectiveFrom}부터`,
      card.sourceName,
    ]
      .filter((x) => x !== "")
      .join(" · "),
    cands: card.candidates.map((c) => ({
      label: c.title,
      why: candWhy(c),
      // 목적지를 말한다 — SKU가 있으면 잇고, 없으면 만든다는 사실을 숨기지 않는다.
      dest: c.skuId === null ? `리스팅 ${c.listingIds.length}개 · SKU 새로 만듦` : "기존 SKU에 연결",
      // clear만 primary — 경합을 골라주면 사람은 그대로 누른다 (연결 화면 규율).
      cls: card.kind === "clear" ? "v-btn v-btn--primary" : "v-btn",
      pick: () => act.resolveCost(card, c),
    })),
    hasCands: card.candidates.length > 0,
    // 후보가 없다고 침묵하지 않는다 — 왜 없는지, 무엇을 할 수 있는지 (LOCK 6).
    noCandNote:
      card.candidates.length > 0
        ? ""
        : "닮은 리스팅이 없습니다 — 아직 안 팔았거나 다른 채널 상품입니다. 팔리면 후보가 생깁니다.",
    dismiss: () => act.dismissCost(card),
  }))

  vals.linkCostDismissed = pc.dismissed.map((d) => ({
    label: `${d.title} · ${won(d.amount)}원`,
    undo: () => act.undoDismissCost(d.id),
  }))

  // 지난 판단(다리 사전)의 크기 — «한 번 이으면 다음 파일부터 저절로»가 실제로
  // 쌓이고 있음을 말한다. 0이면 줄 자체가 없다 (빈 섹션 금지, §21-7).
  vals.linkCostNote =
    pc.resolvedCount > 0
      ? `지난 판단 ${won(pc.resolvedCount)}건 — 같은 품명은 다음 가져오기부터 저절로 붙습니다.`
      : ""
}
