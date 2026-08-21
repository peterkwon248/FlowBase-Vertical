/**
 * **커버리지 — 부재를 일급으로 다룬다** (§22).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 «지표가 입력을 선언»하는가 ★
 *
 * 처음 안은 마켓이 «필요 서류»를 선언하는 것이었다 — `requires: [{ docType, required }]`.
 * 뒤집었다. 서류에 `required`를 달면 **앱이 사용자에게 숙제를 내는 구조**가 된다.
 * 안 낸 서류가 생기고, 광고를 하지 않는 셀러의 화면에는 영원히 빨간 칸이 남는다.
 *
 * 방향을 뒤집으면 같은 사실이 *"이 지표를 열려면 이것이 필요하다"*가 된다.
 * 광고를 안 하는 셀러에게 `ad`는 **잠긴 지표**일 뿐 **결핍이 아니다** — 그리고
 * 잠긴 지표는 조용하다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 문장을 만들지 않는다 ★ (`pnlGaps`와 갈라지는 자리)
 * `pnlGaps`는 core에서 문장까지 만든다. 그 문장들이 **마켓 중립**이기 때문이다 —
 * *"정산 N건이 주문에 이어지지 않는다"*. 커버리지 문장은 그럴 수 없다:
 * *"**11번가 주문 파일**을 넣으면 열립니다"*에는 마켓 통칭이 들어간다.
 *
 * LOCK 4가 core에 마켓 어휘를 금지하므로 **여기서는 구조만 낸다.** 문장은
 * 팩의 사전(`packs/kr-marketplace/markets/*.json`)과 합쳐 화면이 만든다.
 * `displayName`이 프로파일에 사는 것과 같은 원리다.
 */

/**
 * 문서의 성격. **마켓 이름이 아니다** — 어느 마켓이든 이 넷 중 하나로 들어온다.
 *
 * `cost`만 파일이 아니라 사람이 넣는다. 마켓은 매입원가를 주지 않기 때문이고,
 * 그래서 «파일을 넣으세요»가 아니라 «원가를 입력하세요»로 갈린다.
 */
export type DocType = "order" | "settlement" | "ad" | "cost"

export const DOC_TYPES: readonly DocType[] = ["order", "settlement", "ad", "cost"]

/** 손익 3층 어휘. 여기 없는 지표는 커버리지가 판정하지 않는다. */
export type MetricId = "revenue" | "quantity" | "fee" | "ad-spend" | "cogs" | "contribution"

export interface MetricSpec {
  readonly id: MetricId
  /** 화면이 쓰는 이름. 마켓 중립이라 core에 둘 수 있다. */
  readonly label: string
  /** 이 지표가 요구하는 입력. **하나라도 없으면 잠긴다.** */
  readonly requires: readonly DocType[]
}

/**
 * 손익 3층이 요구하는 입력 (`CLAUDE.md`의 3층 정의를 그대로 따른다).
 *
 * ★ `contribution`이 `ad`를 요구하지 않는 이유 ★
 * 3층 정의상 상품 기여이익은 직접 광고비를 뺀다. 그러나 `ad`를 요구 목록에 넣으면
 * **광고를 하지 않는 셀러가 기여이익을 영원히 못 연다.** 광고비는 자기 지표
 * (`ad-spend`)로 따로 잠기고, 없으면 0으로 계산된다 — 광고를 안 하는 셀러에게 그
 * 0은 **정답**이다. 광고를 하는데 파일을 안 넣은 경우를 앱이 알아낼 방법은 없고,
 * 추측해서 경고하면 그게 바로 숙제 검사다 (§22 금지 조항).
 */
export const PNL_METRICS: readonly MetricSpec[] = [
  { id: "revenue", label: "매출", requires: ["order"] },
  { id: "quantity", label: "판매 수량", requires: ["order"] },
  { id: "fee", label: "수수료", requires: ["settlement"] },
  { id: "ad-spend", label: "광고비", requires: ["ad"] },
  { id: "cogs", label: "매입원가", requires: ["cost"] },
  { id: "contribution", label: "상품 기여이익", requires: ["order", "settlement", "cost"] },
]

