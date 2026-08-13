/**
 * Mapping — 파이프라인 4단계.
 *
 * 정규화된 표를 프로파일에 따라 Canonical 필드로 옮긴다. 헌장 B-6 —
 * **프로파일은 코드가 아니라 버전 있는 데이터(JSON)**이므로, 이 파일에는
 * 특정 마켓의 컬럼 이름이 없다 (B-8). 마켓 지식은 `packs/` 안의 JSON에만 있다.
 *
 * 세션 2의 최소형이지만 **버릴 프로토타입이 아니다.** 프로파일 구조 4종
 * (`recognitionRules`·`extractionRules`·`fieldMappings`·`validationRules`)을
 * 전부 갖추고, 내용만 얇다. 확장은 필드를 채우는 일이지 형태를 바꾸는 일이 아니다.
 */

import { readUInt48BE, sha1 } from "./sha1.js"
import type { NormalizedChunk, RawCell } from "../types.js"
import { normalizeValue } from "../normalization/value.js"
import { rowValuesInto } from "../normalization/chunk.js"

export type SourceKeyStrategy = "natural" | "content"

export interface FieldMapping {
  readonly target: string
  readonly source?: string
  readonly kind: "identifier" | "number" | "date" | "text" | "percent" | "enum"
  readonly required?: boolean
  readonly default?: RawCell
  readonly derive?:
    | { readonly from: "fileName"; readonly capture: string }
    | { readonly from: "constant"; readonly value: RawCell }
  /**
   * 원본 값 → Canonical 값 사전. 스키마가 `CHECK`로 값을 제한하는 컬럼이
   * 있어서 필요하다 — 예: `claim_type IN ('CANCEL','RETURN','EXCHANGE','REFUND')`인데
   * 파일은 "취소완료"라고 적는다.
   *
   * 사전에 없는 값은 **조용히 통과시키지 않는다** — 매핑 오류로 보고한다.
   * 모르는 상태가 새로 생겼다는 뜻이고, 그건 사람이 봐야 한다 (헌장 A-5).
   */
  readonly valueMap?: Readonly<Record<string, RawCell>>
}

export interface MappingProfile {
  readonly id: string
  readonly version: string
  readonly packId: string
  readonly marketplaceKey: string
  readonly docType: string
  readonly grain: string
  readonly targetTable: string
  /** 이 **문서**의 이름. 예: "결제완료/정산확정". 화면의 채널 이름이 아니다. */
  readonly label: string
  /**
   * 이 **채널**의 통칭. `connection.display_name`의 기본값이 된다.
   *
   * ★ 왜 프로파일이 이름을 아는가 ★
   * 화면에 `conn-11st` 같은 내부 키를 노출하는 것은 헌장 C-4 위반이고(`batch_id`를
   * 숨기기로 한 것과 같은 계열), 그렇다고 앱이 이름을 지어낼 수도 없다. 프로파일은
   * **그 마켓의 문서 구조 전체를 아는 주체**이므로 마켓의 통칭도 그 정당한 지식이다.
   *
   * LOCK 4와 충돌하지 않는다 — 이름이 사는 곳이 `core/`가 아니라 **팩의 프로파일**이다.
   * core는 이 문자열을 읽어 옮길 뿐 무엇인지 모른다.
   *
   * 연결 화면이 생기면 사용자가 덮어쓸 수 있는 값이 된다 (§10-2 라벨).
   * **여기 있는 것은 기본값이다.**
   */
  readonly displayName: string
  readonly recognitionRules: {
    readonly containerFormats: readonly string[]
    readonly requiredHeaders: readonly string[]
    readonly headerMatch: "all" | "any"
    readonly fileNamePattern?: string
    readonly minConfidence: number
  }
  readonly extractionRules: {
    readonly sheetSelector: { readonly kind: string; readonly name?: string }
    readonly headerRowHint?: number
    readonly detectUnlabeledAggregates?: boolean
  }
  readonly sourceKey: {
    readonly strategy: SourceKeyStrategy
    readonly columns?: readonly string[]
  }
  readonly fieldMappings: readonly FieldMapping[]
  /**
   * 한 파일 안에서 행을 **여러 테이블로 나눠 보낸다.**
   *
   * ★ 왜 프로파일을 둘로 쪼개지 않는가 ★
   * ESM 주문통합검색은 주문과 클레임이 `진행상태` 한 컬럼으로 섞여 있다.
   * 같은 파일에 프로파일 둘이 매칭되면 **Recognition이 모호해진다** — 어느
   * 것을 고를지 파일만 보고는 알 수 없다. 그래서 프로파일은 하나로 두고
   * 그 안에서 행을 가른다. **batch도 하나**다.
   */
  readonly rowRouting?: {
    /** 판정에 쓸 컬럼. */
    readonly column: string
    /**
     * 이 컬럼에서 **나올 수 있다고 알려진 값 전부.**
     *
     * ★ 없으면 조용히 샌다 ★
     * `routes[].match`는 클레임 상태만 열거한다. 마켓이 "부분취소완료" 같은 새
     * 상태를 만들면 어느 route에도 안 걸려 **기본 경로(매출)로 조용히 들어간다** —
     * 클레임이 매출로 잡히는 바로 그 사고다 (헌장 A-5).
     *
     * 그래서 아는 값을 전부 적어두고, 벗어나면 오류로 보고한다. 행은 기본
     * 경로로 보내되(데이터를 버리지 않는다) **모르는 상태가 왔다는 사실을 남긴다.**
     */
    readonly knownValues?: readonly string[]
    readonly routes: readonly {
      /** 이 값들 중 하나면 이 경로로 간다. */
      readonly match: readonly string[]
      readonly targetTable: string
      readonly fieldMappings: readonly FieldMapping[]
      readonly note?: string
    }[]
  }
  readonly validationRules: readonly Record<string, unknown>[]
  readonly unmappedColumns?: { readonly policy: string }
}

