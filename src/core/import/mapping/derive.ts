/**
 * 개인 프로파일 파생 — **사용자의 확정이 프로파일이 되는 자리** (계획 B2).
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 «파생»인가 — 부분 적재의 이행 경로 ★
 *
 * 판정 4단(ADR-017)의 후보는 **반드시 사람을 지난다.** 그 사람의 답을 어디에
 * 남기나 — 즉석 적재가 아니라 **즉석 프로파일**이다: 행 식별 키 없는 적재는
 * 재가져오기마다 중복을 쌓고(ADR-006), 키의 유일성을 «증명»할 항등식은 없다.
 * 그래서 사용자의 답은 기존 프로파일의 **파생판**으로 저장되고, 적재는 기존
 * `runImport`가 한다. 적재기를 새로 만들지 않는다.
 *
 * ★ v1 컷 라인 — 고칠 수 있는 것은 셋뿐 ★
 *
 * ```
 * 허용   fieldMappings의 target 교체 · 미매핑 열에 target 부여 · «쓰지 않음»
 * 거부   sourceKey · rowRouting · signPolicy · blockRead · orderItem · listing
 * ```
 *
 * 거부하는 이유는 각각 다르지만 뿌리는 하나다 — **그 선언들은 값 하나가 아니라
 * 적재의 구조를 바꾼다.** 행 식별 키를 바꾸면 기존 batch와 새 batch가 서로를
 * 못 알아보고(UPSERT 키가 갈린다), 행 갈래를 바꾸면 같은 행이 다른 표로 간다.
 * 그런 변경이 필요한 날은 «백지 신규 양식»과 같은 트리거다 (§20).
 * ─────────────────────────────────────────────────────────────
 *
 * LOCK 4 — 여기에 마켓 어휘는 없다. 어느 열이 무엇인지는 프로파일(팩)과
 * 사용자의 답이 들고 오고, 이 모듈은 둘을 합칠 뿐이다.
 */

import type { FieldMapping, MappingProfile } from "./index.js"
import { columnRoles } from "./index.js"
import { targetSpec } from "./targets.js"

/**
 * 초안 — 헤더별로 사용자가 고른 것. `null` = «이 열은 쓰지 않음».
 *
 * 점수·tier는 여기 없다 — 초안은 **사람의 답**이지 판정의 산물이 아니다.
 * (`resolvePendingCost`가 점수를 인자로 받지 않는 것과 같은 규율.)
 */
export type MappingDraft = ReadonlyMap<string, string | null>

export type DeriveResult =
  | { readonly ok: true; readonly profile: MappingProfile }
  | { readonly ok: false; readonly why: string }

/**
 * 이 헤더를 여기서 고칠 수 있는가. **`field` 역할뿐인 열과 아무 역할 없는 열만.**
 *
 * `rowRouting.routes` 안의 매핑도 `field` 역할로 잡히지만 그 편집은 «어느
 * 갈래의 매핑인가»를 물어야 해서 v1 밖이다 — 갈래 정보는 `columnRoles`가
 * 뭉개므로, 라우팅이 있는 프로파일은 최상위 `fieldMappings`에 있는 열만 허용한다.
 */
export function editableHeaders(profile: MappingProfile): {
  readonly canEdit: (header: string) => boolean
  readonly whyNot: (header: string) => string
} {
  const use = columnRoles(profile)
  const topLevel = new Set(
    profile.fieldMappings.filter((m) => m.source !== undefined).map((m) => m.source?.trim()),
  )
  const routed = new Set<string>()
  for (const r of profile.rowRouting?.routes ?? [])
    for (const m of r.fieldMappings) if (m.source !== undefined) routed.add(m.source.trim())

  const canEdit = (header: string): boolean => {
    const u = use.byColumn.get(header.trim())
    if (u === undefined) return true // 아무 역할 없음 — target 부여 가능
    if (u.roles.some((r) => r !== "field")) return false // 구조 역할이 섞여 있다
    // field 역할뿐이라도 라우팅 갈래에서만 쓰이면 v1 밖이다.
    if (!topLevel.has(header.trim()) && routed.has(header.trim())) return false
    return true
  }
  const whyNot = (header: string): string => {
    const u = use.byColumn.get(header.trim())
    if (u === undefined) return ""
    if (u.roles.includes("source-key"))
      return "행 식별 키를 구성한다 — 바꾸면 기존 데이터와 새 데이터가 서로를 못 알아본다"
    if (u.roles.includes("routing")) return "행이 어느 표로 갈지 정한다 — 여기서 고칠 수 없다"
    if (u.roles.includes("listing-key") || u.roles.includes("listing-title"))
      return "상품 연결의 식별·제목이다 — 여기서 고칠 수 없다"
    if (u.roles.includes("reference-amount")) return "기준 데이터의 값이다 — 여기서 고칠 수 없다"
    if (u.roles.includes("item-field")) return "품목 표의 매핑이다 — 여기서 고칠 수 없다"
    if (routed.has(header.trim()) && !topLevel.has(header.trim()))
      return "행 갈래 안의 매핑이다 — 여기서 고칠 수 없다"
    return ""
  }
  return { canEdit, whyNot }
}

/**
 * 프로파일 + 초안 → 파생 프로파일. **순수 함수 — 저장하지 않는다.**
 *
 * 버전은 건드리지 않는다 — `u1`·`u2` 부여는 저장하는 쪽(`saveUserProfile`)의
 * 일이다. 여기서 지어내면 「다음 번호가 무엇인가」의 진실이 두 곳이 된다.
 *
 * ★ 교체 매핑은 소박하다 ★ target을 바꾸면 `valueMap`·`signPolicy`·`derive`를
 * 승계하지 않는다 — 그 선언들의 뜻은 옛 target에 묶여 있었다. 음수가 오면
 * 조용히 뒤집히는 대신 `sign_undeclared`로 표면화된다 (LOCK 6 쪽이 안전하다).
 */
