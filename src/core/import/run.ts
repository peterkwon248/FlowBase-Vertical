/**
 * 파일 하나를 끝까지 넣는다 — **앱과 CLI가 같은 코드를 쓴다.**
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 이 파일이 생겼나 ★
 *
 * 종단 경로가 이미 두 벌 있었다. `tools/harness/pnl.ts`(완전함)와
 * `src/app/smoke.ts`(얇음 — 리스팅 수집·제외 기록을 건너뛰고 `mapped.rows`를 읽는다).
 * 위저드를 짓는다는 것은 **세 번째 벌**을 만든다는 뜻이었고, 그러면 "화면 숫자 =
 * CLI 숫자"가 검사 항목으로 내려간다.
 *
 * 단일 계산기 원칙(C-3)이 조회 계층으로 넓어졌던 것과 같은 이유로, 적재 경로도
 * 하나로 모은다. 이 함수가 **유일한 가져오기 구현**이다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 여기 있는 것은 전부 두 벌 중 «완전한 쪽»이다 ★
 * 얇은 쪽(`smoke.ts`)이 빠뜨렸던 것 넷을 이 함수가 전부 한다:
 *   · `mapped.byTable` 순회 (라우팅으로 갈라진 행을 놓치지 않는다)
 *   · 리스팅 수집 + 파일당 한 번 UPSERT
 *   · 제외 행 기록 (LOCK 6)
 *   · 배치 커밋
 *
 * 그리고 **어느 쪽도 안 하던 것 셋**을 더 한다:
 *   · 인식이 알아낸 `encoding`/`delimiter`를 파서에 넘긴다 — 오늘 이걸 하는 곳은
 *     `tools/harness/check-excluded.ts` 하나뿐이라 UTF-16 TSV·HTML 표가 갈린다
 *   · 시트 번호를 **받는다.** 세 호출부가 전부 `0`을 박아 넣고 있었다 (§18 시트 선택)
 *   · `sheetName`을 배치에 적는다. 지금까지 늘 NULL이라 "어느 시트에서 왔나"를
 *     되짚을 수 없었다
 *
 * ★ 실행환경 중립 (ADR-011) ★
 * `node:` 모듈을 import하지 않는다. 바이트는 **받는다** — 어떻게 얻었는지(파일 입력 ·
 * Tauri 커맨드 · fs)는 부르는 쪽의 사정이고, 그 경계가 이 파일을 앱에서도 돌게 한다.
 * 마이그레이션도 하지 않는다 — 앱은 `migrate-web`, CLI는 `migrate-node`다.
 */

import { sniff } from "./recognition/sniff.js"
import { parserFor } from "./parsers/index.js"
import { streamSheet } from "./pipeline.js"
import {
  captureFromFileName,
  mapRows,
  newKeyState,
  profileVersion,
  type MappingProfile,
  type MappingError,
} from "./mapping/index.js"
import { collectListings } from "./mapping/listing.js"
import { sha1Bytes } from "./mapping/sha1.js"
import { isFatal, scopeOf } from "./issues.js"
import type { ExcludedRow, HeaderDetection, RawRow, SheetInfo } from "./types.js"
import { describeColumns, SAMPLE_ROWS } from "./columns.js"
import {
  listingIdFor,
  type BatchOpen,
  type FactRow,
  type FactTable,
  type IssueRecord,
  type ListingUpsert,
  type LoadStats,
  type Repository,
} from "../store/repository.js"

/** `analyze.ts`와 같은 표기 — 두 곳이 같은 문자열을 내야 대조가 성립한다. */
const hex = (b: Uint8Array): string =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")

