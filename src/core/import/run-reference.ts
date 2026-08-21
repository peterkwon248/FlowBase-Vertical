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
import { sha1Bytes } from "./mapping/sha1.js"
import { KEY_SEP } from "./mapping/listing.js"
import { parserFor } from "./parsers/index.js"
import { streamSheet } from "./pipeline.js"
import { profileVersion, type MappingProfile } from "./mapping/index.js"
import { normalizeValue } from "./normalization/value.js"
import type { ExcludedRow } from "./types.js"
import type { Repository } from "../store/repository.js"

export interface ReferenceRunOptions {
  readonly bytes: Uint8Array
  readonly fileName: string
  /** `reference` 블록이 있는 프로파일. 없으면 이 함수를 부르면 안 된다. */
  readonly profile: MappingProfile
  /**
   * 처리할 시트들 — 위저드가 고른 하나거나, 같은 프로파일로 매칭된 전부 (ADR-019).
   *
   * ★ 왜 배열인가 ★ 시트별로 이 함수를 반복 호출하면 워크북을 시트 수만큼
   * 재파싱한다 — open이 시간의 98%이고(2.2MB에 3.3초 실측) 13MB 단가표 × 14시트
   * × 메인 스레드 = 사실상 앱 정지다. 파일 단위 작업(판정·열기·지문)은 1회,
   * 시트 루프만 돈다. **주어진 순서대로** 처리한다 — 호출부(위저드)는 시트 인덱스
   * 오름차순을 넘긴다 (ADR-019 B3: 순서가 결정적이어야 충돌의 승자도 결정적이다).
   */
  readonly sheetIndexes: readonly number[]
  readonly libraryId: string
  /** **사람이 정한** 적용 시작일 (`YYYY-MM-DD`). 파일에 없으므로 지어내지 않는다. */
  readonly effectiveFrom: string
  readonly now: string
  /** 이미 같은 (SKU · 종류 · 적용일)이 있으면 덮어쓸까. 기본은 **안 덮는다**. */
  readonly replace?: boolean
  readonly chunkSize?: number
}

/** 시트 하나가 어떻게 됐는지 — 다중 시트 실행에서 «어느 시트가 몇 건»의 재료다. */
export interface ReferenceSheetResult {
  readonly sheetIndex: number
  readonly sheetName: string
  readonly inserted: number
  readonly skipped: number
  readonly replaced: number
  readonly unmatched: number
  readonly stashed: number
  readonly bridged: number
  readonly createdSkus: number
  readonly badRows: number
  readonly excludedCount: number
  /**
   * 이 시트가 중간에 죽었으면 그 사유. null이면 끝까지 갔다.
   *
   * ★ 일급 항목이다 ★ warnings 문자열에만 남기면 아무 화면도 안 읽는다(실측 —
   * warnings의 소비처는 0이다). 한 시트의 실패가 나머지를 막지 않되(continue),
   * 다이제스트가 반드시 그린다. 행 단위 커밋이라 실패 시점까지의 부분 집계는
   * 살아 있다 — catch에서 버리면 다이제스트가 DB보다 적게 말한다 (LOCK 6).
   */
  readonly failed: string | null
}

/**
 * 한 실행 안에서 같은 대상에 **다른 금액**이 두 번 온 것 (ADR-019 B3).
 *
 * 저장 의미론은 바꾸지 않는다 — cost_history는 먼저 값 유지(skip), 대기실은
 * 마지막 값(UPSERT). 대신 그 사실을 세어 말한다. 조용히 덮이면 시트 순서가
 * 결과를 정하는데 사용자는 그런 일이 있었는지도 모른다.
 */
export interface ReferenceConflict {
  /** 어느 저장소에서 — cost = 연결된 원가, pending = 대기실. */
  readonly where: "cost" | "pending"
  /** 사람이 알아볼 행 정체성 — 상품번호 또는 품명. */
  readonly key: string
  readonly prior: number
  readonly next: number
  /** 어느 값이 남았나 — cost는 먼저 값(prior), pending은 나중 값(next). */
  readonly kept: number
}

