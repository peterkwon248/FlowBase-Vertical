/**
 * 프로파일 선언의 **자기 정합성** 검사 — 파일을 보기 전에, 프로파일만 보고 답한다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 이 규칙 하나가 침묵 넷을 닫는가 (2026-08-15) ★
 *
 * `sourceKey.columns` · `rowRouting.column` · `listing.keyColumns`는 셋 다
 * **`requiredHeaders`와 아무 관계가 없다.** 그래서 그 컬럼이 파일에 없어도
 * 프로파일은 여전히 매칭되고, 그 뒤에 **각자 다르게 조용히 무너진다**:
 *
 * ```
 * sourceKey 컬럼 없음   → 그 자리가 ""         → UPSERT가 서로 다른 행을 합친다
 * rowRouting 컬럼 없음  → 라우팅 블록 통째 skip → knownValues 가드조차 안 돈다
 *                                                 (ESM이면 클레임이 전부 매출로)
 * listing 키 컬럼 없음  → collectListings가 return → 리스팅·품목 0, 제외 0
 * ```
 *
 * 셋을 각자 고치면 세 벌의 방어가 생기고 언젠가 갈린다. **상류에 불변식 하나를
 * 세우면 셋이 애초에 성립하지 않는다** — 어길 경로를 없애는 쪽이다.
 *
 * ★ 지금까지 안 터진 이유는 «우연히 겹쳐 있어서»다 ★
 * 그리고 그 우연은 이미 두 프로파일에서 깨져 있었다 (`coupang-order@1`의
 * 「주문번호」· `11st-settlement@1`의 「상품번호」「옵션명」). 규칙이 아니라
 * 운이었다는 증거가 저장소 안에 있었던 셈이다.
 *
 * ★ 왜 가져오기 시점이 아니라 로드 시점인가 ★
 * 프로파일 결함은 **사용자의 잘못이 아니다.** 가져오기 중에 터뜨리면 사용자가
 * 남의 잘못을 «내 파일이 문제인가»로 만난다. 프로파일이 들어오는 문
 * (`loadProfiles`)에서 막고, 하네스처럼 프로파일을 직접 명시하는 경로는
 * `tests/profile-registry.test.ts`가 디스크의 전 프로파일을 돌아 막는다.
 * ─────────────────────────────────────────────────────────────
 *
 * **LOCK 4** — 이 파일에 마켓 어휘가 없다. 선언된 컬럼 이름끼리만 대조한다.
 */

import type { MappingProfile } from "./index.js"

/** 프로파일 하나의 결함. `where`는 어느 선언이 어겼는지다. */
export interface ProfileDefect {
  readonly where: "sourceKey" | "rowRouting" | "listing" | "reference"
  /** `requiredHeaders`에 없는 컬럼 이름들. **개수가 아니라 이름을 준다.** */
  readonly columns: readonly string[]
  /** 사람이 읽는 한 줄. 프로파일을 고치는 사람이 읽는다. */
  readonly reason: string
}

/**
 * 헤더 이름 비교는 **언제나 trim한다.** `mapRows`의 인덱스(`index.set(h.trim())`)와
 * `columnRoles`가 이미 그렇게 하므로, 여기서만 다르면 «검증은 통과했는데 조회는
 * 실패»가 된다.
 */
const norm = (s: string): string => s.trim()

/**
 * 프로파일이 **키·라우팅·리스팅 키로 선언한 컬럼**이 전부 `requiredHeaders`에
 * 있는지 본다. 없으면 그 컬럼이 빠진 파일에서 조용히 무너지는 자리다.
 *
 * 빈 배열이면 정합이다.
 */
