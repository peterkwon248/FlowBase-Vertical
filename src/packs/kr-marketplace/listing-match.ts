/**
 * 리스팅 제목 정규화와 유사도 — **팩에 산다** (LOCK 4).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 core가 아니라 팩인가 ★
 * 여기서 하는 일은 한국 마켓 제목의 생김새를 아는 것이다 — 옵션 접미가
 * `· 색상:블랙-1개` 꼴이라는 것, 판촉 토큰(정품·무료배송)이 유사도를 오염시킨다는
 * 것. 전부 **마켓 지식**이라 `core/`에 두면 LOCK 4가 깨진다.
 *
 * core는 "제목 두 개의 닮은 정도"라는 개념조차 몰라도 된다. 연결 화면이 이
 * 모듈을 쓰고, 그 결과를 사람이 확정한다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 이건 AI가 아니다 ★
 * 결정론적 문자열 유사도다. 같은 입력에 늘 같은 답을 내고, 왜 그렇게 봤는지를
 * `shared`로 돌려준다 — 매핑 위저드가 컬럼에 하던 "추론 근거 + 확신도 + 사람
 * 확정"을 상품에 하는 것뿐이고, 어휘도 그대로 쓴다.
 *
 * ★ 자동 확정은 없다 ★
 * 이 모듈은 **점수만** 낸다. 1.0이 나와도 연결하지 않는다 — 확정의 주체는
 * 언제나 사람이고, 일치도가 그 자리를 대신할 수 없다.
 */

/** `collectListings`가 `상품명 · 옵션명`으로 이어 붙인 그 구분자. */
const TITLE_JOIN = " · "

/**
 * 유사도에서 걷어내는 판촉·규격 토큰.
 *
 * 이 낱말들은 **거의 모든 제목에 나타나** 겹쳐도 정보가 없다. 남겨두면 서로
 * 무관한 두 상품이 "정품·무료배송이 겹쳤다"는 이유로 붙는다.
 */
const NOISE = new Set([
  "정품", "무료배송", "당일발송", "무료", "배송", "국내산", "특가", "할인",
  "세트", "개입", "증정", "사은품", "공식", "공급처", "본사", "정식",
])

/**
 * ★ 구성 표기 — `N+M` 꼴만 잡는다 (ADR-026) ★
 *
 * 「1+1」은 기호가 공백으로 바뀌고(`1 1`) 홑자가 걸러져 **증발한다.** 그래서 묶음과
 * 단품의 토큰 집합이 완전히 같아지고, 두 상품이 유사도 1.000으로 붙는다.
 *
 * **왜 `N+M`만인가** — 카탈로그 실측(2026-08-21 · 제목 177개)이 그 하나만 가리켰다:
 *   `N+M` 3건 → 증발한다. 이것이 결함이다
 *   `Nin1` 31건 → **구성이 아니라 기능명**(3-in-1 충전기)이고 토큰으로 살아남는다
 *   `N개 세트` 2건 → `5개`가 토큰으로 살아남는다
 *   `N개입`·`N세트`·`묶음` 0건 → **없는 것에 규칙을 만들지 않는다**
 * 「구성 표기 일반」으로 넓히면 `3in1` 31건이 구성으로 오인돼 정상 매칭이 무너진다.
 */
const COMPOSITION_RE = /(\d+)\s*\+\s*(\d+)/

/** `1 + 1` · `1+1` → `"1+1"`. 없으면 `null`. */
function extractComposition(product: string): string | null {
  const m = COMPOSITION_RE.exec(product)
  return m ? `${m[1]}+${m[2]}` : null
}

export interface NormalizedTitle {
  readonly raw: string
  /** 옵션부를 뗀 **상품부**. 유사도는 이것만 본다. */
  readonly product: string
  /** 비교 단위. 길이 1 토큰과 잡음어는 뺐다. */
  readonly tokens: readonly string[]
  /**
   * 선언된 구성 (`"1+1"`). 없으면 `null` — **단품이라는 뜻이 아니라 «안 적혔다»이다.**
   * 그래도 `1+1` ↔ `null`은 «다름»으로 본다 (ADR-026 결정 2): 한쪽이 묶음을 명시했으면
   * 그 명시가 정보다.
   */
  readonly composition: string | null
}