/**
 * 잠긴 값의 크기를 계산할 재료. **아는 것만 담는다** — 없으면 크기를 말하지 않는다.
 *
 * 지금 담긴 것은 하나뿐이다: 정산 파일이 말하는 판매금액합계. 주문 파일이 없으면
 * 그 금액은 **매출로 인식되지 못한 채** 정산 표에만 앉아 있다 (ADR-009 ① — 매출은
 * 정산일이 아니라 주문의 `ordered_at` 달에 귀속된다). 그 크기가 곧 «잠긴 매출»이다.
 */
export interface CoverageEvidence {
  readonly settlementGross: number
  /**
   * ★ 갖췄지만 **일부만** 갖춘 입력 — 「원가 236/261」 (ADR-023 확인 ②) ★
   *
   * 여기 **없는** docType은 «완전»이 아니라 **«완전성을 잴 수 없다»**이다. 주문
   * 파일이 몇 개여야 하는지 앱은 알 길이 없다 — 셀러가 이번 달에 파일을 셋 받는지
   * 넷 받는지는 앱 밖의 사실이다. 오늘 분모를 아는 것은 `cost` 하나뿐이고(연결에
   * 붙은 SKU 수), 그래서 이 자리는 **아는 것만** 채운다 (`lockedValue`와 같은 규율).
   *
   * 부재(`held`에 없음)와 **다른 축**이다: 부재는 문을 잠그고, 부분은 문을 열되
   * 말하게 한다. 접으면 §22의 각주(「부재는 boolean이 아니다」)를 어긴다.
   */
  readonly partial?: PartialInputs
}

/** docType별 «갖춘 것 / 갖춰야 할 것». 분모를 아는 성격만 들어온다. */
export type PartialInputs = Readonly<Partial<Record<DocType, { readonly have: number; readonly need: number }>>>

/** 열려 있는 지표가 «이만큼 비었다»고 말할 재료. 화면이 문장을 만든다 (LOCK 4). */
export interface PartialInput {
  readonly docType: DocType
  readonly have: number
  readonly need: number
  /** 모자란 수. `need - have`를 화면마다 다시 빼지 않게 여기서 낸다. */
  readonly short: number
}

export interface CoverageEntry {
  readonly metric: MetricId
  readonly label: string
  readonly open: boolean
  /** 잠금 해제 조건 — 지금 없어서 잠긴 입력들. 열려 있으면 빈 배열. */
  readonly missing: readonly DocType[]
  /**
   * 잠긴 값의 크기. **계산할 수 있을 때만 숫자다.**
   * `null`은 «0»이 아니라 «모른다»이고, 화면은 지표 이름만 말해야 한다 (A-5).
   */
  readonly lockedValue: number | null
  /**
   * ★ 열려 있지만 **일부만 갖춘** 입력들 (ADR-023 확인 ②가 §22-3 ①을 뒤집었다) ★
   *
   * 옛 규칙은 «원가는 전부여야 열린다»였다 — 236/261이면 잠갔다. 그것은 100%짜리
   * **비율 절단점**이고, 부분을 «없음»으로 접는다. 지금은 **열되 이 배열로 말한다.**
   * 잠긴 지표(`open === false`)에서는 늘 비어 있다 — 잠긴 것에 대고 «일부 있다»를
   * 덧붙이면 화면이 두 말을 한다.
   */
  readonly partial: readonly PartialInput[]
}

export interface Coverage {
  readonly held: readonly DocType[]
  readonly entries: readonly CoverageEntry[]
  /** 하나라도 잠긴 것이 있는가 — 화면이 «완결»을 말할 수 있는지의 근거. */
  readonly hasLocked: boolean
  /**
   * 열렸는데 **비어 있는** 것이 하나라도 있는가. `hasLocked`와 따로 두는 이유는
   * 처방이 다르기 때문이다 — 잠김은 «파일을 넣으세요», 부분은 «이 숫자는 지금
   * 실제보다 큽니다». 하나로 접으면 화면이 엉뚱한 안내를 한다.
   */
  readonly hasPartial: boolean
}

