/**
 * 파일이 가진 열을 **있는 그대로 서술한다** — 매핑 이전의 사실.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 이 파일이 있는 이유 ★
 *
 * 지금까지 헤더는 «프로파일에 맞는지»를 묻는 재료로만 쓰이고 버려졌다. 맞으면
 * 매핑이 되고, 안 맞으면 파일이 통째로 증발했다. 둘 다 **헤더 자체는 안 남는다.**
 *
 * 그래서 앱은 매달 같은 파일을 받으면서도 그 열의 이름조차 모른다. 별칭 사전의
 * 재료가 헤더인데 쌓이지 않으니 학습이 구조적으로 불가능하다 (마이그레이션 009).
 *
 * 여기서 만드는 것은 **판단이 아니라 서술**이다. 「이 열은 매출이다」가 아니라
 * 「0번 열의 이름은 '날짜'이고 표본은 '2026-07-01'이며 날짜로 보인다」이다.
 * 판단(목적지 전용 필드)은 프로파일과 사람이 한다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 실행환경 중립 (ADR-011) ★ `node:`도 파서도 import하지 않는다. 값만 받는다.
 */

import { inferColumnKind } from "./normalization/column.js"
import type { NormalizedKind, RawRow } from "./types.js"

/**
 * 표본값의 길이 상한.
 *
 * 셀 하나가 수천 자인 경우가 실제로 있다(주소·옵션 문자열이 붙은 열). 표본은
 * **사람이 열을 알아보기 위한 것**이라 한 줄이면 충분하고, 상한이 없으면
 * 「열 100개짜리 파일」 하나가 DB를 부풀린다.
 */
export const SAMPLE_MAX = 120

/**
 * 종류 추론에 쓸 행 수.
 *
 * `inferColumnKind`는 열마다 최대 200개를 보는데, 그건 **주어진 행 안에서**의
 * 상한이다. 적재 경로가 8만 행을 들고 있을 수는 없으므로(LOCK 5) 앞에서 잘라
 * 넘긴다. 20행이면 「전부 정수 표기」·「대부분 날짜」 같은 판정에 충분하고,
 * 판정 단계(`analyzeImport`)의 기본 미리보기 행 수와도 같다 — **두 경로가 같은
 * 표본을 보아야 같은 답이 나온다.**
 */
export const SAMPLE_ROWS = 20

/** 한 열에 대해 우리가 아는 전부. DB `file_column` 한 줄과 같은 모양이다. */
export interface ColumnSighting {
  /** 0-기준 열 순번. **이름이 겹치는 열이 실제로 있어서** 이름은 키가 못 된다. */
  readonly ordinal: number
  readonly header: string
  /** 첫 비어 있지 않은 표본. 없으면 null — 빈 열인 것도 사실이다. */
  readonly sample: string | null
  readonly kind: NormalizedKind
  readonly confidence: number
  /** 왜 그렇게 봤는가. §20 규칙 2 — 근거는 %가 아니라 문장이다. */
  readonly reason: string
}

/** 표본으로 쓸 수 있는 값인가. 공백만 있는 문자열은 값이 아니다. */
function isSampleable(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (typeof v === "string") return v.trim() !== ""
  return true
}

function sampleOf(rows: readonly RawRow[], col: number): string | null {
  for (const row of rows) {
    const v = row[col]
    if (!isSampleable(v)) continue
    const s = typeof v === "string" ? v.trim() : String(v)
    return s.length > SAMPLE_MAX ? s.slice(0, SAMPLE_MAX) : s
  }
  return null
}

/**
 * 헤더 + 표본 행 → 열 서술.
 *
 * ★ 열 수는 헤더가 정한다 ★
 * 데이터 행이 헤더보다 긴 경우가 있다(ragged — 파서가 그대로 흘린다). 그 꼬리를
 * 열로 세면 이름 없는 열이 생기고, 「이 파일은 63열」 같은 대조가 파일마다
 * 흔들린다. 헤더가 선언한 만큼만 서술하고, 남는 꼬리는 여기서 판단하지 않는다
 * — 그것은 매핑 단계가 `unmappedColumns`로 이미 세고 있다.
 *
 * 이름이 빈 열도 **버리지 않는다.** 빈 이름 역시 그 파일의 사실이고, 빼면
 * 순번이 밀려서 「몇 번째 열」이 어긋난다.
 */
export function describeColumns(
  headers: readonly string[],
  rows: readonly RawRow[],
): ColumnSighting[] {
  return headers.map((raw, ordinal) => {
    const header = raw.trim()
    const inf = inferColumnKind(header, rows, ordinal)
    return {
      ordinal,
      header,
      sample: sampleOf(rows, ordinal),
      kind: inf.kind,
      confidence: inf.confidence,
      reason: inf.reason,
    }
  })
}
