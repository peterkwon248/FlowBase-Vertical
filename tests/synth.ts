/**
 * 합성 워크북 — **커밋할 수 없는 실파일의 모양을 메모리에서 재현한다.**
 *
 * 사건 실파일(13.3MB · 15시트 단가표)은 사업 데이터라 픽스처로 커밋하지 않는다.
 * 대신 그 구조 — 0번은 표지, 나머지는 카드 레이아웃 시트 — 를 SheetJS로 합성한다.
 * 카드 블록의 행 모양은 tests/blocks.test.ts의 실측 축소판과 같은 계보다.
 *
 * ★ cost-card@1 계약이 요구하는 제약 (어기면 조용히 안 붙는다) ★
 * - 지문(requiredCellTexts: 모델명·권장소비자가)이 **첫 20행 안**에 있어야 한다
 *   — 판정은 첫 청크만 본다 (analyze.ts peekSheet).
 * - 블록이 시트당 **2개 이상** — readBlocks는 앵커 2개 미만이면 던진다.
 * - 앵커 열(0)은 블록 시작 행에만 값 — 주기 판정이 선다. 앞 2행은 배너(skipRows 2).
 */
import * as XLSX from "xlsx"

export type Cell = string | number | null

/** 실측 모양 그대로: 라벨과 값 사이에 병합 빈칸이 끼고, 한 상품이 7행이다. */
export const cardBlock = (name: string, model: string, cost: number): Cell[][] => [
  [name, null, "모델명", model, "권장소비자가", null, 42900, null, "원가", cost, null, 100],
  [null, null, "구성품"],
  [null, null, "옵션/색상", "블랙", "온라인 판매가", null, 24800, null, "재고"],
  [null, null, "특징", "5000mAh"],
  [null, null, null, null, "Special partner", null, 13000, null, "비고", "빅셀러"],
  [],
  [],
]

/** 앞 2행은 배너다 — 실파일에도 있다 (blockRead.skipRows = 2와 짝). */
const banner: Cell[][] = [
  ["품명", "이미지", "스팩", null, null, null, null, null, "머레이 직원 공유"],
  [null, null, null, null, "구분", null, "단가 (VAT 포함)"],
]

/** 카드 시트 하나 — [품명, 모델명, 원가] 튜플들로 만든다. */
export const cardSheet = (...items: readonly [string, string, number][]): Cell[][] => [
  ...banner,
  ...items.flatMap(([n, m, c]) => cardBlock(n, m, c)),
]

/** 표지 시트 — 실파일 0번 「공유정보」의 축소판. 어떤 프로파일과도 맞지 않는다. */
export const coverSheet: Cell[][] = [
  ["공유정보"],
  ["연락처", "murray@example.com"],
  ["공식인증", "<img src='https://example.com/x.png'>"],
]

/** 이름 붙은 시트들을 xlsx 바이트로 만든다. */
export function workbookBytes(sheets: readonly [name: string, rows: Cell[][]][]): Uint8Array {
  const wb = XLSX.utils.book_new()
  for (const [name, rows] of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows as Cell[][]), name)
  }
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer)
}
