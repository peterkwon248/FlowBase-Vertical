/**
 * 원가 — **숫자 하나가 아니라 시계열이다** (인계 문서 §5 · 001의 `cost_history`).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 파일의 전부는 규칙 한 줄이다 ★
 *
 * ```
 * 판매일 이전(포함) 중 가장 늦은 이력을 쓴다. 없으면 «미상»이고, 미상은 0이 아니다.
 * ```
 *
 * 뒤 문장이 이 파일이 존재하는 이유다. 원가가 없는 SKU에 0을 넣으면 **그 상품의
 * 기여이익이 매출 전액**이 되고, 화면은 «원가를 안 넣었다»가 아니라 «엄청 남는
 * 상품»이라고 말한다. §22가 «부재를 0으로 바꾸지 않는다»라고 한 것의 계산기판이고,
 * 커버리지가 «원가는 하나라도가 아니라 전부여야 열린다»고 한 것과 같은 판단이다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 원가는 조정이 아니다 (§15와 갈리는 자리) ★
 * 조정(`adjustment`)은 **마켓이 준 사실을 우리가 고치는 것**이라 원본 위에 스택으로
 * 쌓이고 원본을 건드리지 않는다 (LOCK 3). 원가는 마켓이 애초에 주지 않는 값이라
 * 고칠 원본이 없다 — **기준 데이터**이고, 기준 데이터는 «수동 편집 + 변경 이력»이
 * 정상 경로다 (CLAUDE.md 데이터 3종). 그래서 원가를 조정 레이어에 태우지 않는다.
 * 태우면 «원본 없는 조정»이 생겨 대사(원본끼리만 비교)의 전제가 무너진다.
 *
 * ★ 마켓을 모른다 ★ (LOCK 4) — 원가에는 마켓 어휘가 필요 없다. SKU는 우리 것이다.
 */

/** 001의 `CHECK (kind IN (…))`와 같은 순서·같은 값. 여기가 그 CHECK의 타입판이다. */
export const COST_KINDS = ["COGS", "PACKAGING", "LOGISTICS", "OTHER"] as const

export type CostKind = (typeof COST_KINDS)[number]

/** 화면이 쓰는 이름. 마켓 중립이라 core에 둘 수 있다 (`PNL_METRICS.label`과 같은 판단). */
export const COST_KIND_LABEL: Readonly<Record<CostKind, string>> = {
  COGS: "매입원가",
  PACKAGING: "포장비",
  LOGISTICS: "물류비",
  OTHER: "기타",
}

export interface CostEntry {
  readonly kind: CostKind
  /** 원 단위 정수. 부동소수 금지 (001). */
  readonly amount: number
  /** 적용 시작일 `YYYY-MM-DD`. */
  readonly effectiveFrom: string
  readonly note: string | null
  readonly enteredAt: string
  readonly enteredBy: "user" | "import"
}

/**
 * **그 날짜에 유효한 원가.** 없으면 `null` — «0원»이 아니라 «모른다»다.
 *
 * ★ 문자열로 비교한다 ★
 * `on`이 `2026-07-31T16:41:20`처럼 시각을 달고 올 수 있다(`fact_order.ordered_at`).
 * ISO 8601은 사전순이 곧 시간순이므로 `"2026-07-31" <= "2026-07-31T16:41:20"`이
 * 참이고, 그날 등록한 원가가 그날 주문에 제대로 걸린다. `Date`로 파싱하면 실행
 * 기기의 시간대가 끼어들어 하루가 어긋난다 (ADR-002 · `range-boundary`가 이미
 * BETWEEN에서 같은 함정을 잡았다).
 *
 * 동률(같은 `effective_from`이 둘)은 **일어날 수 없다** — 001의
 * `UNIQUE (library_id, sku_id, kind, effective_from)`가 막는다. 그래서 «마지막 것을
 * 쓴다» 같은 임의 규칙을 두지 않는다.
 */
export function costAt(
  history: readonly CostEntry[],
  kind: CostKind,
  on: string,
): number | null {
  let best: CostEntry | null = null
  for (const e of history) {
    if (e.kind !== kind) continue
    if (e.effectiveFrom > on) continue // 아직 적용 전인 원가는 과거 주문에 쓰지 않는다
    if (best === null || e.effectiveFrom > best.effectiveFrom) best = e
  }
  return best === null ? null : best.amount
}

