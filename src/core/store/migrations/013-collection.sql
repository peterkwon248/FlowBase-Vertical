-- ═══════════════════════════════════════════════════════════════
-- 013 — 묶음: 어느 파일들을 합쳐 볼 것인가 (ADR-021)
-- ═══════════════════════════════════════════════════════════════
--
-- ★ 왜 (2026-08-21, 사용자 지적) ★
--
--   "앱이 무비판적으로 모든 파일을 받아들여 합치는 것 같다. 합쳐야 될 파일들을
--    유저가 직접 선택해야 하는 거 아니냐."
--
-- 실측하면 맞다. `active_*` 뷰 다섯의 WHERE는 `b.status = 'committed'` 하나뿐이고,
-- 그 조건의 원래 목적은 **적재 중('open') 배제**였다 (001의 뷰 위 주석). 「어느
-- 파일을 볼까」라는 개념이 애초에 없었다. 커밋된 파일은 조건 없이 전부 들어간다.
--
-- ═══════════════════════════════════════════════════════════════
-- ★★ 뷰가 범위를 안다 — 51곳에 인자를 흘리지 않는다 ★★
-- ═══════════════════════════════════════════════════════════════
--
-- ADR-021은 「뷰 5개의 WHERE에 조건 한 줄씩이면 끝」이라고 적었다. 절반만 맞다 —
-- **SQLite 뷰는 파라미터를 받지 못한다.** 「지금 고른 묶음」을 뷰 안에서 상수로
-- 쓸 수 없으므로 길은 둘뿐이다:
--
--   (a) 조회 51곳에 묶음 인자를 흘린다
--   (b) 선택을 **표에 저장**하고 뷰가 그 표를 읽는다
--
-- (a)를 버린다. 51곳 중 다수가 `Repository` 밖에서 `db.prepare`로 직접 도는 SQL
-- 리터럴이라, 한 곳만 빠뜨리면 **묶음을 무시하고 조용히 전체를 집계한다.** 화면에는
-- 아무 일도 일어나지 않고 숫자만 틀린다 — LOCK 6이 금지하는 바로 그 실패다.
--
-- (b)는 그 실패를 **구조적으로 불가능**하게 만든다. `Repository`가 이미 조회를
-- `^active_[a-z_]+$` 정규식으로 뷰에만 허용하므로(`assertActiveView`), 범위를 뷰에
-- 넣으면 「읽기 경로가 필터를 빠뜨릴 수 없다」가 완성된다. 뷰는 이미 정책을 하나
-- 들고 있다('committed') — 두 번째 정책이 같은 자리에 서는 것이 일관된다.
--
-- ★ JOIN이 아니라 EXISTS인 이유 — 지금이 아니라 **나중에** 갈린다 ★
--
-- 먼저 정직하게: **지금 스키마에서는 JOIN도 1:1이다.** `collection_active`가
-- `PRIMARY KEY (library_id)`라 라이브러리당 한 행이고 `collection_batch`가
-- `PRIMARY KEY (collection_id, batch_id)`라 그 짝도 한 행이니, 사슬을 이어도
-- 행이 안 는다. 실측으로 확인했다 — 이 파일의 `active_order`를 LEFT JOIN판으로
-- 바꿔 `tests/collection.test.ts` 14건을 돌려도 **전부 통과한다.** 즉 지금의
-- 시험으로는 두 판을 가르지 못한다. «두 배가 난다»를 근거로 적으면 거짓이다.
--
-- 그럼에도 EXISTS인 이유는, 그 1:1이 **PK 모양에 기대지 않기** 때문이다.
-- ADR-021의 v3(혼합)이나 「묶음 둘을 겹쳐 보기」로 **활성이 여럿**이 되는 날,
-- JOIN판은 fact 행이 걸린 묶음 수만큼 곱해져 **매출이 조용히 두 배가 된다.**
-- 그 사고는 `COUNT(DISTINCT …)`에는 안 잡히고 `SUM`에서만 드러난다 — 즉 화면의
-- 절반은 멀쩡한 채 금액만 틀린다. EXISTS는 몇 개가 걸리든 한 번만 참이라
-- 그 확장에서 **아무것도 안 바뀐다.**
--
-- 「지금 안 깨지는 것」이 아니라 「넓힐 때 안 깨지는 것」을 고른 자리다.
-- 아래 `collection_active`의 PK가 오늘의 1:1을 지키고 있다는 사실은
-- `tests/collection.test.ts`의 「활성은 늘 하나다」가 못 박는다.
--
-- ★ 「전체」는 행이 아니다 ★
--
-- `collection_active`에 행이 **없으면** 전체다. 「전체를 고름」을 값으로 저장하지
-- 않는다 — `overhead_stance`(010)·`notice_ack`(012)이 세운 관례이고, 그래야
-- 이 마이그레이션 이전의 DB와 이후의 DB가 **같은 답을 낸다**(기존 시험 26곳이
-- 뷰를 통과하는 근거). 「전체」는 지울 수 없는 UI 항목이지 데이터가 아니다.
--
-- ═══════════════════════════════════════════════════════════════
-- ★★ 새로 안 것 — 겹치는 파일은 매출을 두 배로 만들지 않는다 ★★
-- ═══════════════════════════════════════════════════════════════
--
-- ADR-021은 「겹침 탐지」를 미결로 남겼다. 적재를 읽어 보니 전제가 다르다:
-- Fact 적재의 UPSERT가 `ON CONFLICT (connection_id, source_key) DO UPDATE SET …
-- batch_id = excluded.batch_id` 다. 같은 주문이 든 파일을 두 번 넣으면 행이 늘지
-- 않고 **나중 batch로 소유가 옮겨간다.**
--
-- 그래서 묶음에서 겹침의 실제 증상은 「두 배」가 아니라 **「조용히 빠짐」**이다 —
-- 「7월 결산」에 담아 둔 파일의 행이 나중에 들어온 겹치는 파일로 넘어가면, 그
-- batch는 묶음에 그대로 있는데 소유 행이 0이 된다.
--
-- 새 탐지기를 발명하지 않는다. `batchHistory`가 이미 그 수를 센다
-- (`takenOverRows` · `blockedBy`). 묶음 화면이 그 수를 올리면 된다.
--
-- ═══════════════════════════════════════════════════════════════
-- 분류: 기준 데이터다 (사실 ❌ · 계산 ❌)
-- ═══════════════════════════════════════════════════════════════
--
-- 공통 6컬럼도 `row_shadow`도 없고 되돌리기 대상이 아니다. 사람이 손으로 정하고
-- 바꾸는 값이므로 **변경 이력이 따라온다**(헌장의 데이터 3종 — 기준). 다만 v1의
-- 이력은 ADR-005가 원가에 한 것과 같은 **최소형**이다: 무엇이 언제 바뀌었나만
-- append-only로 쌓고, 「그때의 묶음 전체」를 복원하지는 않는다. 답해야 하는 질문이
-- «지난달 순이익이 왜 오늘 달라졌나» 하나이기 때문이다.
--
-- ★ 되돌리기와 가른다 (ADR-021) ★
-- 되돌리기는 fact 행을 지운다. 묶음에서 빼기는 **계산에서만** 뺀다. 그래서
-- `collection_batch`는 batch 행을 참조만 하고, 되돌린 배치(status='undone')도
-- 묶음에 남아 있을 수 있다 — 「빠졌다」와 「되돌려졌다」는 다른 사건이다.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE collection (
  id          TEXT PRIMARY KEY,
  library_id  TEXT NOT NULL REFERENCES library(id),

  -- 사용자가 붙인 이름. 「7월 결산」처럼 사람의 말이다 — 앱이 짓지 않는다.
  name        TEXT NOT NULL,

  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,

  -- 같은 이름 둘은 고르는 순간 구분이 안 된다. 이름이 곧 식별자인 UI이므로 막는다.
  UNIQUE (library_id, name)
) STRICT;