/** `mapping_version` 문자열 — 각 batch가 기록한다 (헌장 B-6). */
export function profileVersion(p: MappingProfile): string {
  return `${p.marketplaceKey}/${p.docType}/${p.grain}@${p.version}`
}

// ─────────────────────────────────────────────────────────────
// 프로파일 판정
// ─────────────────────────────────────────────────────────────

export interface ProfileMatch {
  readonly profile: MappingProfile
  readonly confidence: number
  readonly evidence: readonly string[]
}

/**
 * 헤더와 파일명으로 프로파일 후보를 찾는다. 헌장 B-9 — 후보는 confidence와
 * 함께 **복수** 반환한다.
 */
export function matchProfiles(
  profiles: readonly MappingProfile[],
  ctx: { containerFormat: string; headers: readonly string[]; fileName: string },
): ProfileMatch[] {
  const out: ProfileMatch[] = []
  const present = new Set(ctx.headers.map((h) => h.trim()))

  for (const p of profiles) {
    const evidence: string[] = []
    const r = p.recognitionRules

    if (!r.containerFormats.includes(ctx.containerFormat)) continue

    const hit = r.requiredHeaders.filter((h) => present.has(h))
    const ratio = r.requiredHeaders.length === 0 ? 0 : hit.length / r.requiredHeaders.length
    if (r.headerMatch === "all" && hit.length !== r.requiredHeaders.length) {
      continue
    }
    evidence.push(`필수 헤더 ${hit.length}/${r.requiredHeaders.length} 일치`)

    let confidence = ratio
    if (r.fileNamePattern) {
      const m = new RegExp(r.fileNamePattern).exec(ctx.fileName)
      if (m) {
        confidence = Math.min(1, confidence + 0.1)
        evidence.push("파일명 패턴 일치")
      } else {
        evidence.push("파일명 패턴 불일치 — 헤더로만 판정")
      }
    }

    if (confidence >= r.minConfidence) out.push({ profile: p, confidence, evidence })
  }

  return out.sort((a, b) => b.confidence - a.confidence)
}

// ─────────────────────────────────────────────────────────────
// 행 매핑
// ─────────────────────────────────────────────────────────────

export interface MappedRow {
  readonly sourceKey: string
  readonly fields: Readonly<Record<string, RawCell>>
}

export interface MappingError {
  readonly rowIndex: number
  readonly field: string
  readonly reason: string
}

export interface MappingResult {
  /** 기본 경로(`profile.targetTable`)의 행. 라우팅이 없으면 전부 여기 있다. */
  readonly rows: readonly MappedRow[]
  /**
   * 테이블별 행. `rowRouting`이 있으면 여기로 읽는다 — `rows`만 보면
   * 다른 경로로 간 행을 통째로 놓친다.
   */
  readonly byTable: ReadonlyMap<string, readonly MappedRow[]>
  readonly errors: readonly MappingError[]
  /** 매핑하지 않고 버린 컬럼 수. 조용히 빠뜨리지 않기 위해 센다 (헌장 A-5). */
  readonly unmappedColumnCount: number
}

/**
 * 내용 해시 기반 `source_key` (ADR-006).
 *
 * 자연 키가 없는 양식용이다. 같은 내용은 같은 해시를 얻고, 내용까지 완전히
 * 같은 행은 등장 순번으로 갈린다 — 서로 다른 행이 UPSERT로 합쳐지지 않으면서
 * 같은 파일의 재가져오기는 멱등이다. **행 순서에 기대지 않는다.**
 */
