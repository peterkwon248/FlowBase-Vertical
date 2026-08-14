/**
 * Import 파이프라인 6단계의 계약 (헌장 B-9).
 *
 *   Recognition → Extraction → Normalization → Mapping → Validation → Load
 *
 * ADR-001 조건 1 — 단계 간에는 **직렬화 가능한 값만** 오간다. 클로저·클래스 인스턴스·
 * 라이브 스트림 핸들을 넘기지 않는다. 어느 한 단계가 병목으로 판명되면 그 단계만
 * Rust로 교체할 수 있어야 하고, 그 교체는 경계가 직렬화 가능할 때만 성립한다.
 *
 * 스트리밍은 `AsyncIterable<RowChunk>`로 표현한다. 이터러블 자체는 직렬화 대상이
 * 아니지만 **흘러가는 값(RowChunk)은 직렬화 가능하다** — Rust로 옮기면 같은 청크가
 * IPC를 타면 되므로 경계는 그대로 유지된다.
 *
 * 헌장 B-8 — 이 파일과 core/ 전체는 마켓을 모른다. 마켓 이름 문자열 금지.
 */

// ─────────────────────────────────────────────────────────────
// 공통
// ─────────────────────────────────────────────────────────────

/** 셀의 원본 표현. 파서는 여기까지만 만든다 — 해석은 Normalization의 몫이다. */
export type RawCell = string | number | boolean | null

/** 파서가 뱉는 한 행. 컬럼 수가 행마다 다를 수 있다(ragged). */
export type RawRow = readonly RawCell[]

/**
 * 진행 상황. 헌장 C-5 "대용량 진행(미리보기 즉시/전체 배경)"과
 * ADR-001 조건 4의 "진행 표시 포함" 30초 기준이 이걸 쓴다.
 */
export interface Progress {
  readonly phase: StageName
  readonly rowsDone: number
  /** 전체 행 수를 미리 알 수 없는 포맷이 있다 — 모르면 null. 추정치를 지어내지 않는다. */
  readonly rowsTotal: number | null
}

export type StageName =
  | "recognition"
  | "extraction"
  | "normalization"
  | "mapping"
  | "validation"
  | "load"

// ─────────────────────────────────────────────────────────────
// 1. Recognition
// ─────────────────────────────────────────────────────────────

/** 컨테이너 포맷 4종 = 파서 4종. */
export type ContainerFormat = "xlsx" | "biff" | "html-table" | "delimited"

/**
 * WHATWG Encoding 라벨. `TextDecoder`가 그대로 받는 문자열이며 Node·브라우저
 * Worker 양쪽에서 같은 이름으로 동작한다 (그래서 iconv 계열 의존성이 없다).
 */
export type EncodingLabel = "utf-8" | "utf-16le" | "utf-16be" | "euc-kr"

export interface FormatCandidate {
  readonly format: ContainerFormat
  /** 0..1. 매직 바이트 일치는 높고, 확장자·내용 휴리스틱만이면 낮다. */
  readonly confidence: number
  /**
   * 왜 그렇게 판정했는지. 헌장 A-5 정직 원칙 — 판정 근거를 사람이 볼 수 있어야
   * 하고, 헌장 C-5의 "판정 후보 복수 + 일치도" UI가 이걸 그대로 쓴다.
   */
  readonly evidence: readonly string[]
  /** delimited·html-table에만 해당. */
  readonly encoding?: EncodingLabel
  /** delimited에만 해당. */
  readonly delimiter?: string
}

export interface RecognitionResult {
  /** confidence 내림차순. 헌장 B-9 "후보는 confidence와 함께 복수 반환". */
  readonly candidates: readonly FormatCandidate[]
  /** 파일명에서 얻은 확장자. **힌트일 뿐이며 판정 근거가 아니다.** */
  readonly extensionHint: string | null
  /**
   * 컨테이너 포맷이 확장자와 어긋남. 픽스처 #12(.xls인데 HTML 표)가 여기 걸린다.
   *
   * 주의 — 이 불리언만으로는 부족하다. #1·#2는 `.csv`이고 판정도 `delimited`라
   * 포맷은 일치하지만, 실제로는 콤마가 아니라 TAB이고 UTF-16이다. 그런 어긋남은
   * `identityNotes`가 담는다.
   */
  readonly extensionMismatch: boolean
  /**
   * 사용자에게 알려야 할 "이 파일의 실제 정체". 헌장 C-5 "파일 정체 고지"가 그대로 쓴다.
   * 포맷·구분자·인코딩 중 이름에서 짐작한 것과 다른 항목만 담는다. 다를 게 없으면 빈 배열.
   */
  readonly identityNotes: readonly string[]
}

