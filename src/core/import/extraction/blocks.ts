/**
 * 카드 레이아웃을 표로 편다 — **표가 아닌 파일을 받아내는 길.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 필요한가 (2026-08-19, 사용자 실파일) ★
 *
 * 파이프라인 전체가 «행 = 레코드, 열 = 필드»를 전제한다. 그런데 셀러가 손으로
 * 만든 단가표는 대개 표가 아니라 **카드**다. 사용자의 실제 원가표(13MB · 15시트)가
 * 정확히 그 모양이었다:
 *
 * ```
 * +0  품명 | · | 모델명 | MW-DOC | 권장소비자가 | · | 42900 | · | 원가 | 9200 | · | 100
 * +1  ·    | · | 구성품
 * +2  ·    | · | 옵션/색상 | 애플워치 전용… | 온라인 판매가 | · | 24800 | · | 재고
 * +3  ·    | · | 특징 | 5,000MAH + 워치충전독
 * +4  ·    | · | · | · | Special partner | · | 13000 | · | 비고 | 빅셀러 13,000
 * +5  (빈)  +6 (빈)                                   ← 여기까지가 상품 하나. 7행이다
 * ```
 *
 * 헤더 행이 **없고** 한 레코드가 7행에 걸쳐 있다. 라벨(`원가`·`모델명`)이 값의
 * **왼쪽 칸**에 적혀 있고, 시트 하나에 병합이 350개다.
 *
 * ★ 「열 지정 UI」로는 못 푼다 ★
 * §20 5층의 «사람이 열을 고른다»는 표를 전제한다 — *"어느 열이 원가냐"*를 묻는데
 * 여기엔 **답할 열이 없다.** 원가는 (행 +0, 열 9)에 있고 그 왼쪽 칸에 「원가」라는
 * 글자가 적혀 있을 뿐이다. 그래서 열 번호가 아니라 **라벨로** 찾는다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 이 모듈은 **어댑터**다 ★
 *
 * ```
 * 카드 시트 → [블록 리더] → 표(품명|모델명|원가) → 기존 Normalization·Mapping·Load
 * ```
 *
 * 뒤 단계를 하나도 안 고치는 것이 요점이다. 파이프라인의 «단계 간에는 직렬화
 * 가능한 값만 넘긴다»가 지켜지고, 블록이 아닌 파일은 이 코드를 지나지도 않는다.
 *
 * ★ 마켓을 모른다 (LOCK 4) ★
 * 라벨 문자열(`원가`·`모델명`)은 **전부 프로파일 JSON에서 온다.** 여기 있는 것은
 * 「라벨 오른쪽 첫 값」이라는 규칙뿐이다.
 */

import type { RawCell, RawRow } from "../types.js"

export interface BlockField {
  /** 시트에 적힌 라벨 그대로. `trim` 후 **정확히** 일치해야 한다. */
  readonly label: string
  /** 이 값이 표에서 가질 컬럼 이름. 프로파일의 매핑이 이 이름을 본다. */
  readonly as: string
}

export interface BlockReadRule {
  /**
   * 이 열에 값이 있으면 **새 블록의 시작**이다.
   *
   * 실측 파일에서는 0열(품명)이다. 블록 안의 나머지 행은 이 열이 비어 있어서
   * 「어디서 끊기나」를 이 한 열로 알 수 있다.
   */
  readonly anchorColumn: number
  /** 앵커 셀의 값이 가질 컬럼 이름 (「품명」). */
  readonly anchorAs: string
  readonly fields: readonly BlockField[]
  /**
   * 라벨에서 오른쪽으로 **몇 칸까지** 값을 찾나. 기본 3.
   *
   * 병합 때문에 라벨과 값 사이에 빈 칸이 낀다(`권장소비자가`(4) → 값(6)). 그렇다고
   * 끝까지 훑으면 값이 빈 라벨이 **옆 필드의 값을 집어온다** — 「원가」가 비었을 때
   * 「카톤(내품수량)」을 원가로 읽는 사고가 그것이다. 거리로 막는다.
   */
  readonly maxSpan?: number
  /** 앞의 몇 행은 배너다 — 앵커 판정에서 뺀다. 기본 2. */
  readonly skipRows?: number
  /**
   * 주기 이탈을 어디까지 봐주나 (0~1). 기본 0.1.
   *
   * ★ 넘으면 **거부한다** ★ 주기가 흔들리는 시트를 억지로 읽으면 블록 경계가
   * 밀려서 **A 상품의 원가가 B 상품에 붙는다.** 그건 못 읽는 것보다 훨씬 나쁘다 —
   * 숫자가 나오는데 틀렸고, 아무도 모른다 (LOCK 6).
   */
  readonly maxIrregular?: number
  /**
   * ★ 라벨이 **자리를 가르친다** ★ (0~1, 기본 0.9)
   *
   * 실측에서 블록 10개가 「원가」 라벨 셀만 비어 있었다 — 값은 늘 있던 그 자리에
   * 그대로 있는데 사람이 라벨을 지웠거나 병합이 삼킨 것이다. 라벨만 보면 그
   * 10개를 통째로 잃는다.
   *
   * 그래서 라벨을 **찾은** 블록들에서 값의 좌표를 배우고, 라벨이 없는 블록은
   * 그 좌표에서 읽는다. 실측 좌표 일치율:
   *
   * ```
   * 원가         행+0,열9  = 99%
   * 권장소비자가   행+0,열6  = 100%
   * 모델명        행+0,열3  = 90%
   * ```
   *
   * 이 값 미만이면 **배우지 않는다** — 자리가 흔들리는 시트에서 좌표로 읽으면
   * 엉뚱한 칸을 원가로 집는다. 못 읽는 것보다 나쁘다 (LOCK 6).
   */
  readonly positionConfidence?: number
}