/**
 * 보유 집합과 지표 요구를 맞춰 본다. **조회하지 않는다** — 넘겨받은 것만 본다.
 *
 * `held`에 무엇이 들어가는지(어느 batch가 어느 docType인지)는 팩 사전을 아는
 * 호출자가 정한다. 여기서 `mapping_version` 문자열을 파싱하면 core가 팩의 명명
 * 규칙을 알게 되고, 그 순간 LOCK 4의 경계가 흐려진다.
 */
export function coverage(
  held: readonly DocType[],
  evidence: CoverageEvidence,
  metrics: readonly MetricSpec[] = PNL_METRICS,
): Coverage {
  const have = new Set(held)

  const entries = metrics.map((m): CoverageEntry => {
    const missing = m.requires.filter((d) => !have.has(d))
    const open = missing.length === 0
    return {
      metric: m.id,
      label: m.label,
      open,
      missing,
      lockedValue: lockedSize(m.id, missing, have, evidence),
      // 잠긴 지표에는 부분을 달지 않는다 — 문이 닫힌 것에 대고 «이만큼 찼다»를
      // 말하면 화면이 두 말을 한다. 열린 것만 «이만큼 비었다»를 말한다.
      partial: open ? shortfalls(m.requires, evidence.partial) : [],
    }
  })

  return {
    held: DOC_TYPES.filter((d) => have.has(d)),
    entries,
    hasLocked: entries.some((e) => !e.open),
    hasPartial: entries.some((e) => e.partial.length > 0),
  }
}

/**
 * 이 지표가 요구하는 입력 중 **덜 갖춰진 것**만 골라 낸다.
 *
 * `have >= need`면 아무것도 안 낸다 — 「35/35」를 부분이라 부르면 완전한 것을
 * 결핍처럼 그린다. `need === 0`도 마찬가지다: 붙은 SKU가 하나도 없으면 «원가를
 * 덜 넣었다»가 아니라 **넣을 자리가 아직 없다**는 뜻이고, 그 처방은 상품 연결이지
 * 원가 입력이 아니다 (`cogs-unlinked`가 그쪽을 이미 말한다).
 */
function shortfalls(requires: readonly DocType[], partial: PartialInputs | undefined): readonly PartialInput[] {
  if (partial === undefined) return []
  const out: PartialInput[] = []
  for (const d of requires) {
    const p = partial[d]
    if (p === undefined || p.need <= 0 || p.have >= p.need) continue
    out.push({ docType: d, have: p.have, need: p.need, short: p.need - p.have })
  }
  return out
}

/**
 * 이 성격의 문서가 **열어 준** 지표들 — 다이제스트 한 줄이 쓴다 (§22-4).
 *
 * «방금 이 파일 때문에 열렸나»를 묻지 않고 «지금 열려 있고 이 문서를 요구하나»를
 * 묻는다. 전후 비교를 들고 다니지 않아도 되고, 같은 파일을 다시 넣어도 문장이
 * 참이다 — 그 지표가 열려 있는 것은 여전히 이 파일 덕이기 때문이다.
 */
export function openedBy(
  cov: Coverage,
  dt: DocType,
  metrics: readonly MetricSpec[] = PNL_METRICS,
): readonly string[] {
  return cov.entries
    .filter((e) => e.open && (metrics.find((m) => m.id === e.metric)?.requires.includes(dt) ?? false))
    .map((e) => e.label)
}

/**
 * 잠긴 값의 크기 — **계산 가능한 경우만.**
 *
 * 오늘 계산 가능한 경우는 하나다: **주문이 없어 매출이 잠겼는데 정산은 있는** 경우.
 * 정산 파일의 판매금액합계가 곧 인식되지 못한 매출의 크기다.
 *
 * 나머지는 전부 `null`이다. 예컨대 «수수료가 잠겼다»의 크기는 정산 파일이 없다는
 * 뜻이므로 **아무 데이터도 없어** 계산할 길이 없다. 여기서 추정치를 지어내면
 * 화면이 모르는 것을 아는 척한다 (헌장 A-5).
 */
function lockedSize(
  id: MetricId,
  missing: readonly DocType[],
  have: ReadonlySet<DocType>,
  ev: CoverageEvidence,
): number | null {
  if (missing.length === 0) return null
  if (id === "revenue" && missing.includes("order") && have.has("settlement")) {
    return ev.settlementGross > 0 ? ev.settlementGross : null
  }
  return null
}
