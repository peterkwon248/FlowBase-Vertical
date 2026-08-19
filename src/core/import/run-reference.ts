/**
 * 기준 데이터를 넣는다 — **두 번째 문.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 문이 둘이어야 하나 ★
 *
 * 헌장의 데이터 3종에서 «사실»과 «기준»은 적재 규칙이 정반대다:
 *
 * ```
 * 사실  주문·정산   batch로 쌓고 되돌린다 · 원본 불변 · append-only
 * 기준  원가        덮어쓴다 · 이력이 남는다 · **적용일**이 있다
 * ```
 *
 * 지금까지 가져오기는 사실 전용이었다(`FACT_TABLES`가 5표로 닫는다). 그래서 앱이
 * 커버리지 화면에서 *"매입원가 — 잠김, 필요: cost"*라고 **말해 놓고 넣을 문이
 * 없었다.** 말과 행동이 어긋난 자리였고, 이 파일이 그걸 없앤다.
 *
 * ★ 갈라지는 것은 **적재뿐**이다 ★
 * 판정·파싱·정규화(Recognition→Extraction→Normalization)는 `runImport`와 **같은
 * 코드**를 지난다. 여기서 파서를 새로 부르거나 헤더를 다시 찾지 않는다 — 두 벌이
 * 되는 순간 «같은 파일, 다른 해석»이 생긴다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 원가는 SKU에 붙는데 파일은 SKU를 모른다 ★
 *
 * 파일이 아는 것은 마켓의 상품번호이고 그건 곧 **리스팅 키**다. 그래서:
 *
 * ```
 * 상품번호 → 리스팅 찾기 → 그 리스팅의 SKU에 원가를 붙인다
 *                        └ SKU가 없으면 **1:1로 만든다**
 * ```
 *
 * 1:1 자동 생성은 «같은 물건인지» 판단을 **미루는 것이지 틀리게 하는 것이 아니다.**
 * 리스팅 하나가 곧 물건 하나라는 가장 보수적인 가정이고, 합계는 어긋나지 않는다.
 * 나중에 사람이 「이 셋은 같다」고 합치면 그때 한 줄이 된다 — 그 판단은 데이터에
 * 답이 없어서 자동화할 수 없고(§21-6), 그걸 기다리느라 원가를 못 넣는 것이 더 나쁘다.
 *
 * ★ 적용일은 파일에 없다 ★
 * 원가표에는 «언제부터 이 원가인가»가 없다. 사람이 정해야 하고(ADR-005의 이력),
 * 그래서 `effectiveFrom`을 인자로 받는다 — 지어내지 않는다.
 */

import { sniff } from "./recognition/sniff.js"
import { parserFor } from "./parsers/index.js"
import { streamSheet } from "./pipeline.js"
import { profileVersion, type MappingProfile } from "./mapping/index.js"
import { normalizeValue } from "./normalization/value.js"
import type { ExcludedRow, HeaderDetection, SheetInfo } from "./types.js"
import type { Repository } from "../store/repository.js"

export interface ReferenceRunOptions {
  readonly bytes: Uint8Array
  readonly fileName: string
  /** `reference` 블록이 있는 프로파일. 없으면 이 함수를 부르면 안 된다. */
  readonly profile: MappingProfile
  readonly sheetIndex: number
  readonly libraryId: string
  /** **사람이 정한** 적용 시작일 (`YYYY-MM-DD`). 파일에 없으므로 지어내지 않는다. */
  readonly effectiveFrom: string
  readonly now: string
  /** 이미 같은 (SKU · 종류 · 적용일)이 있으면 덮어쓸까. 기본은 **안 덮는다**. */
  readonly replace?: boolean
  readonly chunkSize?: number
}

/** 행 하나가 어떻게 됐는지 — 합이 곧 파일 행 수다. */
export interface ReferenceRunResult {
  /** 새로 넣은 원가. */
  readonly inserted: number
  /** 이미 같은 값이 있어 **건너뛴** 것. `replace`가 참이면 0이다. */
  readonly skipped: number
  /** 덮어쓴 것. `replace`가 참일 때만 는다. */
  readonly replaced: number
  /** 상품번호로 리스팅을 못 찾은 행. **이게 0이 아닌 것이 정상이다** — 아래 참조. */
  readonly unmatched: number
  /** 그 과정에서 **새로 만든 SKU** 수. */
  readonly createdSkus: number
  /** 금액을 못 읽었거나 상품번호가 빈 행. */
  readonly badRows: number
  /** 파이프라인이 거른 행(합계·빈 행). 숨기지 않는다 (LOCK 6). */
  readonly excluded: readonly ExcludedRow[]
  readonly header: HeaderDetection
  readonly sheet: SheetInfo
  readonly warnings: readonly string[]
  /** 못 찾은 상품번호 표본 — 사람이 원인을 짚을 수 있게 앞의 몇 개를 든다. */
  readonly unmatchedSample: readonly string[]
  /**
   * 어느 종류로 들어갔나 (`cost_history.kind`). **화면이 이걸 되짚을 길이 없다** —
   * 결과만 들고는 «원가»인지 «물류비»인지 알 수 없어서 결과에 싣는다.
   */
  readonly kind: "COGS" | "PACKAGING" | "LOGISTICS" | "OTHER"
}

/** 원 단위 정수로 읽는다. 「1,200원」·「1200.0」 같은 표기를 넘긴다. */
function toWon(value: string | number | null, raw: unknown): number | null {
  const v = typeof value === "number" ? value : normalizeValue(raw as never).value
  if (typeof v !== "number" || !Number.isFinite(v)) return null
  // 원가는 원 단위다. 소수가 오면 반올림하되 **버리지 않는다** — 1원 차이가
  // 손익에 남는 것이 「읽지 못했다」보다 낫다.
  return Math.round(v)
}

