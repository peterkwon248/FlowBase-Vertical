/**
 * 필드 매핑 화면 배선 — **양식(마켓 × 문서)의 사전이 처음으로 화면에 선다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 화면이 서기 전 (실측 2026-08-18) ★
 * 목업이 21개 슬롯을 그려 놨는데 배선이 0이었다 — 껍데기 화면. §20 규칙 1 개정
 * (2026-08-18 사용자 확정)이 «질문 카드 ≤3 + 펼치면 전체 편집 표» 중 후자의
 * 표면으로 이 화면을 지목했고, 배선만 하면 되는 상태였다.
 *
 * ★ B1 = 읽기 배선 · B2 = 고르기와 저장 ★
 * 드롭다운 선택은 초안(App 상태)에 쌓이고, 「양식 확인 완료」가 그것을
 * **파생 개인 프로파일**(`mapping_profile source='user'` · `deriveProfile`)로
 * 저장한다. 드리프트(diff*)·질문 카드(cf*)는 여전히 §20 트리거 게이트 안이다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 세 종류의 양식이 한 목록에 선다 ★
 *
 * ```
 * 내장    프로파일 9장 — 열의 역할은 «선언»이다 (columnRoles · 위저드와 같은 어휘)
 * 내 확정  사용자가 확정한 파생판 (B2) — 같은 자연키의 내장을 가린다
 * 미확인  프로파일 없이 목격된 파일(009) — 열마다 판정 4단이 붙는다 (ADR-017)
 * ```
 *
 * 지금까지 «맞는 양식 없음»으로 끝난 파일이 어디에도 안 보였다 — 목격은 쌓이는데
 * (009) 읽는 화면이 없었다. 이 화면이 009 읽기 표면의 첫 호출자다.
 */

import type { ColumnSighting } from "@core/import/columns.js"
import type { JudgeResult, VerdictTier } from "@core/import/judge.js"
import { columnRoles, type MappingProfile } from "@core/import/mapping/index.js"
import { TARGETS, targetSpec } from "@core/import/mapping/targets.js"
import { deriveProfile, editableHeaders, type MappingDraft } from "@core/import/mapping/derive.js"
import type { TemplateVals } from "./generated/vals.js"
import { roleField, roleWhy } from "./import.js"
import { buildAliasIndex, judgeColumns } from "@core/import/judge.js"
import { profileVersion } from "@core/import/mapping/index.js"
import type { Repository } from "@core/store/repository.js"

const DIM = "var(--fg-4)"
const G = "var(--pnl-pos)"
const WARN = "var(--pnl-warn)"

/** 목록의 한 양식 — 내장 프로파일이거나, 내 확정판이거나, 프로파일 없이 목격된 파일이다. */
export interface FieldmapForm {
  readonly key: string
  readonly name: string
  readonly marketplaceKey: string
  readonly docType: string
  readonly dest: string
  /** `user` = 개인 프로파일 (B2 — `mapping_profile source='user'`). 내장을 가린 판이다. */
  readonly source: "builtin" | "user" | "unknown"
  /** 이 양식으로 본 파일(시트) 수 — `file_sighting` 행 수다. */
  readonly seenCount: number
  readonly lastSeenAt: string | null
  /** 최근 목격의 저장 열 (009). 내장인데 아직 파일을 안 봤으면 빈 배열. */
  readonly columns: readonly ColumnSighting[]
  /** 미확인 양식의 열 판정 (ADR-017). 내장은 선언이 우선이라 `null`. */
  readonly judge: JudgeResult | null
  /** 내장일 때의 프로파일 원본 — 선언 표를 그리는 재료. */
  readonly profile: MappingProfile | null
}

export interface FieldmapView {
  readonly forms: readonly FieldmapForm[]
}

export interface FieldmapActions {
  readonly pick: (key: string) => void
  /** 드롭다운 선택 (B2). 헤더와 change 이벤트를 받는다 — 초안(App 상태)에 쌓인다. */
  readonly onPick: (header: string, ev: unknown) => void
  /** 「양식 확인 완료」(B2) — 초안을 파생판으로 저장한다. */
  readonly confirm: () => void
}

const NOOP: FieldmapActions = { pick: () => {}, onPick: () => {}, confirm: () => {} }