/**
 * 제목을 비교 가능한 모양으로 만든다.
 *
 * ★ 옵션부를 떼는 것이 핵심이다 ★
 * `머레이 100단 … 미니팬 NS-19 · 색상:블랙-1개`에서 옵션부를 안 떼면 같은 상품의
 * 옵션들끼리는 잘 붙지만 **정작 ESM 상품과의 유사도가 옵션 노이즈만큼 깎인다.**
 * 11번가는 옵션 단위(grain=option)이고 ESM은 상품 단위라, 이 비대칭을 지우지
 * 않으면 채널 간 매칭이 구조적으로 불리해진다.
 */
export function normalizeTitle(title: string, grain: "product" | "option"): NormalizedTitle {
  // 옵션 단위 리스팅의 제목은 `상품명 · 옵션명`으로 만들어졌다 (`collectListings`).
  // 그 구성의 역이므로 첫 조각이 상품부다.
  const product = grain === "option" ? (title.split(TITLE_JOIN)[0] ?? title) : title

  // ★ 기호를 지우기 **전에** 구성을 건진다 ★ 아래 replace가 `+`를 공백으로 바꾸므로
  // 순서가 뒤집히면 영영 못 찾는다. 이 두 줄의 순서가 결함 51 그 자체였다.
  const composition = extractComposition(product)

  const tokens = product
    .toLowerCase()
    // 한글·영문·숫자만 남긴다. 괄호·슬래시·+ 같은 기호는 제목마다 제멋대로다.
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE.has(t))

  // 구성을 **토큰으로도** 넣는다 (ADR-026 결정 2). 등급만 내리고 점수를 100%로 두면
  // 화면의 두 표시가 서로를 부정한다 — 「일치도 100%인데 왜 못 고르지」가 된다.
  if (composition !== null) tokens.push(composition)

  return { raw: title, product, tokens: [...new Set(tokens)], composition }
}

export interface MatchScore {
  /** 0..1. Dice 계수 — 겹친 토큰 수를 양쪽 토큰 수의 평균으로 나눈 값. */
  readonly score: number
  /** 왜 그렇게 봤는지. 화면이 "근거 한 줄"로 쓴다. */
  readonly shared: readonly string[]
  /**
   * 구성 표기가 갈리나 (ADR-026). **점수와 다른 축이다** — 이름이 100%여도 참일 수 있고,
   * 참이면 `suggest`가 `clear`로 올리지 않는다.
   */
  readonly compositionMismatch: boolean
}

/**
 * 두 제목의 닮은 정도.
 *
 * Jaccard가 아니라 **Dice**를 쓴다 — 제목 길이가 크게 다른 경우(ESM 제목이 길고
 * 11번가가 짧은 일이 흔하다) Jaccard는 합집합이 커져 과하게 깎인다.
 */
export function similarity(a: NormalizedTitle, b: NormalizedTitle): MatchScore {
  const compositionMismatch = a.composition !== b.composition
  if (a.tokens.length === 0 || b.tokens.length === 0) {
    return { score: 0, shared: [], compositionMismatch }
  }
  const setB = new Set(b.tokens)
  const shared = a.tokens.filter((t) => setB.has(t))
  return {
    score: (2 * shared.length) / (a.tokens.length + b.tokens.length),
    shared,
    compositionMismatch,
  }
}

// ── 제안 등급 ────────────────────────────────────────────────────
//
// ★ 임계값은 실측으로 정했다 — 임의 상수가 아니다 ★
//
// 실제 리스팅 86개(11번가 44 · ESM 42)로 분포를 떴다. ESM 42개 각각에 대해
// 11번가 상품 군집 27개와의 최고 일치도를 구한 결과:
//
//   0.89×3  0.87×2   ← 상위 5
//        [간격 0.11]
//   0.76  0.74×2     ← 상위 8, 전부 margin ≥ 0.35
//        [간격 0.17] ← ★ 분포에서 가장 큰 절단 ★
//   0.57×2  0.50  0.47  0.40  0.38  0.30 …
//        [간격 0.08]
//   0.00×4
//
// **점수 하나로는 안 갈린다.** 두 가지가 더 필요했다:
//
//  ① margin (1위 − 2위) — 0.50짜리 "머레이 … 프로펠러 방향제"는 margin이 0.03이다.
//     방향제 둘이 경합해 어느 쪽인지 모른다. 점수는 중간인데 **확신은 없다.**
//  ② 겹친 토큰 수 — 하위권의 겹침은 "머레이"·"충전기"·"휴대용" **하나뿐**이다.
//     브랜드명이나 범용어 하나가 겹친 것은 신호가 아니라 잡음이다.
//     실측에서 `shared ≥ 2`가 하위 잡음을 거의 정확히 걷어냈다.
//
// ★ 규칙을 실데이터에 되먹여 확인한 결과 (2026-08-13) ★
//
//   clear      6   후보 1개 미리 선택 — 사람은 확인만
//   contested 17   후보 복수 나열 + 선택 강제
//   none      19   후보 없음 — [새 SKU로 등록]이 기본
//
// 절단점 부근에 있던 두 건(표시상 0.74, 실제로는 그보다 조금 아래)이 `contested`로
// 떨어졌다. **경계에서 흔들리면 사람에게 묻는 쪽으로 떨어지는 것이 옳은 방향이다** —
// 반대로 기울면 사람이 확인 없이 통과시킨 잘못된 연결이 남는다.
//
// 재검토 트리거: 새 채널이 붙어 카탈로그가 크게 달라지면 분포를 다시 뜬다.
// 측정 스크립트는 `tools/harness/listing-match-dist.ts`다.

