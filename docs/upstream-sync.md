repo: peterkwon248/FlowBase
branch: main

## Last sync

date: 2026-08-09T03:12:00Z

### Updated in this project
- 내 필드(확장 필드)를 편집 가능하게 — upstream `ColumnDef` / `LibraryField` / `FieldConfig` 어휘에 맞춰 이름·키·붙는 곳·형식·선택지·채우는 방법·손익 반영을 인라인 편집, 추가·삭제 지원
- 구조 섹션 분리 — 상품 연결(미매칭 받은편지함) · 필드 매핑(마켓 × 문서 양식) · 내 필드 · 데이터 구조
- 상품·SKU의 "마켓 매핑" 탭 제거 — 미연결 리스팅은 상품 연결 한 곳에서만 집계
- 리포트 재작업 — 순이익 브리지(줄다리기 + 문장), 짚어볼 것, 움직인 상품
- 대시보드 히어로에 비용 구성 도넛(호버 상세) 도입

## 업스트림에서 확인한 것

| 파일 | 확인한 내용 |
|---|---|
| types/flowbase.ts | 제네릭 컬럼 모델 — `ColumnType`(text·num·date·select·multiSelect·status·formula·lookup·rollup), `ColumnDef`, `FieldConfig`(required·default·format·validation·optionListId), `LibraryField` 카탈로그 |
| components/sheet/ | add-column-menu · column-header-menu · editable-cell — 필드 추가/수정/삭제가 실제 제품에 존재 |
| DESIGN-TOKENS.md | Linear+shadcn 토큰, strokeWidth 1.5, radius ≤ 12px, 굵기 medium/semibold |
| docs/02-v01-backlog.md | Phase 1에 "필드 추가 UI", "필드 수정/삭제" 포함 |

이 프로젝트는 지시서 기반 프로토타입이라 upstream 코드를 반입하지 않는다. 어휘와 필드 모델만 맞춘다.

## 참고한 외부 저장소 (읽기만, 코드 반입 없음)

| 저장소 | 참고한 것 |
|---|---|
| evidence-dev/evidence | BigValue 패턴 — value + comparison + sparkline 조합 |
| lobehub/lobe-charts | BarList · Tracker · DataBars · SparkChart 표현 방식 |

## Screen map

| 화면 | 근거 |
|---|---|
| 손익 대시보드 | 지시서 9·31절 + Evidence BigValue + Lobe BarList |
| 손익 리포트 | 지시서 9·31절 — 브리지·이상 징후·무버 |
| 정산 | 지시서 8절 Settlement · 19절 Hybrid |
| 상품 · SKU | 지시서 29·30절 + SKU 선등록(DRAFT) |
| 주문 | 지시서 8절 Order · OrderItem |
| 데이터 연결 | 지시서 3·14·20절 (연결 상태 6종) |
| 파일 가져오기 | 지시서 21·22절 — 매핑 프로파일 구조 |
| 동기화 기록 | 지시서 15절 SyncRun |
| 상품 연결 | 지시서 7·30절 MarketplaceReference — 개체 매핑 |
| 필드 매핑 | 지시서 21·22절 — 양식 = 마켓 × 문서 종류 |
| 내 필드 | 지시서 8절 Cost(OTHER) + upstream ColumnDef·FieldConfig |
| 데이터 구조 | 지시서 5·7·8·9·34절 |
| 설정 | 지시서 16·28절 Credential · Adjustment Layer |

## 미해결

- 마켓별 실제 export 파일 헤더 미확인 — `FORMS`의 헤더 문자열은 추정값
- 필드 매핑 화면은 아직 읽기 전용 — 열 ↔ 필드 재지정 편집 미구현
- upstream은 Next.js 제품, 이 프로젝트는 단일 DC 프로토타입 — 코드 대조 아닌 어휘 정렬만 수행
- last sync commit sha 미기록 (tree hash만 확인 가능)

## Sync history

- 2026-08-09T00:23:36Z — 대시보드 재설계(BigValue KPI·히어로·BarList), 레이아웃 모드 3종, SKU DRAFT/ACTIVE, Vector DS 번들 경로 정리
