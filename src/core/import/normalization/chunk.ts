/**
 * columnar 청크 접근자.
 *
 * `NormalizedChunk`는 메서드가 없는 평범한 데이터다 (직렬화 경계 — ADR-001).
 * 읽는 쪽이 `r * width + c`를 손으로 쓰면 그 계산이 코드 곳곳에 퍼지므로
 * 여기 자유 함수로 모아둔다.
 *
 * 전부 **할당하지 않는다** — `cellAt`만 예외이고, 그건 이름이 말하듯 객체를
 * 달라고 한 경우다. 표를 통째로 도는 경로에서는 쓰지 않는다.
 */

import { KIND_NAMES } from "../types.js"
import type { NormalizedChunk, NormalizedKind, NormalizedValue, RawCell } from "../types.js"

export function cellKind(ch: NormalizedChunk, r: number, c: number): NormalizedKind {
  return KIND_NAMES[ch.kinds[r * ch.width + c]!]!
}

export function cellValue(ch: NormalizedChunk, r: number, c: number): string | number | null {
  return ch.values[r * ch.width + c] ?? null
}

export function cellRaw(ch: NormalizedChunk, r: number, c: number): RawCell {
  return ch.raws[r * ch.width + c] ?? null
}

/**
 * 객체가 정말 필요할 때만. 셀당 객체 하나를 만드는 것이 평탄화로 없앤 바로 그
 * 비용이므로, **행 수에 비례해 부르지 않는다.**
 */
export function cellAt(ch: NormalizedChunk, r: number, c: number): NormalizedValue {
  const i = r * ch.width + c
  return { kind: KIND_NAMES[ch.kinds[i]!]!, value: ch.values[i] ?? null, raw: ch.raws[i] ?? null }
}

/**
 * 한 행의 값을 호출자가 준 배열에 채운다. 배열을 돌려주지 않는 이유는
 * 재사용을 강제하기 위해서다 — 행마다 새 배열을 만들면 평탄화가 무의미해진다.
 */
export function rowValuesInto(
  ch: NormalizedChunk,
  r: number,
  out: (string | number | null)[],
): void {
  const base = r * ch.width
  for (let c = 0; c < ch.width; c++) out[c] = ch.values[base + c] ?? null
}

/** 테스트·도구용. 청크를 예전 모양(행 배열)으로 되돌린다 — 프로덕션 경로에서 쓰지 않는다. */
export function toRows(ch: NormalizedChunk): NormalizedValue[][] {
  const rows: NormalizedValue[][] = []
  for (let r = 0; r < ch.rowCount; r++) {
    const row: NormalizedValue[] = []
    for (let c = 0; c < ch.width; c++) row.push(cellAt(ch, r, c))
    rows.push(row)
  }
  return rows
}