// ─────────────────────────────────────────────────────────────
// 2. Extraction
// ─────────────────────────────────────────────────────────────

/**
 * 시트 분류. 헌장 B-9 "시트 분류(데이터 후보/요약)".
 * 한 파일이 복수 batch로 갈릴 수 있으므로 시트마다 판정한다.
 */
export type SheetRole = "data" | "summary" | "empty"

/** 병합 셀 범위. 0-기준, 끝 포함. */
export interface MergeRange {
  readonly startRow: number
  readonly endRow: number
  readonly startCol: number
  readonly endCol: number
}

export interface SheetInfo {
  readonly name: string
  readonly index: number
  readonly role: SheetRole
  readonly reason: string
  /** 물리적 최대 행 — 서식만 있는 빈 행을 포함한다. 대조표의 행 수 정의와 같다. */
  readonly physicalRowCount: number
  readonly columnCount: number
  /**
   * 값이 있는 셀 중 수식으로 계산된 것의 비율 (0..1). 알 수 없으면 null.
   *
   * **파생 여부에 대한 유일한 파일 내적 증거다.** 96%가 수식인 시트는 이름이
   * 무엇이든 다른 시트에서 계산된 결과이며, 사실로 적재하면 숫자가 두 번
   * 더해진다. 다만 이 값이 역할을 결정하지는 않는다 — 실측 결과 사람이 만든
   * 워크북에서는 원본 시트도 수식 비율이 높게 나오는 경우가 있다
   * (`docs/세션1-교차대조.md` M-6 참조). 판단 재료로 남기고 사람에게 보인다.
   */
  readonly formulaRatio: number | null
  /**
   * 병합 셀. 병합된 영역에서 값은 좌상단 한 칸에만 있고 나머지는 null이다.
   *
   * 파서는 **채우지 않는다** — 원본이 그렇게 생겼다는 사실을 그대로 전달한다.
   * 채울지 말지는 Extraction의 판단이며(2행 헤더인지, 날짜 forward-fill인지),
   * 그 판단에 필요한 근거가 이 목록이다. 픽스처 #12가 여기 해당한다.
   */
  readonly merges: readonly MergeRange[]
}

export interface HeaderDetection {
  /** 0-기준 행 인덱스. 찾지 못하면 null — 0으로 넘겨짚지 않는다. */
  readonly rowIndex: number | null
  readonly columns: readonly string[]
  readonly confidence: number
  readonly evidence: readonly string[]
}

/** 제외된 행 — 사유와 함께 남긴다. 헌장 C-5 "제외 행 삭선+카운트"가 이걸 표시한다. */
export interface ExcludedRow {
  readonly rowIndex: number
  readonly reason: "total" | "subtitle" | "blank" | "trailing-blank"
  readonly detail: string
}

export interface ExtractedSheet {
  readonly sheet: SheetInfo
  readonly header: HeaderDetection
  readonly rows: readonly RawRow[]
  readonly excluded: readonly ExcludedRow[]
  /** 헤더·제목·합계·빈 행을 뺀 실데이터 행 수. */
  readonly dataRowCount: number
}

// ─────────────────────────────────────────────────────────────
// 3. Normalization
// ─────────────────────────────────────────────────────────────

/**
 * 정규화된 값의 종류.
 *
 * `identifier`가 따로 있는 이유: 주문번호("20260804119")를 숫자로 바꾸면 안 된다.
 * 엑셀이 이미 float로 만들어 정밀도를 깎아놓은 것을 파서가 한 번 더 망치는 일을
 * 막는다 (대조표 함정 #3).
 */
export type NormalizedKind =
  | "number"
  | "percent"
  | "date"
  | "text"
  | "identifier"
  | "null"

