-- ═══════════════════════════════════════════════════════════════
-- 009 — 「앱이 본 헤더」의 목적지: 파일 목격 + 열 기록
-- ═══════════════════════════════════════════════════════════════
--
-- 설계 합의(작업-상태 2026-08-17)의 ③이 통째로 없었다:
--
--   ① 파일이 들어온다        ✅
--   ② 헤더 컬럼이 있다        ✅
--   ③ 앱이 그것을 저장한다     ❌  ← 테이블 19개 어디에도 헤더가 안 남는다
--   ④ 전용 필드로 매핑한다     ✅  (프로파일이 그것이다)
--
-- ③이 없어서 생긴 손해는 셋이고 전부 실측이다:
--
--   프로파일이 없으면 파일이 **통째로 증발한다** — 「맞는 양식 없음」으로 끝나고
--     기록이 0이라, 같은 파일을 다시 넣어도 앱은 처음 보는 것처럼 군다
--   매달 51개 열의 **이름조차 모른다** — 11번가 정산 59열 중 8열만 매핑하고
--     나머지는 `unmappedColumns: {policy:"keep-count"}`로 **수만** 센다
--   그래서 **학습이 구조적으로 불가능하다** — 별칭 사전의 재료가 헤더인데 안 쌓인다
--
-- ★ 왜 `batch`에 붙이지 않는가 — 이게 이 마이그레이션의 핵심 판단이다 ★
--
-- `batch`는 **적재가 시작돼야** 생긴다. 그런데 우리가 가장 잃고 있는 파일은
-- **적재조차 못 한** 파일이다(프로파일 미일치). 헤더를 `batch_id`에만 매달면
-- 정작 이 표를 만든 이유인 그 파일들이 또 증발한다.
--
-- 그래서 앵커를 «배치»가 아니라 **「파일을 봤다」는 사건**으로 둔다. 판정 단계
-- (`analyzeImport`)만 지나가면 남는다 — 프로파일이 있든 없든, 넣든 안 넣든.
-- 배치가 실제로 생기면 `batch_id`로 이어 붙인다. 순서가 반대다:
--
--   예전 사고방식   적재됐다 → 기록이 남는다
--   여기            **봤다 → 기록이 남는다** → (적재되면) 배치가 붙는다
--
-- ★ 되돌려도 배운 것은 남는다 ★
-- `batch_id`는 `ON DELETE SET NULL`이다. 배치가 사라져도 목격은 남는다 —
-- 「이 양식을 본 적 있다」는 적재의 성패와 무관한 사실이고, 되돌리기 한 번에
-- 사전이 초기화되면 학습이 아니다.
--
-- ★ 같은 파일을 다시 보면 갱신한다 (UPSERT) ★
-- 키는 `(library_id, source_hash, sheet_index)`다. 같은 바이트의 같은 시트를
-- 다시 보면 행을 늘리지 않고 `last_seen_at`·`seen_count`만 올린다. 파일명은
-- 바뀔 수 있으므로(이름만 바꿔 재가져오기 — 006) 마지막 이름으로 덮는다.
-- **달이 바뀌면 바이트가 달라 새 행이 된다** — 그래야 §20 드리프트가 성립한다
-- (실측: 같은 11번가 양식이 한 파일에서 63열, 다른 파일에서 61열이다).
--
-- ★ `kind`에 CHECK를 걸지 않는다 — 008이 세운 규칙 그대로 ★
-- 목록은 `NormalizedKind`(core/import/types.ts)가 닫는다. SQLite는 CHECK를
-- ALTER로 못 바꿔서, 여기 굳히면 종류 하나 더할 때마다 테이블을 다시 짓는다.
-- `scope`처럼 진짜로 닫힌 축만 CHECK로 닫는다.
--
-- ★ Fact가 아니라 메타다 ★
-- 그래서 공통 6컬럼(LOCK 1)이 없다. `row_shadow` 트리거도 안 붙는다 — 그것은
-- Fact 5종만 덮는다(002). 되돌리기의 대상도 아니다.
--
-- ⚠ **`sample_value`는 원본 값이다** — `구매자명` 열의 표본은 실명이다.
-- 로컬 파일에 사는 동안은 `buyer_ref`와 같은 등급이라 새로 생기는 위험이 없지만,
-- **DB 스냅샷을 밖으로 내보내는 경로(웹판 배포)는 이 컬럼을 반드시 비워야 한다.**
-- 그 경로는 아직 없다. 생길 때 이 주석이 그 자리를 가리킨다.
--
-- 001을 고치지 않는다 (스키마 LOCK). 새 번호로 쌓는다.

