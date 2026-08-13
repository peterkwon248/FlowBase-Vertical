/**
 * 마켓 리스팅 추출 — **파일이 아는 가장 가는 판매 단위**를 뽑는다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 Fact 매핑과 따로인가 ★
 * 리스팅은 Fact가 아니라 dimension이고(`DIMENSION_TABLES`), 행 하나당 하나가
 * 아니라 **파일 전체에서 중복을 걷어낸 종류의 목록**이다. 주문 146행이 상품
 * 12종을 가리키면 리스팅은 12개다.
 *
 * 그래서 청크를 가로지르며 `Map`에 모은다 — 같은 상품이 몇 번 나오든 한 줄이다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 입도가 채널마다 다르다 ★
 * ESM 주문통합검색에는 옵션 컬럼이 없고 11번가 정산확정에는 있다. 그래서
 * ESM 리스팅은 상품 단위, 11번가는 옵션 단위가 된다. 같은 실물 상품이 ESM에선
 * 1개, 11번가에선 옵션 수만큼 N개로 잡힌다 — **결함이 아니라 이 비대칭의 정상
 * 표현이고**, 연결 화면에서 N:1 연결로 나타난다.
 *
 * 코드가 "11번가면 옵션이겠거니" 추론하게 두면 그 추론은 마켓 지식이 되어 core로
 * 샌다 (LOCK 4). 그래서 프로파일이 `grain`을 **선언**하고 core는 옮기기만 한다.
 */

import type { NormalizedChunk } from "../types.js"
import type { ListingUpsert } from "../../store/repository.js"

/**
 * 여러 컬럼으로 키를 만들 때의 구분자 — **ADR-006과 같은 `U+0001`**.
 *
 * ⚠ 소스에서 보이지 않는 문자다. 이 상수를 쓰고 리터럴을 직접 적지 않는다.
 */
export const KEY_SEP = ""

/** 프로파일이 선언하는 리스팅 규칙. 없으면 그 프로파일은 리스팅을 만들지 않는다. */
export interface ListingRule {
  /** 이 파일이 만드는 리스팅의 입도. 추론하지 않고 선언한다. */
  readonly grain: "product" | "option"
  /** 식별자를 이루는 컬럼들. 순서가 키의 순서다. */
  readonly keyColumns: readonly string[]
  /** 사람이 읽을 이름을 이루는 컬럼들. ` · `로 잇는다. */
  readonly titleColumns: readonly string[]
}

/**
 * 청크에서 리스팅을 뽑아 `into`에 모은다. **중복은 여기서 걷힌다.**
 *
 * 키 컬럼이 하나라도 비면 그 행은 리스팅을 만들지 않는다 — 식별자 없는 리스팅은
 * 다음 파일에서 같은 것인지 알 수 없어 매번 새로 생긴다.
 */
export function collectListings(
  rule: ListingRule,
  headers: readonly string[],
  chunk: NormalizedChunk,
  into: Map<string, ListingUpsert>,
): void {
  const index = new Map<string, number>()
  headers.forEach((h, i) => index.set(h.trim(), i))

  const keyCols = rule.keyColumns.map((c) => index.get(c.trim()))
  const titleCols = rule.titleColumns.map((c) => index.get(c.trim()))
  // 선언한 키 컬럼이 파일에 없으면 리스팅을 만들지 않는다. 반쪽 키로 만들면
  // 다음 파일과 이어지지 않아 중복 리스팅이 쌓인다.
  if (keyCols.some((c) => c === undefined)) return

  const cell = (base: number, col: number | undefined): string =>
    col === undefined || col >= chunk.width ? "" : String(chunk.values[base + col] ?? "").trim()

  for (let i = 0; i < chunk.rowCount; i++) {
    const base = i * chunk.width
    const parts = keyCols.map((c) => cell(base, c))
    if (parts.some((p) => p === "")) continue

    const key = parts.join(KEY_SEP)
    if (into.has(key)) continue // 먼저 본 이름을 쓴다 — 같은 파일 안에서는 같다

    const title = titleCols.map((c) => cell(base, c)).filter((t) => t !== "").join(" · ")
    into.set(key, { listingKey: key, title: title || key, grain: rule.grain })
  }
}