export interface BlockReadResult {
  /** 합성 헤더. `[anchorAs, ...fields.as]` 순서다. */
  readonly header: readonly string[]
  /** 블록 하나가 행 하나가 된다. */
  readonly rows: readonly RawRow[]
  /** 판정된 주기 (행 수). */
  readonly period: number
  /** 주기를 벗어난 블록의 비율. `maxIrregular` 이하일 때만 여기 온다. */
  readonly irregular: number
  /** 앵커 행 수 = 블록 수. */
  readonly blocks: number
  /** 필드별로 값을 **찾지 못한** 블록 수. 조용히 빈칸으로 두지 않는다. */
  readonly missing: Readonly<Record<string, number>>
  /** 라벨로 찾은 수. */
  readonly byLabel: Readonly<Record<string, number>>
  /** **배운 자리**로 찾은 수 — 라벨이 없던 블록이다. 추론이므로 따로 센다. */
  readonly byPosition: Readonly<Record<string, number>>
  /** 필드별로 배운 좌표. `null`이면 일치율이 모자라 안 배웠다. */
  readonly learned: Readonly<Record<string, { rowOffset: number; column: number } | null>>
}

const text = (c: RawCell | undefined): string =>
  c === null || c === undefined ? "" : String(c).trim()

/** 최빈값. 동률이면 **작은 쪽** — 주기를 크게 잡으면 블록을 삼킨다. */
function mode(ns: readonly number[]): number {
  const count = new Map<number, number>()
  for (const n of ns) count.set(n, (count.get(n) ?? 0) + 1)
  let best = 0
  let bestN = 0
  for (const [n, c] of [...count].sort((a, b) => a[0] - b[0])) {
    if (c > bestN) {
      best = n
      bestN = c
    }
  }
  return best
}

/**
 * 카드 시트를 표로 편다. **실패하면 던진다** — 조용히 반쯤 읽지 않는다.
 *
 * 던지는 경우는 셋이고 전부 «틀리게 읽느니 안 읽는다»에 해당한다:
 * 앵커가 2개 미만(주기를 잴 수 없다) · 주기가 0 이하 · 이탈률 초과.
 */
