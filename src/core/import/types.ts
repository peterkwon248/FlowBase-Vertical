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

export interface SheetInfo {
  readonly name: string
  readonly index: number
  readonly role: SheetRole
  readonly reason: string
  /** 물리적 최대 행 — 서식만 있는 빈 행을 포함한다. 대조표의 행 수 정의와 같다. */
  readonly physicalRowCount: number
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

/** 파서가 지켜야 하는 모양. 4종 전부 이 인터페이스를 만족한다. */
export interface Parser {
  readonly format: ContainerFormat
  /** 시트 목록만. 전체를 읽지 않는다 — 위저드의 시트 선택 단계(C-5)가 쓴다. */
  probe(bytes: Uint8Array, opts?: ParseOptions): Promise<readonly SheetInfo[]>
  /** 앞 N행만. 미리보기는 전체 파싱과 분리한다 (헌장 B-9). */
  preview(bytes: Uint8Array, rows: number, opts?: ParseOptions): Promise<readonly RawRow[]>
  /** 전량. 청크로 흘린다. */
  stream(bytes: Uint8Array, opts?: ParseOptions): AsyncIterable<RowChunk>
}

export interface ParseOptions {
  readonly sheetIndex?: number
  readonly encoding?: EncodingLabel
  readonly delimiter?: string
  readonly chunkSize?: number
  readonly onProgress?: (p: Progress) => void
}

export const DEFAULT_CHUNK_SIZE = 5_000
