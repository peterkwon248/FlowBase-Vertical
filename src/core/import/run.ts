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
import type { ExcludedRow, HeaderDetection, SheetInfo } from "./types.js"
import type { BatchOpen, FactTable, ListingUpsert, LoadStats, Repository } from "../store/repository.js"

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
  /** 매핑 오류 전부 (치명 + 비치명). 치명인 것만 제외로 기록된다. */
  readonly mappingErrors: readonly MappingError[]
  readonly unmappedColumnCount: number
  readonly listings: LoadStats | null
  readonly header: HeaderDetection
  readonly sheet: SheetInfo
  /** 파서가 남긴 말 (SheetJS 경고 · fast path 거절 사유). 오늘 아무도 표시하지 않는다. */
  readonly warnings: readonly string[]
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

    const batch: BatchOpen = {
      id: o.batchId,
      libraryId: o.libraryId,
      connectionId: o.connectionId,
      sourceName: o.fileName,
      sourceBytes: o.bytes.length,
      // ★ 파일 지문 ★ 이게 있어야 «같은 바이트·다른 이름»을 다음 가져오기에서
      // 잡을 수 있다 (마이그레이션 006). 배관은 001부터 있었지만 아무도 값을
      // 넘기지 않아 늘 NULL이었다.
      sourceHash: hex(sha1Bytes(o.bytes)),
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
    let loaded = 0
    let offset = 0
    let unmappedColumnCount = 0
    const errors: MappingError[] = []
    const perTable = new Map<string, number>()
    /** 이 파일이 만드는 리스팅 **종류**. 청크를 가로질러 모인다. */
    const listings = new Map<string, ListingUpsert>()

    for await (const chunk of chunks) {
      if (headers.length === 0) headers = [...getSummary().header.columns]

      const mapped = mapRows(
        o.profile,
        headers,
        chunk,
        { fileName: o.fileName, fileNameCaptures: captures, keyState },
        offset,
      )
      if (o.profile.listing) collectListings(o.profile.listing, headers, chunk, listings)

      const base = offset
      offset += chunk.rowCount
      errors.push(...mapped.errors)
      unmappedColumnCount = mapped.unmappedColumnCount

      // ★ `byTable`로 읽는다. `rows`만 보면 라우팅으로 다른 테이블에 간 행을
      // 통째로 놓친다 — `smoke.ts`가 정확히 그렇게 하고 있다.
      for (const [table, rows] of mapped.byTable) {
        if (rows.length === 0) continue
        await repo.loadChunk(
          table as FactTable,
          batch,
          rows.map((r, i) => ({
            id: `${batch.id}-${table}-${base + i}`,
            source_key: r.sourceKey,
            ...r.fields,
          })),
        )
        perTable.set(table, (perTable.get(table) ?? 0) + rows.length)
        loaded += rows.length
      }

      o.onProgress?.({ rowsDone: offset, chunk: perTable.size })
    }

    // 리스팅은 **다 모은 뒤 한 번** 넣는다. 종류의 목록이라 청크마다 넣으면
    // 같은 리스팅에 UPSERT가 반복된다.
    const listingStats =
      o.profile.listing && listings.size > 0
        ? await repo.upsertListings(o.libraryId, o.connectionId, [...listings.values()], o.now)
        : null

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
     *  · `fatal`만 넣는다. 비치명 오류(모르는 라우팅 값 · 없는 컬럼)는 **행이
     *    적재됐으므로** 제외가 아니다. 넣으면 조용한 실패를 고치려다 조용한 거짓이 된다
     *  · **행 단위로 합친다.** 한 행에서 필드 셋이 실패해도 잃은 행은 하나다
     */
    const lost = new Map<number, string[]>()
    for (const e of errors) {
      if (!e.fatal) continue
      const at = lost.get(e.rowIndex)
      if (at) at.push(`${e.field}: ${e.reason}`)
      else lost.set(e.rowIndex, [`${e.field}: ${e.reason}`])
    }

    await repo.recordExclusions(batch.id, [
      ...sum.excluded.map((e) => ({ rowIndex: e.rowIndex, reason: e.reason, detail: e.detail })),
      ...[...lost].map(([rowIndex, why]) => ({
        rowIndex,
        reason: "error" as const,
        detail: why.join(" · "),
      })),
    ])
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
    }
  } finally {
    // 판정이 틀렸든 적재가 터졌든 파일 핸들은 닫는다.
    src.close()
  }
}