function contentKey(values: readonly RawCell[], seen: Map<number, number>): string {
  const canonical = values.map((v) => (v === null ? "~" : `${typeof v}:${v}`)).join("")
  // 앞 6바이트(48비트)를 정수로. 안전 정수 범위 안이라 부동소수 오차가 없다.
  //
  // `node:crypto`가 아니라 순수 JS 구현을 쓴다 — 실제 앱은 웹뷰에서 돌고
  // 거기엔 `node:crypto`가 없다. 표준 SHA-1이라 값은 한 비트도 다르지 않고,
  // `tests/sha1.test.ts`가 그걸 대조로 증명한다 (source_key가 바뀌면 재가져오기
  // 멱등성이 깨지므로 값 불변이 조건이었다).
  const numeric = readUInt48BE(sha1(canonical))
  const n = seen.get(numeric) ?? 0
  seen.set(numeric, n + 1)
  // 저장되는 키는 문자열이다 — 사람이 보고 대조할 수 있어야 한다.
  return `${numeric.toString(16).padStart(12, "0")}:${n}`
}

/**
 * 파일 하나를 도는 동안 유지되는 키 상태.
 *
 * ★ 청크마다 새로 만들면 안 된다 ★
 * `content` 전략의 순번은 **파일 전체**에서 같은 내용이 몇 번째로 나왔는지다.
 * 청크 안에서만 세면 청크 경계를 걸친 동일 행 쌍이 같은 키를 받아 UPSERT로
 * 합쳐진다 — 실제로 #13에서 행 하나가 그렇게 사라졌고, 종단 게이트의
 * "적재 행 수 = SQL 되세기" 검증이 잡았다.
 */
export interface KeyState {
  /**
   * 해시 → 등장 횟수.
   *
   * 키가 **숫자**인 이유: 80,137행이면 항목이 8만 개고, 문자열 키로 두면 그
   * 문자열들이 파일이 끝날 때까지 힙에 남는다. 실측에서 +35MB 차이가 났고
   * 그게 256MB 기준을 넘겼다. sha1 앞 6바이트(48비트)를 정수로 쓰면 충돌
   * 확률은 8만 행 기준 무시할 수준이면서(생일 한계 ≈ 8만²/2⁴⁹) 항목이 훨씬 가볍다.
   */
  readonly seen: Map<number, number>
}

export function newKeyState(): KeyState {
  return { seen: new Map() }
}

export interface MapContext {
  readonly fileName: string
  /** 파일명 패턴에서 뽑은 이름 있는 캡처. `derive.from === "fileName"`이 쓴다. */
  readonly fileNameCaptures: Readonly<Record<string, string>>
  /** 파일 단위로 하나. 생략하면 이 호출 안에서만 유효한 상태를 쓴다. */
  readonly keyState?: KeyState
}

/** 파일명에서 `recognitionRules.fileNamePattern`의 캡처를 뽑는다. */
export function captureFromFileName(
  profile: MappingProfile,
  fileName: string,
): Record<string, string> {
  const pattern = profile.recognitionRules.fileNamePattern
  if (!pattern) return {}
  const m = new RegExp(pattern).exec(fileName)
  return m?.groups ? { ...m.groups } : {}
}