/**
 * 드롭다운 값 → 초안 항목 (B2). **등록부에 있는 것만 초안이 된다.**
 *
 * 선택지에는 역할 낱말(「행 식별에 참여」 등 — controlled select의 현재 값)도
 * 섞여 있다. 그것을 고르는 것은 뜻이 없으므로 `ignore`다 — 조용히 다른 뜻으로
 * 바꾸는 것보다 아무 일도 안 하는 쪽이 낫다.
 */
export function parsePick(value: string): { kind: "target"; target: string } | { kind: "none" } | { kind: "ignore" } {
  if (value === "이 열은 쓰지 않음" || value === "저장 안 함") return { kind: "none" }
  const name = value.split(" — ")[0] ?? ""
  if (targetSpec(name) !== undefined) return { kind: "target", target: name }
  return { kind: "ignore" }
}

const DOC_LABEL: Record<string, string> = {
  order: "주문",
  settlement: "정산",
  ad: "광고",
  cost: "원가",
}

const TIER_LABEL: Record<VerdictTier, string> = {
  alias: "확정",
  identity: "증명",
  candidate: "후보",
  unknown: "모름",
}
const TIER_COLOR: Record<VerdictTier, string> = {
  alias: G,
  identity: G,
  candidate: WARN,
  unknown: DIM,
}

/** 문서 종류별 점 색 — 채널 색이 아니라 **문서 종류** 색이다 (양식의 축이 그쪽이다). */
const DOC_COLOR: Record<string, string> = {
  order: "var(--accent)",
  settlement: "var(--pnl-pos)",
  ad: "var(--pnl-warn)",
  cost: "var(--fg-3)",
}

/**
 * 드롭다운 선택지 — **등록부의 뜻풀이가 붙는다** (targets.ts의 세 번째 소비처).
 * B2부터 고르기가 산다 — 고른 것은 `parsePick`을 지나 초안이 된다.
 */
export function fieldOptions(current: readonly string[]): string[] {
  const glossed = TARGETS.map((t) => `${t.name} — ${t.gloss}`)
  // controlled <select>는 현재 값이 옵션에 있어야 그려진다 — 역할 낱말들을 앞에 둔다.
  return [...new Set([...current, ...glossed, "이 열은 쓰지 않음"])]
}

/** 화면이 쓰는 낱말 셋 — 출처(state)·근원(src). 한 곳에서만 정한다. */
const SOURCE_WORD: Record<FieldmapForm["source"], { state: string; color: string; src: string }> = {
  builtin: { state: "내장", color: G, src: "팩" },
  user: { state: "내 확정", color: "var(--accent)", src: "내 확정판" },
  unknown: { state: "미확인", color: WARN, src: "파일" },
}

/** 목업의 동결 배너 문구 — 미확인 양식일 때 그대로 쓴다. */
const UNCONFIRMED_COPY =
  "이 양식은 아직 확인되지 않았습니다. 확인 필요 열을 확정해야 다음 파일이 자동으로 처리됩니다."