CREATE TABLE collection_batch (
  collection_id  TEXT NOT NULL REFERENCES collection(id) ON DELETE CASCADE,

  -- 되돌리기는 batch 행을 남긴다(status='undone'). 그래서 CASCADE로 고아가 되지
  -- 않는다 — `batch_exclusion`(001)과 같은 정책이다.
  batch_id       TEXT NOT NULL REFERENCES batch(id) ON DELETE CASCADE,

  added_at       TEXT NOT NULL,

  PRIMARY KEY (collection_id, batch_id)
) STRICT;

-- 뷰가 「이 batch가 지금 범위인가」를 물을 때 타는 길.
CREATE INDEX idx_collection_batch_batch ON collection_batch(batch_id);

CREATE TABLE collection_active (
  -- 라이브러리마다 하나. 행이 **없으면 「전체」**다 (010·012 관례).
  library_id     TEXT PRIMARY KEY REFERENCES library(id),

  -- 묶음이 지워지면 선택도 함께 사라진다 → 다시 「전체」가 된다. 없는 묶음을
  -- 가리키는 선택이 남아 화면이 통째로 비는 것보다 낫다.
  collection_id  TEXT NOT NULL REFERENCES collection(id) ON DELETE CASCADE,

  set_at         TEXT NOT NULL
) STRICT;