export interface NormalizedValue {
  readonly kind: NormalizedKind
  readonly value: string | number | null
  /** 원본 표현. 되돌아볼 수 있어야 한다 — 조정 레이어(B-3)와 오류 표시가 쓴다. */
  readonly raw: RawCell
}

/**
 * `NormalizedKind`의 정수 코드. columnar 청크가 `Uint8Array`에 담는 값이다.
 *
 * 순서를 바꾸면 저장된 것과 어긋난다 — 지금은 청크가 메모리에만 있으므로
 * 안전하지만, IPC나 디스크로 나가는 순간 이 표가 계약이 된다. 끝에만 추가한다.
 */
export const KIND_NULL = 0
export const KIND_NUMBER = 1
export const KIND_PERCENT = 2
export const KIND_DATE = 3
export const KIND_TEXT = 4
export const KIND_IDENTIFIER = 5

/** 코드 → 이름. 인덱스가 곧 코드다. */
export const KIND_NAMES: readonly NormalizedKind[] = [
  "null",
  "number",
  "percent",
  "date",
  "text",
  "identifier",
]

// ─────────────────────────────────────────────────────────────
// 스트리밍
// ─────────────────────────────────────────────────────────────

/**
 * 청크 하나. **이 값이 직렬화 경계다** — Rust 포팅 시 그대로 IPC를 탄다.
 * 헌장 B-9 "청크→SQLite", ADR-001 조건 3 "청크 단위 트랜잭션 배치 insert".
 */
export interface RowChunk {
  readonly sheetIndex: number
  /** 시트 안에서 이 청크 첫 행의 0-기준 인덱스. */
  readonly startRow: number
  readonly rows: readonly RawRow[]
  readonly isLast: boolean
}

/**
 * 정규화된 청크 — **columnar**. 셀 하나가 객체 하나였던 것을 평평한 배열로 바꾼 것이다.
 *
 * ★ 왜 행 배열이 아닌가 ★
 * 행마다 배열, 셀마다 `{kind, value, raw}` 객체를 만들면 #13(80,137행 × 43열)에서
 * 객체 344만 개가 생긴다. 동시에 살아 있는 건 청크 하나뿐이지만 RSS는 할당
 * **총량**을 따라가므로 기준 2(256MB)를 넘겼다. 평평한 배열이면 청크당 할당이
 * 셀 수와 무관하게 **3개**다.
 *
 * ★ 왜 여전히 평범한 데이터인가 ★
 * `RowChunk`와 같은 직렬화 경계다 (ADR-001: 단계 간에는 직렬화 가능한 값만).
 * 메서드를 달면 구조화 복제가 깨져 Rust 포팅 시 IPC를 못 탄다. 그래서 접근은
 * `normalization/chunk.ts`의 자유 함수로 한다. `Uint8Array`는 전송 가능(transferable)
 * 이기까지 해서 오히려 그 경계에 더 맞는다.
 *
 * 인덱스는 `r * width + c`. 세 배열의 길이는 모두 `rowCount * width`다.
 */
export interface NormalizedChunk {
  readonly sheetIndex: number
  /** 시트 안에서 이 청크 첫 행의 0-기준 인덱스. */
  readonly startRow: number
  /**
   * 청크의 각 행이 **시트에서 몇 번째 물리 행이었는지** (0-기준).
   *
   * ★ `startRow + i`로 계산할 수 없다 ★
   * 합계 행과 빈 행은 청크에 실리지 않고 건너뛰므로, 청크 안의 i번째 행이
   * 물리적으로 `startRow + i`라는 보장이 없다. 중간에 합계 행이 하나만 있어도
   * 그 뒤가 전부 한 칸씩 밀린다.
   *
   * ★ 왜 필요한가 — 좌표계가 둘이면 «22행»이 두 가지 뜻이 된다 ★
   * 파이프라인이 내는 제외(`ExcludedRow.rowIndex`)는 **물리 행**이고, 매핑이 내는
   * 오류는 데이터 행 순번이었다. 둘을 같은 `batch_exclusion.row_index` 컬럼에 넣으면
   * 사유에 따라 뜻이 달라지는 열이 된다 — 사용자를 엉뚱한 행으로 보내는 표다.
   * 여기서 물리 행을 들고 다녀서 **한 좌표계로 통일**한다 (작업 리듬 8).
   */
  readonly rowIndices: Int32Array
  readonly isLast: boolean
  /** 이 청크의 컬럼 수. 시트 전체가 아니라 **청크**의 폭이다. */
  readonly width: number
  readonly rowCount: number
  /** `KIND_*` 코드. */
  readonly kinds: Uint8Array
  readonly values: readonly (string | number | null)[]
  /** 원본 셀. 파서가 만든 값을 그대로 참조한다 — 여기서 새로 만들지 않는다. */
  readonly raws: readonly RawCell[]
}

