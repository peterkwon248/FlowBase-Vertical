-- ═══════════════════════════════════════════════════════════════
-- 008 — 비치명 오류의 목적지: 「적재됐지만 온전하지 않은 행」
-- ═══════════════════════════════════════════════════════════════
--
-- `MappingError`는 두 가지를 섞어 담아 왔다. 행을 버린 것(치명)과 **행은 적재됐지만
-- 알려야 하는 것**(비치명)이다. 전자는 `batch_exclusion`에 `reason="error"`로 남지만,
-- 후자는 `ImportRunResult.mappingErrors`에 담긴 채 **아무도 읽지 않고** 사라졌다.
--
--   「사전에 없는 상태값이 기본 경로로 흘러 들어갔다」   → 어디에도 안 남았다
--   「선언한 컬럼이 파일에 없어 그 값이 전 행에서 빈다」  → 어디에도 안 남았다
--   「품목이 부모를 못 찾아 버려졌다」                    → 어디에도 안 남았다
--
-- 적재는 됐으니 조용한 «실패»는 아니다. 하지만 **조용한 결손**이고, LOCK 6이 막으려는
-- 것과 같은 계열이다.
--
-- ★ 왜 `batch_exclusion`이 아닌가 — 007과 같은 이유다 ★
-- 그 행들은 **버려지지 않았다.** `recordExclusions`는 `excluded_count`를 올리므로
-- 넣는 순간 「신규 + 갱신 + 병합 + 제외 = 파일 행」이 그 자리에서 깨진다. 그리고
-- `batch_exclusion.reason`은 CHECK로 닫힌 다섯이라, 새 사유를 끼우는 것은 편입이
-- 아니라 그 선언을 뒤집는 일이다.
--
-- ★ `code`에 CHECK를 걸지 않는다 — 007이 부딪힌 벽을 되풀이하지 않는다 ★
-- SQLite는 CHECK를 ALTER로 바꾸지 못한다(테이블 재생성이다). 사유 목록을 여기에
-- 굳히면 새 사유 하나를 더할 때마다 테이블을 다시 짓게 되고, 그 비용이 결국
-- 「그냥 기존 사유에 욱여넣기」를 부른다 — 007에서 `merged`가 제외로 못 들어간
-- 것과 정반대 방향의 같은 사고다.
--
-- 대신 목록은 **`core/import/issues.ts`의 `ISSUE_KINDS`가 닫는다.** 쓰는 경로가
-- 하나뿐(`Repository.recordIssues`)이고 그 인자가 `IssueCode` 유니온이라, 표에 없는
-- 코드는 컴파일이 거부한다. `tests/batch-issues.test.ts`가 「DB에 있는 코드 ⊆ 선언표」를
-- 실제로 재서 그 잠금이 살아 있는지 확인한다.
--
-- ★ `scope`는 CHECK로 닫는다 — 이쪽은 진짜로 닫힌 축이다 ★
--   row   이 파일 행 하나에 일어난 일. `row_index`가 있다
--   file  파일 전체에 걸친 일. `row_index`는 NULL이다
-- 「컬럼이 없다」를 행 사건으로 세면 «온전하지 않은 행 1건»이 되는데 실제로는 전 행에서
-- 그 값이 빈다. 파일 사건을 행 수로 뭉개면 수가 141분의 1로 줄어 「거의 괜찮다」처럼
-- 보인다 — 조용한 실패를 고치려다 조용한 거짓을 만드는 자리다.
--
-- ★ 어떤 카운터도 건드리지 않는다 ★
-- `row_count`·`excluded_count`·`inserted/updated/merged_count` 전부 그대로다. 이
-- 테이블은 항등식의 항이 아니라 **적재된 행에 붙는 주석**이다.
--
-- 기존 배치는 0행이다. **0은 «온전했다»가 아니라 «안 남겼다»** 이므로, 화면은
-- 사건이 있을 때만 말한다 (ADR-009 ①-보완 3의 3번).
--
-- 001을 고치지 않는다 (스키마 LOCK). 새 번호로 쌓는다.
-- `row_shadow` 트리거는 Fact 5종만 덮으므로 여기 붙지 않는다.

CREATE TABLE batch_issue (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id   TEXT NOT NULL REFERENCES batch(id) ON DELETE CASCADE,
  -- 사유 코드. 목록은 `ISSUE_KINDS`가 닫는다 (위 참조)
  code       TEXT NOT NULL,
  scope      TEXT NOT NULL CHECK (scope IN ('row','file')),
  -- 파일 기준 절대 행 번호. scope='file'이면 NULL이다 — 0을 넣으면 «1행에서 일어난
  -- 일»과 «행이 없는 일»이 같은 얼굴이 된다
  row_index  INTEGER,
  detail     TEXT NOT NULL,
  CHECK ((scope = 'file') = (row_index IS NULL))
) STRICT;

CREATE INDEX idx_issue_batch ON batch_issue(batch_id);

-- 적용 기록. 이 줄을 빠뜨리면 schema.test.ts의 '파일 수만큼 적용된다'가 잡는다.
INSERT INTO schema_migration (version, applied_at) VALUES (8, datetime('now'));