export async function runReferenceImport(
  repo: Repository,
  o: ReferenceRunOptions,
): Promise<ReferenceRunResult> {
  const rule = o.profile.reference
  if (rule === undefined) {
    throw new Error(`기준 데이터 프로파일이 아니다: ${profileVersion(o.profile)}`)
  }

  const chunkSize = o.chunkSize ?? 1_000
  const rec = sniff(o.bytes, o.fileName)
  const top = rec.candidates[0]
  if (!top) throw new Error("컨테이너 포맷을 판정하지 못했다")

  const src = await parserFor(top.format).open(o.bytes, {
    chunkSize,
    ...(top.encoding === undefined ? {} : { encoding: top.encoding }),
    ...(top.delimiter === undefined ? {} : { delimiter: top.delimiter }),
  })

  try {
    const sheet = src.sheets[o.sheetIndex]
    if (!sheet) throw new Error(`시트 ${o.sheetIndex}는 없다`)

    /**
     * ★ 카드 레이아웃이면 블록 리더가 앞에서 표로 편다 ★
     *
     * 여기서 갈래를 만들지 않는 것이 요점이다 — 옵션 하나를 넘기면 그 뒤는 평범한
     * 표라서 열 찾기·정규화·적재가 하나도 안 바뀐다. 실측 사용자 파일이 그 경로로
     * 200블록 → 200행이 됐다.
     */
    const { chunks, getSummary } = streamSheet(src, o.sheetIndex, {
      chunkSize,
      ...(o.profile.blockRead === undefined ? {} : { blockRead: o.profile.blockRead }),
    })

    let headers: string[] = []
    let keyCol = -1
    let amountCol = -1
    let titleCol = -1

    let inserted = 0
    let skipped = 0
    let replaced = 0
    let unmatched = 0
    let createdSkus = 0
    let badRows = 0
    const unmatchedSample: string[] = []

    for await (const chunk of chunks) {
      if (headers.length === 0) {
        headers = [...getSummary().header.columns]
        const at = (name: string | undefined): number =>
          name === undefined ? -1 : headers.findIndex((h) => h.trim() === name.trim())
        keyCol = at(rule.listingKeyColumn)
        amountCol = at(rule.amountColumn)
        titleCol = at(rule.titleColumn)
        // 열이 없으면 **한 행도 못 넣는다.** 조용히 0건으로 끝내지 않는다 (LOCK 6).
        if (keyCol < 0 || amountCol < 0) {
          throw new Error(
            `기준 데이터 열을 찾지 못했다 — ` +
              `${keyCol < 0 ? `「${rule.listingKeyColumn}」 ` : ""}` +
              `${amountCol < 0 ? `「${rule.amountColumn}」 ` : ""}가 파일에 없다`,
          )
        }
      }

      for (let i = 0; i < chunk.rowCount; i++) {
        const base = i * chunk.width
        const key = String(chunk.values[base + keyCol] ?? "").trim()
        const amount = toWon(
          chunk.values[base + amountCol] ?? null,
          chunk.raws[base + amountCol] ?? null,
        )

        if (key === "" || amount === null) {
          badRows++
          continue
        }

        /**
         * ★ 못 찾는 것이 정상이다 ★
         * 원가표에는 아직 안 판 상품·단종된 상품이 섞여 있다. 그 행을 오류로
         * 다루면 사용자는 «파일이 잘못됐다»로 읽는데, 사실은 **아직 팔지 않아
         * 리스팅이 없는 것**이다. 세되 실패로 부르지 않는다.
         */
        const listing = await repo.listingByKey(o.libraryId, key)
        if (listing === null) {
          unmatched++
          if (unmatchedSample.length < 10) unmatchedSample.push(key)
          continue
        }

        let skuId = listing.skuId
        if (skuId === null) {
          const title =
            titleCol >= 0 ? String(chunk.values[base + titleCol] ?? "").trim() : ""
          const made = await repo.createSkuForListings(
            o.libraryId,
            [listing.id],
            title === "" ? listing.title : title,
            o.now,
          )
          if (made.skuId === null) {
            // 멱등 경로 — 그 사이 다른 요청이 이었다. 다시 읽어 붙인다.
            const again = await repo.listingByKey(o.libraryId, key)
            skuId = again?.skuId ?? null
          } else {
            skuId = made.skuId
            createdSkus++
          }
        }
        if (skuId === null) {
          unmatched++
          continue
        }

        const r = await repo.addCost({
          libraryId: o.libraryId,
          skuId,
          kind: rule.kind,
          amount,
          effectiveFrom: o.effectiveFrom,
          note: `${o.fileName} · ${profileVersion(o.profile)}`,
          now: o.now,
          // ★ 도구가 넣었다는 사실을 남긴다 ★ 001부터 있던 칸이고, 사람이 화면에서
          // 넣은 값과 구별돼야 나중에 «누가 이 값을 넣었나»를 되짚을 수 있다.
          enteredBy: "import",
          ...(o.replace === true ? { replace: true } : {}),
        })
        if (r.inserted) inserted++
        else if (r.replaced) replaced++
        else skipped++
      }
    }

    const sum = getSummary()
    return {
      inserted,
      skipped,
      replaced,
      unmatched,
      createdSkus,
      badRows,
      excluded: sum.excluded,
      header: sum.header,
      sheet,
      warnings: [...src.warnings, ...rec.identityNotes],
      unmatchedSample,
      kind: rule.kind,
    }
  } finally {
    src.close()
  }
}
