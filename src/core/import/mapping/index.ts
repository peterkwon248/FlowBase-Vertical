/**
 * Mapping — 파이프라인 4단계.
 *
 * 정규화된 표를 프로파일에 따라 Canonical 필드로 옮긴다. 헌장 B-6 —
 * **프로파일은 코드가 아니라 버전 있는 데이터(JSON)**이므로, 이 파일에는
 * 특정 마켓의 컬럼 이름이 없다 (B-8). 마켓 지식은 `packs/` 안의 JSON에만 있다.
 *
 * 세션 2의 최소형이지만 **버릴 프로토타입이 아니다.** 프로파일 구조 4종
 * (`recognitionRules`·`extractionRules`·`fieldMappings`·`validationRules`)을
 * 전부 갖추고, 내용만 얇다. 확장은 필드를 채우는 일이지 형태를 바꾸는 일이 아니다.
 */

import { readUInt48BE, sha1 } from "./sha1.js"
import type { NormalizedChunk, RawCell } from "../types.js"
import type { IssueCode } from "../issues.js"
import { normalizeValue } from "../normalization/value.js"
import { rowValuesInto } from "../normalization/chunk.js"

export type SourceKeyStrategy = "natural" | "content"

export interface FieldMapping {
  readonly target: string
  readonly source?: string
  readonly kind: "identifier" | "number" | "date" | "text" | "percent" | "enum"
  readonly required?: boolean
  readonly default?: RawCell
  readonly derive?:
    | { readonly from: "fileName"; readonly capture: string }
    | { readonly from: "constant"; readonly value: RawCell }
    /**
     * ★ 여러 열의 **곱** (2026-08-18) ★
     *
     * ─────────────────────────────────────────────────────────────
     * 어떤 양식은 라인 합계를 주지 않고 **단가와 수량만** 준다. 자사몰 주문
     * 파일이 그렇다 — `판매가`(단가) · `상품수량`은 있는데 라인 금액 열이 없고,
     * `총 품목 금액`은 **주문 단위 합계**다.
     *
     * 실측(B2B 픽스처 1,197행 · 주문 1,071건): 주문 단위로 묶으면
     * `Σ(판매가 × 상품수량) == 총 품목 금액`이 **1,054건 일치**한다. 어긋나는
     * 17건은 전부 설명된다 — 16건은 취소되어 총액이 0이고, 1건은 옵션 추가금이다.
     *
     * 그래서 라인 금액에 `총 품목 금액`을 쓰면 **다품목 주문에서 매출이 겹쳐
     * 계상된다**(품목 2개짜리 주문이 두 줄 모두 주문 총액을 갖는다). 단가×수량이
     * 라인의 진실이고, 그걸 표현할 방법이 없어서 이 갈래를 만들었다.
     * ─────────────────────────────────────────────────────────────
     *
     * ★ 마켓을 모른다 (LOCK 4) ★ 「단가 × 수량」은 어느 마켓에나 있는 모양이고,
     * 여기 있는 것은 **곱셈**뿐이다. 어떤 열을 곱할지는 프로파일이 정한다.
     *
     * 열이 없거나 숫자가 아니면 **조용히 0으로 만들지 않는다** — 다른 매핑과
     * 같은 경로로 오류를 남긴다. 0은 「안 팔렸다」로 읽히므로 가장 위험한 기본값이다.
     */
    | { readonly from: "multiply"; readonly columns: readonly string[] }
  /**
   * 원본 값 → Canonical 값 사전. 스키마가 `CHECK`로 값을 제한하는 컬럼이
   * 있어서 필요하다 — 예: `claim_type IN ('CANCEL','RETURN','EXCHANGE','REFUND')`인데
   * 파일은 "취소완료"라고 적는다.
   *
   * 사전에 없는 값은 **조용히 통과시키지 않는다** — 매핑 오류로 보고한다.
   * 모르는 상태가 새로 생겼다는 뜻이고, 그건 사람이 봐야 한다 (헌장 A-5).
   */
  readonly valueMap?: Readonly<Record<string, RawCell>>
  /**
   * ★ 음수를 어떻게 다루나 — **선언이 집행을 정한다** (ADR-009 ②) ★
   *
   * `"magnitude"`: 저장은 **절대값**이고 부호가 뜻하던 것(공제냐 환불이냐)은
   * 타입이 진다. 프로파일 11곳이 이걸 선언해 뒀는데 **읽는 코드가 0곳이었다** —
   * 오늘까지 집행자가 없었다.
   *
   * ★ 집행하되 **조용히 뒤집지 않는다** ★
   * `abs`는 값을 바꾸는 일이다. 바꿨다는 사실을 남기지 않으면 사용자는 파일의
   * -12,345를 앱에서 12,345로 보고 «내가 잘못 봤나»가 된다. 그래서 바꿀 때마다
   * 비치명 사건으로 표면화한다 (`sign_normalized`).
   *
   * ★ 선언이 없으면 **바꾸지 않는다** ★
   * 음수의 뜻을 모르는 채 절대값을 씌우면 반품이 판매가 되고 손실이 이익이 된다.
   * 값은 그대로 두고 «부호 규칙이 선언되지 않았다»고 말한다 (`sign_undeclared`).
   */
  readonly signPolicy?: "magnitude"
}

export type { ListingRule } from "./listing.js"
import { KEY_SEP, type ListingRule } from "./listing.js"