export function fieldmapVals(
  vals: TemplateVals,
  view: FieldmapView | null,
  selKey: string | null,
  act: FieldmapActions = NOOP,
  /** 사용자가 고친 것 (B2). App 상태다 — 양식을 바꾸면 App이 비운다. */
  draft: MappingDraft = new Map(),
): void {
  const forms = view?.forms ?? []
  const sel = forms.find((f) => f.key === selKey) ?? forms[0] ?? null

  // 나브 배지 — 미확인 양식 수. 0이면 빈 문자열 (배지 없음).
  const unknownCount = forms.filter((f) => f.source === "unknown").length
  vals.fmBadge = unknownCount > 0 ? String(unknownCount) : ""

  vals.fmList = forms.map((f) => ({
    name: f.name,
    edge: f.key === sel?.key ? "var(--accent)" : "transparent",
    bg: f.key === sel?.key ? "var(--bg-subtle)" : "transparent",
    chColor: DOC_COLOR[f.docType] ?? DIM,
    state: SOURCE_WORD[f.source].state,
    stateColor: SOURCE_WORD[f.source].color,
    doc: DOC_LABEL[f.docType] ?? f.docType,
    src: SOURCE_WORD[f.source].src,
    dest: f.dest,
    meta:
      f.seenCount > 0
        ? `본 파일 ${f.seenCount} · 마지막 ${(f.lastSeenAt ?? "").slice(0, 10)}`
        : "아직 파일을 본 적 없음",
    pick: () => act.pick(f.key),
  }))

  if (sel === null) {
    vals.fmTitle = "양식이 없습니다"
    vals.fmChannel = ""
    vals.fmDoc = ""
    vals.fmSrc = ""
    vals.fmDest = ""
    vals.fmSummary = ""
    vals.fmWarn = false
    vals.fmWarnText = ""
    vals.fmConfirmable = false
    vals.fmCols = []
    vals.fmFieldOptions = []
    return
  }

  vals.fmTitle = sel.name
  vals.fmChannel = sel.marketplaceKey
  vals.fmDoc = DOC_LABEL[sel.docType] ?? sel.docType
  vals.fmSrc = sel.source === "unknown" ? "파일에서 목격" : `${SOURCE_WORD[sel.source].src} 프로파일`
  vals.fmDest = sel.dest

  /**
   * ★ 배너가 두 가지 사실을 말한다 (B2) ★
   *
   * ```
   * 미확인 양식        동결 문구 — «확인 필요». 확인 버튼은 없다 (v1 컷: 백지
   *                    신규 양식 작성은 질문 카드와 같은 트리거 — §20)
   * 초안이 있는 양식   고친 개수와 저장의 뜻, 또는 **저장할 수 없는 이유**
   *                    (최소 한 벌 부족 등 — 버튼을 조용히 죽이지 않는다, LOCK 6)
   * ```
   */
  const editable = sel.source !== "unknown" && sel.profile !== null
  const derived = editable && draft.size > 0 && sel.profile !== null ? deriveProfile(sel.profile, draft) : null
  vals.fmWarn = sel.source === "unknown" || derived !== null
  vals.fmWarnText =
    sel.source === "unknown"
      ? UNCONFIRMED_COPY
      : derived === null
        ? ""
        : derived.ok
          ? `고친 매핑 ${draft.size}건 — 확인하면 내 확정판으로 저장되어 다음 가져오기부터 쓰입니다.`
          : `이대로는 저장할 수 없습니다 — ${derived.why}`
  vals.fmConfirmable = derived !== null && derived.ok
  vals.confirmFm = act.confirm

  const rows = sel.source === "unknown" ? judgedRows(sel) : builtinRows(sel, draft, act)
  vals.fmCols = rows
  vals.fmFieldOptions = fieldOptions(rows.map((r) => r.field))
  vals.fmSummary =
    sel.source !== "unknown"
      ? summaryBuiltin(sel)
      : sel.judge === null
        ? ""
        : `확정 ${sel.judge.tierCounts.alias} · 증명 ${sel.judge.tierCounts.identity} · ` +
          `후보 ${sel.judge.tierCounts.candidate} · 모름 ${sel.judge.tierCounts.unknown}`
}

interface FmRow {
  readonly header: string
  readonly sample: string
  readonly field: string
  readonly fieldColor: string
  readonly onPick: (ev: unknown) => void
  /**
   * 드롭다운 잠금 — **구조를 바꾸는 열은 여기서 못 고친다** (B2 v1 컷 라인).
   * 근거 열이 이미 그 역할(행 식별 키 등)을 말하고 있다 — 잠긴 이유가 곧 역할이다.
   */
  readonly locked: boolean
  readonly why: string
  readonly conf: string
  readonly color: string
}

function summaryBuiltin(f: FieldmapForm): string {
  const declared = f.profile === null ? 0 : columnRoles(f.profile).byColumn.size
  return f.columns.length > 0
    ? `선언 ${declared}열 · 최근 파일 ${f.columns.length}열`
    : `선언 ${declared}열`
}

/** 등록부 뜻풀이가 붙은 라벨 — 드롭다운 선택지와 **같은 문자열**이어야 선택이 그려진다. */
function glossed(target: string): string {
  const spec = targetSpec(target)
  return spec === undefined ? target : `${spec.name} — ${spec.gloss}`
}

/**
 * 내장·내 확정 양식의 표 — **선언이 우선이다** (위저드 확인 표와 같은 어휘 · 결함 53 계보).
 * 목격이 있으면 실제 파일의 열 순서·표본으로 그리고, 없으면 선언만 그린다.
 *
 * B2: `field` 역할뿐인 열과 역할 없는 열은 드롭다운이 산다 — 고른 것은 초안
 * (App 상태)에 쌓이고, 이 행은 초안이 있으면 **초안을 먼저** 그린다. 구조
 * 역할(행 식별 키·라우팅·리스팅…)이 있는 열은 잠긴다 — v1 컷 라인.
 */
