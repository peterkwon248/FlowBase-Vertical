/**
 * 가져오기 기록 화면이 읽는 **단 하나의 조회** — 조회 단일화 다섯 번째.
 *
 * ★ 되돌릴 수 있나를 화면이 판정하지 않는다 ★
 * 화면이 스스로 «이건 되돌릴 수 있다»를 계산하면 `assertUndoable`과 두 벌이 되고,
 * 그 둘은 언젠가 갈린다 — 버튼은 활성인데 누르면 거부되거나, 그 반대가 된다.
 * 그래서 **같은 신호(`row_shadow`)를 세어 상태를 넘겨준다.**
 *
 * ★ 마켓을 모른다 ★ `mapping_version` → 문서 성격 해석은 팩을 아는 쪽이 주입한다
 * (§22 `loadCoverage`와 같은 규율).
 */

import type { Driver } from "../store/driver.js"
import { Repository } from "../store/repository.js"
import type { DocType } from "../coverage/index.js"
import type { DocTypeResolver } from "../coverage/load.js"

/**
 * 되돌리기 버튼의 3상태.
 *
 * `blocked`는 «지금은 안 된다»이지 «영영 안 된다»가 아니다 — 잠근 배치를 먼저
 * 되돌리면 풀린다. 화면 문구가 그 순서를 말해야 한다.
 */
export type UndoState = "can" | "blocked" | "undone"

/**
 * 이 배치가 **어떻게 끝났나** — 버튼 상태(`UndoState`)와 다른 축이다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 「적재 중 초록 영구」와 「abort ≠ undo」가 한 축의 두 얼굴이었다 ★
 *
 * 화면은 `batchStatus === "committed" ? "완료" : "적재 중"` 한 줄로 판정하고 있었다.
 * 그래서 **적재하다 죽은 배치가 영원히 「적재 중」이고 색은 초록**이었다 — 끝나지
 * 않은 일이 완료와 같은 색을 쓴 것이다.
 *
 * 그리고 `open` 배치를 되돌리면 `undone`이 되어 「되돌림」이라 표시됐다. 실제로는
 * **취소**다 — 손익에 반영된 적이 없는 것을 물린 것이라 무게가 다르다.
 *
 * ★ 새 컬럼이 필요 없다 ★
 * ADR-004는 「`aborted_at`을 따로 두는 것은 구분해 보여줄 필요가 생긴 뒤에 한다」고
 * 미뤄 뒀다. 그 필요가 생겼는데, **`committed_at`이 이미 그 사실을 갖고 있다** —
 * 커밋된 적이 없는 배치의 `undone`은 «취소»이고, 있는 것은 «되돌리기»다.
 * 저장을 먼저 짓고 필요를 나중에 찾지 않는다 (§21-5).
 * ─────────────────────────────────────────────────────────────
 */
export type BatchOutcome =
  /** 완료됐고 지금도 살아 있다. */
  | "done"
  /** 손익에 반영됐던 것을 물렸다. */
  | "undone"
  /** **커밋된 적이 없다** — 적재하다 만 것을 치웠다. */
  | "aborted"
  /** 아직 `open`이다. 적재가 끝나지 않았다는 뜻이고, **완료가 아니다.** */
  | "unfinished"