/** 행 하나가 어떻게 됐는지 — 합이 곧 파일 행 수다. 아래 합계는 전 시트 합. */
export interface ReferenceRunResult {
  /** 새로 넣은 원가. */
  readonly inserted: number
  /** 이미 같은 값이 있어 **건너뛴** 것. `replace`가 참이면 0이다. */
  readonly skipped: number
  /** 덮어쓴 것. `replace`가 참일 때만 는다. */
  readonly replaced: number
  /** 상품번호로 리스팅을 못 찾은 행. **이게 0이 아닌 것이 정상이다** — 아래 참조. */
  readonly unmatched: number
  /**
   * 못 찾았지만 **대기실에 남긴** 행 (011). unmatched ⊇ stashed가 아니라
   * unmatched = stashed + bridged다 — 셋을 따로 세는 이유는 화면이 각각 다른
   * 문장을 쓰기 때문이다 («대기 N» · «지난 판단으로 N건 붙음»).
   * 시트 간 같은 품명은 대기실에서 한 행으로 합쳐지므로 DB 행 수는 이보다
   * 적을 수 있다 (D1 실측: 176 push → 175행).
   */
  readonly stashed: number
  /**
   * ★ 과거의 사람 판단으로 붙은 행 ★ — 대기실의 resolved 행(같은 source_key)이
   * 가리키는 SKU로 곧장 들어갔다. 점수 자동 확정이 아니라 §20 규칙 4의 재사용이다.
   */
  readonly bridged: number
  /** 그 과정에서 **새로 만든 SKU** 수. */
  readonly createdSkus: number
  /** 금액을 못 읽었거나 상품번호가 빈 행. */
  readonly badRows: number
  /** 파이프라인이 거른 행(합계·빈 행) — 전 시트 합침. 숨기지 않는다 (LOCK 6). */
  readonly excluded: readonly ExcludedRow[]
  readonly warnings: readonly string[]
  /** 못 찾은 상품번호 표본 — 사람이 원인을 짚을 수 있게 앞의 몇 개를 든다. */
  readonly unmatchedSample: readonly string[]
  /**
   * 어느 종류로 들어갔나 (`cost_history.kind`). **화면이 이걸 되짚을 길이 없다** —
   * 결과만 들고는 «원가»인지 «물류비»인지 알 수 없어서 결과에 싣는다.
   */
  readonly kind: "COGS" | "PACKAGING" | "LOGISTICS" | "OTHER"
  /** 시트별 결과 — 실패 시트도 여기 사유와 함께 실린다 (일급 항목). */
  readonly perSheet: readonly ReferenceSheetResult[]
  /** 시트 간 금액 충돌 표본 (≤10). 전체 수는 `conflictCount`. */
  readonly conflicts: readonly ReferenceConflict[]
  readonly conflictCount: number
}