/**
 * ★ 화면에 나가는 글자를 자른다 (2026-08-21) ★
 *
 * 실물에서 열 이름이 200자 넘게 오는 파일이 있다 — 표지 시트의 셀이
 * `<img src='https://gi.esmplus.com/…'>` 통짜였다. `whiteSpace: nowrap`인 칸이라
 * 표가 컨테이너 밖으로 밀려나고 **우측 패널이 잘려 보였다** (사용자 지적).
 *
 * 키는 자르지 않는다 — `onPick`이 원본을 쥐고 있다. 화면에 나가는 문자열만
 * 줄이고, 줄였다는 사실을 «…»로 말한다 (조용히 지우지 않는다 · LOCK 6).
 * 위저드의 표본 칸이 이미 같은 처방을 쓴다 (`import.ts` — `slice(0, 24)`).
 */
const cut = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n)}…` : t)

function builtinRows(f: FieldmapForm, draft: MappingDraft, act: FieldmapActions): FmRow[] {
  if (f.profile === null) return []
  const use = columnRoles(f.profile)
  const { canEdit } = editableHeaders(f.profile)

  const rowOf = (header: string, sample: string): FmRow => {
    const u = use.byColumn.get(header.trim())
    const roles = u?.roles ?? []
    const editable = canEdit(header)
    const drafted = draft.has(header.trim()) ? draft.get(header.trim()) : undefined
    if (drafted !== undefined) {
      return {
        header: cut(header, 40),
        sample: cut(sample, 32),
        field: drafted === null ? "이 열은 쓰지 않음" : glossed(drafted),
        fieldColor: "var(--accent)",
        onPick: (ev) => act.onPick(header.trim(), ev),
        locked: false,
        why: "내가 고른 값 — 「양식 확인 완료」를 눌러야 저장됩니다",
        conf: "고침",
        color: "var(--accent)",
      }
    }
    return {
      header: cut(header, 40),
      sample: cut(sample, 32),
      field: u ? (u.target ?? roleField(roles)) : use.contentKeyed ? "행 식별에 참여" : "저장 안 함",
      fieldColor: u || use.contentKeyed ? "var(--fg-2)" : DIM,
      onPick: editable ? (ev): void => act.onPick(header.trim(), ev) : () => {},
      locked: !editable,
      why: u
        ? roleWhy(roles, u.required === true)
        : use.contentKeyed
          ? "이 양식은 행 전체로 source_key를 만든다"
          : "이 프로파일이 쓰지 않는 컬럼",
      conf: u ? "선언" : "—",
      color: u ? G : DIM,
    }
  }

  if (f.columns.length > 0) {
    return f.columns.map((c) => rowOf(c.header, c.sample ?? "—"))
  }
  return [...use.byColumn.keys()].map((h) => rowOf(h, "—"))
}

/**
 * 미확인 양식의 표 — 열마다 판정 4단 (ADR-017). 근거는 %가 아니라 문장이다.
 *
 * 드롭다운은 잠긴다 — 미확인 양식의 확정(백지 신규 양식 작성)은 v1 밖이다
 * (질문 카드와 같은 §20 트리거). 파생의 발판이 될 프로파일이 없어서, 여기서
 * 고른 답은 저장할 곳이 없다 — 살아 있는 척하는 드롭다운이 더 나쁘다.
 */
function judgedRows(f: FieldmapForm): FmRow[] {
  const byOrdinal = new Map((f.judge?.verdicts ?? []).map((v) => [v.ordinal, v]))
  return f.columns.map((c) => {
    const v = byOrdinal.get(c.ordinal)
    const tier = v?.tier ?? "unknown"
    return {
      // ★ 미확인 양식이 가장 험한 값을 준다 ★ 표지 시트의 셀이 그대로 열 이름이
      // 되므로 `<img src='…'>` 200자짜리가 온다 — 실물로 봤다.
      header: cut(c.header, 40),
      sample: cut(c.sample ?? "—", 32),
      field: v?.target ?? (v && v.candidates.length > 0 ? `${v.candidates.join(" / ")} ?` : "—"),
      fieldColor: v?.target ? "var(--fg-2)" : DIM,
      onPick: () => {},
      locked: true,
      why: v?.sentence ?? "",
      conf: TIER_LABEL[tier],
      color: TIER_COLOR[tier],
    }
  })
}

/**
 * 필드 매핑 화면의 양식 목록을 조립한다 (B1).
 *
 * ★ 목격(009)을 처음으로 **읽는다** ★ 지금까지 이 표는 쓰기만 있었다 — «맞는
 * 양식 없음»으로 끝난 파일이 기록은 되는데 어디에도 안 보였다. 여기서 내장
 * 프로파일에 목격 통계를 붙이고, 프로파일 없는 목격은 «미확인 양식»으로 세운다.
 *
 * 미확인 양식의 열에는 판정 4단(ADR-017)을 붙인다 — 저장된 열(표본 1개·kind)로
 * 별칭·값 게이트는 돌지만 **증명(항등식)은 못 돈다**(항등은 행 200개가 필요한데
 * 목격은 열당 표본 1개다). 그 차이는 화면이 숨기지 않는다 — 증명은 위저드에서
 * 산 분석으로만 뜬다.
 */
export async function loadFieldmapView(
  repo: Repository,
  profiles: readonly MappingProfile[],
  libraryId: string,
  /**
   * 개인 프로파일의 버전 문자열들 (`profileVersion` 모양). `profiles`는 이미
   * 병합본이라(내 확정판이 내장을 가린 뒤) 목록만 봐서는 출처를 모른다 —
   * 병합한 쪽(data.ts)이 안다. 규약(u 접두)을 여기서 다시 해석하지 않는다.
   */
  userVersions: ReadonlySet<string> = new Set(),
): Promise<FieldmapView> {
  const sightings = await repo.fileSightings(libraryId)
  const aliasIndex = buildAliasIndex(profiles)

  const sightingColumns = async (id: number): Promise<ColumnSighting[]> =>
    (await repo.fileColumns(id)).map((c) => ({
      ordinal: Number(c["ordinal"]),
      header: String(c["header"]),
      sample: c["sample_value"] === null || c["sample_value"] === undefined ? null : String(c["sample_value"]),
      kind: String(c["kind"]) as ColumnSighting["kind"],
      confidence: Number(c["kind_confidence"] ?? 0),
      reason: String(c["kind_reason"] ?? ""),
    }))

  const forms: FieldmapForm[] = []

  // ── 내장 9장 — 목격 통계를 붙인다 ────────────────────────────────
  for (const p of profiles) {
    const version = profileVersion(p)
    // ★ 목격의 `profile_id`는 `p.id`다 (run.ts:500 — 버전 접미 없음). 버전 문자열로
    // 대조하면 전부 «본 적 없음»이 된다 — 데모 DB 렌더에서 실제로 그렇게 떴다.
    const mine = sightings.filter((s) => String(s["profile_id"] ?? "") === p.id)
    const latest = mine[0] // fileSightings는 last_seen_at 내림차순이다
    forms.push({
      key: version,
      name: `${p.displayName} · ${p.label}`,
      marketplaceKey: p.marketplaceKey,
      docType: p.docType,
      dest: p.targetTable,
      source: userVersions.has(version) ? "user" : "builtin",
      seenCount: mine.length,
      lastSeenAt: latest === undefined ? null : String(latest["last_seen_at"]),
      columns: latest === undefined ? [] : await sightingColumns(Number(latest["id"])),
      judge: null,
      profile: p,
    })
  }

  // ── 미확인 — 프로파일 없이 목격된 파일들 ─────────────────────────
  for (const s of sightings) {
    if (s["profile_id"] !== null && s["profile_id"] !== undefined) continue
    const columns = await sightingColumns(Number(s["id"]))
    // 열이 하나도 없는 목격(헤더 미탐지)은 목록에 세워도 보여줄 것이 없다 — 센다.
    if (columns.length === 0) continue
    forms.push({
      key: `file:${String(s["source_hash"])}:${Number(s["sheet_index"])}`,
      name: `${String(s["source_name"])}${
        s["sheet_name"] === null || s["sheet_name"] === undefined ? "" : ` — ${String(s["sheet_name"])}`
      }`,
      marketplaceKey: "?",
      docType: "?",
      dest: "미정",
      source: "unknown",
      seenCount: Number(s["seen_count"] ?? 1),
      lastSeenAt: String(s["last_seen_at"]),
      columns,
      judge: judgeColumns(columns, aliasIndex),
      profile: null,
    })
  }

  return { forms }
}