-- 변경 이력 — append-only. 「지난달 순이익이 왜 달라졌나」에 답하는 최소형.
CREATE TABLE collection_event (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id     TEXT NOT NULL REFERENCES library(id),

  -- 묶음이 지워져도 이력은 남아야 한다 — 그래서 FK를 걸지 않는다.
  -- 지워진 묶음의 이름은 `name`에 박제된 값으로 남는다.
  collection_id  TEXT NOT NULL,

  kind           TEXT NOT NULL
                 CHECK (kind IN ('created','renamed','added','removed','deleted')),

  -- added·removed일 때만 있다.
  batch_id       TEXT,
  -- created·renamed·deleted일 때의 이름. renamed는 **새 이름**을 적는다.
  name           TEXT,

  at             TEXT NOT NULL
) STRICT;

CREATE INDEX idx_collection_event ON collection_event(library_id, at);

-- ═══════════════════════════════════════════════════════════════
-- 활성 뷰 재정의 — 다섯 개가 같은 조건을 진다
-- ═══════════════════════════════════════════════════════════════
--
-- 트리거를 통째로 다시 만든 003·005와 같은 모양이다 (DROP … IF EXISTS + CREATE).
-- 조건이 다섯 번 반복되는 것은 001부터 그랬다 — 뷰는 상속이 없다.
--
-- 읽는 법: 「커밋됐고, (선택이 없거나 || 선택된 묶음에 담겨 있다)」

DROP VIEW IF EXISTS active_order;
CREATE VIEW active_order AS
  SELECT o.* FROM fact_order o
    JOIN batch b ON b.id = o.batch_id
   WHERE b.status = 'committed'
     AND (NOT EXISTS (SELECT 1 FROM collection_active ca WHERE ca.library_id = b.library_id)
          OR EXISTS (SELECT 1 FROM collection_active ca
                       JOIN collection_batch cb ON cb.collection_id = ca.collection_id
                      WHERE ca.library_id = b.library_id AND cb.batch_id = b.id));

DROP VIEW IF EXISTS active_order_item;
CREATE VIEW active_order_item AS
  SELECT i.* FROM fact_order_item i
    JOIN batch b ON b.id = i.batch_id
   WHERE b.status = 'committed'
     AND (NOT EXISTS (SELECT 1 FROM collection_active ca WHERE ca.library_id = b.library_id)
          OR EXISTS (SELECT 1 FROM collection_active ca
                       JOIN collection_batch cb ON cb.collection_id = ca.collection_id
                      WHERE ca.library_id = b.library_id AND cb.batch_id = b.id));

DROP VIEW IF EXISTS active_settlement;
CREATE VIEW active_settlement AS
  SELECT s.* FROM fact_settlement s
    JOIN batch b ON b.id = s.batch_id
   WHERE b.status = 'committed'
     AND (NOT EXISTS (SELECT 1 FROM collection_active ca WHERE ca.library_id = b.library_id)
          OR EXISTS (SELECT 1 FROM collection_active ca
                       JOIN collection_batch cb ON cb.collection_id = ca.collection_id
                      WHERE ca.library_id = b.library_id AND cb.batch_id = b.id));

DROP VIEW IF EXISTS active_claim;
CREATE VIEW active_claim AS
  SELECT c.* FROM fact_claim c
    JOIN batch b ON b.id = c.batch_id
   WHERE b.status = 'committed'
     AND (NOT EXISTS (SELECT 1 FROM collection_active ca WHERE ca.library_id = b.library_id)
          OR EXISTS (SELECT 1 FROM collection_active ca
                       JOIN collection_batch cb ON cb.collection_id = ca.collection_id
                      WHERE ca.library_id = b.library_id AND cb.batch_id = b.id));

DROP VIEW IF EXISTS active_ad_spend;
CREATE VIEW active_ad_spend AS
  SELECT a.* FROM fact_ad_spend a
    JOIN batch b ON b.id = a.batch_id
   WHERE b.status = 'committed'
     AND (NOT EXISTS (SELECT 1 FROM collection_active ca WHERE ca.library_id = b.library_id)
          OR EXISTS (SELECT 1 FROM collection_active ca
                       JOIN collection_batch cb ON cb.collection_id = ca.collection_id
                      WHERE ca.library_id = b.library_id AND cb.batch_id = b.id));

-- 적용 기록. 이 줄을 빠뜨리면 schema.test.ts의 '파일 수만큼 적용된다'가 잡는다.
INSERT INTO schema_migration (version, applied_at) VALUES (13, datetime('now'));
