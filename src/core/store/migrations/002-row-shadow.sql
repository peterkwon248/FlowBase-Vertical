-- U-1 — UPSERT × 되돌리기 의미론 (ADR-004)
--
-- 헌장 B-2의 "되돌리기 = 해당 batch 행 제거"는 한 행이 한 배치에만 속할 때만
-- 참이다. UPSERT가 있으면 한 행이 여러 배치를 거친다:
--
--   배치 A가 주문 X를 넣는다        → X.batch_id = A
--   배치 B가 같은 X를 다시 가져온다  → X.batch_id = B
--   배치 B를 되돌린다               → X가 통째로 사라진다  ← A의 데이터가 파괴됐다
--
-- 올바른 의미론:
--   B가 **신규 삽입한** 행 → 삭제
--   B가 **갱신한** 행     → 이전 버전으로 복원
--
-- 그러려면 덮어쓰기 직전의 행을 어딘가 보존해야 한다. `version` 컬럼은 몇 번째
-- 판인지만 알려줄 뿐 이전 판의 내용을 갖고 있지 않다.

CREATE TABLE row_shadow (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 덮어쓴 쪽 배치. 이 배치를 되돌릴 때 여기 담긴 판으로 복원한다.
  batch_id       TEXT NOT NULL REFERENCES batch(id),
  target_table   TEXT NOT NULL,
  connection_id  TEXT NOT NULL,
  source_key     TEXT NOT NULL,
  -- 덮이기 전 행의 소유 배치. 되돌리기 순서 검증에 쓴다 —
  -- 어떤 그림자가 이 배치를 가리키고 있으면 그 뒤에 다른 배치가 얹혀 있다는 뜻이다.
  prev_batch_id  TEXT NOT NULL,
  prev_row_json  TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  -- 한 배치가 같은 행을 여러 번 건드려도 **첫 스냅샷만** 남긴다.
  -- 그게 그 배치가 손대기 전의 상태이기 때문이다.
  UNIQUE (batch_id, target_table, connection_id, source_key)
) STRICT;

CREATE INDEX idx_shadow_batch ON row_shadow(batch_id, target_table);
CREATE INDEX idx_shadow_prev ON row_shadow(prev_batch_id);

-- ═══════════════════════════════════════════════════════════════
-- 트리거 — 덮어쓰기 직전 스냅샷
-- ═══════════════════════════════════════════════════════════════
--
-- 애플리케이션이 행마다 SELECT를 돌지 않도록 DB 안에서 처리한다. 80,138행
-- 적재에서 행당 왕복이 하나 늘면 그게 바로 병목이 된다.
--
-- `WHEN OLD.batch_id <> NEW.batch_id` — 같은 배치가 같은 행을 두 번 건드리는
-- 경우(한 파일에 source_key가 중복)는 스냅샷을 만들지 않는다. 그 배치가
-- 손대기 전 상태는 이미 첫 스냅샷에 있다.
--
-- `INSERT OR IGNORE` — UNIQUE 제약과 함께 "첫 스냅샷만 남는다"를 보장한다.

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
      'total_amount', OLD.total_amount
    ), datetime('now'));
END;

CREATE TRIGGER shadow_fact_order_item
BEFORE UPDATE ON fact_order_item FOR EACH ROW
WHEN OLD.batch_id <> NEW.batch_id
BEGIN
  INSERT OR IGNORE INTO row_shadow
    (batch_id, target_table, connection_id, source_key, prev_batch_id, prev_row_json, created_at)
  VALUES (NEW.batch_id, 'fact_order_item', OLD.connection_id, OLD.source_key, OLD.batch_id,
    json_object(
      'id', OLD.id, 'connection_id', OLD.connection_id, 'batch_id', OLD.batch_id,
      'library_id', OLD.library_id, 'version', OLD.version, 'updated_at', OLD.updated_at,
      'mapping_version', OLD.mapping_version, 'source_key', OLD.source_key,
      'order_id', OLD.order_id, 'listing_id', OLD.listing_id, 'sku_id', OLD.sku_id,
      'quantity', OLD.quantity, 'gross_amount', OLD.gross_amount,
      'discount_amount', OLD.discount_amount
    ), datetime('now'));
END;

CREATE TRIGGER shadow_fact_settlement
BEFORE UPDATE ON fact_settlement FOR EACH ROW
WHEN OLD.batch_id <> NEW.batch_id
BEGIN
  INSERT OR IGNORE INTO row_shadow
    (batch_id, target_table, connection_id, source_key, prev_batch_id, prev_row_json, created_at)
  VALUES (NEW.batch_id, 'fact_settlement', OLD.connection_id, OLD.source_key, OLD.batch_id,
    json_object(
      'id', OLD.id, 'connection_id', OLD.connection_id, 'batch_id', OLD.batch_id,
      'library_id', OLD.library_id, 'version', OLD.version, 'updated_at', OLD.updated_at,
      'mapping_version', OLD.mapping_version, 'source_key', OLD.source_key,
      'order_source_key', OLD.order_source_key, 'settled_on', OLD.settled_on,
      'pay_out_on', OLD.pay_out_on, 'gross_amount', OLD.gross_amount,
      'fee_amount', OLD.fee_amount, 'vat_amount', OLD.vat_amount,
      'shipping_amount', OLD.shipping_amount, 'net_amount', OLD.net_amount
    ), datetime('now'));
END;

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
      'status', OLD.status, 'claimed_at', OLD.claimed_at, 'amount', OLD.amount
    ), datetime('now'));
END;

CREATE TRIGGER shadow_fact_ad_spend
BEFORE UPDATE ON fact_ad_spend FOR EACH ROW
WHEN OLD.batch_id <> NEW.batch_id
BEGIN
  INSERT OR IGNORE INTO row_shadow
    (batch_id, target_table, connection_id, source_key, prev_batch_id, prev_row_json, created_at)
  VALUES (NEW.batch_id, 'fact_ad_spend', OLD.connection_id, OLD.source_key, OLD.batch_id,
    json_object(
      'id', OLD.id, 'connection_id', OLD.connection_id, 'batch_id', OLD.batch_id,
      'library_id', OLD.library_id, 'version', OLD.version, 'updated_at', OLD.updated_at,
      'mapping_version', OLD.mapping_version, 'source_key', OLD.source_key,
      'campaign_key', OLD.campaign_key, 'campaign_name', OLD.campaign_name,
      'spent_on', OLD.spent_on, 'campaign_type', OLD.campaign_type,
      'impressions', OLD.impressions, 'clicks', OLD.clicks,
      'spend_amount', OLD.spend_amount, 'conversions', OLD.conversions,
      'conversion_amount', OLD.conversion_amount
    ), datetime('now'));
END;

INSERT INTO schema_migration (version, applied_at) VALUES (2, datetime('now'));
