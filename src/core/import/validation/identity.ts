/**
 * 항등식 증명 — **값들 사이의 관계가 200행 전부에서 성립하면 증명이다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 (계획 C · §20 4층) ★
 *
 * 값 하나는 아무것도 안 알려준다 — 11번가 정산은 금액 열이 41개이고 전부 원이고
 * 전부 비슷한 크기다. 그런데 **관계**는 증명이 된다: `A = B + C`가 검사한 행
 * 전부에서 성립하면 그건 추측이 아니라 사실이고, §20 규칙 2의 그 문장이 된다 —
 * *"판매합계−공제와 128행 일치"*.
 *
 * ★ 이 파일은 관계만 증명한다 — 이름은 못 짓는다 ★
 * `A = B + C`가 성립해도 A가 무슨 필드인지는 여기서 모른다. 이름은
 * `IDENTITY_TEMPLATES`(등록부)와 확정된 이웃 열이 함께 지목한다 — 그 연결은
 * `judge.ts`의 일이다. 템플릿 밖 항등은 tier를 못 올리고 문장만 남는다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ Validation 칸의 첫 실입주자 — 그러나 그 부채를 닫는 것은 아니다 ★
 * 「validationRules 미실행」 부채(작업-상태)는 **적재 시** 선언 규칙을 실행하는
 * 일이고, 이건 **판정 시** 관계를 증명하는 일이다. 종류가 다르다.
 */

export interface NumericColumn {
  readonly ordinal: number
  readonly header: string
}

export interface IdentityFinding {
  /** 합의 결과 열: `values[result] = values[a] + values[b]`. */
  readonly result: number
  readonly a: number
  readonly b: number
  /** 셋 다 값이 있어 실제로 검사한 행 수. */
  readonly rowsChecked: number
  /** §20 규칙 2 — 근거는 %가 아니라 문장이다. */
  readonly sentence: string
}

/** 정수 허용오차 — 반올림 1원. 이것보다 넓히면 「거의 맞다」가 증명이 된다. */
const TOLERANCE = 1
/** 선별 표본 — 이만큼 먼저 보고 통과한 3중조만 전량 검사한다. */
const PREFILTER_ROWS = 8
/** 이보다 적은 행으로는 증명이라 부르지 않는다 — 우연의 여지가 크다. */
const MIN_ROWS = 8

/**
 * 숫자 열들 사이의 합 항등을 찾는다: `result = a + b` (a ≤ b 한 방향만).
 *
 * 뺄셈은 따로 찾지 않는다 — `net = gross − fee`는 `gross = net + fee`와 같은
 * 관계라 합 형태 하나로 전부 잡힌다. 곱(`a ≈ b×c`)은 v1 밖이다(허용오차 정의가
 * 다르고 대상 실물이 아직 없다 — 계획의 트리거 목록).
 *
 * ★ 퇴화 방지 — 0이 아니라 **실질**이 기준이다 (실측 2026-08-19) ★
 * 한 항이 전부 0이면 `a = b`가 된다 — 금지한 항 하나짜리 항등이다. 그런데 0
 * 검사만으로는 모자랐다: 허용오차 ±1 아래에서 **잔값 열이 0처럼 삼켜진다.**
 * 실측 — 11번가 광고 리포트에서 「총 전환수」=「클릭률」+「직접 전환수」 같은
 * 거짓 항등이 10건 나왔다. 클릭률(≤1)이 오차 안에 통째로 들어가 아무 합에나
 * 붙는 것이다. 그래서 각 항과 결과가 검사 행 어딘가에서 **|값| > 허용오차**를
 * 넘어야 한다 — 오차 안에서만 사는 열은 관계의 항이 될 수 없다.
 *
 * @param matrix 행 우선 — `matrix[row][i]`는 `columns[i]`의 값. null = 못 읽음.
 */
export function proveIdentities(
  columns: readonly NumericColumn[],
  matrix: readonly (readonly (number | null)[])[],
): IdentityFinding[] {
  const n = columns.length
  if (n < 3 || matrix.length < MIN_ROWS) return []

  const holds = (r: number, aI: number, bI: number, row: readonly (number | null)[]): boolean => {
    const rv = row[r]
    const av = row[aI]
    const bv = row[bI]
    if (rv === null || rv === undefined || av === null || av === undefined || bv === null || bv === undefined)
      return false
    return Math.abs(rv - (av + bv)) <= TOLERANCE
  }

  const out: IdentityFinding[] = []
  for (let r = 0; r < n; r++) {
    for (let a = 0; a < n; a++) {
      if (a === r) continue
      for (let b = a + 1; b < n; b++) {
        if (b === r) continue

        // ── 선별: 앞의 몇 행이 어긋나면 바로 버린다 ────────────
        let pre = 0
        let ok = true
        for (const row of matrix) {
          if (row[r] == null || row[a] == null || row[b] == null) continue
          if (!holds(r, a, b, row)) {
            ok = false
            break
          }
          pre++
          if (pre >= PREFILTER_ROWS) break
        }
        if (!ok || pre === 0) continue

        // ── 전량 검사 + 퇴화 방지 ──────────────────────────────
        let checked = 0
        let aMaterial = false
        let bMaterial = false
        let rMaterial = false
        for (const row of matrix) {
          if (row[r] == null || row[a] == null || row[b] == null) continue
          if (!holds(r, a, b, row)) {
            ok = false
            break
          }
          if (Math.abs(row[a]!) > TOLERANCE) aMaterial = true
          if (Math.abs(row[b]!) > TOLERANCE) bMaterial = true
          if (Math.abs(row[r]!) > TOLERANCE) rMaterial = true
          checked++
        }
        if (!ok || checked < MIN_ROWS || !aMaterial || !bMaterial || !rMaterial) continue

        out.push({
          result: columns[r]!.ordinal,
          a: columns[a]!.ordinal,
          b: columns[b]!.ordinal,
          rowsChecked: checked,
          sentence:
            `「${columns[r]!.header}」 = 「${columns[a]!.header}」 + 「${columns[b]!.header}」` +
            ` — ${checked}행 중 ${checked}행 일치`,
        })
      }
    }
  }
  return out
}