export interface MappingProfile {
  readonly id: string
  readonly version: string
  readonly packId: string
  readonly marketplaceKey: string
  readonly docType: string
  readonly grain: string
  readonly targetTable: string
  /** 이 **문서**의 이름. 예: "결제완료/정산확정". 화면의 채널 이름이 아니다. */
  readonly label: string
  /**
   * 이 **채널**의 통칭. `connection.display_name`의 기본값이 된다.
   *
   * ★ 왜 프로파일이 이름을 아는가 ★
   * 화면에 `conn-11st` 같은 내부 키를 노출하는 것은 헌장 C-4 위반이고(`batch_id`를
   * 숨기기로 한 것과 같은 계열), 그렇다고 앱이 이름을 지어낼 수도 없다. 프로파일은
   * **그 마켓의 문서 구조 전체를 아는 주체**이므로 마켓의 통칭도 그 정당한 지식이다.
   *
   * LOCK 4와 충돌하지 않는다 — 이름이 사는 곳이 `core/`가 아니라 **팩의 프로파일**이다.
   * core는 이 문자열을 읽어 옮길 뿐 무엇인지 모른다.
   *
   * 연결 화면이 생기면 사용자가 덮어쓸 수 있는 값이 된다 (§10-2 라벨).
   * **여기 있는 것은 기본값이다.**
   */
  readonly displayName: string
  readonly recognitionRules: {
    readonly containerFormats: readonly string[]
    readonly requiredHeaders: readonly string[]
    /**
     * ★ **이 헤더가 있으면 이 양식이 아니다** (2026-08-18) ★
     *
     * ─────────────────────────────────────────────────────────────
     * `requiredHeaders`는 «있으면 통과»라, **좁은 양식이 넓은 양식에 삼켜진다.**
     *
     * 실측으로 부딪혔다: 원가표는 `상품번호|상품명|모델명|원가|배송비|카테고리|Model`
     * 7열인데, 사용자 워크북의 `B2B_매출정리`(101열)에 **그 7열이 전부 들어 있다.**
     * 그래서 매출 파일이 원가표로 100% 판정됐다 — 필수 헤더를 아무리 고쳐도
     * 부분집합 관계라 갈리지 않는다.
     *
     * ★ 열 수로 막지 않는다 ★ 「7열 이하만 원가표」로 하면 마켓이 열 하나만 더해도
     * 양식이 통째로 안 붙는다 — 「열 추가는 공짜」라는 이 앱의 성질과 정면으로 충돌한다.
     *
     * 대신 **의미로 막는다**: 원가는 상품 단위라 「주문 번호」가 있을 수 없다.
     * 있으면 그건 거래 파일이지 원가 마스터가 아니다. 열이 늘어도 이 판정은 안 흔들린다.
     * ─────────────────────────────────────────────────────────────
     */
    readonly forbiddenHeaders?: readonly string[]
    readonly headerMatch: "all" | "any"
    readonly fileNamePattern?: string
    /**
     * 사람에게 보여줄 **원본 파일명 예시.** 파일명 캡처가 실패했을 때 화면이
     * *"예: 쿠팡 제트 매출_20260701~20260731.xlsx"*라고 말할 수 있어야 한다 —
     * 정규식을 사용자에게 내밀 수는 없기 때문이다.
     *
     * 마켓 어휘라 팩에 산다 (LOCK 4). core는 문자열을 옮길 뿐이다.
     */
    readonly fileNameExample?: string
    readonly minConfidence: number
  }
  readonly extractionRules: {
    readonly sheetSelector: { readonly kind: string; readonly name?: string }
    readonly headerRowHint?: number
    readonly detectUnlabeledAggregates?: boolean
  }
  /**
   * ★ **기준 데이터** 양식임을 선언한다 (2026-08-18) ★
   *
   * ─────────────────────────────────────────────────────────────
   * 데이터 3종(헌장)에서 «사실»과 «기준»은 적재 규칙이 다르다:
   *
   * ```
   * 사실  주문·정산   batch로 쌓고 되돌린다 · 원본 불변 · append-only
   * 기준  원가·상품   덮어쓴다 · 이력이 남는다 · 적용일이 있다
   * ```
   *
   * 지금까지 가져오기는 사실 전용이었다(`FACT_TABLES`가 5표로 닫아 둔다).
   * 그래서 앱이 «원가 파일이 필요합니다»라고 말해 놓고 **넣을 문이 없었다** —
   * 말과 행동이 어긋난 자리였다.
   *
   * 이 블록이 있으면 `runReferenceImport`가 맡는다. 없으면 종전대로 `runImport`다.
   * 판정·파싱·정규화(①~④)는 **완전히 같은 코드**를 지나고, 갈라지는 것은 적재뿐이다.
   * ─────────────────────────────────────────────────────────────
   */
  readonly reference?: {
    /** 무엇을 넣는가. v1은 원가뿐이다 (ADR-005 — 이력 범위를 원가로 좁힌 결정). */
    readonly target: "cost"
    /**
     * 상품을 가리키는 열. **리스팅 키와 같은 값**이어야 한다.
     *
     * 원가는 SKU에 붙는데 파일은 SKU를 모른다 — 파일이 아는 것은 마켓의 상품번호이고,
     * 그건 곧 리스팅 키다. 그래서 «리스팅을 찾아 그 SKU에 붙인다».
     */
    readonly listingKeyColumn: string
    /** 금액 열. 원 단위 정수로 읽는다. */
    readonly amountColumn: string
    /** `cost_history.kind`. 스키마가 CHECK로 네 종을 닫아 뒀다. */
    readonly kind: "COGS" | "PACKAGING" | "LOGISTICS" | "OTHER"
    /** 사람이 알아볼 이름을 만들 때 쓴다 (SKU를 새로 만드는 경우). */
    readonly titleColumn?: string
  }
  readonly sourceKey: {
    readonly strategy: SourceKeyStrategy
    readonly columns?: readonly string[]
    /**
     * 파일명 캡처를 키에 **더한다** — `recognitionRules.fileNamePattern`의 이름 있는
     * 그룹을 쓴다.
     *
     * ★ 왜 필요한가 (2026-08-14, 쿠팡 제트 매출) ★
     * 기간 집계 파일은 행이 «옵션 × 기간»이고 **기간이 파일 안에 없다** —
     * 파일명에만 있다. 컬럼만으로 키를 만들면 옵션ID가 키가 되고, 8월 파일이
     * 7월 행을 **UPSERT로 덮어** 7월 매출이 통째로 사라진다.
     *
     * `content` 전략도 답이 아니다. 행 내용만 해시하므로 두 달의 숫자가 같으면
     * (전량 0인 옵션이 흔하다) 같은 키가 되어 똑같이 덮인다.
     *
     * **선언하지 않으면 아무것도 달라지지 않는다** — 기존 프로파일의 키는 한 글자도
     * 바뀌지 않고, 따라서 재가져오기 멱등성도 그대로다 (ADR-006).
     */
    readonly fileNameCaptures?: readonly string[]
  }
  readonly fieldMappings: readonly FieldMapping[]
  /**
   * 이 파일에서 **마켓 리스팅**을 뽑는 규칙 (`listing.ts`).
   *
   * 없으면 리스팅을 만들지 않는다 — 광고 보고서처럼 상품 식별자가 없는 문서가
   * 그렇다. 있으면 `grain`으로 자기 입도를 선언한다 (마이그레이션 004).
   */
  readonly listing?: ListingRule
  /**
   * **품목 적재 (2단계).** 주문 헤더와 함께 `fact_order_item`을 한 줄 더 낸다.
   *
   * ─────────────────────────────────────────────────────────────
   * ★ 왜 «두 번째 테이블»이 아니라 별도 선언인가 ★
   * `rowRouting`은 행을 **어느 하나의** 테이블로 보낸다(ESM의 주문 vs 클레임).
   * 품목은 그것과 다르다 — 같은 행이 주문 헤더 **이면서** 품목이다. 라우팅으로
   * 흉내 내면 한 행이 두 버킷에 들어가야 하는데, 그러면 «이 행은 어디로 갔나»의
   * 답이 하나가 아니게 되고 라우팅의 뜻이 무너진다.
   *
   * ★ 식별자를 새로 선언하지 않는다 ★
   * 품목의 식별자는 **리스팅 키 그대로**다(`listing.keyColumns`). 「이 리스팅이
   * 이 주문에서 팔린 것」이 곧 품목이므로 다른 키를 둘 이유가 없고, 두면 두 선언이
   * 언젠가 갈린다. 그래서 `orderItem`은 `listing` 없이는 성립하지 않는다.
   *
   * 품목의 `source_key` = **부모 주문의 source_key + 리스팅 키** (`KEY_SEP`).
   * 부모가 이미 유일하므로 그 안에서 리스팅만 구분되면 되고, 재가져오기에서
   * 두 값 모두 파일이 같으면 같으므로 **UPSERT 정체성이 보존된다** (ADR-006).
   * ─────────────────────────────────────────────────────────────
   *
   * 클레임으로 라우팅된 행은 **품목을 만들지 않는다.** 매출에서 빠진 판매의
   * 원가도 빠져야 하기 때문이다 — 취소된 주문의 매입원가를 계상하면 손실이
   * 두 번 잡힌다.
   */
  readonly orderItem?: {
    /** `quantity`·`gross_amount`·`discount_amount`. `target`은 컬럼명 그대로다. */
    readonly fieldMappings: readonly FieldMapping[]
    readonly note?: string
  }
  /**
   * 한 파일 안에서 행을 **여러 테이블로 나눠 보낸다.**
   *
   * ★ 왜 프로파일을 둘로 쪼개지 않는가 ★
   * ESM 주문통합검색은 주문과 클레임이 `진행상태` 한 컬럼으로 섞여 있다.
   * 같은 파일에 프로파일 둘이 매칭되면 **Recognition이 모호해진다** — 어느
   * 것을 고를지 파일만 보고는 알 수 없다. 그래서 프로파일은 하나로 두고
   * 그 안에서 행을 가른다. **batch도 하나**다.
   */
  readonly rowRouting?: {
    /** 판정에 쓸 컬럼. */
    readonly column: string
    /**
     * 이 컬럼에서 **나올 수 있다고 알려진 값 전부.**
     *
     * ★ 없으면 조용히 샌다 ★
     * `routes[].match`는 클레임 상태만 열거한다. 마켓이 "부분취소완료" 같은 새
     * 상태를 만들면 어느 route에도 안 걸려 **기본 경로(매출)로 조용히 들어간다** —
     * 클레임이 매출로 잡히는 바로 그 사고다 (헌장 A-5).
     *
     * 그래서 아는 값을 전부 적어두고, 벗어나면 오류로 보고한다. 행은 기본
     * 경로로 보내되(데이터를 버리지 않는다) **모르는 상태가 왔다는 사실을 남긴다.**
     */
    readonly knownValues?: readonly string[]
    readonly routes: readonly {
      /** 이 값들 중 하나면 이 경로로 간다. */
      readonly match: readonly string[]
      readonly targetTable: string
      readonly fieldMappings: readonly FieldMapping[]
      /**
       * **기본 경로에도 남긴다** — 한 행이 두 테이블로 간다 (2026-08-14 판정).
       *
       * ─────────────────────────────────────────────────────────────
       * ★ 왜 필요한가 — 클레임 이중 차감 ★
       *
       * ESM은 취소·반품·환불이 **원거래 행 자체**에 상태로 찍혀 온다. 그 행을
       * `fact_claim`으로만 보내면 그 판매는 매출에 **들어간 적이 없는데** 손익이
       * 클레임을 또 뺀다 — 실측 순이익이 388,700원 과소계상됐다.
       *
       * ADR-009 ①과 충돌하지 않는다는 점이 함정이었다: 「클레임은 발생일 기준」은
       * **원거래가 다른 달에 있는** 클레임의 규칙이고, 여기서는 원거래와 취소가
       * 같은 행이다. 두 경우를 같은 식으로 다루면 후자만 두 번 빠진다.
       *
       * ★ 왜 조인 판정이 아닌가 ★
       * 「매출에 짝이 있나」를 조인으로 물으려면 근사 매칭이 필요하다 — ESM 클레임
       * 키는 주문번호뿐이고 주문 키는 주문번호+상품번호라 **비접합**이다. ADR-006이
       * 근사 매칭을 금지하므로 그 길은 닫혀 있고, 전부 「짝 없음」으로 판정하면
       * 월경계 클레임(8월에 오는 7월 주문 취소)이 영영 안 빠지는 더 큰 사고가 된다.
       *
       * ★ 왜 표시 계층이 아닌가 ★
       * §22-5의 소비처 고정 — 「매출은 `order`에서만」. 화면에서 `fact_claim`을
       * 매출에 합치는 땜질은 그 LOCK 위반이므로 **저장 계층에서** 두 번 쓴다.
       *
       * 파일 모양이 회계 규칙을 바꾸면 채널마다 순이익의 정의가 달라진다 —
       * 판매 사실은 `fact_order`(주문일 인식), 취소 사실은 `fact_claim`(발생일)이
       * 한 파일에 압축돼 오든 따로 오든 같아야 한다.
       * ─────────────────────────────────────────────────────────────
       */
      readonly alsoDefault?: boolean
      readonly note?: string
    }[]
  }
  readonly validationRules: readonly Record<string, unknown>[]
  readonly unmappedColumns?: { readonly policy: string }
}