export interface ImportRunOptions {
  readonly bytes: Uint8Array
  /** 사람이 고른 파일의 이름. 프로파일의 파일명 캡처가 이걸 본다. */
  readonly fileName: string
  /** 판정 단계에서 사람이 확정한 프로파일. 이 함수는 고르지 않는다. */
  readonly profile: MappingProfile
  /** §18 — 시트를 고르는 것은 사람이다. 기본값을 두지 않는 이유는 아래 주석 참조. */
  readonly sheetIndex: number
  readonly libraryId: string
  readonly connectionId: string
  readonly batchId: string
  readonly now: string
  readonly chunkSize?: number
  /** 청크마다 부른다. 8만 행이 도는 동안 화면이 죽은 것처럼 보이지 않게 한다. */
  readonly onProgress?: (p: { readonly rowsDone: number; readonly chunk: number }) => void
}

export interface ImportRunResult {
  /** 테이블별 적재 통계. 라우팅이 있으면 둘 이상이 된다 (ESM = 주문 + 클레임). */
  readonly perTable: ReadonlyMap<string, number>
  readonly loaded: number
  /** 파이프라인이 거른 행(합계·빈 행). **숨기지 않는다** (LOCK 6). */
  readonly excluded: readonly ExcludedRow[]
  /**
   * 매핑이 **버린 행 수**. `mappingErrors.length`와 다르다 — 한 행이 여러 오류를
   * 내므로 오류 수는 잃은 행 수보다 클 수 있다. 이 값이 사람에게 말할 숫자다.
   */
  readonly lostRows: number
  /**
   * 매핑 오류 전부 (치명 + 비치명). **둘 다 목적지가 있다** — 치명은
   * `batch_exclusion`(reason="error"), 비치명은 `batch_issue`다 (마이그레이션 008).
   * 어느 쪽인지는 `ISSUE_KINDS`가 코드로 정한다.
   */
  readonly mappingErrors: readonly MappingError[]
  readonly unmappedColumnCount: number
  readonly listings: LoadStats | null
  readonly header: HeaderDetection
  readonly sheet: SheetInfo
  /** 파서가 남긴 말 (SheetJS 경고 · fast path 거절 사유). 오늘 아무도 표시하지 않는다. */
  readonly warnings: readonly string[]
  /**
   * 시작 전에 치운 **미완료 배치**. 다이제스트에도 남지만(`batch_issue`) 부르는 쪽이
   * 즉시 알 수 있게 함께 돌려준다 — 하네스·CLI는 다이제스트를 안 읽는다.
   */
  readonly abortedStale: readonly { readonly sourceName: string; readonly blocked: boolean }[]
}