-- 「이 파일의 이 시트를 봤다」. 적재와 무관하게 남는다.
CREATE TABLE file_sighting (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id    TEXT NOT NULL REFERENCES library(id),
  -- 파일 지문 (SHA-1 hex). `batch.source_hash`와 같은 값·같은 표기다.
  source_hash   TEXT NOT NULL,
  -- 마지막으로 본 이름. 이름은 바뀔 수 있으므로 식별자가 아니다.
  source_name   TEXT NOT NULL,
  source_bytes  INTEGER NOT NULL,
  container_format TEXT NOT NULL,
  sheet_index   INTEGER NOT NULL,
  sheet_name    TEXT,
  -- 헤더 줄의 0-기준 행 인덱스. **못 찾으면 NULL** — 0으로 넘겨짚지 않는다
  -- (`HeaderDetection.rowIndex`가 같은 규칙이다).
  header_row_index INTEGER,
  column_count  INTEGER NOT NULL,
  -- 이 시트에 맞은 프로파일. **NULL이 정상값이다** — 「맞는 양식이 없었다」는
  -- 실패가 아니라 우리가 기록하려던 바로 그 사실이다.
  profile_id    TEXT,
  -- 실제로 적재까지 갔다면 그 배치. 안 갔으면 NULL.
  batch_id      TEXT REFERENCES batch(id) ON DELETE SET NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  seen_count    INTEGER NOT NULL DEFAULT 1,
  UNIQUE (library_id, source_hash, sheet_index)
) STRICT;

-- 열마다 한 줄. 목업의 「필드 매핑」이 그리는 표가 이것이다:
--   파일 열 | 샘플값 | 신뢰도 | 목적지(전용 필드)
CREATE TABLE file_column (
  sighting_id   INTEGER NOT NULL REFERENCES file_sighting(id) ON DELETE CASCADE,
  -- 열 순번 (0-기준). 이름이 겹치는 열이 실제로 있으므로 이름은 키가 못 된다.
  ordinal       INTEGER NOT NULL,
  header        TEXT NOT NULL,
  -- 첫 비어 있지 않은 표본 하나. 없으면 NULL (빈 열도 사실이다).
  sample_value  TEXT,
  -- 추론된 종류. 목록은 `NormalizedKind`가 닫는다 (위 참조).
  kind          TEXT NOT NULL,
  kind_confidence REAL NOT NULL,
  -- 왜 그렇게 봤는가. §20 규칙 2 — 근거는 %가 아니라 **문장**이다.
  kind_reason   TEXT NOT NULL,
  PRIMARY KEY (sighting_id, ordinal)
) STRICT;

-- 「이 헤더 이름을 어디서 봤나」 — 별칭 사전의 씨앗이 이 인덱스를 탄다.
CREATE INDEX idx_file_column_header ON file_column(header);
-- 라이브러리 안에서 최근 본 파일 목록.
CREATE INDEX idx_file_sighting_lib ON file_sighting(library_id, last_seen_at);

-- 적용 기록. 이 줄을 빠뜨리면 schema.test.ts의 '파일 수만큼 적용된다'가 잡는다.
INSERT INTO schema_migration (version, applied_at) VALUES (9, datetime('now'));