/** `mapping_version` 문자열 — 각 batch가 기록한다 (헌장 B-6). */
export function profileVersion(p: MappingProfile): string {
  return `${p.marketplaceKey}/${p.docType}/${p.grain}@${p.version}`
}

// ─────────────────────────────────────────────────────────────
// 컬럼의 역할 — «이 프로파일이 이 컬럼을 쓰는가»의 유일한 답
// ─────────────────────────────────────────────────────────────

/**
 * 한 컬럼이 맡는 일. **`field` 하나만 있는 게 아니다** — 결함 53이 정확히 그
 * 착각이었다: 확인 화면이 `fieldMappings`만 보고 `주문번호`·`상품명`을
 * «이 프로파일이 쓰지 않는 컬럼»이라고 말했다. 실제로는 행 식별 키와 리스팅
 * 제목의 출처였다.
 */
export type ColumnRole =
  /** `fieldMappings` — Canonical 필드로 저장된다. */
  | "field"
  /** `sourceKey.columns` — 행 식별 키를 구성한다. UPSERT 멱등이 여기 걸린다. */
  | "source-key"
  /** `listing.keyColumns` — 마켓 리스팅의 식별자. */
  | "listing-key"
  /** `listing.titleColumns` — 상품 연결 화면에 뜨는 제목. */
  | "listing-title"
  /** `rowRouting.column` — 이 행이 어느 테이블로 갈지 정한다. */
  | "routing"
  /**
   * `orderItem.fieldMappings` — 품목(`fact_order_item`)으로 저장된다.
   *
   * `field`와 갈라 두는 이유는 결함 53과 같다: 수량 컬럼은 **저장되는데** 주문
   * 헤더에는 안 보인다. 같은 `field`로 뭉치면 화면이 «주문에 저장된다»고 말하게
   * 되고, 그건 어느 표를 봐도 그 값이 없는 이유를 설명하지 못한다.
   */
  | "item-field"
  /**
   * `reference.amountColumn` — **기준 데이터의 값**이 여기서 온다 (원가 등).
   *
   * `field`와 갈라 두는 이유는 `item-field`와 같다: 이 값은 Fact 표가 아니라
   * `cost_history`로 가고, 되돌리기도 batch도 걸리지 않는다. 같은 `field`로
   * 뭉치면 확인 화면이 «주문 표에 저장된다»고 말하게 된다.
   */
  | "reference-amount"

export interface ColumnUse {
  readonly roles: readonly ColumnRole[]
  /** `field` 역할일 때의 Canonical 필드명. */
  readonly target?: string
  readonly required?: boolean
}

