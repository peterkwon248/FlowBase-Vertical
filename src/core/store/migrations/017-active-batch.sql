-- ═══════════════════════════════════════════════════════════════
-- 017 — `active_batch`: 커버리지 판정이 묶음을 본다 (ADR-023 결정 2 · 확인 ①)
-- ═══════════════════════════════════════════════════════════════
--
-- ★ 무엇이 틀려 있었나 (2026-08-21 실측 · `src/core/coverage/load.ts`) ★
--
-- 013이 fact 뷰 다섯에 묶음 조건을 넣었는데 **커버리지의 보유 판정만 빠졌다.**
-- `loadCoverage`가 한 함수 안에서 두 기준을 섞어 쓰고 있었다:
--
--     counts (order·settlement·ad)   active_* 뷰      → 묶음을 **지킨다**
--     held   (무슨 성격을 가졌나)      FROM batch …     → 묶음을 **무시한다**
--
-- 증상: 「7월 결산」 묶음을 고르면 8월 광고 파일의 행은 집계에서 빠지는데,
-- 「광고비 열림」은 **그대로 열려 있다.** 열린 지표가 0을 그린다 — §22가 세운
-- 「부재를 0으로 바꾸지 않는다」의 정확한 반대이고, 화면에는 아무 일도 안 일어난다.
--
-- ★ 왜 뷰인가 — 013이 이미 답했다 ★
--
-- 013의 「(a) 조회에 인자를 흘린다 vs (b) 선택을 표에 저장하고 뷰가 읽는다」에서
-- (b)를 골랐고, 그 이유가 여기 그대로 적용된다. `load.ts`의 SQL에 조건을 손으로
-- 베끼면 **013의 뷰 다섯과 여섯 번째 사본**이 생기고, 묶음의 뜻이 바뀌는 날
-- 다섯만 고치고 하나를 빠뜨린다. 조건은 한 자리에 산다.
--
-- ★ `batch`를 대체하지 않는다 — 장부는 전부를 보여야 한다 ★
--
-- 「가져오기 기록」(015의 통)은 **묶음과 무관하게 전부** 보여야 한다. 넣은 파일이
-- 안 보이면 그것이 U-1 위반이다. 그래서 이 뷰는 **범위에 민감한 조회 전용**이고,
-- 장부·이력·되돌리기는 계속 `batch`를 직접 읽는다. 뷰를 만든다고 옛 길이 막히지
-- 않는 것이 요점이다.
--
-- 이름을 `active_`로 시작시키는 이유는 `Repository.assertActiveView`의
-- `^active_[a-z_]+$`를 통과시키기 위해서다 — 읽기 경로의 화이트리스트가 그것이다.
--
-- 분류: 계산(뷰)이다. 표를 만들지 않으므로 LOCK 1·2와 무관하다.
-- ═══════════════════════════════════════════════════════════════

-- 읽는 법: 「커밋됐고, (선택이 없거나 || 선택된 묶음에 담겨 있다)」 — 013과 같은 문장.
DROP VIEW IF EXISTS active_batch;
CREATE VIEW active_batch AS
  SELECT b.* FROM batch b
   WHERE b.status = 'committed'
     AND (NOT EXISTS (SELECT 1 FROM collection_active ca WHERE ca.library_id = b.library_id)
          OR EXISTS (SELECT 1 FROM collection_active ca
                       JOIN collection_batch cb ON cb.collection_id = ca.collection_id
                      WHERE ca.library_id = b.library_id AND cb.batch_id = b.id));

-- 적용 기록. 이 줄을 빠뜨리면 schema.test.ts의 '파일 수만큼 적용된다'가 잡는다.
INSERT INTO schema_migration (version, applied_at) VALUES (17, datetime('now'));