export async function runImport(
  repo: Repository,
  o: ImportRunOptions,
): Promise<ImportRunResult> {
  const chunkSize = o.chunkSize ?? 1_000

  // ── Recognition ──
  // 후보 1등의 encoding·delimiter를 **파서에 넘긴다.** 이걸 빠뜨리면 UTF-16 TSV가
  // 깨져 읽히고, 그 실패는 "빈 시트"처럼 보여서 원인을 찾기 어렵다.
  const rec = sniff(o.bytes, o.fileName)
  const top = rec.candidates[0]
  if (!top) throw new Error("컨테이너 포맷을 판정하지 못했다")

  // `exactOptionalPropertyTypes`라 `undefined`를 명시적으로 넘길 수 없다 —
  // 없는 것과 «undefined로 있는 것»을 구분하는 설정이고, 여기서는 없는 것이 맞다.
  const src = await parserFor(top.format).open(o.bytes, {
    chunkSize,
    ...(top.encoding === undefined ? {} : { encoding: top.encoding }),
    ...(top.delimiter === undefined ? {} : { delimiter: top.delimiter }),
  })

  try {
    const sheet = src.sheets[o.sheetIndex]
    if (!sheet) throw new Error(`시트 ${o.sheetIndex}는 없다`)

    // ★ 캡처 실패는 정지다 — 화면보다 여기가 진짜 가드다 ★
    //
    // 위저드가 막힌 후보로는 [가져오기]를 못 누르게 하지만, `runImport`는
    // «하나뿐인 적재 경로»라 하네스·CLI도 지나간다. 키의 일부가 빈 문자열로
    // 들어가면 **같은 파일의 두 이름이 서로 다른 키를 얻어** 재가져오기가
    // 중복을 쌓는다. 조용히 폴백하지 않고 여기서 멈춘다 (ADR-006 증축).
    const needCaptures = o.profile.sourceKey.fileNameCaptures ?? []
    if (needCaptures.length > 0) {
      const got = captureFromFileName(o.profile, o.fileName)
      const missing = needCaptures.filter((c) => (got[c] ?? "") === "")
      if (missing.length > 0) {
        const eg = o.profile.recognitionRules.fileNameExample
        throw new Error(
          `파일명에서 ${missing.join("·")}를 읽지 못했다 — 이 양식은 파일명이 키의 일부다` +
            (eg === undefined ? "" : ` (예: ${eg})`),
        )
      }
    }

    /**
     * ★ 시작 전에 미완료 배치를 치운다 — **재시도가 곧 정리다** (대열 4 ③ 마지막) ★
     *
     * 적재가 도중에 죽으면 `open` 배치가 남고, 사용자의 자연스러운 첫 행동인
     * 「다시 넣어 보자」가 그것을 **영영 못 치우는 상태로** 만든다(그림자가
     * `prev_batch_id`를 남겨 LIFO 가드에 걸린다).
     *
     * **여기가 «시작»인 것이 요점이다.** 끝에 치우면 그림자 사슬이 이미 얽혀 복원이
     * 새 배치를 옛 판으로 덮는다. 시작 시점에는 사슬이 없어 평범한 되돌리기로 깨끗하다.
     *
     * 조용히 치우지 않는다 — 아래에서 다이제스트에 남긴다 (LOCK 6).
     */
    const cleaned = await repo.abortStaleBatches(o.libraryId, o.connectionId, o.now)

    /** 파일 지문. 배치와 목격이 **같은 값**을 써야 둘이 이어진다 (006 · 009). */
    const sourceHash = hex(sha1Bytes(o.bytes))

    const batch: BatchOpen = {
      id: o.batchId,
      libraryId: o.libraryId,
      connectionId: o.connectionId,
      sourceName: o.fileName,
      sourceBytes: o.bytes.length,
      // ★ 파일 지문 ★ 이게 있어야 «같은 바이트·다른 이름»을 다음 가져오기에서
      // 잡을 수 있다 (마이그레이션 006). 배관은 001부터 있었지만 아무도 값을
      // 넘기지 않아 늘 NULL이었다.
      sourceHash,
      containerFormat: top.format,
      // 어느 시트에서 왔는지 남긴다 — 여러 시트짜리 파일에서 이게 없으면
      // 나중에 "이 batch가 무엇이었나"를 되짚을 수 없다.
      sheetName: sheet.name,
      mappingVersion: profileVersion(o.profile),
      startedAt: o.now,
    }
    await repo.openBatch(batch)

    const { chunks, getSummary } = streamSheet(src, o.sheetIndex, { chunkSize })

    // ★ 파일당 한 번이다 ★ 청크마다 새로 만들면 같은 자연키가 청크 경계에서
    // 다시 시작해 행이 조용히 사라진다 (mapping/index.ts의 기록).
    const captures = captureFromFileName(o.profile, o.fileName)
    const keyState = newKeyState()

    let headers: string[] = []
    /**
     * 열 서술용 표본 — **첫 청크의 앞부분만** 잡는다 (마이그레이션 009).
     *
     * 종류 추론은 표본 200개면 충분하고(`inferColumnKind`), 8만 행을 들고 있는
     * 것은 LOCK 5가 금지한 바로 그 일이다. 여기서 잡지 않으면 적재 후에 파일을
     * 다시 열어야 한다 — 같은 바이트를 두 번 읽는 값이 이 배열보다 비싸다.
     */
    const sampleRows: RawRow[] = []
    let loaded = 0
    let offset = 0
    let unmappedColumnCount = 0
    /**
     * 「신규 + 갱신 + 병합 + 제외 = 파일 행」의 앞 셋. 마이그레이션 007 참조.
     *
     * `merged`만 사고다 — 앞의 둘은 재가져오기의 정상 동작이라, 뭉뚱그리면
     * 사용자가 «덮어써진 것»과 «합쳐져 사라진 것»을 구분할 수 없다.
     */
    let inserted = 0
    let updated = 0
    let merged = 0
    const errors: MappingError[] = []
    const perTable = new Map<string, number>()
    /** 이 파일이 만드는 리스팅 **종류**. 청크를 가로질러 모인다. */
    const listings = new Map<string, ListingUpsert>()

    /**
     * 리스팅 적재 누계. **청크마다 «처음 본 것만» 넣는다** (아래 이유).
     * 종류마다 정확히 한 번 UPSERT되므로 총 호출 수는 «다 모은 뒤 한 번»과 같다.
     */
    let listingStats: LoadStats | null = null
    const bumpListings = (s: LoadStats): void => {
      listingStats = listingStats === null
        ? s
        : { inserted: listingStats.inserted + s.inserted, updated: listingStats.updated + s.updated }
    }

    for await (const chunk of chunks) {
      if (headers.length === 0) headers = [...getSummary().header.columns]

      // 첫 청크에서만 채운다. `raws`는 원본 표현이라 화면이 파일과 같은 값을 보인다.
      for (let i = 0; sampleRows.length < SAMPLE_ROWS && i < chunk.rowCount; i++) {
        const at = i * chunk.width
        sampleRows.push(chunk.raws.slice(at, at + chunk.width))
      }

      const mapped = mapRows(
        o.profile,
        headers,
        chunk,
        { fileName: o.fileName, fileNameCaptures: captures, keyState },
        offset,
      )

      /**
       * ★ 리스팅이 **Fact보다 먼저** 들어간다 (품목 적재가 시킨 순서 변경) ★
       *
       * 전에는 파일을 다 돌고 나서 한 번에 넣었다. 품목이 `listing_id`로 리스팅을
       * 가리키고 `PRAGMA foreign_keys = ON`이므로, 리스팅이 나중에 들어가면
       * **품목 적재가 FK로 통째로 실패한다.**
       *
       * 새로 본 것만 넘기므로 같은 리스팅에 UPSERT가 반복되지 않는다 — 옛 주석이
       * 걱정하던 것이 그것이고, 그 걱정은 «전부 다시 넘기기»에만 해당한다.
       */
      if (o.profile.listing) {
        const before = listings.size
        collectListings(o.profile.listing, headers, chunk, listings)
        if (listings.size > before) {
          const fresh = [...listings.values()].slice(before)
          bumpListings(await repo.upsertListings(o.libraryId, o.connectionId, fresh, o.now))
        }
      }

      const base = offset
      offset += chunk.rowCount
      errors.push(...mapped.errors)
      unmappedColumnCount = mapped.unmappedColumnCount
      merged += mapped.merged

      // ★ `byTable`로 읽는다. `rows`만 보면 라우팅으로 다른 테이블에 간 행을
      // 통째로 놓친다 — `smoke.ts`가 정확히 그렇게 하고 있다.
      //
      // 주문 헤더가 **가장 먼저** 나가야 한다 — 품목이 그 id를 가리킨다.
      // `byTable`은 기본 경로 버킷을 먼저 만들지만(`mapRows`), 그 순서에 기대지
      // 않고 여기서 명시한다. Map 순회 순서에 FK 무결성을 얹지 않는다.
      const tables = [
        o.profile.targetTable,
        ...[...mapped.byTable.keys()].filter((t) => t !== o.profile.targetTable),
      ]
      for (const table of tables) {
        const rows = mapped.byTable.get(table)
        if (!rows || rows.length === 0) continue
        /**
         * ★ 반환값을 받는다 (2026-08-15) ★
         *
         * 001부터 `{inserted, updated}`를 돌려주는데 여기서 버리고 `rows.length`를
         * 더하고 있었다. 그래서 UPSERT가 행을 합쳐도 「적재 + 제외 = 파일 행」이
         * **겉으로는 성립했다** — 사고가 항등식을 통과하는 구조였다.
         *
         * `loaded`는 그대로 `rows.length`를 쓴다. 「이 파일이 만든 Fact 행 수」라는
         * 뜻이고 진행 표시가 그걸 읽는다 — 뜻을 바꾸지 않고 **분해를 옆에 둔다.**
         */
        const stats = await repo.loadChunk(
          table as FactTable,
          batch,
          rows.map((r, i) => ({
            id: `${batch.id}-${table}-${base + i}`,
            source_key: r.sourceKey,
            ...r.fields,
          })),
        )
        inserted += stats.inserted
        updated += stats.updated
        perTable.set(table, (perTable.get(table) ?? 0) + rows.length)
        loaded += rows.length
      }

      /**
       * ★ 품목 — 부모의 **저장된 id**를 물어서 건다 ★
       *
       * 여기서 `${batch.id}-fact_order-${…}`를 다시 계산하면 안 된다. UPSERT의
       * `DO UPDATE SET`에 `id`가 없어 **재가져오기에서 행은 처음 받은 id를 지키기**
       * 때문이다 — 두 번째 가져오기부터 존재하지 않는 부모를 가리키게 되고,
       * FK가 켜져 있으니 적재가 통째로 실패한다 (실측으로 확인한 함정이다).
       *
       * 부모를 못 찾은 품목은 **버리지 않고 오류로 남긴다.** 오늘 그런 일은
       * 부모 행이 매핑 단계에서 fatal로 빠졌을 때뿐인데(ESM의 결제일 빈 행),
       * 그때는 품목도 만들어지지 않으므로 여기 걸릴 것이 없어야 정상이다.
       */
      if (mapped.items.length > 0) {
        const parentIds = await repo.idsBySourceKey(
          o.profile.targetTable as FactTable,
          o.connectionId,
          mapped.items.map((it) => it.orderSourceKey),
        )
        const itemRows: FactRow[] = []
        for (const [i, it] of mapped.items.entries()) {
          const orderId = parentIds.get(it.orderSourceKey)
          if (orderId === undefined) {
            // ★ 품목마다 **그 행의 번호로** 남긴다 ★
            // 전에는 청크당 한 줄에 «N건»을 적었고, 그 줄이 달고 있던 행 번호는
            // 청크 시작 번호(`base`)라 실제 행과 무관했다. 사람이 그 번호로 파일을
            // 열면 엉뚱한 줄을 본다 — 좌표계는 하나여야 한다.
            errors.push({
              rowIndex: it.rowIndex,
              field: "order_id",
              reason: "품목이 부모 주문을 찾지 못해 버려졌다 — 이 행의 원가가 붙지 않는다",
              code: "orphan_item",
            })
            continue
          }
          itemRows.push({
            id: `${batch.id}-fact_order_item-${base + i}`,
            source_key: it.sourceKey,
            order_id: orderId,
            listing_id: listingIdFor(o.connectionId, it.listingKey),
            ...it.fields,
          })
        }
        if (itemRows.length > 0) {
          // `countsAsRow: false` — 품목은 파일의 새 행이 아니라 **같은 행의 두 번째
          // 표현**이다. 더하면 160행 파일이 「301행 적재」가 되고, 사용자가 파일과
          // 대조하는 산식(적재 + 제외 = 파일 행)이 깨진다.
          await repo.loadChunk("fact_order_item", batch, itemRows)
          perTable.set("fact_order_item", (perTable.get("fact_order_item") ?? 0) + itemRows.length)
          loaded += itemRows.length
        }
      }

      // ★ 「가져온 행」은 **파일 행 수**다 — 테이블 적재 수의 합이 아니다 ★
      // 한 파일 행이 여러 Fact 행이 되는 경우가 둘이다(품목 · 이중 기록).
      await repo.addBatchRows(batch.id, mapped.rowsLoaded)

      o.onProgress?.({ rowsDone: offset, chunk: perTable.size })
    }

    // ★ 요약은 청크를 다 돈 **뒤에** 읽는다 ★ 제외 목록은 스트림이 끝나야 완성된다.
    const sum = getSummary()

    /**
     * ★ 매핑이 버린 행도 제외로 남긴다 (LOCK 6) ★
     *
     * 여기가 오래 비어 있던 자리다. 파이프라인이 거른 행(합계·빈 행)은 기록됐지만
     * **매핑이 버린 행은 메모리에만 있다가 사라졌다.** ESM 파일에서 발생일 없는
     * 클레임 5건이 정확히 그렇게 없어지고 있었다 — 적재 155행은 맞는데 파일에
     * 있던 160행 중 5행이 어디로 갔는지 아무 데도 안 적혀 있었다.
     *
     * 두 가지를 지킨다:
     *  · 치명만 넣는다. 비치명 오류(모르는 라우팅 값 · 없는 컬럼)는 **행이
     *    적재됐으므로** 제외가 아니다. 넣으면 조용한 실패를 고치려다 조용한 거짓이 된다
     *  · **행 단위로 합친다.** 한 행에서 필드 셋이 실패해도 잃은 행은 하나다
     */
    const lost = new Map<number, string[]>()
    for (const e of errors) {
      if (!isFatal(e.code)) continue
      const at = lost.get(e.rowIndex)
      if (at) at.push(`${e.field}: ${e.reason}`)
      else lost.set(e.rowIndex, [`${e.field}: ${e.reason}`])
    }

    /**
     * ★ 비치명 오류의 목적지 (마이그레이션 008) ★
     *
     * 이 갈래가 없던 동안 `fatal: false`는 `mappingErrors`에 담긴 채 함수가 끝나면
     * 사라졌다 — 앱 표면에 한 곳도 닿지 않았다. 제외가 아니므로 별도 기록으로 가고,
     * 어떤 카운터도 올리지 않는다.
     *
     * **파일 사건은 중복을 제거한다.** `mapRows`는 청크마다 새로 돌고 «컬럼당 한 번»
     * 상태도 청크 안에서만 유지되므로, 없는 컬럼 하나가 80청크 파일에서 80번
     * 보고된다. 그대로 넣으면 「없는 컬럼 80건」이 되어 수 자체가 거짓말이 된다.
     *
     * ★ 그리고 **버려진 행은 여기 들어오지 않는다** (`lost`를 먼저 만든 이유) ★
     * 한 행이 둘 다 낼 수 있다 — 라우팅 값이 사전에 없다고 보고한 **직후** 필수
     * 필드가 비어 그 행이 통째로 빠지는 경우다(합성 시험에서 실제로 나온다).
     * 거르지 않으면 그 행이 「제외」와 「적재됐지만 온전하지 않은 행」에 **동시에**
     * 서고, 뒤 문장은 그 행에 대해 거짓이다. 두 좌표가 같은 물리 행 번호라
     * 이 대조가 성립한다.
     *
     * ⚠ **크기 한도는 `errors`와 같은 차수다.** 파일 전체의 행 사건이 메모리에 모인다
     * — 8만 행이 전부 «모르는 상태값»인 파일이 오면 8만 항목이다. 오늘 그런 파일은
     * 없고(픽스처 6종 전부 0건) `errors` 자체가 이미 같은 한도를 갖고 있어 새로
     * 생긴 위험은 아니지만, 실제로 그런 파일이 나타나면 **청크마다 흘려보내는 것**이
     * 처방이다(한 행의 치명 여부는 그 행의 청크 안에서 이미 정해진다).
     */
    const issues: IssueRecord[] = []
    const fileSeen = new Set<string>()
    for (const e of errors) {
      if (isFatal(e.code)) continue
      if (scopeOf(e.code) === "file") {
        /**
         * ★ 파일 사건의 `detail`은 **화면에 그대로 나간다** ★
         * 그래서 Canonical 필드명(`fee_amount:`)을 앞에 붙이지 않는다 — 사용자가 아는
         * 이름은 **파일의 컬럼명**이지 우리 스키마의 컬럼명이 아니다 (헌장 C-4).
         *
         * 사유만으로 dedupe하므로 **같은 컬럼이 여러 필드에 쓰이는 경우도 한 줄로
         * 모인다.** 사실은 「이 컬럼이 파일에 없다」 하나이고, 그것이 몇 개의 Canonical
         * 필드를 비게 했는지는 사용자의 처방을 바꾸지 않는다.
         */
        if (fileSeen.has(e.reason)) continue
        fileSeen.add(e.reason)
        issues.push({ code: e.code, scope: "file", rowIndex: null, detail: e.reason })
      } else {
        if (lost.has(e.rowIndex)) continue
        issues.push({
          code: e.code,
          scope: "row",
          rowIndex: e.rowIndex,
          // 행 사건의 detail은 화면에 안 나온다(수만 나온다). 되짚기용이라 필드를 남긴다
          detail: `${e.field}: ${e.reason}`,
        })
      }
    }

    /**
     * ★ 치운 것을 말한다 ★ 3번이 만든 통로(`batch_issue`)를 그대로 쓴다 — 적재는
     * 됐고 알려야 하는 것이므로 «제외»가 아니라 «사건»이다. 새 표면을 만들지 않는다.
     */
    for (const c of cleaned) {
      issues.push({
        code: c.blocked ? "stale_batch_blocked" : "stale_batch_aborted",
        scope: "file",
        rowIndex: null,
        detail: c.blocked
          ? `「${c.sourceName}」 — 이후 가져오기가 그 행을 가져가 치우지 못했습니다`
          : `「${c.sourceName}」`,
      })
    }

    await repo.addBatchLoadStats(batch.id, { inserted, updated, merged })

    await repo.recordExclusions(batch.id, [
      ...sum.excluded.map((e) => ({ rowIndex: e.rowIndex, reason: e.reason, detail: e.detail })),
      ...[...lost].map(([rowIndex, why]) => ({
        rowIndex,
        reason: "error" as const,
        detail: why.join(" · "),
      })),
    ])
    await repo.recordIssues(batch.id, issues)

    /**
     * ★ 무엇이 들어왔는지가 아니라 **파일이 무엇이었는지**를 남긴다 (009) ★
     *
     * 매핑된 8열만 이름을 갖고 나머지 51열은 `unmappedColumnCount`라는 **수 하나로**
     * 뭉개져 왔다. 그 수는 「51개를 못 읽었다」는 말은 해도 「그것들이 무엇이었나」는
     * 영영 못 한다. 여기서 남기면 다음 세션의 별칭 사전이 그 이름들을 재료로 쓴다.
     *
     * 판정 단계에서 이미 남겼을 수 있다(위저드가 그렇게 한다). 그때는 `batch_id`가
     * 붙으면서 갱신될 뿐 행이 늘지 않는다 — 키가 `(라이브러리, 지문, 시트)`다.
     */
    await repo.recordFileSighting({
      libraryId: o.libraryId,
      sourceHash,
      sourceName: o.fileName,
      sourceBytes: o.bytes.length,
      containerFormat: top.format,
      sheetIndex: o.sheetIndex,
      sheetName: sheet.name,
      headerRowIndex: sum.header.rowIndex,
      profileId: o.profile.id,
      batchId: batch.id,
      at: o.now,
      columns: describeColumns(headers, sampleRows),
    })

    await repo.commitBatch(batch.id, o.now)

    return {
      perTable,
      loaded,
      excluded: sum.excluded,
      /** 매핑이 **버린** 행 수. `mappingErrors.length`와 다르다 — 한 행이 여러 오류를 낸다. */
      lostRows: lost.size,
      mappingErrors: errors,
      unmappedColumnCount,
      listings: listingStats,
      header: sum.header,
      sheet,
      // 파서가 남긴 말을 버리지 않는다 — 오늘 아무 호출부도 이걸 보지 않는다.
      warnings: [...src.warnings, ...rec.identityNotes],
      abortedStale: cleaned.map((c) => ({ sourceName: c.sourceName, blocked: c.blocked })),
    }
  } finally {
    // 판정이 틀렸든 적재가 터졌든 파일 핸들은 닫는다.
    src.close()
  }
}