/** 실측 절단점 — 분포에서 가장 큰 간격(0.74 → 0.57). */
const CLEAR_SCORE = 0.74
/** 1위와 2위가 이만큼 벌어져야 "뚜렷하다"고 본다. 상위 8개는 전부 0.35 이상이었다. */
const CLEAR_MARGIN = 0.15
/** 신호로 볼 최소 겹침. 하나짜리 겹침은 브랜드·범용어라 잡음이다. */
const MIN_SHARED = 2
/** 후보로라도 보여줄 최소 점수. */
const CANDIDATE_SCORE = 0.2

export type SuggestionKind = "clear" | "contested" | "none"

export interface Candidate {
  readonly key: string
  readonly score: number
  readonly shared: readonly string[]
  /**
   * 구성 표기가 갈리나 (ADR-026). `similarity()`가 낸 값을 그대로 나른다.
   *
   * **선택 필드로 두지 않았다.** 기본값 `false`를 주면 새 호출부가 이 질문을
   * 건너뛴 채 컴파일되고, 그러면 이 관문이 조용히 꺼진 경로가 생긴다.
   */
  readonly compositionMismatch: boolean
}

export interface Suggestion {
  /**
   * `clear`      후보 1개를 **미리 선택된 상태로** 제시 — 사람은 확인만
   * `contested`  **미리 고르지 않는다.** 사람이 고른다
   * `none`       후보 없음 — `[새 SKU로 등록]`이 기본
   *
   * ⚠ **`contested`는 후보가 하나여도 된다** (2026-08-21 · ADR-026). 전에는 「복수를
   * 나열」이 곧 정의였는데, 구성 불일치로 강등된 카드는 후보가 하나뿐이면서
   * 미리 골라지면 안 된다. 등급의 뜻은 「경합이 있다」가 아니라 **「우리가 대신
   * 고르지 않는다」**이다.
   *
   * 새 등급을 만들지 않은 것은 LOCK 6이다 — 「새 실패 상태를 발명하지 말고 기존
   * 체계에 편입한다」. 대신 **왜 강등됐는지**를 후보가 들고 간다(`caution`).
   */
  readonly kind: SuggestionKind
  readonly candidates: readonly Candidate[]
}

/**
 * 후보 목록을 등급으로 나눈다. **연결하지 않는다 — 점수만 낸다.**
 *
 * 1.0이 나와도 자동 확정은 없다. 확정의 주체는 언제나 사람이고, 일치도가 그
 * 자리를 대신할 수 없다.
 */
export function suggest(candidates: readonly Candidate[]): Suggestion {
  const sorted = [...candidates].sort((a, b) => b.score - a.score)
  const top = sorted[0]
  if (!top || top.score < CANDIDATE_SCORE || top.shared.length < MIN_SHARED) {
    return { kind: "none", candidates: [] }
  }

  /**
   * ★ 구성 불일치는 이름 유사도를 이긴다 (ADR-026) ★
   *
   * 「1+1 X」와 「X」는 이름이 같아도 **원가가 다른 다른 상품**이다. 미리 골라 주면
   * 사람은 확인만 누르고, 누르면 되돌릴 수 없다. **후보에서 지우지는 않는다** —
   * 같은 SKU로 쓸지는 사람이 정한다. 우리가 안 하는 것은 «대신 고르기»뿐이다.
   */
  const margin = top.score - (sorted[1]?.score ?? 0)
  if (top.score >= CLEAR_SCORE && margin >= CLEAR_MARGIN && !top.compositionMismatch) {
    return { kind: "clear", candidates: [top] }
  }

  // 경합이면 **미리 고르지 않는다.** 애매한 것을 골라주면 사람은 그대로 누른다.
  return {
    kind: "contested",
    candidates: sorted.filter((c) => c.score >= CANDIDATE_SCORE && c.shared.length >= MIN_SHARED).slice(0, 4),
  }
}

