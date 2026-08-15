-- ═══════════════════════════════════════════════════════════════
-- 007 — 「적재 + 제외 = 파일 행」을 「신규 + 갱신 + 병합 + 제외 = 파일 행」으로 정련
-- ═══════════════════════════════════════════════════════════════
--
-- `loadChunk`는 001부터 `{inserted, updated}`를 돌려주는데 **`run.ts`가 그것을
-- 버리고** `loaded += rows.length`를 썼다. 그래서 UPSERT가 같은 키의 행을 합쳐도
-- 「적재 + 제외 = 파일 행」이 **겉으로는 성립했다** — 행이 사라진 사고가 항등식을
-- 통과해 버리는 구조였다.
--
-- ★ 왜 세 칸인가 — 「병합」과 「갱신」은 다른 사실이다 ★
--
--   신규(inserted)  이 파일이 테이블에 처음 넣은 행
--   갱신(updated)   **이전 배치**의 행을 덮었다 — 재가져오기의 정상 동작이다
--   병합(merged)    **같은 파일 안에서** 두 행이 같은 키를 얻어 하나로 합쳐졌다
--
-- 셋째만이 사고다. 앞의 둘과 뭉뚱그리면 재가져오기(정상)와 키 붕괴(사고)가 같은
-- 숫자로 보인다 — 「처방이 다르면 다른 단서다」의 계산기판이다.
--
-- ★ 병합은 `loadChunk`가 셀 수 없다 ★
-- 그 함수의 통계는 `inserted = 앞뒤 행 수 차이 · updated = 나머지`라, 파일 안
-- 병합도 «갱신»으로 잡힌다. 그래서 병합은 **매핑 단계**가 센다(같은 파일에서
-- 이미 나온 source_key인가). 저장 계층이 못 보는 것을 저장 계층에 묻지 않는다.
--
-- ★ 왜 `batch_exclusion`이 아닌가 ★
-- 병합된 행은 **버려진 것이 아니라 합쳐진 것**이고, `recordExclusions`는
-- `excluded_count`를 올린다 — 넣는 순간 항등식이 그 자리에서 깨진다. 그리고
-- `batch_exclusion.reason`은 CHECK로 닫힌 다섯이라, 새 사유를 끼우는 것은 편입이
-- 아니라 그 선언을 뒤집는 일이다 (LOCK 6 후단).
--
-- 기존 배치는 전부 0이다. **0은 «병합이 없었다»가 아니라 «세지 않았다»** 이므로,
-- 화면은 `merged_count > 0`일 때만 말한다 (ADR-009 ①-보완 3의 3번).
--
-- 001을 고치지 않는다 (스키마 LOCK). 새 번호로 쌓는다.
-- `batch`에는 그림자 트리거가 없다 — `row_shadow`는 Fact 5종만 덮는다.

ALTER TABLE batch ADD COLUMN inserted_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE batch ADD COLUMN updated_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE batch ADD COLUMN merged_count   INTEGER NOT NULL DEFAULT 0;

-- 적용 기록. 이 줄을 빠뜨리면 schema.test.ts의 '파일 수만큼 적용된다'가 잡는다.
INSERT INTO schema_migration (version, applied_at) VALUES (7, datetime('now'));
