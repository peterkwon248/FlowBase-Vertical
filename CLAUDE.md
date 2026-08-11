# FlowBase 손익

셀러 정산·손익 앱. 로컬퍼스트 데스크톱 앱(Tauri + SQLite), 서버 0대.

## 문서 우선순위

충돌 시: **[구현 헌장](docs/구현-헌장.md) > [핸드오프](docs/핸드오프.md) > 목업 코드**

| 문서 | 무엇 |
|---|---|
| [docs/구현-헌장.md](docs/구현-헌장.md) | 최상위. 스키마 LOCK·파이프라인 6단계·세션 계획·금지 목록 |
| [docs/핸드오프.md](docs/핸드오프.md) | 목업 내부 지도. 시드 경계·상태 소유·알려진 결함 43건 |
| [docs/인계-문서.md](docs/인계-문서.md) | 손익 3층·Canonical 흐름·Library 설계 |
| [docs/지시서-v1.md](docs/지시서-v1.md) | 제품 정의·티어·신규 화면 4종 원본 지시 |
| [docs/upstream-sync.md](docs/upstream-sync.md) | upstream `peterkwon248/FlowBase`와의 어휘 정렬 기록 |
| [docs/ADR-001-파이프라인-스택.md](docs/ADR-001-파이프라인-스택.md) | 파이프라인 = 전부 TypeScript. 조건 4개 + SheetJS 버전·무결성 고정 + 성능 판정 |
| [docs/ADR-002-파싱-원칙.md](docs/ADR-002-파싱-원칙.md) | 날짜는 UTC 게터 · 타입 체계 유무로 추론 주체 결정 · 확장자 어긋남 3층 · **시트 판정 권한 순서** |
| [docs/§18-개정사항.md](docs/§18-개정사항.md) | 파이프라인에서 나온 UI 요구 3건 (수식 경고·시트 선택 게이트·0행 표시). 구현은 세션 3 |
| [docs/픽스처-대조표.md](docs/픽스처-대조표.md) | **독립 실측 대조표.** `expected*` 매니페스트의 채점 기준 — 우리 파서로 만들지 않았다 |

`mockup/`은 **동결본**이다. 읽기 전용 참조 — 편집하지 않는다.

## 절대 규칙 (LOCK)

1. **Fact 행 공통 컬럼**: `connection_id` · `batch_id` · `library_id` · `version` · `updated_at` · `mapping_version`. 첫 마이그레이션부터 존재. 소급 추가 불가.
2. **append-only**. 가져오기는 덮어쓰기가 아니라 batch 추가. 되돌리기 = batch 행 제거. `source_key` 중복은 UPSERT.
3. **원본 불변**. 수정은 조정 레코드로 쌓는다. 유효값 = 원본 + 조정 스택. **대사는 원본끼리만 비교** — 조정으로 불일치를 일치로 만들 수 없다.
4. **Core는 마켓을 모른다**. `core/`에 쿠팡·네이버·G마켓·옥션·11번가·ESM 문자열 금지. 마켓 지식은 `packs/kr-marketplace/` 안에만. Profit Engine에 `if (marketplace === …)` 금지.
5. **전체 메모리 적재 금지**. 앱 시작 = 메타데이터만, 화면 진입 = 해당 범위만 쿼리, 집계는 SQL에 위임. 파싱은 청크→SQLite 스트리밍 (80,138행×43열이 정기 입력이다).
6. **조용한 실패 금지**. 읽지 못한 것은 제외하고 **제외를 표시한다**. 새 실패 상태를 발명하지 말고 기존 체계(`ERROR`/`FORMAT_CHANGED`/오류 행 제외)에 편입한다.
7. **AI는 선택**. AI가 꺼져 있어도 전 기능이 동작한다. BYOK, Provider 인터페이스 뒤.
8. **내보내기는 무료 전면 개방**. 데이터 인질 금지. 티어 게이팅은 헌장 B-10이 전부.
9. **Fact 행 인라인 편집 UI 금지**. 수정은 조정 레이어로만.
10. **"동기화" 카피 금지**. 양방향·자동이 실존하기 전까지. 용어는 연결 / 가져오기 / batch.

