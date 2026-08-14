/**
 * `source_key` 방어 테스트 — ADR-006의 경고를 실효화한다.
 *
 * 이 파일이 있는 이유는 하나다. `mapping/index.ts`의 두 `join()`이 소스에서
 * **빈 문자열로 보이는데 실제 바이트는 `U+0001`**이기 때문이다. 에디터·grep·
 * 코드 리뷰 어디에서도 안 보인다.
 *
 * "빈 문자열이네" 하고 정리하는 순간 모든 `source_key`가 바뀐다. 키가 바뀌면
 * UPSERT 정체성이 바뀌므로 재가져오기가 기존 행을 갱신하지 못하고 전부 새 행으로
 * 쌓인다 — 이중 집계이고, 화면에는 그냥 큰 숫자로 보인다 (헌장 A-5).
 *
 * 그래서 여기서 **분리자를 코드포인트 수준으로 못 박고**, 알려진 입력의 키를
 * 리터럴로 고정한다. 분리자가 바뀌면 이 두 테스트가 정확한 사유와 함께 깨진다.
 *
 * 기대값은 `String.fromCharCode(1)`로 만든다 — 소스에 제어문자를 직접 박으면
 * 이 파일도 똑같이 안 보이는 문제를 갖게 된다.
 */

import { describe, it, expect } from "vitest"
import { mapRows, newKeyState, type MappingProfile } from "../src/core/import/mapping/index.js"
import { KIND_NULL, KIND_NUMBER, KIND_TEXT } from "../src/core/import/types.js"
import type { NormalizedChunk, RawCell } from "../src/core/import/types.js"

/** 분리자의 정체. 이 값이 곧 계약이다. */
const SEP = String.fromCharCode(1)

/** 테스트용 columnar 청크. 값을 그대로 raw로도 둔다. */
function chunkOf(rows: readonly (readonly (string | number | null)[])[]): NormalizedChunk {
  const rowCount = rows.length
  const width = rows[0]?.length ?? 0
  const kinds = new Uint8Array(rowCount * width)
  const values: (string | number | null)[] = new Array(rowCount * width).fill(null)
  const raws: RawCell[] = new Array(rowCount * width).fill(null)

  for (let r = 0; r < rowCount; r++) {
    for (let c = 0; c < width; c++) {
      const v = rows[r]![c] ?? null
      const i = r * width + c
      values[i] = v
      raws[i] = v
      kinds[i] = v === null ? KIND_NULL : typeof v === "number" ? KIND_NUMBER : KIND_TEXT
    }
  }
  // 합성 청크라 합계·빈 행이 없다 — 물리 행과 데이터 행이 1:1이다
  const rowIndices = Int32Array.from({ length: rowCount }, (_, i) => i)
  return { sheetIndex: 0, startRow: 0, rowIndices, isLast: true, width, rowCount, kinds, values, raws }
}

function profile(sourceKey: MappingProfile["sourceKey"]): MappingProfile {
  return {
    id: "test/profile",
    version: "1",
    packId: "test",
    marketplaceKey: "test",
    docType: "test",
    grain: "test",
    targetTable: "fact_ad_spend",
    label: "테스트",
    displayName: "테스트 채널",
    recognitionRules: {
      containerFormats: ["xlsx"],
      requiredHeaders: [],
      headerMatch: "all",
      minConfidence: 0,
    },
    extractionRules: { sheetSelector: { kind: "firstData" } },
    sourceKey,
    fieldMappings: [
      { target: "campaign_key", source: "A", kind: "identifier" },
      { target: "campaign_name", source: "B", kind: "text" },
    ],
    validationRules: [],
  }
}

const CTX = { fileName: "t.xlsx", fileNameCaptures: {}, keyState: newKeyState() }
const HEADERS = ["A", "B"]