export interface ProfileColumnUse {
  /** 키는 **trim된** 헤더명. 헤더 쪽도 trim해서 맞춘다. */
  readonly byColumn: ReadonlyMap<string, ColumnUse>
  /**
   * `sourceKey.strategy === "content"` — 선언된 키 컬럼이 없고 **행 전체**가
   * 식별에 참여한다 (ADR-006). 이때는 «이 컬럼을 쓰지 않는다»가 **어떤 컬럼에
   * 대해서도 참이 아니다.**
   */
  readonly contentKeyed: boolean
}

/**
 * 프로파일이 실제로 읽는 컬럼과 그 역할 — **판정만 한다. 문구는 만들지 않는다.**
 *
 * 표시 문자열을 여기서 만들지 않는 이유는 §22에서 배운 것과 같다: 같은 사실을
 * 화면은 표의 한 칸으로, 매핑 카운터는 숫자로 쓴다. 구조를 주고 문장은 각자 만든다.
 *
 * `rowRouting.routes[].fieldMappings`도 센다 — 클레임 경로에서만 쓰는 컬럼을
 * «버렸다»고 세면 숫자가 거짓말을 한다.
 */
/**
 * 기준 데이터 종류 → **저장되는 자리**의 이름. 화면이 「어디에 들어가나」를
 * 말할 때 쓴다 — `cost_history.kind`의 코드값을 그대로 보이면 아무 뜻도 없다.
 */
const REFERENCE_TARGET: Record<string, string> = {
  COGS: "매입원가",
  PACKAGING: "포장비",
  LOGISTICS: "물류비",
  OTHER: "기타 원가",
}

export function columnRoles(profile: MappingProfile): ProfileColumnUse {
  const byColumn = new Map<string, ColumnUse>()

  const add = (raw: string | undefined, role: ColumnRole, extra?: Omit<ColumnUse, "roles">): void => {
    const key = (raw ?? "").trim()
    if (key === "") return
    const prev = byColumn.get(key)
    const roles = prev ? (prev.roles.includes(role) ? prev.roles : [...prev.roles, role]) : [role]
    byColumn.set(key, { ...prev, ...extra, roles })
  }

  // `required`는 **참일 때만** 싣는다. `exactOptionalPropertyTypes`가 켜져 있어
  // `undefined`를 명시적으로 넣을 수 없고, 애초에 «필수가 아님»과 «선언 안 함»을
  // 구분할 필요가 없다.
  const asField = (m: FieldMapping): Omit<ColumnUse, "roles"> =>
    m.required === true ? { target: m.target, required: true } : { target: m.target }

  for (const m of profile.fieldMappings) {
    if (m.source) add(m.source, "field", asField(m))
  }
  for (const r of profile.rowRouting?.routes ?? []) {
    for (const m of r.fieldMappings) {
      if (m.source) add(m.source, "field", asField(m))
    }
  }
  for (const m of profile.orderItem?.fieldMappings ?? []) {
    if (m.source) add(m.source, "item-field", asField(m))
  }
  for (const c of profile.sourceKey.columns ?? []) add(c, "source-key")
  for (const c of profile.listing?.keyColumns ?? []) add(c, "listing-key")
  for (const c of profile.listing?.titleColumns ?? []) add(c, "listing-title")
  if (profile.rowRouting) add(profile.rowRouting.column, "routing")

  /**
   * ★ 기준 데이터 프로파일은 `fieldMappings`가 비어 있다 ★
   *
   * 원가표는 Canonical 필드로 저장되는 것이 하나도 없다 — 상품번호로 리스팅을
   * 찾고 금액을 `cost_history`에 넣을 뿐이다. 그래서 이 블록이 없으면 확인
   * 화면이 **모든 컬럼을 «이 프로파일이 쓰지 않는 컬럼»이라고 말한다.** 실제로는
   * 셋을 읽고 그중 둘이 없으면 한 행도 못 넣는데도. 결함 53과 같은 계보다.
   */
  const ref = profile.reference
  if (ref) {
    add(ref.listingKeyColumn, "listing-key")
    add(ref.amountColumn, "reference-amount", {
      target: REFERENCE_TARGET[ref.kind] ?? "기준 데이터",
      required: true,
    })
    add(ref.titleColumn, "listing-title")
  }

  return { byColumn, contentKeyed: profile.sourceKey.strategy === "content" }
}

// ─────────────────────────────────────────────────────────────
// 프로파일 판정
// ─────────────────────────────────────────────────────────────

export interface ProfileMatch {
  readonly profile: MappingProfile
  readonly confidence: number
  readonly evidence: readonly string[]
  /**
   * **이 후보로는 넣을 수 없다** — 이유와 함께. `undefined`면 넣을 수 있다.
   *
   * ★ 왜 «후보에서 빼기»가 아니라 «막힌 후보»인가 ★
   * 빼버리면 화면이 «맞는 프로파일이 없습니다»라고 말하는데, 그건 거짓이다 —
   * 양식은 알아봤고 **파일명이 모자란 것**이다. 사용자가 할 일이 완전히 다르므로
   * (다른 파일을 찾는 게 아니라 이름을 되돌리는 것) 이유를 들고 남는다.
   *
   * 값을 만드는 것은 core, 문장을 만드는 것은 화면이다 (§22 분업).
   */
  readonly blockedBy?: {
    /** 파일명에서 읽지 못한 캡처 이름들. */
    readonly missingCaptures: readonly string[]
  }
}

/**
 * 헤더와 파일명으로 프로파일 후보를 찾는다. 헌장 B-9 — 후보는 confidence와
 * 함께 **복수** 반환한다.
 */
export function matchProfiles(
  profiles: readonly MappingProfile[],
  ctx: { containerFormat: string; headers: readonly string[]; fileName: string },
): ProfileMatch[] {
  const out: ProfileMatch[] = []
  const present = new Set(ctx.headers.map((h) => h.trim()))

  for (const p of profiles) {
    const evidence: string[] = []
    const r = p.recognitionRules

    if (!r.containerFormats.includes(ctx.containerFormat)) continue

    // ★ 금지 헤더가 하나라도 있으면 이 양식이 아니다 — 필수 헤더를 보기 전에 자른다.
    // 넓은 양식이 좁은 양식을 삼키는 것을 막는 유일한 장치다 (위 주석 참조).
    const banned = (r.forbiddenHeaders ?? []).filter((h) => present.has(h))
    if (banned.length > 0) continue

    const hit = r.requiredHeaders.filter((h) => present.has(h))
    const ratio = r.requiredHeaders.length === 0 ? 0 : hit.length / r.requiredHeaders.length
    if (r.headerMatch === "all" && hit.length !== r.requiredHeaders.length) {
      continue
    }
    evidence.push(`필수 헤더 ${hit.length}/${r.requiredHeaders.length} 일치`)

    let confidence = ratio
    let captures: Record<string, string> = {}
    if (r.fileNamePattern) {
      const m = new RegExp(r.fileNamePattern).exec(ctx.fileName)
      if (m) {
        captures = { ...m.groups }
        confidence = Math.min(1, confidence + 0.1)
        evidence.push("파일명 패턴 일치")
      } else {
        evidence.push("파일명 패턴 불일치 — 헤더로만 판정")
      }
    }

    // ★ 캡처 실패는 정지다. 조용한 폴백이 없다 ★
    //
    // 키의 일부가 파일명에 있는 양식(기간 집계)에서 캡처가 비면 그 자리가 빈
    // 문자열로 들어가고, **키가 갈라져 재가져오기가 중복을 쌓는다.** `content`
    // 전략으로 몰래 물러나는 것도 답이 아니다 — 같은 파일의 두 이름이 서로 다른
    // 키를 얻는 것은 마찬가지다.
    //
    // 그래서 후보에서 빼지 않고 **막힌 채로** 남긴다. 사용자가 할 일은 «다른 파일
    // 찾기»가 아니라 «원래 이름 되돌리기»이고, 그건 «맞는 프로파일이 없습니다»로는
    // 전달되지 않는다.
    const need = p.sourceKey.fileNameCaptures ?? []
    const missingCaptures = need.filter((c) => (captures[c] ?? "") === "")

    if (confidence >= r.minConfidence) {
      out.push(
        missingCaptures.length === 0
          ? { profile: p, confidence, evidence }
          : { profile: p, confidence, evidence, blockedBy: { missingCaptures } },
      )
    }
  }

  return out.sort((a, b) => b.confidence - a.confidence)
}

