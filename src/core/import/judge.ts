/**
 * 열 판정 — **파일이 아니라 열 단위로 «무엇을 아는가»를 말한다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 4단 (계획 A · ADR-017) ★
 *
 * ```
 * alias      별칭이 안다 + 값 신호가 어긋나지 않는다   → 자동 사용 가능
 * identity   항등식이 증명한다 (C 세션이 채운다)       → 자동 사용 가능
 * candidate  신호는 있는데 확정할 수 없다              → 반드시 사람에게 묻는다
 * unknown    아무 신호도 없다                          → 세어서 말한다 (LOCK 6)
 * ```
 *
 * ★ 이름은 좁히고, 값이 확정한다 (§20 2층) ★
 * 별칭이 유일하게 맞아도 열의 값 종류(kind)가 등록부의 기대와 어긋나면 후보로
 * 강등된다. 실측 근거: 「구매금액」은 esm 주문에서 매출이고 esm 광고에서
 * 전환매출이다 — 이름만 믿으면 광고 리포트의 전환매출이 매출로 들어간다.
 *
 * ★ v1의 판정은 화면 주석일 뿐 적재를 바꾸지 않는다 ★
 * 적재는 여전히 프로파일이 정한다. 부분 적재의 이행 경로는 즉석 적재가 아니라
 * **즉석 프로파일**이고(계획 — 행 식별 키는 증명 불가라 사람 확정이 필수),
 * 그 확정 UI가 B 세션이다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 왜 core인가 — 계획은 팩에 두자고 했다 ★
 * 색인 유도는 `MappingProfile`의 **구조**를 걷는 일이고(columnRoles가 판례),
 * 코드에 마켓 문자열이 한 글자도 없다 — 마켓 어휘는 전부 프로파일 데이터로
 * 들어온다 (LOCK 4 비저촉). core에 두면 `analyzeImport`가 이미 받는 profiles로
 * 색인을 만들 수 있어 새 매개변수·앱 배선이 0이다.
 */

import { profileVersion, type ColumnRole, type MappingProfile } from "./mapping/index.js"
import { targetSpec } from "./mapping/targets.js"
import type { ColumnSighting } from "./columns.js"

export interface AliasEntry {
  readonly header: string
  /** `field`·`item-field`·`reference-amount`일 때의 canonical target. */
  readonly target: string | null
  readonly roles: readonly ColumnRole[]
  readonly profileVersion: string
  readonly marketplaceKey: string
  readonly docType: string
}

export interface AliasIndex {
  readonly byHeader: ReadonlyMap<string, readonly AliasEntry[]>
}

/**
 * 프로파일에서 별칭 색인을 **라이브로 유도한다 — 저장 0.**
 *
 * 씨앗이 곧 프로파일이라(실측 70줄 · 헤더 41종) 별도 표를 만들면 썩는 사본이
 * 하나 생길 뿐이다. 개인 프로파일(B2)도 프로파일로 저장되므로 사용자의 답이
 * 자동으로 이 색인에 흘러든다 — **출처가 하나다.**
 *
 * ★ `columnRoles`를 재사용하지 않는 이유 (실측) ★
 * 그 함수는 열의 역할을 **병합**한다 — esm 주문의 「구매금액」은 주문의
 * `total_amount`이자 품목의 `gross_amount`인데, 병합본에는 하나만 남는다.
 * 화면의 «이 열이 무슨 역할이냐»에는 병합이 맞지만, 색인의 «이 이름이 어떤
 * 뜻들로 쓰였냐»에는 **선언 전부**가 필요하다. 질문이 달라서 걷는 길이 다르다 —
 * 여기서 선언을 직접 걷고, 마켓 문자열은 여전히 프로파일 데이터에서만 온다.
 */
export function buildAliasIndex(profiles: readonly MappingProfile[]): AliasIndex {
  const byHeader = new Map<string, AliasEntry[]>()

  for (const p of profiles) {
    const put = (raw: string | undefined, target: string | null, role: ColumnRole): void => {
      const header = (raw ?? "").trim()
      if (header === "") return
      let list = byHeader.get(header)
      if (!list) {
        list = []
        byHeader.set(header, list)
      }
      list.push({
        header,
        target,
        roles: [role],
        profileVersion: profileVersion(p),
        marketplaceKey: p.marketplaceKey,
        docType: p.docType,
      })
    }

    for (const m of p.fieldMappings) if (m.source) put(m.source, m.target, "field")
    for (const r of p.rowRouting?.routes ?? [])
      for (const m of r.fieldMappings) if (m.source) put(m.source, m.target, "field")
    for (const m of p.orderItem?.fieldMappings ?? [])
      if (m.source) put(m.source, m.target, "item-field")
    for (const c of p.sourceKey.columns ?? []) put(c, null, "source-key")
    for (const c of p.listing?.keyColumns ?? []) put(c, null, "listing-key")
    for (const c of p.listing?.titleColumns ?? []) put(c, null, "listing-title")
    if (p.rowRouting) put(p.rowRouting.column, null, "routing")
    if (p.reference) {
      put(p.reference.listingKeyColumn, null, "listing-key")
      put(p.reference.amountColumn, null, "reference-amount")
      put(p.reference.titleColumn, null, "listing-title")
    }
  }
  return { byHeader }
}