export function readBlocks(rows: readonly RawRow[], rule: BlockReadRule): BlockReadResult {
  const skip = rule.skipRows ?? 2
  const span = rule.maxSpan ?? 3
  const maxIrregular = rule.maxIrregular ?? 0.1

  const anchors: number[] = []
  for (let i = skip; i < rows.length; i++) {
    if (text(rows[i]?.[rule.anchorColumn]) !== "") anchors.push(i)
  }
  if (anchors.length < 2) {
    throw new Error(
      `블록을 찾지 못했다 — ${rule.anchorColumn}열에 값이 있는 행이 ${anchors.length}개다. ` +
        `카드 레이아웃이 아니거나 앵커 열이 다르다`,
    )
  }

  const gaps: number[] = []
  for (let k = 1; k < anchors.length; k++) gaps.push(anchors[k]! - anchors[k - 1]!)
  const period = mode(gaps)
  if (period <= 0) throw new Error("블록 주기를 판정하지 못했다")
  const off = gaps.filter((g) => g !== period).length
  const irregular = gaps.length === 0 ? 0 : off / gaps.length
  if (irregular > maxIrregular) {
    throw new Error(
      `블록 주기가 고르지 않다 — ${period}행 주기에서 ${off}/${gaps.length}이 벗어난다 ` +
        `(${Math.round(irregular * 100)}%). 억지로 읽으면 앞 상품의 값이 뒤 상품에 붙는다`,
    )
  }

  /** 라벨 집합 — 값을 찾다가 **다른 라벨을 만나면 멈춘다**(빈 필드가 옆을 집지 않게). */
  const labels = new Set(rule.fields.map((f) => f.label))
  const header = [rule.anchorAs, ...rule.fields.map((f) => f.as)]
  const minShare = rule.positionConfidence ?? 0.9

  const bounds = anchors.map((from, k) => ({
    from,
    to: Math.min(k + 1 < anchors.length ? anchors[k + 1]! : from + period, rows.length),
  }))

  /**
   * ── 1차: 라벨로 찾는다. 값과 **함께 그 좌표도** 기록한다 ─────────
   * 좌표는 2차에서 「라벨이 없는 블록」을 살리는 데 쓴다.
   */
  const hits: Map<string, { value: RawCell; key: string }>[] = []
  const posCount = new Map<string, Map<string, number>>()
  for (const f of rule.fields) posCount.set(f.label, new Map())

  for (const { from, to } of bounds) {
    const found = new Map<string, { value: RawCell; key: string }>()
    for (let r = from; r < to; r++) {
      const row = rows[r]
      if (!row) continue
      for (let c = 0; c < row.length; c++) {
        const t = text(row[c])
        if (t === "" || !labels.has(t) || found.has(t)) continue
        // 라벨 오른쪽 첫 **비어 있지 않은** 칸. 병합 때문에 한두 칸 건너뛴다.
        for (let d = 1; d <= span && c + d < row.length; d++) {
          const v = row[c + d]
          const vt = text(v)
          if (vt === "") continue
          // 값이 아니라 **다음 라벨**이면 이 필드는 빈 것이다 — 집어오지 않는다.
          if (labels.has(vt)) break
          const key = `${r - from}:${c + d}`
          found.set(t, { value: v ?? null, key })
          const m = posCount.get(t)!
          m.set(key, (m.get(key) ?? 0) + 1)
          break
        }
      }
    }
    hits.push(found)
  }

  /**
   * ── 좌표를 배운다 — **압도적 다수일 때만** ────────────────────
   * 일치율이 모자라면 `null`로 두고 2차를 건너뛴다. 흔들리는 자리에서 좌표로
   * 읽으면 엉뚱한 칸이 원가가 된다.
   */
  const learned: Record<string, { rowOffset: number; column: number } | null> = {}
  const learnedKey = new Map<string, string>()
  for (const f of rule.fields) {
    const m = posCount.get(f.label)!
    const total = [...m.values()].reduce((n, c) => n + c, 0)
    const top = [...m].sort((a, b) => b[1] - a[1])[0]
    if (top === undefined || total === 0 || top[1] / total < minShare) {
      learned[f.as] = null
      continue
    }
    const [ro, col] = top[0].split(":").map(Number) as [number, number]
    learned[f.as] = { rowOffset: ro, column: col }
    learnedKey.set(f.label, top[0])
  }

  /** ── 2차: 행을 만든다. 라벨이 없으면 배운 자리에서 읽는다 ────── */
  const missing: Record<string, number> = {}
  const byLabel: Record<string, number> = {}
  const byPosition: Record<string, number> = {}
  for (const f of rule.fields) {
    missing[f.as] = 0
    byLabel[f.as] = 0
    byPosition[f.as] = 0
  }

  const out: RawRow[] = []
  bounds.forEach(({ from, to }, k) => {
    const found = hits[k]!
    const row: RawCell[] = [rows[from]?.[rule.anchorColumn] ?? null]
    for (const f of rule.fields) {
      const hit = found.get(f.label)
      if (hit !== undefined) {
        byLabel[f.as] = (byLabel[f.as] ?? 0) + 1
        row.push(hit.value)
        continue
      }
      const at = learned[f.as]
      let picked: RawCell = null
      if (at !== null && at !== undefined) {
        const r = from + at.rowOffset
        if (r < to) {
          const v = rows[r]?.[at.column]
          const vt = text(v)
          // 그 자리가 비었거나 **라벨이면** 안 읽는다 — 배치가 밀린 블록이다.
          if (vt !== "" && !labels.has(vt)) picked = v ?? null
        }
      }
      if (picked === null) missing[f.as] = (missing[f.as] ?? 0) + 1
      else byPosition[f.as] = (byPosition[f.as] ?? 0) + 1
      row.push(picked)
    }
    out.push(row)
  })

  return {
    header,
    rows: out,
    period,
    irregular,
    blocks: anchors.length,
    missing,
    byLabel,
    byPosition,
    learned,
  }
}