## Import 파이프라인 — 모듈 경계와 이름 고정

```
Recognition → Extraction → Normalization → Mapping → Validation → Load
```

Recognition은 **매직 바이트가 1순위**, 확장자는 힌트에 불과하다:
`FF FE`→UTF-16 TSV · `<meta`/`<html`→HTML 표 · `PK`→xlsx · `D0 CF`→BIFF xls

구현은 **전부 TypeScript** ([ADR-001](docs/ADR-001-파이프라인-스택.md)). 단계 간에는 직렬화 가능한 값만 넘긴다 — 병목 단계만 Rust로 교체할 수 있어야 한다. 파싱은 Worker에서, SheetJS는 CDN 타르볼 `0.20.3` 고정(npm `xlsx`는 0.18.5에서 멈춰 있고 CVE 2건이 살아 있다). SQLite 적재는 청크 단위 트랜잭션.

## 데이터 3종 분류

| 종류 | 예 | 편집 |
|---|---|---|
| 사실 | 주문·정산·반품 | 가져오기 경로로만. 인라인 편집 ❌ (조정 레이어로) |
| 기준 | 원가·상품·연결·매핑·내 필드·비용 룰 | 수동 편집 + 변경 이력 |
| 계산 | 대시보드·진단·기록 | 입력 영구 ❌ |

## 손익 3층 — 이름을 정확히 쓴다

```
매출 − 할인·수수료·VAT·배송 − 매입원가 − 직접 광고비 − 운영비
= 상품 기여이익
 − 미배분 광고비
= 채널 기여이익
 − 고정비
= 회사 순이익
```

상품별 손익의 합은 회사 순이익이 아니다. 그게 정상이고 화면이 그 차이를 보여준다.

## 세션 계획

- **세션 1** 파이프라인 (UI 없음) — 스니퍼 + 파서 4종 + Extraction + Normalization + 픽스처 하네스
  - 합격: 픽스처 15개 전부 `expectedProfile`/`expectedSheets`/`expectedHeader`/`expectedRowCount` 통과
  - 합격: 쿠팡 광고 픽스처(80,138행) 파싱+적재 **30초 이내** (진행 표시 포함)
  - 합격: 같은 픽스처 처리 중 **Worker 피크 RSS 256MB 이하**. 초과는 실패가 아니라 "SheetJS 전량 적재의 한계" 판정 — Extraction만 Rust 포팅하는 근거가 된다
  - 검증: 뽑은 `expected*` 매니페스트를 [픽스처-대조표](docs/픽스처-대조표.md)와 교차 대조. 불일치 항목만 사람이 판정한다 (행 수 정의 차이 = 물리 행 vs 데이터 행은 불일치가 아니므로 먼저 구분)
  - 선행: 픽스처 비식별화(구매자명·연락처·주소 치환). 원본 커밋 금지
- **세션 2** 저장 골격 — Tauri + SQLite, 스키마 전부, append-only batch, 리포지토리 계층
- **세션 3** 접합 — 목업 몸체 이식, 시드→리포지토리 교체, 실파일 통과, 손계산 정답지 대조

세션을 건너뛰거나 한 세션에 일괄 위임하지 않는다.

## 커밋

- 픽스처 원본(실명·연락처·주소 포함)은 **커밋 금지**. `fixtures/raw/`는 gitignore.
  커밋되는 것은 `fixtures/clean/`(비식별화본)이고 테스트는 기본으로 그쪽을 쓴다.
  원본 대조가 필요할 때만 `FIXTURE_DIR=raw`.
- `_ref/`는 사용자 참고 자료(스크린샷·대행사 리포트)이며 git에서 제외돼 있다.

## 픽스처 도구

```bash
npm run harness   # expected 매니페스트 생성 (fixtures/manifest/manifest.json)
npm run perf      # 성능 게이트 — 30초 / 256MB
```

`tools/deident/` — `scan` (PII 탐지) · `apply` (raw→clean 치환) · `verify` (잔존·구조 검증).
`tools/harness/` — `dump-sheet` · `check-excluded` · `classify-check` · `verify-fast-path`.