/**
 * 같은 상품으로 보이는 옵션 리스팅을 **묶어서 제안**한다.
 *
 * 11번가 44개가 옵션 단위라, 상품부가 같은 것끼리 묶으면 클릭 수가 상품 종수로
 * 준다. **자동 병합이 아니라 군집 제안이다** — 묶음마다 사람이 [새 SKU로 등록]을
 * 한 번 누른다.
 *
 * 묶는 기준은 유사도가 아니라 **상품부 완전 일치**다. 유사도로 묶으면 서로 다른
 * 상품이 조용히 한 SKU가 되고, 그건 사람이 눈치채기 어려운 종류의 오류다.
 */
export function clusterByProduct<T extends { title: string; grain: "product" | "option" }>(
  listings: readonly T[],
): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const l of listings) {
    const key = normalizeTitle(l.title, l.grain).product
    const b = out.get(key)
    if (b) b.push(l)
    else out.set(key, [l])
  }
  return out
}

// ── 원가 다리 — 대기 행(011) → 리스팅 군집 ──────────────────────
//
// ★ 왜 별도 진입점인가 ★
// 연결 화면의 suggest는 «카드 제목 ↔ SKU 이름»이다. 원가 대기 행은 SKU가 아직
// 없는 리스팅에도 붙어야 하므로(319 vs 35 — 커버리지 9배) 비교 대상이 **리스팅
// 제목의 상품부 군집**이고, 확정도 군집 단위다(그 군집의 리스팅 전부가 한 SKU).
// 군집 기준은 `clusterByProduct` 그대로 — 유사도가 아니라 상품부 완전 일치다.

/** 다리의 비교 대상 — 코어가 리스팅을 이 모양으로 넘긴다. */
export interface BridgeListing {
  readonly id: string
  readonly title: string
  readonly grain: "product" | "option"
  readonly skuId: string | null
}

export interface BridgeCandidate {
  /** 군집 키 (상품부). */
  readonly key: string
  /** 사람이 읽는 제목 — 군집의 상품부. */
  readonly title: string
  /** 이 군집의 리스팅 전부. 확정 시 SKU가 없으면 이들이 한 SKU가 된다. */
  readonly listingIds: readonly string[]
  /** 군집에 이미 SKU가 붙어 있으면 그 id. */
  readonly skuId: string | null
  readonly score: number
  readonly shared: readonly string[]
  /**
   * 어떻게 찾았나 — 화면 문장이 갈린다.
   * `model`이면 «모델 일치 「WT1080」»이고 %를 말하지 않는다 (§20 규칙 2 —
   * 코드 일치는 확률이 아니라 사실이다). `name`이면 겹친 토큰이 근거다.
   */
  readonly via: "model" | "name"
  /** 구성 표기가 갈리나 (ADR-026). 모델이 맞아도 이것이 이긴다 — 아래 1층 참조. */
  readonly compositionMismatch: boolean
  /** 화면이 사유 문장을 짓는 자리. `compositionMismatch`의 화면용 이름이다. */
  readonly caution: "composition" | null
}

export interface BridgeSuggestion {
  readonly kind: SuggestionKind
  readonly candidates: readonly BridgeCandidate[]
}

/**
 * 모델 코드를 비교 가능한 변형들로 쪼갠다.
 *
 * 실측 모양: `MW-DOC` · `WH-DOC / S` · `BM-330 / MK-100` (슬래시 = 병기).
 * 변형마다 토큰으로 나눠, 리스팅 제목 토큰이 **한 변형의 토큰을 전부** 품으면
 * 일치로 본다 — 「doc」 하나 겹친 것은 일치가 아니다.
 */
function modelVariants(model: string): string[][] {
  return model
    .split("/")
    .map((v) =>
      v
        .toLowerCase()
        .replace(/[^0-9a-z가-힣]+/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1),
    )
    .filter((v) => v.length > 0)
}