const hex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")

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
  if (o.sheetIndexes.length === 0) {
    throw new Error("넣을 시트가 없다 — sheetIndexes가 비었다")
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
    // ── 실행 수준 상태 — 시트 루프 밖 (ADR-019 B1) ─────────────────────
    // stash를 시트마다 flush하면 DB의 UPSERT(후착 승)가 시트 간에 적용돼
    // 충돌 탐지가 성립하지 않는다. 지문·표본·충돌 장부도 파일 단위다.
    const sourceHash = hex(sha1Bytes(o.bytes))
    /** 대기실로 갈 행들 — 전 시트 루프가 끝나고 한 번에 UPSERT한다. */
    const stash: Parameters<Repository["stashPendingCosts"]>[0][number][] = []
    /** 대기실 충돌 탐지 — (kind·sourceKey) → 마지막 금액. DB는 안 알려주므로 여기서 센다. */
    const pendingSeen = new Map<string, number>()
    const unmatchedSample: string[] = []
    const conflicts: ReferenceConflict[] = []
    let conflictCount = 0
    const noteConflict = (c: ReferenceConflict): void => {
      conflictCount++
      if (conflicts.length < 10) conflicts.push(c)
    }
    const perSheet: ReferenceSheetResult[] = []
    const excludedAll: ExcludedRow[] = []

    for (const sheetIndex of o.sheetIndexes) {
      const sheet = src.sheets[sheetIndex]
      // 시트별 카운터 — 실패해도 버리지 않는다. 행 단위 커밋이라 실패 시점까지의
      // 행은 이미 DB에 있고, 여기서 버리면 다이제스트가 DB보다 적게 말한다 (LOCK 6).
      let inserted = 0
      let skipped = 0
      let replaced = 0
      let unmatched = 0
      let bridged = 0
      let createdSkus = 0
      let badRows = 0
      let stashedHere = 0
      let excludedCount = 0
      let failed: string | null = null

      if (!sheet) {
        perSheet.push({
          sheetIndex,
          sheetName: `시트 ${sheetIndex + 1}`,
          inserted, skipped, replaced, unmatched, stashed: 0, bridged,
          createdSkus, badRows, excludedCount,
          failed: `시트 ${sheetIndex}는 없다`,
        })
        continue
      }

      try {
        /**
         * ★ 카드 레이아웃이면 블록 리더가 앞에서 표로 편다 ★
         *
         * 여기서 갈래를 만들지 않는 것이 요점이다 — 옵션 하나를 넘기면 그 뒤는 평범한
         * 표라서 열 찾기·정규화·적재가 하나도 안 바뀐다. 실측 사용자 파일이 그 경로로
         * 200블록 → 200행이 됐다.
         */
        const { chunks, getSummary } = streamSheet(src, sheetIndex, {
          chunkSize,
          ...(o.profile.blockRead === undefined ? {} : { blockRead: o.profile.blockRead }),
        })

        // 시트-지역 상태 — 열 인덱스는 시트마다 다시 찾는다 (열 순서가 다를 수 있다).
        let headers: string[] = []
        let keyCol = -1
        let amountCol = -1
        let titleCol = -1
        let modelCol = -1
        /** 프로파일의 `sourceKey.columns` 인덱스 — 대기 행의 정체성이 여기서 나온다. */
        let skCols: number[] = []

        for await (const chunk of chunks) {
          if (headers.length === 0) {
            headers = [...getSummary().header.columns]
            const at = (name: string | undefined): number =>
              name === undefined ? -1 : headers.findIndex((h) => h.trim() === name.trim())
            keyCol = at(rule.listingKeyColumn)
            amountCol = at(rule.amountColumn)
            titleCol = at(rule.titleColumn)
            modelCol = at(rule.modelColumn)
            skCols =
              o.profile.sourceKey.strategy === "natural"
                ? (o.profile.sourceKey.columns ?? []).map(at)
                : []
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

              const title = titleCol >= 0 ? String(chunk.values[base + titleCol] ?? "").trim() : key
              const model = modelCol >= 0 ? String(chunk.values[base + modelCol] ?? "").trim() : ""
              // 대기 행의 정체성 — 프로파일의 sourceKey 선언(ADR-006)을 그대로 탄다.
              // 새 규칙을 발명하면 재가져오기 멱등이 두 규약으로 갈린다.
              const sourceKey =
                skCols.length > 0
                  ? skCols
                      .map((c) => (c < 0 ? "" : String(chunk.values[base + c] ?? "")))
                      .join(KEY_SEP)
                  : key

              /**
               * ★ 지난 판단이 있으면 곧장 붙인다 — 다리 사전 ★
               * 사람이 전에 「이 품명 = 이 SKU」를 확정했으면(resolved) 그 SKU로
               * 바로 넣는다. 점수가 아니라 **저장된 사람 판단**이라 자동이어도 된다
               * (§20 규칙 4 — 답 = 갱신, 다음 파일부터 질문 0).
               */
              const bridgedSku = await repo.resolvedCostBridge(o.libraryId, rule.kind, sourceKey)
              if (bridgedSku !== null) {
                const br = await repo.addCost({
                  libraryId: o.libraryId,
                  skuId: bridgedSku,
                  kind: rule.kind,
                  amount,
                  effectiveFrom: o.effectiveFrom,
                  note: `${o.fileName} · ${profileVersion(o.profile)} · 지난 판단으로 연결`,
                  now: o.now,
                  enteredBy: "import",
                  // 이 원가가 **어느 파일에서 왔나** (015). 대기실(`pending_cost`)은
                  // 011부터 갖고 있던 것을 `cost_history`도 이제 갖는다.
                  sourceHash,
                  ...(o.replace === true ? { replace: true } : {}),
                })
                if (br.inserted) inserted++
                else if (br.replaced) replaced++
                else {
                  skipped++
                  // «이미 같은 값» — 값이 달랐다면 그 문장은 거짓이다. 세어 말한다.
                  if (br.previous !== null && br.previous !== amount) {
                    noteConflict({ where: "cost", key, prior: br.previous, next: amount, kept: br.previous })
                  }
                }
                bridged++
              }

              // 붙었든(bridged) 못 붙었든 대기실의 값은 최신으로 따라간다 — 상태는
              // stash가 덮지 않으므로(리포지토리 계약) resolved·dismissed 판단은 산다.
              // 같은 실행 안에서 같은 품명이 다른 금액으로 두 번 오면 충돌로 센다 —
              // UPSERT는 마지막 값이 남고, 그 사실을 말하지 않으면 조용한 덮임이다.
              const pk = `${rule.kind}${KEY_SEP}${sourceKey}`
              const prevPending = pendingSeen.get(pk)
              if (prevPending !== undefined && prevPending !== amount) {
                noteConflict({
                  where: "pending",
                  key: title === "" ? key : title,
                  prior: prevPending,
                  next: amount,
                  kept: amount,
                })
              }
              pendingSeen.set(pk, amount)

              stash.push({
                libraryId: o.libraryId,
                sourceKey,
                kind: rule.kind,
                title: title === "" ? key : title,
                modelCode: model === "" ? null : model,
                amount,
                effectiveFrom: o.effectiveFrom,
                sourceHash,
                sourceName: o.fileName,
                profileVersion: profileVersion(o.profile),
                now: o.now,
              })
              stashedHere++
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
              // 이 원가가 **어느 파일에서 왔나** (015).
              sourceHash,
              ...(o.replace === true ? { replace: true } : {}),
            })
            if (r.inserted) inserted++
            else if (r.replaced) replaced++
            else {
              skipped++
              // 같은 (SKU·종류·적용일)에 **다른 금액** — 앞 시트나 지난 실행의 값이
              // 이긴다(먼저 값 유지). «이미 같은 값»이라는 화면 문장이 거짓이 되는
              // 자리라 반드시 센다 (ADR-019 B3).
              if (r.previous !== null && r.previous !== amount) {
                noteConflict({ where: "cost", key, prior: r.previous, next: amount, kept: r.previous })
              }
            }
          }
        }
        excludedCount = getSummary().excluded.length
        excludedAll.push(...getSummary().excluded)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        const already = inserted + replaced
        // 행 단위 커밋이라 여기까지의 행은 이미 DB에 있다 — 사유에 그 사실을 싣는다.
        failed = already > 0 ? `${msg} — ${already}건은 이미 반영된 뒤 중단 (재실행은 멱등)` : msg
      }

      perSheet.push({
        sheetIndex,
        sheetName: sheet.name,
        inserted, skipped, replaced, unmatched,
        stashed: stashedHere - bridged,
        bridged, createdSkus, badRows, excludedCount, failed,
      })
    }

    if (stash.length > 0) await repo.stashPendingCosts(stash)

    /**
     * ★★ 통에 이 파일을 남긴다 (015 · ADR-023 결정 1) ★★
     *
     * **이 자리가 통째로 없었다.** `runImport`(Fact 경로)는 `recordFileSighting`을
     * 부르는데 여기는 안 불렀고, 그래서 **원가 파일은 「가져오기 기록」에 한 줄도
     * 안 나왔다** — 사용자가 13MB 단가표를 넣고 겪은 그것이다.
     * 실측(2026-08-21 · `public/demo.sqlite`): `cost_history` 35행 · `pending_cost`
     * 171행을 만든 파일이 `file_sighting`에는 **0행**이었다.
     *
     * 시트마다 한 줄이다 — 009의 키가 `(라이브러리, 지문, 시트)`이고, 19시트짜리
     * 워크북에서 고른 하나만 남기면 나머지 18장을 또 잃는다(`data.ts`의 같은 판단).
     * batch는 없다(`batchId: null`) — 기준 데이터는 batch를 만들지 않는다. 그것이
     * 결함이 아니라 **이 표가 생긴 이유**다.
     *
     * 실패해도 가져오기는 계속된다. 장부를 못 남긴 것이 원가를 못 넣을 이유는 아니다.
     */
    for (const ps of perSheet) {
      try {
        const sightingId = await repo.recordFileSighting({
          libraryId: o.libraryId,
          sourceHash,
          sourceName: o.fileName,
          sourceBytes: o.bytes.length,
          containerFormat: top.format,
          sheetIndex: ps.sheetIndex,
          sheetName: ps.sheetName,
          // 기준 가져오기는 헤더 탐지 결과를 여기까지 들고 오지 않는다.
          // **0으로 넘겨짚지 않는다** — `null`이 「모른다」다 (009의 규칙).
          headerRowIndex: null,
          profileId: o.profile.id,
          batchId: null,
          at: o.now,
          columns: [],
        })
        /**
         * 「무엇이 됐나」. **0인 종류는 안 넘긴다** — 「대기 0건」을 줄로 그리면
         * 할 말이 없는데 말하는 것이 된다. 반대로 넘긴 종류의 0은 저장한다.
         */
        const outcomes = [
          { kind: "cost", count: ps.inserted },
          { kind: "cost_replaced", count: ps.replaced },
          { kind: "cost_skipped", count: ps.skipped },
          { kind: "pending_cost", count: ps.stashed },
          { kind: "bridged", count: ps.bridged },
          { kind: "sku_created", count: ps.createdSkus },
          { kind: "bad_rows", count: ps.badRows },
        ].filter((x) => x.count > 0)
        // 아무것도 안 됐으면 그 사실 자체가 결과다 — 빈 목록으로 두면 화면이
        // 「기록은 있는데 아무 말이 없는 줄」을 그린다 (LOCK 6).
        if (outcomes.length === 0) outcomes.push({ kind: "nothing", count: 0 })
        await repo.recordOutcomes(sightingId, outcomes, o.now)
      } catch {
        /* 장부를 못 남겨도 가져오기는 계속된다 — 원가는 이미 들어갔다 */
      }
    }

    const sum = (k: keyof Omit<ReferenceSheetResult, "sheetIndex" | "sheetName" | "failed">): number =>
      perSheet.reduce((t, s) => t + s[k], 0)
    return {
      inserted: sum("inserted"),
      skipped: sum("skipped"),
      replaced: sum("replaced"),
      unmatched: sum("unmatched"),
      stashed: sum("stashed"),
      bridged: sum("bridged"),
      createdSkus: sum("createdSkus"),
      badRows: sum("badRows"),
      excluded: excludedAll,
      warnings: [...src.warnings, ...rec.identityNotes],
      unmatchedSample,
      kind: rule.kind,
      perSheet,
      conflicts,
      conflictCount,
    }
  } finally {
    src.close()
  }
}