/**
 * 같은 규칙의 **SQL판.** 집계는 SQL에 위임해야 하는데(LOCK 5) 그렇다고 규칙을
 * 두 번 적으면 두 벌이 된다 — 되돌리기 버튼의 3상태를 «같은 신호를 세어» 만든 것과
 * 같은 문제다.
 *
 * 그래서 **규칙을 여기 한 번만 적고** 컬럼 이름만 받는다. `ORDER BY … DESC LIMIT 1`이
 * 이 저장소 어디에도 또 나오지 않는 것이 이 함수가 지키는 성질이고,
 * `tests/cost.test.ts`가 두 답을 **직접 대조**한다.
 *
 * 인자는 전부 **SQL 식**이다(컬럼 참조 · 바인딩 `?` · 리터럴). 사용자 입력을
 * 여기로 넣지 않는다 — 값은 `?`로 바인딩해서 넘긴다.
 */
export function costAtSql(col: {
  readonly libraryId: string
  readonly skuId: string
  readonly kind: string
  readonly on: string
}): string {
  return (
    `(SELECT c.amount FROM cost_history c` +
    ` WHERE c.library_id = ${col.libraryId} AND c.sku_id = ${col.skuId}` +
    ` AND c.kind = ${col.kind} AND c.effective_from <= ${col.on}` +
    ` ORDER BY c.effective_from DESC LIMIT 1)`
  )
}

// ─────────────────────────────────────────────────────────────
// 입력 검증 — 화면이 저장을 부르기 전에 통과해야 하는 것
// ─────────────────────────────────────────────────────────────

export type CostInputProblem =
  | "amount-empty"
  | "amount-not-number"
  | "amount-negative"
  | "amount-not-integer"
  | "date-empty"
  | "date-malformed"

/** 사람이 읽는 사유. 화면이 문장을 지어내지 않도록 여기서 준다. */
export const COST_PROBLEM_TEXT: Readonly<Record<CostInputProblem, string>> = {
  "amount-empty": "금액을 넣어 주세요",
  "amount-not-number": "숫자로 넣어 주세요",
  "amount-negative": "원가는 0보다 작을 수 없습니다",
  "amount-not-integer": "원 단위 정수로 넣어 주세요",
  "date-empty": "적용 시작일을 넣어 주세요",
  "date-malformed": "날짜는 YYYY-MM-DD 형식입니다",
}

export interface CostDraft {
  /** 사람이 친 그대로. 쉼표·공백·«원»이 섞여 들어온다. */
  readonly amount: string
  readonly effectiveFrom: string
}

export type CostParse =
  | { readonly ok: true; readonly amount: number; readonly effectiveFrom: string }
  | { readonly ok: false; readonly problems: readonly CostInputProblem[] }

/**
 * 초안 → 저장 가능한 값. **문제를 전부 모아서 돌려준다** — 하나씩 튕기면 사용자가
 * 같은 칸을 세 번 고치게 된다.
 *
 * ★ `amount >= 0`이지 `> 0`이 아니다 ★
 * 0원 원가는 실재한다 — 증정품·샘플·사은품이 그렇다. 0을 막으면 사용자는 1원을
 * 넣게 되고, 그 1원은 영원히 남는 거짓이 된다. 반대로 **음수는 막는다**: 음수 원가는
 * 뜻이 없고(환급이면 그건 원가가 아니라 다른 사실이다) 그대로 기여이익을 부풀린다.
 */
export function parseCostDraft(d: CostDraft): CostParse {
  const problems: CostInputProblem[] = []

  // 쉼표는 사람이 읽기 위한 것이라 걷어낸다. 「12,000원」·「 12000 」 전부 받는다.
  const raw = d.amount.replace(/[,\s원]/g, "")
  let amount = 0
  if (raw === "") {
    problems.push("amount-empty")
  } else if (!/^[+-]?\d+(\.\d+)?$/.test(raw)) {
    problems.push("amount-not-number")
  } else {
    amount = Number(raw)
    if (amount < 0) problems.push("amount-negative")
    // 원 단위 정수다 (001의 `amount INTEGER`). 반올림해서 받아주면 사용자가 넣은
    // 값과 저장된 값이 달라지고, 그 차이는 아무 데도 안 적힌다.
    else if (!Number.isInteger(amount)) problems.push("amount-not-integer")
  }

  const from = d.effectiveFrom.trim()
  if (from === "") problems.push("date-empty")
  else if (!isCalendarDate(from)) problems.push("date-malformed")

  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, amount, effectiveFrom: from }
}

/**
 * `YYYY-MM-DD`이고 **달력에 실재하는 날**인가.
 *
 * 형식만 보면 `2026-02-31`이 통과하고, 그 값은 `effective_from <= ordered_at`
 * 비교에서 조용히 3월 1일 이후로 행세한다 — 원가가 엉뚱한 달부터 적용된다.
 * `Date.UTC`로 되짚어 확인한다 (로컬 시간대를 태우지 않는다 · ADR-002).
 */
export function isCalendarDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}