export interface HistoryRow {
  readonly id: string
  readonly channel: string
  readonly sourceName: string
  readonly sheetName: string | null
  readonly docType: DocType | null
  /** 커밋 시각. 아직 커밋 전이면 시작 시각. */
  readonly at: string
  readonly batchStatus: string
  /** 적재 당시 센 행. 되돌린 배치는 0이다 — 그것도 사실이다. */
  readonly fetched: number
  /** 신규 삽입. 되돌리면 **사라질** 행이다. */
  readonly created: number
  /** 갱신. 되돌리면 **이전 판으로 복원될** 행이다. */
  readonly updated: number
  readonly failed: number
  /** 지금 소유한 테이블별 행 — ESM 한 파일이 주문·클레임으로 갈린 것이 여기 보인다. */
  readonly ownedByTable: Readonly<Record<string, number>>
  readonly undo: UndoState
  /** 어떻게 끝났나. 화면의 상태 칸이 이걸 읽는다 — 문구는 화면이 만든다. */
  readonly outcome: BatchOutcome
  readonly undoneAt: string | null
  /**
   * 잠근 배치. **id를 담지 않는다** — 화면이 내부 키를 내보내지 않기 때문이다
   * (헌장 C-4). 사람이 알아보는 것은 파일 이름과 시각이다.
   */
  readonly blockedBy: { readonly sourceName: string; readonly at: string | null } | null
  /**
   * ★ 이 줄이 **무엇인가** (015 · ADR-023 결정 1) ★
   *
   * `fact`      배치가 붙었다. 위 행 수·되돌리기가 전부 그 배치의 것이다
   * `reference` 기준 데이터(원가 등). **batch가 없고 되돌릴 수 없다** — 결함이 아니라
   *             batch의 성질이다(LOCK 2). 결과는 `outcomes`가 든다
   * `seen`      봤지만 안 넣었다. 판정만 지나간 파일 — **이것도 기록할 사실이다**
   *             (009가 생긴 이유). 「기록이 없다」와 「안 넣었다」는 다르다
   */
  readonly kind: "fact" | "reference" | "seen"
  /**
   * batch가 못 담는 결과 (015). `reference`에서만 찬다 —
   * `cost 35 · pending_cost 171 · sku_created 35` 꼴이다. 문구는 화면이 만든다.
   */
  readonly outcomes: Readonly<Record<string, number>>
  /** 몇 번 봤나 (009). 재가져오기가 몇 번이었는지를 이 수가 말한다. */
  readonly seenCount: number
}