/** `20260701` → `2026-07-01`. 파일명 캡처는 구분자가 없는 경우가 흔하다. */
function looseDate(s: string): string | null {
  const t = s.trim()
  const m = /^(\d{4})[-./]?(\d{2})[-./]?(\d{2})$/.exec(t)
  if (!m) return null
  const [, y, mo, d] = m
  const month = Number(mo)
  const day = Number(d)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${y}-${mo}-${d}`
}

export function mapRows(
  profile: MappingProfile,
  headers: readonly string[],
  chunk: NormalizedChunk,
  ctx: MapContext,
  startRowIndex = 0,
): MappingResult {
  const index = new Map<string, number>()
  headers.forEach((h, i) => index.set(h.trim(), i))

  const routing = profile.rowRouting
  const routeCol = routing ? index.get(routing.column.trim()) : undefined

  // 미매핑 컬럼은 **모든 경로가 쓰는 컬럼의 합집합**으로 센다 — 클레임 경로에서만
  // 쓰는 컬럼을 "버렸다"고 세면 숫자가 거짓말을 한다.
  const usedColumns = new Set<string>()
  for (const m of profile.fieldMappings) if (m.source) usedColumns.add(m.source)
  for (const r of routing?.routes ?? []) {
    for (const m of r.fieldMappings) if (m.source) usedColumns.add(m.source)
  }
  if (routing) usedColumns.add(routing.column)
  const unmappedColumnCount = headers.filter((h) => !usedColumns.has(h.trim())).length

  /** 테이블별 버킷. 기본 경로는 `profile.targetTable`이다. */
  const byTable = new Map<string, MappedRow[]>()
  const bucket = (t: string): MappedRow[] => {
    let b = byTable.get(t)
    if (!b) {
      b = []
      byTable.set(t, b)
    }
    return b
  }

  const out: MappedRow[] = bucket(profile.targetTable)
  const errors: MappingError[] = []
  const seen = (ctx.keyState ?? newKeyState()).seen

  // `content` 전략이 쓰는 행 값 버퍼. **청크당 하나**를 돌려 쓴다 — 행마다 뜨면
  // 평탄화로 없앤 할당이 그대로 되살아난다.
  const scratch: (string | number | null)[] =
    profile.sourceKey.strategy === "natural" ? [] : new Array(chunk.width).fill(null)

  for (let i = 0; i < chunk.rowCount; i++) {
    const rowIndex = startRowIndex + i
    const base = i * chunk.width
    const fields: Record<string, RawCell> = {}
    let fatal = false

    // 이 행이 어느 경로로 가는가. 일치하는 route가 없으면 기본 경로다.
    let targetTable = profile.targetTable
    let mapped = profile.fieldMappings
    if (routing && routeCol !== undefined && routeCol < chunk.width) {
      const routeValue = String(chunk.values[base + routeCol] ?? "")
      const hit = routing.routes.find((r) => r.match.includes(routeValue))
      if (hit) {
        targetTable = hit.targetTable
        mapped = hit.fieldMappings
      } else if (routing.knownValues && !routing.knownValues.includes(routeValue)) {
        // 모르는 값이다. 기본 경로로 보내되 조용히 넘기지 않는다.
        errors.push({
          rowIndex,
          field: routing.column,
          reason: `알 수 없는 ${routing.column}: "${routeValue}" — 새 상태가 생겼는지 확인해야 한다`,
        })
      }
    }

    for (const m of mapped) {
      let value: RawCell = null

      if (m.derive) {
        if (m.derive.from === "constant") {
          value = m.derive.value
        } else {
          const raw = ctx.fileNameCaptures[m.derive.capture]
          value = raw === undefined ? null : (looseDate(raw) ?? raw)
        }
      } else if (m.source !== undefined) {
        const col = index.get(m.source)
        if (col === undefined) {
          // 헤더 자체가 없다 — 행마다 보고하면 8만 건이 되므로 첫 행에서만.
          if (i === 0) {
            errors.push({ rowIndex, field: m.target, reason: `컬럼 "${m.source}"가 없다` })
          }
        } else if (col < chunk.width) {
          value = coerce(chunk.values[base + col] ?? null, chunk.raws[base + col] ?? null, m.kind)
          if (m.valueMap && value !== null) {
            const mappedValue = m.valueMap[String(value)]
            if (mappedValue === undefined) {
              // 모르는 값을 통과시키면 스키마의 CHECK가 적재 시점에 터지거나,
              // 더 나쁘게는 엉뚱한 분류로 집계된다. 여기서 잡는다.
              errors.push({
                rowIndex,
                field: m.target,
                reason: `사전에 없는 값: "${String(value)}"`,
              })
              fatal = true
            }
            value = mappedValue ?? null
          }
        }
      }

      if (value === null && m.default !== undefined) value = m.default

      if (value === null && m.required) {
        errors.push({ rowIndex, field: m.target, reason: "필수 필드가 비었다" })
        fatal = true
      }
      fields[m.target] = value
    }

    if (fatal) continue

    const sourceKey =
      profile.sourceKey.strategy === "natural"
        ? (profile.sourceKey.columns ?? [])
            .map((c) => {
              const col = index.get(c)
              return col === undefined || col >= chunk.width
                ? ""
                : String(chunk.values[base + col] ?? "")
            })
            .join("")
        : (rowValuesInto(chunk, i, scratch), contentKey(scratch, seen))

    bucket(targetTable).push({ sourceKey, fields })
  }

  return { rows: out, errors, unmappedColumnCount, byTable }
}

/**
 * 정규화된 값을 매핑이 요구하는 종류로 맞춘다.
 *
 * `raw`를 따로 받는 이유: 컬럼 추론이 `text`로 봤는데 프로파일이 `number`를
 * 요구하는 경우, 정규화된 값이 아니라 **원본**을 다시 읽어야 한다. 평탄화
 * 이후에도 원본에 닿는 경로가 남아 있어야 하는 것이 이 함수 때문이다.
 */
function coerce(
  value: string | number | null,
  raw: RawCell,
  kind: FieldMapping["kind"],
): RawCell {
  if (value === null) return null
  switch (kind) {
    case "identifier":
      return String(value)
    case "number":
    case "percent":
      return typeof value === "number" ? value : (normalizeValue(raw).value as RawCell)
    case "date":
      return typeof value === "string" ? value : String(value)
    default:
      return typeof value === "number" ? String(value) : value
  }
}