export type VerdictTier = "alias" | "identity" | "candidate" | "unknown"

export interface ColumnVerdict {
  readonly ordinal: number
  readonly header: string
  readonly tier: VerdictTier
  /** `alias`·`identity`에서만 확정된 target. 후보의 target은 `candidates`에 있다. */
  readonly target: string | null
  /** 후보 target들 — 이름이 여러 뜻으로 갈릴 때 전부 든다 (사람이 고른다). */
  readonly candidates: readonly string[]
  /** ★ 근거는 %가 아니라 문장이다 (§20 규칙 2) ★ */
  readonly sentence: string
}

export interface JudgeResult {
  readonly verdicts: readonly ColumnVerdict[]
  readonly tierCounts: Readonly<Record<VerdictTier, number>>
}

/** «어느 양식에서 그렇게 쓰나»를 사람 말로. 마켓 이름은 프로파일 데이터에서 온다. */
const usedBy = (e: AliasEntry): string => `${e.marketplaceKey}/${e.docType}`

export function judgeColumns(
  sightings: readonly ColumnSighting[],
  index: AliasIndex,
): JudgeResult {
  const verdicts: ColumnVerdict[] = []
  const tierCounts: Record<VerdictTier, number> = {
    alias: 0,
    identity: 0,
    candidate: 0,
    unknown: 0,
  }

  for (const s of sightings) {
    const entries = index.byHeader.get(s.header.trim()) ?? []
    const v = judgeOne(s, entries)
    verdicts.push(v)
    tierCounts[v.tier]++
  }
  return { verdicts, tierCounts }
}

function judgeOne(s: ColumnSighting, entries: readonly AliasEntry[]): ColumnVerdict {
  const base = { ordinal: s.ordinal, header: s.header }

  if (entries.length === 0) {
    return {
      ...base,
      tier: "unknown",
      target: null,
      candidates: [],
      sentence: "아는 양식 어디에도 없는 이름이다",
    }
  }

  const targets = [...new Set(entries.map((e) => e.target).filter((t): t is string => t !== null))]

  // 구조적 역할뿐인 이름 (행 식별 키·리스팅 키 …) — 필드로 확정할 것이 없다.
  if (targets.length === 0) {
    const roles = [...new Set(entries.flatMap((e) => e.roles))]
    return {
      ...base,
      tier: "candidate",
      target: null,
      candidates: [],
      sentence: `${entries.map(usedBy).join("·")} 양식에서 ${
        roles.includes("source-key") ? "행 식별" : "구조 역할"
      }에 쓰이는 이름이다 — 필드로는 확정하지 않는다`,
    }
  }

  /**
   * ★ 같은 이름이 여러 뜻이면 확정하지 않는다 ★
   * 실측 6건이 이 규칙의 근거다 — 「구매금액」(매출 vs 전환매출)·「영역명」(3역).
   * 전역 사전이 위험한 이유 그 자체라, 후보를 **전부 들고** 사람에게 간다.
   */
  if (targets.length > 1) {
    const bag = targets
      .map((t) => {
        const users = entries.filter((e) => e.target === t).map(usedBy)
        return `${t}(${users.join("·")})`
      })
      .join(" vs ")
    return {
      ...base,
      tier: "candidate",
      target: null,
      candidates: targets,
      sentence: `같은 이름이 양식마다 다른 뜻이다 — ${bag}. 이름만으로 못 가른다`,
    }
  }

  // 유일한 뜻 — 이제 값이 확정한다 (§20 2층).
  const target = targets[0]!
  const spec = targetSpec(target)
  const users = [...new Set(entries.filter((e) => e.target === target).map(usedBy))].join("·")

  if (spec === undefined) {
    // 등록부 밖 target은 validateProfiles가 막으므로 여기 올 수 없지만, 방어한다.
    return {
      ...base,
      tier: "candidate",
      target: null,
      candidates: [target],
      sentence: `${users} 양식이 ${target}로 쓰는데 등록부에 없는 이름이다`,
    }
  }

  if (s.kind === "null") {
    return {
      ...base,
      tier: "candidate",
      target: null,
      candidates: [target],
      sentence: `${users} 양식이 ${target}(${spec.gloss})로 쓴다 — 표본이 없어 값을 확인하지 못했다`,
    }
  }

  if (!spec.kinds.includes(s.kind)) {
    // 이름은 맞는데 값이 아니다 — 확정하면 여기서 사고가 난다.
    return {
      ...base,
      tier: "candidate",
      target: null,
      candidates: [target],
      sentence:
        `${users} 양식이 ${target}(${spec.gloss})로 쓰는 이름인데, 이 열의 값은 ` +
        `${s.kind}다(기대: ${spec.kinds.join("·")}) — 이름만 믿지 않는다`,
    }
  }

  return {
    ...base,
    tier: "alias",
    target,
    candidates: [target],
    sentence: `${users} 양식이 ${target}(${spec.gloss})로 쓴다 · 값도 ${s.kind}로 맞다`,
  }
}