export async function loadHistoryRows(
  db: Driver,
  libraryId: string,
  resolveDocType: DocTypeResolver,
): Promise<readonly HistoryRow[]> {
  const repo = new Repository(db)
  const raw = await repo.batchHistory(libraryId)
  const intake = await repo.intakeHistory(libraryId)

  const batchById = new Map(raw.map((b) => [b.id, b]))
  /** 통이 이미 집어 간 배치 — 남는 것은 목격 없는 배치이고, 그건 아래에서 줍는다. */
  const claimed = new Set<string>()

  const fromBatch = (b: (typeof raw)[number], extra: {
    kind: HistoryRow["kind"]
    outcomes: Readonly<Record<string, number>>
    seenCount: number
  }): HistoryRow => {
    // 상태 판정 — `assertUndoable`의 세 조건 중 화면이 보여줄 둘.
    // (세 번째인 «배치가 존재하나»는 목록에 있다는 것 자체가 답이다)
    const undo: UndoState =
      b.status === "undone" ? "undone" : b.takenOverRows > 0 ? "blocked" : "can"

    /**
     * ★ 판정은 여기서 한다 — 화면이 `status`를 다시 해석하지 않는다 ★
     * 「커밋된 적이 없다」가 취소와 되돌리기를 가르는 사실이고, 그것은 저장이 아는
     * 것이지 화면이 추론할 것이 아니다.
     */
    const outcome: BatchOutcome =
      b.status === "committed"
        ? "done"
        : b.status === "undone"
          ? b.committedAt === null
            ? "aborted"
            : "undone"
          : "unfinished"

    return {
      id: b.id,
      channel: b.channel,
      sourceName: b.sourceName,
      sheetName: b.sheetName,
      docType: resolveDocType(b.mappingVersion),
      at: b.committedAt ?? b.startedAt,
      batchStatus: b.status,
      fetched: b.rowCount,
      // 신규 = 적재한 것 중 **덮어쓴 것을 뺀** 나머지.
      //
      // `max(0, …)`는 이제 순수한 방어다. 전에는 되돌린 배치의 `row_count`가 0으로
      // 밀려 음수가 실제로 나올 수 있었는데, 되돌리기가 더 이상 그 값을 건드리지
      // 않는다(2026-08-16). 즉 이 칸도 이제 **적재 당시의 사실**이고, 되돌렸다는
      // 것은 `undo`/`undoneAt`이 말한다.
      created: Math.max(0, b.rowCount - b.restoresRows),
      updated: b.restoresRows,
      failed: b.excludedCount,
      ownedByTable: b.ownedByTable,
      undo,
      outcome,
      undoneAt: b.undoneAt,
      blockedBy:
        b.blockedBy === null ? null : { sourceName: b.blockedBy.sourceName, at: b.blockedBy.at },
      ...extra,
    }
  }

  /**
   * ★★ 장부의 단위가 **배치**에서 **파일**로 바뀐다 (015 · ADR-023 결정 1) ★★
   *
   * 전에는 `batch` 한 표만 읽어서 **원가 파일이 한 줄도 안 나왔다** — 사용자가
   * 13MB 단가표를 넣고 겪은 그것이다. 이제 통(`file_sighting`)이 척추이고 배치는
   * 그 줄에 달리는 「이 파일이 무엇이 됐나」 중 하나다.
   */
  const out: HistoryRow[] = []
  for (const s of intake) {
    const b = s.batchId === null ? null : (batchById.get(s.batchId) ?? null)
    if (b !== null) {
      claimed.add(b.id)
      out.push(fromBatch(b, { kind: "fact", outcomes: s.outcomes, seenCount: s.seenCount }))
      continue
    }
    // 배치가 없는 파일. **결과가 있으면 기준 데이터, 없으면 「봤을 뿐」이다.**
    // 둘을 한 상태로 뭉개면 「원가를 넣었는데 아무 말이 없는 줄」이 된다 (LOCK 6).
    const kinds = Object.keys(s.outcomes).filter((k) => k !== "nothing")
    out.push({
      // 내부 키를 화면에 내보내지 않는다 (헌장 C-4). 이 id는 화면이 행을 구분하는
      // 데만 쓰고, 통의 줄은 배치가 아니므로 배치 id와 섞이지 않게 접두를 붙인다.
      id: `intake:${s.id}`,
      // 기준 데이터에는 연결이 없다. **빈 문자열이 「채널 없음」이고**, 문구는 화면이 만든다.
      channel: "",
      sourceName: s.sourceName,
      sheetName: s.sheetName,
      docType: s.profileId === null ? null : resolveDocType(s.profileId),
      at: s.lastSeenAt,
      batchStatus: "",
      // 행 수는 배치의 어휘다. 기준 데이터는 `outcomes`로 말한다 — 0을 그리면
      // 「0행 들어갔다」로 읽히는데 그건 거짓이다 (§22).
      fetched: 0,
      created: 0,
      updated: 0,
      failed: s.outcomes["bad_rows"] ?? 0,
      ownedByTable: {},
      // ★ 되돌릴 수 없다 ★ `row_shadow`가 Fact 5종만 덮는다(002). 못 누르는 버튼을
      // 그려놓고 막지 않는다 — 화면이 사유를 상태 칸에 쓴다 (§21-1 · U-3).
      undo: "blocked",
      outcome: kinds.length > 0 ? "done" : "unfinished",
      undoneAt: null,
      blockedBy: null,
      kind: kinds.length > 0 ? "reference" : "seen",
      outcomes: s.outcomes,
      seenCount: s.seenCount,
    })
  }

  /**
   * ★ 목격 없는 배치를 줍는다 — 조용히 사라지면 안 된다 (LOCK 6) ★
   *
   * 오늘 실측은 0건이다(2026-08-21 · 실 DB·데모 둘 다). 그래도 줍는 이유는,
   * 통을 척추로 삼는 순간 **목격이 없는 배치는 장부에서 통째로 증발**하기 때문이다.
   * 「지금 0이니 괜찮다」로 두면 그런 배치가 생기는 날 아무도 모른다.
   */
  for (const b of raw) {
    if (claimed.has(b.id)) continue
    out.push(fromBatch(b, { kind: "fact", outcomes: {}, seenCount: 1 }))
  }

  // 최근 순. 통과 배치가 섞이므로 여기서 한 번 정렬한다.
  return out.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))
}