/** 시트 목록 단계에서 알 수 있는 것. 행 수는 아직 모른다 — 지어내지 않는다. */
export interface SheetSummary {
  readonly name: string
  readonly index: number
}

/**
 * 파서가 지켜야 하는 모양. 4종 전부 이 인터페이스를 만족한다.
 *
 * 세 진입점이 나뉜 이유는 헌장 B-9의 "미리보기(앞 N행)와 전체 파싱을 분리"다.
 * 셋 다 같은 바이트를 받지만 읽는 양이 다르다 — 시트 목록은 워크북 인덱스만,
 * 미리보기는 앞 N행만, `open`만이 전량을 읽는다.
 */
export interface Parser {
  readonly format: ContainerFormat
  /** 시트 목록만. 셀을 읽지 않는다 — 위저드의 시트 선택 단계(C-5)가 쓴다. */
  listSheets(bytes: Uint8Array, opts?: ParseOptions): Promise<readonly SheetSummary[]>
  /** 앞 N행만. 전체 파싱을 유발하지 않아야 한다. */
  preview(bytes: Uint8Array, rows: number, opts?: ParseOptions): Promise<readonly RawRow[]>
  /** 전량 파싱. 반드시 `close()`로 해제한다. */
  open(bytes: Uint8Array, opts?: ParseOptions): Promise<ParsedSource>
}

/**
 * 열린 원본. **이건 라이브 핸들이라 직렬화 대상이 아니다** — 파서 단계 *안쪽*에
 * 머문다. 밖으로 나가는 것은 `RowChunk`뿐이고 그건 직렬화 가능하다 (ADR-001 조건 1).
 */
export interface ParsedSource {
  readonly sheets: readonly SheetInfo[]
  /**
   * 파싱 중 라이브러리가 낸 경고. **비어 있지 않다고 실패는 아니다** — 읽기는
   * 성공했지만 파일이 정상 범주를 벗어났다는 신호다.
   *
   * 잡아서 올리는 이유: SheetJS는 이런 상황을 `console.error`로 흘리고 계속
   * 진행한다. 그대로 두면 사용자도 우리도 모르는 채 숫자만 나오고, 그게
   * 헌장 A-5가 금지하는 조용한 실패다. 픽스처 #8이 실제로 여기 걸린다
   * (data descriptor zip — 크기 필드가 0이라 9건의 경고가 난다. 데이터는 온전).
   */
  readonly warnings: readonly string[]
  /** 청크로 흘린다. 헌장 B-9 "청크→SQLite". */
  stream(sheetIndex: number, opts?: ParseOptions): AsyncIterable<RowChunk>
  /**
   * 워크북 참조를 끊는다. ADR-001의 "워크북 조기 해제" 완화책 — 80,138행짜리
   * 파일에서 이걸 빠뜨리면 피크 메모리 기준(256MB)을 지킬 수 없다.
   */
  close(): void
}

export interface ParseOptions {
  readonly sheetIndex?: number
  readonly encoding?: EncodingLabel
  readonly delimiter?: string
  readonly chunkSize?: number
  readonly onProgress?: (p: Progress) => void
}

/**
 * 청크 하나의 행 수. 메모리 실측으로 정한 값이다 (픽스처 #13, 256MB 기준):
 *
 *   5,000 → +283MB  초과
 *   2,000 → +257MB  초과 (1MB 차이로)
 *   1,000 → +231MB  통과
 *     500 → +222MB  통과
 *
 * 속도는 셋 다 2.8~2.9초로 같다 — 청크를 키워서 얻는 게 없다. 1,000은 SQLite
 * 트랜잭션 배치로도 적당한 크기다 (ADR-001 조건 3).
 */
export const DEFAULT_CHUNK_SIZE = 1_000