// ─────────────────────────────────────────────────────────────
// 행 매핑
// ─────────────────────────────────────────────────────────────

export interface MappedRow {
  readonly sourceKey: string
  readonly fields: Readonly<Record<string, RawCell>>
}

export interface MappingError {
  readonly rowIndex: number
  readonly field: string
  readonly reason: string
  /**
   * ★ 무슨 일이 있었나 — **치명 여부와 좌표계를 이 코드가 정한다** ★
   *
   * 이 목록은 두 가지를 섞어 담는다 — 행이 통째로 빠진 것(필수 필드 없음 · 사전에
   * 없는 값)과 **행은 적재됐지만 알려야 하는 것**(모르는 라우팅 값 · 없는 컬럼).
   * 섞인 채로 세면 «오류 5건»이 몇 행을 잃은 것인지 아무도 모른다.
   *
   * 전에는 여기 `fatal: boolean`이 있었고 **부르는 자리마다 손으로 적었다.** 같은
   * 사유가 두 곳에서 다르게 판정될 수 있는 모양이라 코드값 하나로 바꿨다 —
   * 판정은 `ISSUE_KINDS`가 한 곳에서 한다 (`isFatal(e.code)`).
   *
   * 목적지도 코드가 정한다: 치명은 `batch_exclusion`(reason="error"), 비치명은
   * `batch_issue`다. 구분 없이 전부 제외에 넣으면 **적재된 행을 제외됐다고 기록**하게
   * 된다 — 조용한 실패를 고치려다 조용한 거짓을 만드는 꼴이다 (LOCK 6).
   */
  readonly code: IssueCode
}

/**
 * 품목 한 줄 — **`byTable`에 들어가지 않는다.**
 *
 * 두 값(`orderSourceKey`·`listingKey`)이 Canonical 컬럼이 아니라 «적재할 때 풀어야
 * 할 참조»라서다. `fact_order_item.order_id`는 부모 행의 **id**를 요구하는데 그 id는
 * 적재 시점에야 정해지고(재가져오기면 기존 id가 유지된다), `listing_id`는 리스팅이
 * 먼저 들어가 있어야 FK가 선다. 그 해소를 `byTable`에 섞으면 `loadChunk`가
 * 이 두 값을 컬럼으로 알고 INSERT를 만든다.
 */
export interface MappedItem {
  readonly sourceKey: string
  /**
   * 이 품목이 나온 **물리 행 번호** (`chunk.rowIndices[i]`).
   *
   * 적재가 아니라 **보고**를 위해 있다. 부모를 못 찾은 품목을 알릴 때 좌표가 없으면
   * 청크 시작 번호나 품목 순번을 대신 쓰게 되는데, 그 둘은 파일 행과 다른 좌표계라
   * 사용자를 엉뚱한 줄로 보낸다 — 「좌표계는 하나여야 한다」(mapRows 루프의 기록).
   */
  readonly rowIndex: number
  /** 부모 주문의 `source_key`. 적재 직전에 `fact_order.id`로 바뀐다. */
  readonly orderSourceKey: string
  /** `marketplace_listing.listing_key`. `listing_id`가 여기서 나온다. */
  readonly listingKey: string
  readonly fields: Readonly<Record<string, RawCell>>
}

export interface MappingResult {
  /** 기본 경로(`profile.targetTable`)의 행. 라우팅이 없으면 전부 여기 있다. */
  readonly rows: readonly MappedRow[]
  /**
   * 테이블별 행. `rowRouting`이 있으면 여기로 읽는다 — `rows`만 보면
   * 다른 경로로 간 행을 통째로 놓친다.
   */
  readonly byTable: ReadonlyMap<string, readonly MappedRow[]>
  /**
   * 품목 (`profile.orderItem`이 있을 때만). **클레임으로 간 행은 여기 없다** —
   * 매출에서 빠진 판매의 원가도 빠져야 한다.
   */
  readonly items: readonly MappedItem[]
  /**
   * **파일에서 실제로 읽어낸 행 수** — 치명 오류로 버린 행은 빼고 센다.
   *
   * 테이블별 적재 수의 합이 아니다. 한 행이 여러 Fact 행이 되는 경우가 둘이라
   * (품목 · 이중 기록) 그 합은 파일 행 수와 대조되지 않는다. 사용자가 읽는
   * 「가져온 행」은 이쪽이다 (`Repository.addBatchRows`).
   */
  readonly rowsLoaded: number
  readonly errors: readonly MappingError[]
  /** 매핑하지 않고 버린 컬럼 수. 조용히 빠뜨리지 않기 위해 센다 (헌장 A-5). */
  readonly unmappedColumnCount: number
  /**
   * **같은 파일 안에서** 앞 행과 같은 `source_key`를 얻은 행 수 — UPSERT가 이
   * 행들을 앞 행에 합친다.
   *
   * `loadChunk`의 `updated`와 **다른 사실이다.** 그쪽은 «이전 배치의 행을 덮었다»
   * (재가져오기의 정상 동작)이고 이쪽은 «이 파일의 행 식별이 유일하지 않다»
   * (사고)다. 저장 계층은 둘을 구분하지 못하므로 여기서 센다.
   *
   * `content` 전략은 등장 순번(`:n`)이 붙어 구조적으로 0이다.
   */
  readonly merged: number
}

/**
 * 내용 해시 기반 `source_key` (ADR-006).
 *
 * 자연 키가 없는 양식용이다. 같은 내용은 같은 해시를 얻고, 내용까지 완전히
 * 같은 행은 등장 순번으로 갈린다 — 서로 다른 행이 UPSERT로 합쳐지지 않으면서
 * 같은 파일의 재가져오기는 멱등이다. **행 순서에 기대지 않는다.**
 */
