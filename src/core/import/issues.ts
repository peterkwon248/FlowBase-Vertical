/**
 * 가져오기가 남기는 **사건 코드** — 하나의 선언표가 사유·치명 여부·좌표계를 함께 정한다.
 *
 * ─────────────────────────────────────────────────────────────
 * ★ 왜 생겼나 — `fatal: false`는 아무 데도 닿지 않았다 ★
 *
 * `MappingError`는 두 가지를 섞어 담아 왔다. 행을 버린 것(치명)과 **행은 적재됐지만
 * 알려야 하는 것**(비치명)이다. 전자는 `batch_exclusion`에 `reason="error"`로
 * 기록되지만, 후자는 `ImportRunResult.mappingErrors`에 담겨 **아무도 읽지 않은 채**
 * 함수가 끝나면 사라졌다.
 *
 * 즉 「사전에 없는 상태값이 기본 경로로 흘러 들어갔다」·「선언한 컬럼이 파일에
 * 없어 그 값이 전 행에서 빈다」가 앱 표면에 **한 곳도** 닿지 않았다. 조용한 실패는
 * 아니다(적재는 됐다). 하지만 **조용한 결손**이고, LOCK 6이 막으려는 것과 같은 계열이다.
 * ─────────────────────────────────────────────────────────────
 *
 * ★ 치명 여부를 **부르는 쪽이 정하지 않는다** ★
 *
 * 전에는 `errors.push({ …, fatal: false })`처럼 자리마다 손으로 적었다. 같은 사유가
 * 두 곳에서 다르게 판정될 수 있는 모양이고, 그런 «어길 수 있는 상태»는 언젠가
 * 갈린다 — C 계열(키·라우팅·리스팅 컬럼)에서 겪은 그것이다. 그래서 `fatal`은 표가
 * 정하고 코드는 **코드값만** 고른다.
 *
 * ★ 좌표계가 둘이라 함께 선언한다 (`scope`) ★
 *
 *   row   이 **파일 행 하나**에 일어난 일. 행 번호가 있다
 *   file  이 **파일 전체**에 걸친 일. 행 번호가 없다
 *
 * 「컬럼 «배송비»가 없다」를 행 사건으로 세면 «온전하지 않은 행 1건»이 되는데, 실제로는
 * **전 행에서** 그 값이 빈다. 파일 사건을 행 수로 뭉개면 수가 141분의 1로 줄어
 * 「거의 괜찮다」처럼 보인다 — 조용한 실패를 고치려다 조용한 거짓을 만드는 자리다.
 *
 * ★ 화면 문구는 여기 없다 ★
 * `what`은 개발자용 한 줄이다. 사용자에게 보일 말은 화면이 소유한다
 * (`app/import.ts`의 `ISSUE_LABEL`) — §22에서 core가 문장을 만들지 않기로 한 것과 같다.
 */

export type IssueScope = "row" | "file"

export interface IssueKind {
  /** 이 사유가 **행을 버렸는가.** 버렸으면 목적지는 `batch_exclusion`이다. */
  readonly fatal: boolean
  readonly scope: IssueScope
  /** 개발자용 한 줄. 화면 문구가 아니다. */
  readonly what: string
}

/**
 * ★ 닫힌 집합이다 — 새 실패 상태를 발명하지 않는다 (LOCK 6) ★
 *
 * 여기에 없는 코드는 타입이 거부한다. 새 사유가 필요하면 **이 표에 한 줄을 더하는
 * 것이 곧 목적지 선언**이 된다 — 그 줄 없이는 `errors.push`가 컴파일되지 않는다.
 */
export const ISSUE_KINDS = {
  // ── 치명: 행이 빠졌다. `batch_exclusion`(reason="error")로 간다 ──
  required_empty: { fatal: true, scope: "row", what: "필수 필드가 비었다" },
  value_not_in_dict: { fatal: true, scope: "row", what: "사전(valueMap)에 없는 값" },

  // ── 비치명: 행은 적재됐다. `batch_issue`로 간다 ──
  unknown_route: {
    fatal: false,
    scope: "row",
    what: "라우팅 값이 knownValues에 없다 — 행은 기본 경로로 적재됐다",
  },
  missing_column: {
    fatal: false,
    scope: "file",
    what: "프로파일이 선언한 컬럼이 파일에 없다 — 그 필드가 전 행에서 빈다",
  },
  item_key_missing: {
    fatal: false,
    scope: "file",
    what: "리스팅 키 컬럼이 없어 품목을 만들지 못했다 — 주문은 적재됐다",
  },
  orphan_item: {
    fatal: false,
    scope: "row",
    what: "품목이 부모 주문을 찾지 못해 버려졌다 — 주문 자체는 적재됐다",
  },
  stale_batch_aborted: {
    fatal: false,
    scope: "file",
    what: "끝나지 않았던 이전 배치를 취소하고 다시 넣었다 — 재시도가 곧 정리다",
  },
  stale_batch_blocked: {
    fatal: false,
    scope: "file",
    what: "끝나지 않은 이전 배치가 있는데 다른 배치가 그 행을 가져가 못 치웠다",
  },
} as const satisfies Record<string, IssueKind>

export type IssueCode = keyof typeof ISSUE_KINDS

export const isFatal = (code: IssueCode): boolean => ISSUE_KINDS[code].fatal
export const scopeOf = (code: IssueCode): IssueScope => ISSUE_KINDS[code].scope

/** 비치명 코드 전부. 화면·테스트가 «전부 다뤘는가»를 물을 때 쓴다. */
export const NONFATAL_CODES: readonly IssueCode[] = (
  Object.keys(ISSUE_KINDS) as IssueCode[]
).filter((c) => !ISSUE_KINDS[c].fatal)