export function validateProfile(p: MappingProfile): readonly ProfileDefect[] {
  const required = new Set((p.recognitionRules?.requiredHeaders ?? []).map(norm))
  const out: ProfileDefect[] = []

  const missing = (cols: readonly string[]): string[] =>
    cols.map(norm).filter((c) => c !== "" && !required.has(c))

  /**
   * `content` 전략은 **행 전체가 키**라 특정 컬럼에 기대지 않는다 — 검사 대상이
   * 아니다. 여기에 규칙을 걸면 43열짜리 광고 보고서의 전 컬럼을
   * `requiredHeaders`에 적으라는 말이 된다.
   */
  if (p.sourceKey?.strategy === "natural") {
    const bad = missing(p.sourceKey.columns ?? [])
    if (bad.length > 0) {
      out.push({
        where: "sourceKey",
        columns: bad,
        reason:
          `행 식별 키로 쓰는 컬럼이 requiredHeaders에 없다 — 이 컬럼이 빠진 파일도 ` +
          `프로파일에 매칭되고, 그때 키의 그 자리가 빈 문자열이 되어 ` +
          `서로 다른 행이 UPSERT로 합쳐진다`,
      })
    }
  }

  if (p.rowRouting !== undefined) {
    const bad = missing([p.rowRouting.column])
    if (bad.length > 0) {
      out.push({
        where: "rowRouting",
        columns: bad,
        reason:
          `행 분기에 쓰는 컬럼이 requiredHeaders에 없다 — 이 컬럼이 빠지면 라우팅 ` +
          `판정 자체가 건너뛰어져 knownValues 가드도 돌지 않고, 모든 행이 조용히 ` +
          `기본 경로로 간다 (ADR-010의 보증이 무력화된다)`,
      })
    }
  }

  if (p.listing !== undefined) {
    const bad = missing(p.listing.keyColumns ?? [])
    if (bad.length > 0) {
      out.push({
        where: "listing",
        columns: bad,
        reason:
          `리스팅 키로 쓰는 컬럼이 requiredHeaders에 없다 — 이 컬럼이 빠지면 ` +
          `리스팅 수집이 통째로 중단되어 리스팅·품목이 0이 되는데, 가져오기는 ` +
          `«성공»으로 끝나고 제외도 0으로 표시된다`,
      })
    }
  }

  /**
   * 기준 데이터 양식도 **같은 규율**을 받는다 — 열이 빠지면 조용히 0건이 되고
   * 가져오기는 «성공»으로 끝난다. Fact 쪽 셋과 정확히 같은 사고다.
   */
  if (p.reference !== undefined) {
    const bad = missing([p.reference.listingKeyColumn, p.reference.amountColumn])
    if (bad.length > 0) {
      out.push({
        where: "reference",
        columns: bad,
        reason:
          `기준 데이터의 상품 열·금액 열이 requiredHeaders에 없다 — 이 컬럼이 빠지면 ` +
          `붙일 상품을 못 찾거나 금액이 비어 **원가가 하나도 안 들어가는데** ` +
          `가져오기는 «성공»으로 끝난다`,
      })
    }
  }

  return out
}

/** 여러 프로파일을 한 번에. 결함이 있는 것만 담긴다. */
export function validateProfiles(
  profiles: readonly MappingProfile[],
): ReadonlyMap<string, readonly ProfileDefect[]> {
  const out = new Map<string, readonly ProfileDefect[]>()
  for (const p of profiles) {
    const d = validateProfile(p)
    if (d.length > 0) out.set(profileLabel(p), d)
  }
  return out
}

/** 오류 문구에 쓸 이름. `profileVersion`과 같은 모양이되 여기서는 파일 식별용이다. */
export function profileLabel(p: MappingProfile): string {
  return `${p.marketplaceKey}/${p.docType}/${p.grain}@${p.version}`
}

/** 검증 결과를 사람이 읽는 여러 줄로. 던질 때도 로그할 때도 같은 문장을 쓴다. */
export function formatDefects(
  byProfile: ReadonlyMap<string, readonly ProfileDefect[]>,
): string {
  return [...byProfile]
    .map(([name, defects]) =>
      defects
        .map((d) => `  ${name} · ${d.where}: 「${d.columns.join("」「")}」 — ${d.reason}`)
        .join("\n"),
    )
    .join("\n")
}
