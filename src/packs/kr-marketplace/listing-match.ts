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

export interface NormalizedTitle {
  readonly raw: string
  /** 옵션부를 뗀 **상품부**. 유사도는 이것만 본다. */
  readonly product: string
  /** 비교 단위. 길이 1 토큰과 잡음어는 뺐다. */
  readonly tokens: readonly string[]
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

  const tokens = product
    .toLowerCase()
    // 한글·영문·숫자만 남긴다. 괄호·슬래시·+ 같은 기호는 제목마다 제멋대로다.
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !NOISE.has(t))

  return { raw: title, product, tokens: [...new Set(tokens)] }
}

export interface MatchScore {
  /** 0..1. Dice 계수 — 겹친 토큰 수를 양쪽 토큰 수의 평균으로 나눈 값. */
  readonly score: number
  /** 왜 그렇게 봤는지. 화면이 "근거 한 줄"로 쓴다. */
  readonly shared: readonly string[]
}

/**
 * 두 제목의 닮은 정도.
 *
 * Jaccard가 아니라 **Dice**를 쓴다 — 제목 길이가 크게 다른 경우(ESM 제목이 길고
 * 11번가가 짧은 일이 흔하다) Jaccard는 합집합이 커져 과하게 깎인다.
 */
export function similarity(a: NormalizedTitle, b: NormalizedTitle): MatchScore {
  if (a.tokens.length === 0 || b.tokens.length === 0) return { score: 0, shared: [] }
  const setB = new Set(b.tokens)
  const shared = a.tokens.filter((t) => setB.has(t))
  return {
    score: (2 * shared.length) / (a.tokens.length + b.tokens.length),
    shared,
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
}

export interface Suggestion {
  /**
   * `clear`      후보 1개를 **미리 선택된 상태로** 제시 — 사람은 확인만
   * `contested`  후보 복수를 나열하고 **선택을 강제** — 미리 고르지 않는다
   * `none`       후보 없음 — `[새 SKU로 등록]`이 기본
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

  const margin = top.score - (sorted[1]?.score ?? 0)
  if (top.score >= CLEAR_SCORE && margin >= CLEAR_MARGIN) {
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