function contentKey(values: readonly RawCell[], seen: Map<number, number>): string {
  const canonical = values.map((v) => (v === null ? "~" : `${typeof v}:${v}`)).join(KEY_SEP)
  // 앞 6바이트(48비트)를 정수로. 안전 정수 범위 안이라 부동소수 오차가 없다.
  //
  // `node:crypto`가 아니라 순수 JS 구현을 쓴다 — 실제 앱은 웹뷰에서 돌고
  // 거기엔 `node:crypto`가 없다. 표준 SHA-1이라 값은 한 비트도 다르지 않고,
  // `tests/sha1.test.ts`가 그걸 대조로 증명한다 (source_key가 바뀌면 재가져오기
  // 멱등성이 깨지므로 값 불변이 조건이었다).
  const numeric = readUInt48BE(sha1(canonical))
  const n = seen.get(numeric) ?? 0
  seen.set(numeric, n + 1)
  // 저장되는 키는 문자열이다 — 사람이 보고 대조할 수 있어야 한다.
  return `${numeric.toString(16).padStart(12, "0")}:${n}`
}

/**
 * 파일 하나를 도는 동안 유지되는 키 상태.
 *
 * ★ 청크마다 새로 만들면 안 된다 ★
 * `content` 전략의 순번은 **파일 전체**에서 같은 내용이 몇 번째로 나왔는지다.
 * 청크 안에서만 세면 청크 경계를 걸친 동일 행 쌍이 같은 키를 받아 UPSERT로
 * 합쳐진다 — 실제로 #13에서 행 하나가 그렇게 사라졌고, 종단 게이트의
 * "적재 행 수 = SQL 되세기" 검증이 잡았다.
 */
export interface KeyState {
  /**
   * 해시 → 등장 횟수.
   *
   * 키가 **숫자**인 이유: 80,137행이면 항목이 8만 개고, 문자열 키로 두면 그
   * 문자열들이 파일이 끝날 때까지 힙에 남는다. 실측에서 +35MB 차이가 났고
   * 그게 256MB 기준을 넘겼다. sha1 앞 6바이트(48비트)를 정수로 쓰면 충돌
   * 확률은 8만 행 기준 무시할 수준이면서(생일 한계 ≈ 8만²/2⁴⁹) 항목이 훨씬 가볍다.
   */
  readonly seen: Map<number, number>
  /**
   * `natural` 전략에서 **테이블별로** 이미 나온 `source_key`.
   *
   * ★ 왜 필요한가 ★ 키 컬럼이 파일에 없으면 그 자리가 빈 문자열이 되어 서로 다른
   * 행이 같은 키를 얻고, `loadChunk`의 UPSERT가 둘을 하나로 합친다. 그런데 그
   * 함수의 통계는 «앞뒤 행 수 차이»라 **파일 안 병합과 이전 배치 갱신을 구분하지
   * 못한다.** 병합을 셀 수 있는 유일한 자리가 여기다.
   *
   * **테이블별인 이유**: 이중 기록은 같은 `source_key`를 `fact_order`와
   * `fact_claim`에 **일부러** 넣는다. 테이블을 안 가르면 그 정상 동작이 전부
   * 병합으로 잡힌다.
   *
   * ★ `seen`과 달리 문자열 그대로 둔다 ★ 위 주석이 해시를 쓰는 이유는 8만 행
   * 때문인데, 그쪽은 `content` 전략이고 이 맵은 `natural`에서만 큰다(오늘 최대
   * 155행). 그리고 여기서 해시 충돌은 «다른 행인데 병합»이라는 **거짓 경고**가
   * 되므로, 값이 다르다 — 순번이 하나 어긋나는 `seen` 쪽과 같은 위험이 아니다.
   */
  readonly naturalKeys: Map<string, Set<string>>
}

export function newKeyState(): KeyState {
  return { seen: new Map(), naturalKeys: new Map() }
}

export interface MapContext {
  readonly fileName: string
  /** 파일명 패턴에서 뽑은 이름 있는 캡처. `derive.from === "fileName"`이 쓴다. */
  readonly fileNameCaptures: Readonly<Record<string, string>>
  /** 파일 단위로 하나. 생략하면 이 호출 안에서만 유효한 상태를 쓴다. */
  readonly keyState?: KeyState
}

/** 파일명에서 `recognitionRules.fileNamePattern`의 캡처를 뽑는다. */
export function captureFromFileName(
  profile: MappingProfile,
  fileName: string,
): Record<string, string> {
  const pattern = profile.recognitionRules.fileNamePattern
  if (!pattern) return {}
  const m = new RegExp(pattern).exec(fileName)
  return m?.groups ? { ...m.groups } : {}
}

