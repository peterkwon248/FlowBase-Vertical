-- ═══════════════════════════════════════════════════════════════════
-- 014 — 광고비를 상품에 붙인다 (ADR-022)
-- ═══════════════════════════════════════════════════════════════════
--
-- ★ 왜 (2026-08-20 감사 A-1-1) ★
--
-- `snapshot.ts`가 `adDirect: 0`을 **리터럴로** 넣고 있었다. 게으름이 아니라
-- **저장 계층이 표현할 수 없었기 때문**이다 — `fact_ad_spend`는 캠페인 단위 표라
-- «이 광고비가 어느 상품 것인가»를 담을 칸이 아예 없었다.
--
-- 그 결과 광고비 전액이 2층(미배분)으로 갔고 **1층/2층 경계가 통째로 틀렸다.**
-- 「이 상품이 남는가」의 답이 틀린다. 3층(회사 순이익)은 합이라 맞다 — 그래서
-- 총액만 보면 아무 이상이 없어 보인다. 그게 이 결함이 오래 산 이유다.
--
-- ★ 실측이 이 마이그레이션을 정당화한다 ★
--
--   쿠팡 광고 보고서 80,137행 · 광고비 15,700,534원 · 고유 광고집행 옵션ID 65개
--   쿠팡 제트 매출의 옵션ID와 대조   20개 일치 · 14,955,098원  ★ 95.3% ★
--   쿠팡 일반 매출의 옵션ID와 대조   19개 일치 ·    719,101원      4.6%
--   노출상품ID로는                   0개 일치 — 층위가 다르다 (상품 vs 옵션)
--
-- 즉 **광고비의 95%가 상품까지 내려간다.** 배분 규칙을 발명할 필요도 없다 —
-- 파일이 «이 광고는 이 옵션의 것»이라고 이미 말하고 있다.
--
-- ★ LOCK 4 ★ 컬럼 이름은 `listing_key`다. 「옵션ID」는 쿠팡 어휘이므로 코어에
-- 들어오지 않는다 — 그 번역은 팩의 프로파일이 한다.
--
-- ★ NULL이 «0»이 아니다 (LOCK 6 · §22) ★
-- 상품 식별자가 **없는 광고 파일이 실재한다** — 11번가 기간별보고서는 일자별
-- 집계라 상품 열이 없다(#2·#11 실측). 그런 행의 `listing_key`는 NULL이고,
-- 그건 «광고비 0»이 아니라 «어느 상품인지 파일이 말해주지 않는다»이다.
-- 화면은 그 둘을 구분해서 말해야 한다.

ALTER TABLE fact_ad_spend ADD COLUMN listing_key TEXT;

-- 배분 조인이 매 조회마다 탄다. `library_id`가 앞에 오는 이유는 다른 인덱스와 같다.
CREATE INDEX idx_ad_listing ON fact_ad_spend(library_id, listing_key);

-- ═══════════════════════════════════════════════════════════════════
-- 되돌리기 그림자 — **트리거를 다시 만든다** (ADR-004)
-- ═══════════════════════════════════════════════════════════════════
--
-- ★ 이걸 빠뜨리면 조용히 값을 잃는다 ★
-- 002의 `shadow_fact_ad_spend`는 `json_object(...)`에 **컬럼을 하나씩 나열한다.**
-- 컬럼만 늘리고 트리거를 그대로 두면, UPSERT로 밀려난 행을 되돌릴 때
-- `listing_key`가 **복원되지 않는다** — 되돌린 뒤 그 광고비가 미배분으로 떨어지고
-- 아무도 그 사실을 모른다. ADR-004가 지키려는 것이 정확히 그 «순서 꼬임»이다.
--
-- SQLite는 트리거 본문을 텍스트로 보관하므로 컬럼 추가가 트리거를 갱신하지 않는다.
-- 그래서 지우고 다시 만든다. 조건(`WHEN OLD.batch_id <> NEW.batch_id`)은 그대로다.

DROP TRIGGER shadow_fact_ad_spend;

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
      'conversion_amount', OLD.conversion_amount,
      'listing_key', OLD.listing_key
    ), datetime('now'));
END;

INSERT INTO schema_migration (version, applied_at) VALUES (14, datetime('now'));
