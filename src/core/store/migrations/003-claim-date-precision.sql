-- ═══════════════════════════════════════════════════════════════
-- 003 — 클레임 일자의 정밀도 표기
-- ═══════════════════════════════════════════════════════════════
--
-- ESM 주문통합검색에는 **클레임 일자 컬럼이 없다.** 진행상태로만 취소·반품·환불을
-- 알 수 있고, 그 일이 언제 벌어졌는지는 파일이 말해주지 않는다.
--
-- ADR-009 ①은 클레임을 발생일(claimed_at)에 잡으라고 했다. 일자가 없으면
-- 결제일을 프록시로 쓸 수밖에 없는데, **그걸 실제 발생일과 구별하지 않으면
-- 조용히 틀린 숫자가 된다** (헌장 A-5). 반품이 8월에 났는데 7월 결제일로 잡히면
-- 7월 손익이 그만큼 나빠지고 8월은 좋아진다.
--
-- 그래서 값이 아니라 **값의 정밀도**를 함께 저장한다:
--
--   NULL 또는 'exact'  파일이 준 실제 일자
--   'proxy'            다른 날짜로 대신한 것 — 화면이 추정임을 표기해야 한다
--
-- 001을 고치지 않는다 (스키마 LOCK). 새 번호로 쌓는다.

ALTER TABLE fact_claim ADD COLUMN date_precision TEXT;

-- ── 그림자 트리거를 다시 만든다 ──────────────────────────────────
--
-- ★ 컬럼을 추가하면 트리거도 고쳐야 한다 ★
-- `row_shadow.prev_row_json`은 컬럼을 **이름으로 나열**해 만든다. 새 컬럼을
-- 빠뜨리면 되돌리기가 그 값을 복원하지 못하고, 그 손실은 조용하다.
-- `tests/shadow-trigger-coverage.test.ts`가 이 누락을 잡는다 (ADR-004 재검토 트리거 3).

DROP TRIGGER IF EXISTS shadow_fact_claim;

CREATE TRIGGER shadow_fact_claim
BEFORE UPDATE ON fact_claim FOR EACH ROW
WHEN OLD.batch_id <> NEW.batch_id
BEGIN
  INSERT OR IGNORE INTO row_shadow
    (batch_id, target_table, connection_id, source_key, prev_batch_id, prev_row_json, created_at)
  VALUES (NEW.batch_id, 'fact_claim', OLD.connection_id, OLD.source_key, OLD.batch_id,
    json_object(
      'id', OLD.id, 'connection_id', OLD.connection_id, 'batch_id', OLD.batch_id,
      'library_id', OLD.library_id, 'version', OLD.version, 'updated_at', OLD.updated_at,
      'mapping_version', OLD.mapping_version, 'source_key', OLD.source_key,
      'order_source_key', OLD.order_source_key, 'claim_type', OLD.claim_type,
      'status', OLD.status, 'claimed_at', OLD.claimed_at, 'amount', OLD.amount,
      'date_precision', OLD.date_precision
    ), datetime('now'));
END;

-- 적용 기록. 이 줄을 빠뜨리면 schema.test.ts의 '파일 수만큼 적용된다'가 잡는다.
INSERT INTO schema_migration (version, applied_at) VALUES (3, datetime('now'));