/**
 * 원가 대기 행 하나에 대한 후보 군집들.
 *
 * ★ 모델 정확 일치가 이름 유사도를 이긴다 ★
 * 모델 코드는 사람이 물건을 구별하려고 붙인 식별자라, 제목 문구가 아무리 달라도
 * 코드가 맞으면 같은 물건이다(cost-card 실측 메모 — «이름 유사도로 못 잡는 것을
 * 코드 일치가 잡는다»). 일치 군집이 하나면 `clear`, 복수면 `contested`다 —
 * 복수 일치는 같은 코드를 두 군집이 쓰는 것이라 사람이 갈라야 한다.
 *
 * 모델이 없거나 안 맞으면 이름 유사도로 물러난다 — 절단점(0.74/0.15/겹침 2)은
 * 실측 상수 그대로다. 재실측 없이 바꾸지 않는다.
 *
 * **연결하지 않는다 — 점수만 낸다.** 확정의 주체는 언제나 사람이다.
 */
export function prepareCostBridge(listings: readonly BridgeListing[]): {
  suggest(pending: { readonly title: string; readonly model: string | null }): BridgeSuggestion
} {
  /**
   * ★ 군집과 정규화는 **한 번만** 한다 ★
   * 대기 행마다 다시 만들면 175행 × 군집 200개의 정규화가 반복된다 — 실측으로
   * 조회가 479ms였고, 준비를 밖으로 빼면 행당 비용은 유사도 계산뿐이다.
   */
  const clusters = clusterByProduct(listings)
  const prepared = [...clusters].map(([key, members]) => ({
    key,
    members,
    norm: normalizeTitle(members[0]!.title, members[0]!.grain),
    tokens: new Set(normalizeTitle(key, "product").tokens),
    // 군집 안에 SKU가 이어진 리스팅이 있으면 그 SKU가 목적지다. 군집은 상품부
    // 완전 일치라 서로 다른 SKU가 섞여 있을 수 없다 — 있다면 사람이 이미
    // 갈라 붙인 것이므로 첫 것을 쓰지 않고 없는 것으로 둔다.
    skuId: (() => {
      const ids = [...new Set(members.map((m) => m.skuId).filter((x) => x !== null))]
      return ids.length === 1 ? ids[0]! : null
    })(),
  }))

  return {
    suggest(pending) {
      return suggestOne(pending, prepared)
    },
  }
}

function suggestOne(
  pending: { readonly title: string; readonly model: string | null },
  prepared: readonly {
    readonly key: string
    readonly members: readonly BridgeListing[]
    readonly norm: NormalizedTitle
    readonly tokens: ReadonlySet<string>
    readonly skuId: string | null
  }[],
): BridgeSuggestion {
  const a = normalizeTitle(pending.title, "product")

  const scored: BridgeCandidate[] = prepared.map((c) => {
    const s = similarity(a, c.norm)
    return {
      key: c.key,
      title: c.key,
      listingIds: c.members.map((m) => m.id),
      skuId: c.skuId,
      score: s.score,
      shared: s.shared,
      via: "name",
      compositionMismatch: s.compositionMismatch,
      caution: s.compositionMismatch ? ("composition" as const) : null,
    }
  })

  // ── 1층: 모델 정확 일치 ──────────────────────────────────────
  if (pending.model !== null && pending.model.trim() !== "") {
    const variants = modelVariants(pending.model)
    if (variants.length > 0) {
      const hits: BridgeCandidate[] = []
      scored.forEach((c, i) => {
        const titleTokens = prepared[i]!.tokens
        const hit = variants.find((v) => v.every((t) => titleTokens.has(t)))
        if (hit !== undefined) hits.push({ ...c, via: "model", shared: hit })
      })
      hits.sort((x, y) => y.score - x.score)
      /**
       * ★ 모델이 맞아도 **구성이 이긴다** (ADR-026) ★
       * 모델 코드는 «무슨 물건인가»를 가리키지 «몇 개 묶음인가»를 가리키지 않는다.
       * `1+1 COOL-10`과 `COOL-10`은 같은 물건 다른 수량이고 원가가 다르다.
       * 여기를 안 걸면 연결 화면만 고치고 원가 다리에 같은 구멍이 남는다.
       */
      if (hits.length === 1 && !hits[0]!.compositionMismatch) {
        return { kind: "clear", candidates: hits }
      }
      if (hits.length >= 1) return { kind: "contested", candidates: hits.slice(0, 4) }
    }
  }

  // ── 2층: 이름 유사도 — 기존 절단점 그대로 ────────────────────
  const s = suggest(
    scored.map((c) => ({
      key: c.key,
      score: c.score,
      shared: c.shared,
      compositionMismatch: c.compositionMismatch,
    })),
  )
  const byKey = new Map(scored.map((c) => [c.key, c]))
  return { kind: s.kind, candidates: s.candidates.map((c) => byKey.get(c.key)!) }
}