/** `20260701` → `2026-07-01`. 파일명 캡처는 구분자가 없는 경우가 흔하다. */
function looseDate(s: string): string | null {
  const t = s.trim()
  const m = /^(\d{4})[-./]?(\d{2})[-./]?(\d{2})$/.exec(t)
  if (!m) return null
  const [, y, mo, d] = m
  const month = Number(mo)
  const day = Number(d)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${y}-${mo}-${d}`
}

export function mapRows(
  profile: MappingProfile,
  headers: readonly string[],
  chunk: NormalizedChunk,
  ctx: MapContext,
  startRowIndex = 0,
): MappingResult {
  const index = new Map<string, number>()
  headers.forEach((h, i) => index.set(h.trim(), i))

  const routing = profile.rowRouting
  const routeCol = routing ? index.get(routing.column.trim()) : undefined

  // 미매핑 컬럼은 **모든 역할의 합집합**으로 센다 — 클레임 경로에서만 쓰는 컬럼을
  // "버렸다"고 세면 숫자가 거짓말을 한다.
  //
  // ★ 판정을 `columnRoles`로 모았다 (결함 53) ★
  // 여기 있던 인라인 집합은 **`sourceKey.columns`를 빠뜨리고 있었다.** 그래서
  // `unmappedColumnCount`가 과다 계상됐고(11번가 `주문순번`이 «미매핑»에 들어갔다),
  // 확인 화면은 같은 누락을 «이 프로파일이 쓰지 않는 컬럼»이라는 **거짓 문구**로
  // 내보냈다. 두 곳이 각자 세던 것을 한 함수로 합친다.
  const { byColumn: columnUse } = columnRoles(profile)
  const unmappedColumnCount = headers.filter((h) => !columnUse.has(h.trim())).length

  /** 테이블별 버킷. 기본 경로는 `profile.targetTable`이다. */
  const byTable = new Map<string, MappedRow[]>()
  const bucket = (t: string): MappedRow[] => {
    let b = byTable.get(t)
    if (!b) {
      b = []
      byTable.set(t, b)
    }
    return b
  }

  const out: MappedRow[] = bucket(profile.targetTable)
  const errors: MappingError[] = []
  const items: MappedItem[] = []
  /** 없는 컬럼은 **컬럼당 한 번만** 보고한다 — 매핑을 두 벌 돌려도 중복되지 않게. */
  const missingReported = new Set<string>()
  /** 파일에서 읽어낸 행 수 — 버린 행은 빼고 센다. */
  let rowsLoaded = 0
  const keyState = ctx.keyState ?? newKeyState()
  const seen = keyState.seen

  /**
   * 이 행을 테이블 버킷에 넣으면서 **파일 안 키 충돌을 센다.**
   *
   * 버킷에 직접 `push`하지 않고 이 함수를 거치는 이유: 넣는 자리가 두 곳이라
   * (기본 경로 · 라우팅 경로) 한쪽에만 세면 이중 기록에서 절반이 빠진다.
   */
  let merged = 0
  const put = (table: string, row: MappedRow): void => {
    bucket(table).push(row)
    if (profile.sourceKey.strategy !== "natural") return
    let keys = keyState.naturalKeys.get(table)
    if (keys === undefined) {
      keys = new Set()
      keyState.naturalKeys.set(table, keys)
    }
    if (keys.has(row.sourceKey)) merged++
    else keys.add(row.sourceKey)
  }

  /**
   * 품목의 리스팅 키를 만드는 컬럼들 — `collectListings`와 **같은 규칙**이어야 한다.
   * 여기서 따로 만들면 두 키가 어긋나 `listing_id`가 존재하지 않는 리스팅을 가리킨다.
   */
  const itemRule = profile.orderItem
  const listingKeyCols =
    itemRule === undefined
      ? []
      : (profile.listing?.keyColumns ?? []).map((c) => index.get(c.trim()))
  // 선언만 있고 리스팅 규칙이 없으면 품목을 만들 수 없다 — 식별자가 없기 때문이다.
  // 조용히 안 만들지 않고 **한 번** 알린다 (LOCK 6).
  const itemsPossible =
    itemRule !== undefined &&
    listingKeyCols.length > 0 &&
    listingKeyCols.every((c) => c !== undefined)
  if (itemRule !== undefined && !itemsPossible && chunk.rowCount > 0) {
    errors.push({
      rowIndex: chunk.rowIndices[0] ?? startRowIndex,
      field: "fact_order_item",
      reason:
        "품목을 만들 수 없다 — 리스팅 키 컬럼이 이 파일에 없다" +
        `(선언: ${(profile.listing?.keyColumns ?? []).join("·") || "없음"})`,
      code: "item_key_missing",
    })
  }

  // `content` 전략이 쓰는 행 값 버퍼. **청크당 하나**를 돌려 쓴다 — 행마다 뜨면
  // 평탄화로 없앤 할당이 그대로 되살아난다.
  const scratch: (string | number | null)[] =
    profile.sourceKey.strategy === "natural" ? [] : new Array(chunk.width).fill(null)

  for (let i = 0; i < chunk.rowCount; i++) {
    // ★ 물리 행을 쓴다 ★ 청크가 들고 온 시트 행 번호다. `startRowIndex + i`는
    // **데이터 행 순번**이라 합계·빈 행이 빠진 만큼 물리 행과 어긋나고, 그 숫자를
    // 사용자에게 보이면 엉뚱한 행으로 보내게 된다 (좌표계는 하나여야 한다).
    // 청크가 못 알려주는 합성 입력에서만 옛 계산으로 물러난다.
    const rowIndex = chunk.rowIndices[i] ?? startRowIndex + i
    const base = i * chunk.width

    /**
     * 여러 열의 곱. **전부 숫자로 읽혔을 때만** 값이 된다 (`derive.from === "multiply"`).
     *
     * 하나라도 못 읽으면 `null`이다 — 0이나 부분곱을 돌려주면 «작게 팔렸다»라는
     * 거짓이 되고, 그건 조용한 실패다. 주문 행과 품목 행이 **같은 함수**를 쓰므로
     * 라인 금액이 두 표에서 갈리지 않는다.
     */
    const multiplied = (
      columns: readonly string[],
      target: string,
    ): number | null => {
      let acc = 1
      for (const name of columns) {
        const col = index.get(name)
        if (col === undefined || col >= chunk.width) {
          if (!missingReported.has(name)) {
            missingReported.add(name)
            errors.push({ rowIndex, field: target, reason: `컬럼 "${name}"가 없다`, code: "missing_column" })
          }
          return null
        }
        const one = coerce(chunk.values[base + col] ?? null, chunk.raws[base + col] ?? null, "number")
        if (typeof one !== "number") return null
        acc *= one
      }
      return acc
    }

    /** 매핑 한 벌을 적용한다. **두 번 부를 수 있다** — 이중 기록이 그래서 가능하다. */
    const apply = (mappings: readonly FieldMapping[]): { fields: Record<string, RawCell>; fatal: boolean } => {
      const fields: Record<string, RawCell> = {}
      let fatal = false
      for (const m of mappings) {
        let value: RawCell = null

        if (m.derive) {
          if (m.derive.from === "constant") {
            value = m.derive.value
          } else if (m.derive.from === "multiply") {
            value = multiplied(m.derive.columns, m.target)
          } else {
            const raw = ctx.fileNameCaptures[m.derive.capture]
            value = raw === undefined ? null : (looseDate(raw) ?? raw)
          }
        } else if (m.source !== undefined) {
          const col = index.get(m.source)
          if (col === undefined) {
            // 헤더 자체가 없다 — 행마다 보고하면 8만 건이 되므로 **컬럼당 한 번만**.
            // (전에는 `i === 0`이었는데, 이중 기록으로 매핑을 두 벌 돌리면서
            //  같은 컬럼이 두 번 보고될 수 있게 됐다.)
            if (!missingReported.has(m.source)) {
              missingReported.add(m.source)
              errors.push({
                rowIndex,
                field: m.target,
                reason: `컬럼 "${m.source}"가 없다`,
                code: "missing_column",
              })
            }
          } else if (col < chunk.width) {
            value = coerce(chunk.values[base + col] ?? null, chunk.raws[base + col] ?? null, m.kind)

            /**
             * ★ 음수 — 선언이 있으면 집행하고, 없으면 **손대지 않고 말한다** ★
             *
             * 오늘 픽스처 4종에 음수 금액은 0건이다(실측). 즉 이 분기는 실파일이
             * 아니라 **합성으로만** 확인할 수 있다 (ADR-007 경계).
             */
            if (typeof value === "number" && value < 0) {
              if (m.signPolicy === "magnitude") {
                errors.push({
                  rowIndex,
                  field: m.target,
                  reason: `${value} → ${Math.abs(value)}`,
                  code: "sign_normalized",
                })
                value = Math.abs(value)
              } else {
                errors.push({
                  rowIndex,
                  field: m.target,
                  reason: `${value}`,
                  code: "sign_undeclared",
                })
              }
            }

            if (m.valueMap && value !== null) {
              const mappedValue = m.valueMap[String(value)]
              if (mappedValue === undefined) {
                // 모르는 값을 통과시키면 스키마의 CHECK가 적재 시점에 터지거나,
                // 더 나쁘게는 엉뚱한 분류로 집계된다. 여기서 잡는다.
                errors.push({
                  rowIndex,
                  field: m.target,
                  reason: `사전에 없는 값: "${String(value)}"`,
                  code: "value_not_in_dict",
                })
                fatal = true
              }
              value = mappedValue ?? null
            }
          }
        }

        if (value === null && m.default !== undefined) value = m.default

        if (value === null && m.required) {
          errors.push({
            rowIndex,
            field: m.target,
            reason: "필수 필드가 비었다",
            code: "required_empty",
          })
          fatal = true
        }
        fields[m.target] = value
      }
      return { fields, fatal }
    }

    // 이 행이 어느 경로로 가는가. 일치하는 route가 없으면 기본 경로다.
    let hit: (typeof routing extends undefined ? never : NonNullable<typeof routing>["routes"][number]) | undefined
    if (routing && routeCol !== undefined && routeCol < chunk.width) {
      const routeValue = String(chunk.values[base + routeCol] ?? "")
      hit = routing.routes.find((r) => r.match.includes(routeValue))
      if (!hit && routing.knownValues && !routing.knownValues.includes(routeValue)) {
        // 모르는 값이다. 기본 경로로 보내되 조용히 넘기지 않는다.
        errors.push({
          rowIndex,
          field: routing.column,
          reason: `알 수 없는 ${routing.column}: "${routeValue}" — 새 상태가 생겼는지 확인해야 한다`,
          // 행은 **기본 경로로 적재된다.** 버린 것이 아니라 알리는 것이다
          code: "unknown_route",
        })
      }
    }

    /**
     * ★ 이중 기록 — 한 행이 **판매이면서 취소**일 때 (`alsoDefault`) ★
     *
     * 두 벌을 다 만들고, **어느 하나라도 치명적이면 둘 다 버린다.** 반쪽만 넣으면
     * 매출은 잡히고 취소는 안 잡히거나(순이익 과대) 그 반대가 되는데, 둘 다
     * 「조용히 틀린 숫자」다. ESM의 결제일 빈 5행이 정확히 이 경우이고, 그 행들은
     * 지금까지도 양쪽 다 못 만들어 통째로 제외돼 왔다 — 동작이 바뀌지 않는다.
     */
    const asRoute = hit === undefined ? null : apply(hit.fieldMappings)
    const asDefault =
      hit === undefined || hit.alsoDefault === true ? apply(profile.fieldMappings) : null
    if (asRoute?.fatal === true || asDefault?.fatal === true) continue

    const sourceKey =
      profile.sourceKey.strategy === "natural"
        ? (profile.sourceKey.columns ?? [])
            .map((c) => {
              const col = index.get(c)
              return col === undefined || col >= chunk.width
                ? ""
                : String(chunk.values[base + col] ?? "")
            })
            .concat(
              // 파일명 캡처는 **뒤에** 붙인다. 선언이 없으면 빈 배열이라 기존
              // 프로파일의 키가 한 글자도 달라지지 않는다 — 재가져오기 멱등성 보존.
              (profile.sourceKey.fileNameCaptures ?? []).map(
                (c) => ctx.fileNameCaptures[c] ?? "",
              ),
            )
            .join(KEY_SEP)
        : (rowValuesInto(chunk, i, scratch), contentKey(scratch, seen))

    /**
     * ★ 두 행의 `source_key`는 **같다** ★ 테이블이 다르므로 UNIQUE가 갈리고,
     * 「같은 원본 행의 두 표현」이라는 사실이 키에 그대로 남는다. 재가져오기에서
     * 둘 다 같은 키를 다시 얻으므로 멱등도 각자 성립한다 (`tests/order-item.test.ts`).
     */
    rowsLoaded++
    if (asDefault !== null) put(profile.targetTable, { sourceKey, fields: asDefault.fields })
    if (hit !== undefined && asRoute !== null) {
      put(hit.targetTable, { sourceKey, fields: asRoute.fields })
    }

    /**
     * ★ 품목은 **기본 경로로 간 행에서만** 나온다 ★
     *
     * ESM은 취소·반품·환불이 같은 파일에 섞여 있고 그 행들은 `fact_claim`으로
     * 간다. 그 행에서도 품목을 만들면 **팔리지 않은 물건의 매입원가가 계상되고**,
     * 매출에는 없는 원가가 손익에 들어가 손실이 두 번 잡힌다.
     */
    // ★ 조건 (c) — 라우팅된 행은 **이중 기록이더라도** 품목을 만들지 않는다 ★
    // 취소된 판매의 원가를 계상하지 않는 것이 매출·클레임 상쇄(net 0)와 정합이다.
    // 「반품 시 재고 손실」 같은 정교화는 알려진 단순화로 ADR-009에 적혀 있다.
    if (itemsPossible && hit === undefined) {
      const parts = listingKeyCols.map((c) =>
        c === undefined || c >= chunk.width ? "" : String(chunk.values[base + c] ?? "").trim(),
      )
      // 키가 반쪽이면 리스팅도 안 만들어졌다 (`collectListings`가 같은 조건으로
      // 거른다). 존재하지 않는 리스팅을 가리키는 품목을 만들지 않는다.
      if (!parts.some((p) => p === "")) {
        const listingKey = parts.join(KEY_SEP)
        const itemFields: Record<string, RawCell> = {}
        for (const m of itemRule!.fieldMappings) {
          let value: RawCell = null
          if (m.derive?.from === "constant") value = m.derive.value
          // 라인 금액이 «단가 × 수량»인 양식은 품목 쪽도 같은 곱이 필요하다.
          // 주문 행과 **같은 함수**를 쓰므로 두 표의 금액이 갈릴 수 없다.
          else if (m.derive?.from === "multiply") value = multiplied(m.derive.columns, m.target)
          else if (m.source !== undefined) {
            const col = index.get(m.source)
            if (col !== undefined && col < chunk.width) {
              value = coerce(chunk.values[base + col] ?? null, chunk.raws[base + col] ?? null, m.kind)
            }
          }
          if (value === null && m.default !== undefined) value = m.default
          itemFields[m.target] = value
        }
        items.push({
          // 부모 키 + 리스팅 키. 부모가 이미 유일하므로 그 안에서 리스팅만
          // 구분되면 되고, 두 값 모두 파일이 같으면 같다 → 재가져오기 멱등.
          sourceKey: `${sourceKey}${KEY_SEP}${listingKey}`,
          rowIndex,
          orderSourceKey: sourceKey,
          listingKey,
          fields: itemFields,
        })
      }
    }
  }

  return { rows: out, errors, items, rowsLoaded, unmappedColumnCount, byTable, merged }
}

/**
 * 정규화된 값을 매핑이 요구하는 종류로 맞춘다.
 *
 * `raw`를 따로 받는 이유: 컬럼 추론이 `text`로 봤는데 프로파일이 `number`를
 * 요구하는 경우, 정규화된 값이 아니라 **원본**을 다시 읽어야 한다. 평탄화
 * 이후에도 원본에 닿는 경로가 남아 있어야 하는 것이 이 함수 때문이다.
 */
function coerce(
  value: string | number | null,
  raw: RawCell,
  kind: FieldMapping["kind"],
): RawCell {
  if (value === null) return null
  switch (kind) {
    case "identifier":
      return String(value)
    case "number":
    case "percent":
      return typeof value === "number" ? value : (normalizeValue(raw).value as RawCell)
    case "date":
      return typeof value === "string" ? value : String(value)
    default:
      return typeof value === "number" ? String(value) : value
  }
}