export function deriveProfile(base: MappingProfile, draft: MappingDraft): DeriveResult {
  if (draft.size === 0) return { ok: false, why: "바뀐 것이 없다" }

  const { canEdit, whyNot } = editableHeaders(base)
  for (const header of draft.keys()) {
    if (!canEdit(header)) {
      return { ok: false, why: `「${header}」 — ${whyNot(header)}` }
    }
  }

  // 초안의 target이 등록부에 있는지 — 문에서 막는다 (ADR-010 계보).
  for (const [header, target] of draft) {
    if (target !== null && targetSpec(target) === undefined) {
      return { ok: false, why: `「${header}」 → «${target}» — 등록부에 없는 필드다` }
    }
  }

  const bySource = new Map(draft)
  const kept: FieldMapping[] = []
  for (const m of base.fieldMappings) {
    const key = m.source?.trim() ?? ""
    if (!bySource.has(key)) {
      kept.push(m)
      continue
    }
    const target = bySource.get(key)
    bySource.delete(key)
    if (target === null || target === undefined) continue // 쓰지 않음 — 매핑 제거
    if (target === m.target) {
      kept.push(m) // 제자리 선택 — 원본 매핑을 그대로 둔다 (valueMap 등 보존)
      continue
    }
    kept.push(plainMapping(target, key))
  }
  // 남은 초안 = 원래 매핑이 없던 열에 target 부여.
  for (const [header, target] of bySource) {
    if (target === null) continue // 안 쓰던 열을 «쓰지 않음» — 이미 그렇다
    kept.push(plainMapping(target, header))
  }

  const derived: MappingProfile = { ...base, fieldMappings: kept }

  const guard = minimumSet(derived)
  if (guard !== null) return { ok: false, why: guard }
  return { ok: true, profile: derived }
}

/** target 교체·신규 부여로 생기는 매핑. kind는 등록부의 첫 kind를 따른다. */
function plainMapping(target: string, source: string): FieldMapping {
  const spec = targetSpec(target)
  const kind = spec?.kinds[0]
  return {
    target,
    source,
    kind: kind === "number" || kind === "date" || kind === "identifier" || kind === "percent" ? kind : "text",
  }
}

/**
 * 최소 한 벌 — **날짜 하나 + 금액 하나**가 남아 있어야 한다.
 *
 * 행 식별 키와 표는 편집 불가라 저절로 유지된다. 날짜·금액은 편집 대상이라
 * 사용자가 «쓰지 않음»으로 다 지울 수 있고, 그 프로파일로 적재하면 손익이
 * 셀 것이 없다 — 저장 전에 막고 이유를 말한다.
 *
 * 기준 데이터 프로파일(`reference`)은 값이 `reference` 블록에 살고 그 블록은
 * 편집 불가라, 이 검사가 보는 `fieldMappings`가 원래 비어 있어도 정상이다.
 */
function minimumSet(p: MappingProfile): string | null {
  if (p.reference !== undefined) return null

  const all: FieldMapping[] = [
    ...p.fieldMappings,
    ...(p.rowRouting?.routes ?? []).flatMap((r) => r.fieldMappings),
    ...(p.orderItem?.fieldMappings ?? []),
  ]
  const hasDate = all.some((m) => m.kind === "date")
  const hasAmount = all.some((m) => m.kind === "number")
  if (!hasDate && !hasAmount) return "날짜 열과 금액 열이 하나도 안 남는다 — 이 매핑으로는 적재해도 셀 것이 없다"
  if (!hasDate) return "날짜 열이 하나도 안 남는다 — 어느 날의 일인지 알 수 없게 된다"
  if (!hasAmount) return "금액 열이 하나도 안 남는다 — 손익이 셀 것이 없어진다"
  return null
}

/**
 * 번들 + 개인 프로파일 병합 — **같은 자연키면 사용자 최신이 내장을 가린다.**
 *
 * 자연키 = (마켓 · 문서종류 · grain). 목업의 고정 문구 «직접 지정한 매핑은
 * 덮어쓰지 않습니다»의 이행이 이 함수다: 팩이 갱신돼도 사용자가 확정한 판이
 * 판정·적재에 쓰인다. 내장으로 되돌리는 UI는 v2 (실물 트리거 대기).
 *
 * `user` 목록은 **최신이 앞**이라고 가정한다 (`userProfiles`가 그렇게 준다).
 */
export function mergeProfiles(
  bundled: readonly MappingProfile[],
  user: readonly MappingProfile[],
): readonly MappingProfile[] {
  const key = (p: MappingProfile): string => `${p.marketplaceKey}/${p.docType}/${p.grain}`
  const mask = new Map<string, MappingProfile>()
  for (const p of user) if (!mask.has(key(p))) mask.set(key(p), p)

  const out: MappingProfile[] = []
  const used = new Set<string>()
  for (const b of bundled) {
    const u = mask.get(key(b))
    if (u !== undefined) {
      out.push(u)
      used.add(key(b))
    } else {
      out.push(b)
    }
  }
  // 내장에 짝이 없는 개인 프로파일 — v1 경로로는 안 생기지만 (파생뿐이라),
  // 생겨도 잃지 않는다.
  for (const u of user) {
    const k = key(u)
    if (!used.has(k) && mask.get(k) === u) out.push(u)
  }
  return out
}
