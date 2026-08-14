-- ═══════════════════════════════════════════════════════════════
-- 005 — 주문 행의 기간 정밀도
-- ═══════════════════════════════════════════════════════════════
--
-- 쿠팡 제트(로켓그로스) 매출은 **옵션 × 기간 집계**로만 나온다. 행마다 날짜가
-- 없고 기간은 파일명에만 있다 (`…_20260701~20260731.xlsx`). 주문 단위 원본을
-- 쿠팡이 주지 않으므로, **이 집계가 그 사실의 원본이다** (§22-5 개정).
--
-- ADR-009 ①은 매출을 `ordered_at` 달에 귀속시킨다. 기간 집계를 넣으려면 날짜를
-- 하나 골라야 하는데, **고른 날짜를 실제 주문일과 구별하지 않으면 조용히 틀린
-- 숫자가 된다** — 003이 클레임 프록시 일자에 대해 내린 결론과 같다.
--
-- 그래서 003의 체계를 그대로 재사용한다. 값이 아니라 **값의 정밀도**를 함께 둔다:
--
--   NULL 또는 'exact'  파일이 준 실제 주문일시
--   'period'           기간 집계 — `ordered_at`은 **기간 시작일**이고
--                      `period_end`가 끝이다
--
-- ★ 왜 기간 시작일인가 ★
-- 월 단위 파일을 월 단위로 보는 한(우리 사용자의 실제 사용) 기간이 달 안에
-- 온전히 들어가므로 **왜곡이 0이다.** 기간이 달 경계를 걸칠 때만 귀속이
-- 애매해지고, 그때는 `pnlGaps`가 단서를 만든다. 임의로 기간 중앙값이나
-- 마지막 날을 고르면 그 선택이 어디에도 기록되지 않는다.
--
-- ★ 무엇을 못 하게 되나 ★
-- 이 행들은 **일별 분해가 불가능하다.** 일별 차트에서 빠지고, 그 부재를
-- 화면이 말해야 한다 (§22 «커버리지는 문서의 존재를, gaps는 온전함을»).
--
-- 001을 고치지 않는다 (스키마 LOCK). 새 번호로 쌓는다.

ALTER TABLE fact_order ADD COLUMN date_precision TEXT;
ALTER TABLE fact_order ADD COLUMN period_end TEXT;

-- ── 그림자 트리거를 다시 만든다 ──────────────────────────────────
--
-- ★ 컬럼을 추가하면 트리거도 고쳐야 한다 ★ (ADR-004 재검토 트리거 3)
-- `row_shadow.prev_row_json`은 컬럼을 **이름으로 나열**해 만든다. 새 컬럼을
-- 빠뜨리면 되돌리기가 그 값을 복원하지 못하고, 그 손실은 조용하다.
-- `tests/shadow-trigger-coverage.test.ts`가 이 누락을 잡는다.

DROP TRIGGER IF EXISTS shadow_fact_order;

CREATE TRIGGER shadow_fact_order
BEFORE UPDATE ON fact_order FOR EACH ROW
WHEN OLD.batch_id <> NEW.batch_id
BEGIN
  INSERT OR IGNORE INTO row_shadow
    (batch_id, target_table, connection_id, source_key, prev_batch_id, prev_row_json, created_at)
  VALUES (NEW.batch_id, 'fact_order', OLD.connection_id, OLD.source_key, OLD.batch_id,
    json_object(
      'id', OLD.id, 'connection_id', OLD.connection_id, 'batch_id', OLD.batch_id,
      'library_id', OLD.library_id, 'version', OLD.version, 'updated_at', OLD.updated_at,
      'mapping_version', OLD.mapping_version, 'source_key', OLD.source_key,
      'ordered_at', OLD.ordered_at, 'status', OLD.status, 'buyer_ref', OLD.buyer_ref,
      'total_amount', OLD.total_amount,
      'date_precision', OLD.date_precision, 'period_end', OLD.period_end
    ), datetime('now'));
END;

-- 적용 기록. 이 줄을 빠뜨리면 schema.test.ts의 '파일 수만큼 적용된다'가 잡는다.
INSERT INTO schema_migration (version, applied_at) VALUES (5, datetime('now'));
