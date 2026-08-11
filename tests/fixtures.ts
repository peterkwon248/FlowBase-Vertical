/**
 * 픽스처 15종 레지스트리.
 *
 * 번호는 `docs/픽스처-대조표.md`의 #번호와 **같아야 한다.** 교차 대조가 번호로
 * 이뤄지므로 여기서 어긋나면 대조 자체가 무의미해진다.
 *
 * 파일은 `fixtures/raw/`(gitignore)에 있다 — 실명·연락처가 든 원본이며 커밋하지
 * 않는다 (헌장 E-10). 비식별화본이 준비되면 `fixtures/`로 경로를 옮긴다.
 */

import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import type { ContainerFormat, EncodingLabel } from "../src/core/import/types.js"

const here = dirname(fileURLToPath(import.meta.url))
export const RAW_DIR = join(here, "..", "fixtures", "raw")

export interface FixtureDef {
  /** 대조표의 # 번호. */
  readonly id: number
  readonly file: string
  /** 대조표 "파일 정체" 열의 값 — Recognition 정답. */
  readonly expectedFormat: ContainerFormat
  readonly expectedEncoding?: EncodingLabel
  readonly expectedDelimiter?: string
  /** 이름이 내용을 속이는 파일인가. */
  readonly deceptiveName: boolean
  readonly note: string
}

export const FIXTURES: readonly FixtureDef[] = [
  {
    id: 1,
    file: "11st_기간별보고서_daily_2026-07-01_2026-07-31.csv",
    expectedFormat: "delimited",
    expectedEncoding: "utf-16le",
    expectedDelimiter: "\t",
    deceptiveName: true,
    note: "확장자 csv지만 UTF-16 LE + TAB",
  },
  {
    id: 2,
    file: "11st_기간별보고서_daily_2026-07-01_2026-07-31_포커스 광고.csv",
    expectedFormat: "delimited",
    expectedEncoding: "utf-16le",
    expectedDelimiter: "\t",
    deceptiveName: true,
    note: "#1과 동일 구조",
  },
  {
    id: 3,
    file: "2026-01 통합 매출 대시보드.xlsx",
    expectedFormat: "xlsx",
    deceptiveName: false,
    note: "19시트, 유저 수제 대시보드",
  },
  {
    id: 4,
    file: "2026.07월_파워클릭 보고서_murraymall.xlsx",
    expectedFormat: "xlsx",
    deceptiveName: false,
    note: "18시트 대행사 리포트, 헤더 6행",
  },
  {
    id: 5,
    file: "2026.07월_포커스클릭 보고서_ADVER26053309.xlsx",
    expectedFormat: "xlsx",
    deceptiveName: false,
    note: "6시트, 키워드 11,394행",
  },
  {
    id: 6,
    file: "2026년 7월_11st 결제일 정산확정 건.xls",
    expectedFormat: "biff",
    deceptiveName: false,
    note: "유일한 진짜 BIFF. 헤더 6행 59컬럼",
  },
  {
    id: 7,
    file: "25년 11월 원본 데이터(ESM+11st의 원본 데이터 1차 가공).xlsx",
    expectedFormat: "xlsx",
    deceptiveName: false,
    note: "7시트, #3의 축소판",
  },
  {
    id: 8,
    file: "26년 7월 ESM 주문통합검색.xlsx",
    expectedFormat: "xlsx",
    deceptiveName: false,
    note: "단일 시트 160행. 구매자명·수령인명 실명 — 비식별화 필수",
  },
  {
    id: 9,
    file: "B2B_매출정리 예시 파일.xlsx",
    expectedFormat: "xlsx",
    deceptiveName: false,
    note: "93컬럼, 시트명이 타임스탬프",
  },
  {
    id: 10,
    file: "B2B_반품정리 예시 파일.xlsx",
    expectedFormat: "xlsx",
    deceptiveName: false,
    note: "100컬럼, 시트명이 타임스탬프",
  },
  {
    id: 11,
    file: "ESM_파워클릭_murraymall_report_daily_2026070120260731.xlsx",
    expectedFormat: "xlsx",
    deceptiveName: false,
    note: "헤더 1행 클린, 12컬럼 31행",
  },
  {
    id: 12,
    file: "일별 매출현황.xls",
    expectedFormat: "html-table",
    expectedEncoding: "utf-8",
    deceptiveName: true,
    note: "확장자 xls지만 HTML 표. <tr> 127개",
  },
  {
    id: 13,
    file: "쿠팡 광고 보고서_20260701_20260731.xlsx",
    expectedFormat: "xlsx",
    deceptiveName: false,
    note: "80,138행 × 43열 — 성능 판정용",
  },
  {
    id: 14,
    file: "쿠팡 일반 매출_2026-08-10.xlsx",
    expectedFormat: "xlsx",
    deceptiveName: false,
    note: "시트명 Delivery, 41컬럼. 수취인 정보 — 비식별화 확인",
  },
  {
    id: 15,
    file: "쿠팡 제트 매출_20260701~20260731.xlsx",
    expectedFormat: "xlsx",
    deceptiveName: false,
    note: '시트명 판매통계, 13컬럼. "100.0%" 문자열',
  },
]

export function fixturePath(f: FixtureDef): string {
  return join(RAW_DIR, f.file)
}

export function readFixture(f: FixtureDef): Uint8Array {
  return new Uint8Array(readFileSync(fixturePath(f)))
}

/** 원본이 아직 배치되지 않았으면 테스트를 건너뛰게 한다 — 조용히 통과시키지 않는다. */
export function fixturesPresent(): boolean {
  return FIXTURES.every((f) => existsSync(fixturePath(f)))
}
