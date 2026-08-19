/**
 * 필드 매핑 화면 배선 — **양식(마켓 × 문서)의 사전이 처음으로 화면에 선다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 화면이 서기 전 (실측 2026-08-18) ★
 * 목업이 21개 슬롯을 그려 놨는데 배선이 0이었다 — 껍데기 화면. §20 규칙 1 개정
 * (2026-08-18 사용자 확정)이 «질문 카드 ≤3 + 펼치면 전체 편집 표» 중 후자의
 * 표면으로 이 화면을 지목했고, 배선만 하면 되는 상태였다.
 *
 * ★ B1 = 읽기 배선이다 ★
 * 표의 드롭다운은 그려지지만 고르기는 B2(개인 프로파일 저장)에서 산다.
 * `confirmFm`·드리프트(diff*)는 §20 트리거 게이트 안이라 여기서 배선하지 않는다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 두 종류의 양식이 한 목록에 선다 ★
 *
 * ```
 * 내장   프로파일 9장 — 열의 역할은 «선언»이다 (columnRoles · 위저드와 같은 어휘)
 * 미확인  프로파일 없이 목격된 파일(009) — 열마다 판정 4단이 붙는다 (ADR-017)
 * ```
 *
 * 지금까지 «맞는 양식 없음»으로 끝난 파일이 어디에도 안 보였다 — 목격은 쌓이는데
 * (009) 읽는 화면이 없었다. 이 화면이 009 읽기 표면의 첫 호출자다.
 */

import type { ColumnSighting } from "@core/import/columns.js"
import type { JudgeResult, VerdictTier } from "@core/import/judge.js"
import { columnRoles, type MappingProfile } from "@core/import/mapping/index.js"
import { TARGETS } from "@core/import/mapping/targets.js"
import type { TemplateVals } from "./generated/vals.js"
import { roleField, roleWhy } from "./import.js"
import { buildAliasIndex, judgeColumns } from "@core/import/judge.js"
import { profileVersion } from "@core/import/mapping/index.js"
import type { Repository } from "@core/store/repository.js"

const DIM = "var(--fg-4)"
const G = "var(--pnl-pos)"
const WARN = "var(--pnl-warn)"

/** 목록의 한 양식 — 내장 프로파일이거나, 프로파일 없이 목격된 파일이다. */
export interface FieldmapForm {
  readonly key: string
  readonly name: string
  readonly marketplaceKey: string
  readonly docType: string
  readonly dest: string
  readonly source: "builtin" | "unknown"
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
}

const NOOP: FieldmapActions = { pick: () => {} }

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
 * B1에서는 고를 수 없지만(onPick이 noop) 목록은 완성본이다 — B2가 켜기만 한다.
 */
export function fieldOptions(current: readonly string[]): string[] {
  const glossed = TARGETS.map((t) => `${t.name} — ${t.gloss}`)
  // controlled <select>는 현재 값이 옵션에 있어야 그려진다 — 역할 낱말들을 앞에 둔다.
  return [...new Set([...current, ...glossed, "이 열은 쓰지 않음"])]
}

export function fieldmapVals(
  vals: TemplateVals,
  view: FieldmapView | null,
  selKey: string | null,
  act: FieldmapActions = NOOP,
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
    state: f.source === "builtin" ? "내장" : "미확인",
    stateColor: f.source === "builtin" ? G : WARN,
    doc: DOC_LABEL[f.docType] ?? f.docType,
    src: f.source === "builtin" ? "팩" : "파일",
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
    vals.fmCols = []
    vals.fmFieldOptions = []
    return
  }

  vals.fmTitle = sel.name
  vals.fmChannel = sel.marketplaceKey
  vals.fmDoc = DOC_LABEL[sel.docType] ?? sel.docType
  vals.fmSrc = sel.source === "builtin" ? "팩 내장" : "파일에서 목격"
  vals.fmDest = sel.dest
  // 미확인 양식은 배너가 «확인 필요»를 말한다. 확인 버튼(confirmFm)은 §20 게이트
  // 안(B2)이라 아직 없다 — fmConfirmable은 컷에 남아 있다.
  vals.fmWarn = sel.source === "unknown"

  const rows = sel.source === "builtin" ? builtinRows(sel) : judgedRows(sel)
  vals.fmCols = rows
  vals.fmFieldOptions = fieldOptions(rows.map((r) => r.field))
  vals.fmSummary =
    sel.source === "builtin"
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
  readonly onPick: () => void
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

/**
 * 내장 양식의 표 — **선언이 우선이다** (위저드 확인 표와 같은 어휘 · 결함 53 계보).
 * 목격이 있으면 실제 파일의 열 순서·표본으로 그리고, 없으면 선언만 그린다.
 */
function builtinRows(f: FieldmapForm): FmRow[] {
  if (f.profile === null) return []
  const use = columnRoles(f.profile)

  const rowOf = (header: string, sample: string): FmRow => {
    const u = use.byColumn.get(header.trim())
    const roles = u?.roles ?? []
    return {
      header,
      sample,
      field: u ? (u.target ?? roleField(roles)) : use.contentKeyed ? "행 식별에 참여" : "저장 안 함",
      fieldColor: u || use.contentKeyed ? "var(--fg-2)" : DIM,
      onPick: () => {}, // B2에서 산다 — 편집은 개인 프로파일 저장과 함께 온다
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

/** 미확인 양식의 표 — 열마다 판정 4단 (ADR-017). 근거는 %가 아니라 문장이다. */
function judgedRows(f: FieldmapForm): FmRow[] {
  const byOrdinal = new Map((f.judge?.verdicts ?? []).map((v) => [v.ordinal, v]))
  return f.columns.map((c) => {
    const v = byOrdinal.get(c.ordinal)
    const tier = v?.tier ?? "unknown"
    return {
      header: c.header,
      sample: c.sample ?? "—",
      field: v?.target ?? (v && v.candidates.length > 0 ? `${v.candidates.join(" / ")} ?` : "—"),
      fieldColor: v?.target ? "var(--fg-2)" : DIM,
      onPick: () => {},
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
      source: "builtin",
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