describe("source_key 분리자 — 소스에서 빈 문자열처럼 보이지만 U+0001이다 (ADR-006)", () => {
  it("natural 전략의 키는 U+0001로 이어진다 — 코드포인트까지 고정", () => {
    const mapped = mapRows(
      profile({ strategy: "natural", columns: ["A", "B"] }),
      HEADERS,
      chunkOf([["a", "bc"]]),
      { ...CTX, keyState: newKeyState() },
    )

    const key = mapped.rows[0]!.sourceKey
    expect(key).toBe("a" + SEP + "bc")
    // ★ 이 단언이 핵심이다 ★ 분리자를 ""로 "정리"하면 여기서 깨진다.
    expect(key.charCodeAt(1)).toBe(1)
    expect(key).toHaveLength(4)
  })

  it("분리자가 있어야 서로 다른 행이 같은 키를 받지 않는다 — 분리자의 존재 이유", () => {
    const p = profile({ strategy: "natural", columns: ["A", "B"] })
    const a = mapRows(p, HEADERS, chunkOf([["a", "bc"]]), { ...CTX, keyState: newKeyState() })
    const b = mapRows(p, HEADERS, chunkOf([["ab", "c"]]), { ...CTX, keyState: newKeyState() })

    // 분리자가 ""였다면 둘 다 "abc"가 되어 UPSERT로 합쳐진다.
    expect(a.rows[0]!.sourceKey).not.toBe(b.rows[0]!.sourceKey)
    expect(a.rows[0]!.sourceKey).toBe("a" + SEP + "bc")
    expect(b.rows[0]!.sourceKey).toBe("ab" + SEP + "c")
  })

  it("content 전략도 같은 분리자를 쓴다 — 셀 경계가 바뀌면 키가 갈린다", () => {
    const p = profile({ strategy: "content" })
    const a = mapRows(p, HEADERS, chunkOf([["a", "bc"]]), { ...CTX, keyState: newKeyState() })
    const b = mapRows(p, HEADERS, chunkOf([["ab", "c"]]), { ...CTX, keyState: newKeyState() })

    expect(a.rows[0]!.sourceKey).not.toBe(b.rows[0]!.sourceKey)
  })
})

describe("source_key 회귀 — 알려진 입력의 키를 리터럴로 고정한다", () => {
  /**
   * ★ 이 값이 바뀌면 저장된 모든 키와 어긋난다 ★
   *
   * 깨졌다면 셋 중 하나다:
   *   1. 분리자가 바뀌었다 (U+0001 → 다른 것). ADR-006을 읽어라
   *   2. canonical 인코딩이 바뀌었다 (`typeof v` 접두사·null 표기 `~`)
   *   3. sha1 앞 6바이트를 정수로 쓰는 방식이 바뀌었다
   *
   * 어느 쪽이든 **기존 DB의 키를 전부 재계산해야 한다.** 값만 갱신하고 넘어가면
   * 재가져오기가 이중 집계된다. 사유 없이 이 리터럴을 고치지 마라.
   */
  it("content 전략 — 고정 입력 → 고정 키", () => {
    const mapped = mapRows(
      profile({ strategy: "content" }),
      HEADERS,
      chunkOf([["a", "bc"]]),
      { ...CTX, keyState: newKeyState() },
    )
    expect(mapped.rows[0]!.sourceKey).toBe("53e4dad7616d:0")
  })

  it("natural 전략 — 고정 입력 → 고정 키", () => {
    const mapped = mapRows(
      profile({ strategy: "natural", columns: ["A", "B"] }),
      HEADERS,
      chunkOf([["캠페인-1", "이름"]]),
      { ...CTX, keyState: newKeyState() },
    )
    expect(mapped.rows[0]!.sourceKey).toBe("캠페인-1" + SEP + "이름")
  })

  it("내용이 완전히 같은 행은 순번으로 갈린다 (ADR-006) — 파일 전체에서 센다", () => {
    const p = profile({ strategy: "content" })
    const keyState = newKeyState()
    const mapped = mapRows(p, HEADERS, chunkOf([["a", "bc"], ["a", "bc"]]), { ...CTX, keyState })

    expect(mapped.rows[0]!.sourceKey).toBe("53e4dad7616d:0")
    expect(mapped.rows[1]!.sourceKey).toBe("53e4dad7616d:1")
  })

  it("청크가 갈려도 순번은 이어진다 — keyState는 파일 단위다", () => {
    const p = profile({ strategy: "content" })
    const keyState = newKeyState()
    const first = mapRows(p, HEADERS, chunkOf([["a", "bc"]]), { ...CTX, keyState }, 0)
    const second = mapRows(p, HEADERS, chunkOf([["a", "bc"]]), { ...CTX, keyState }, 1)

    // 청크마다 newKeyState()를 만들면 둘 다 :0이 되어 UPSERT로 합쳐진다.
    expect(first.rows[0]!.sourceKey).toBe("53e4dad7616d:0")
    expect(second.rows[0]!.sourceKey).toBe("53e4dad7616d:1")
  })
})
