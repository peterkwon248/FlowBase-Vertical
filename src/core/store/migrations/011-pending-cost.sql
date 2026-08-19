-- ═══════════════════════════════════════════════════════════════
-- 011 — 원가 대기: 못 붙은 원가 행을 버리지 않는다
-- ═══════════════════════════════════════════════════════════════
--
-- ★ 왜 (2026-08-19, 사용자 실파일) ★
--
-- 카드 단가표(13MB · 15시트)를 블록 리더가 200블록 전부 읽어냈는데 **0건이
-- 붙었다.** 파일에 마켓 상품번호가 한 개도 없어서다 — 다리(`listingKeyColumn`)는
-- `listing_key` 정확 일치인데 품명은 키가 아니라 제목이다.
--
-- 그때 `run-reference`는 못 찾은 행의 품명·모델명·금액·적용일을 **버렸다** —
-- 남는 것은 개수와 표본 키 ≤10뿐. 사람이 나중에 «이 품명이 이 상품이다»라고
-- 판단할 재료가 증발한다. `file_sighting`(009)이 「봤다 → 남는다」로 뒤집은
-- 그 순서를 원가에도 적용한다: **못 붙었다 → 남는다 → 사람이 잇는다.**
--
-- ★ 분류: Fact도 이력도 아닌 메타다 ★
--
-- Fact가 아니다 — 공통 6컬럼도 row_shadow도 없다. 되돌리기 대상이 아니다.
-- 이력도 아니다 — ADR-005의 이력은 **확정된** 원가의 것이고 이건 확정 전이다.
-- `file_sighting`과 같은 등급이라, 재가져오기가 값을 덮어써도 된다(아래 UPSERT).
--
-- ★ UPSERT 키 = (library_id, kind, source_key) ★
--
-- source_key는 프로파일의 `sourceKey` 선언(ADR-006)으로 만든다 — 대기 행의
-- 정체성 규칙을 새로 발명하지 않고 이미 있는 규약을 탄다. 같은 파일을 다시
-- 넣으면 행이 늘지 않고 amount·effective_from·last_seen_at만 갱신된다.
--
-- ★ resolved 행이 곧 다리 사전이다 ★
--
-- 사람이 「품명 X = SKU Y」를 한 번 확정하면(resolvePendingCost), 다음에 같은
-- source_key가 오면 run-reference가 **그 SKU로 곧장 addCost한다.** 점수 자동
-- 확정이 아니라 과거의 사람 판단 재사용이다 — §20 규칙 4(「답 = 갱신, 다음
-- 파일부터 질문 0」)의 원가판. 그래서 resolved 행은 지우지 않는다.
--
-- dismissed도 지우지 않는다 — 「쓰지 않음」은 삭제가 아니라 **세고 있는 부재**다
-- (§20 규칙 3 · §22). 화면이 «무시한 N건»을 셀 수 있어야 한다.
--
-- CHECK는 state에만 건다 — 진짜 닫힌 축이다. kind는 008의 규칙대로 연다
-- (새 종류가 CHECK에 막혀 죽는 것보다 TS 타입이 막는 편이 낫다).
--
-- PII: 이 표는 상품명·모델명뿐이다 — file_column.sample_value(실명 표본) 같은
-- 위험이 새로 생기지 않는다.

CREATE TABLE pending_cost (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id      TEXT NOT NULL REFERENCES library(id),

  -- 프로파일의 sourceKey 선언으로 만든 행 식별 키 (ADR-006 규약 그대로).
  source_key      TEXT NOT NULL,
  kind            TEXT NOT NULL,           -- COGS · PACKAGING · LOGISTICS · OTHER

  title           TEXT NOT NULL,           -- 품명 — 사람이 판단할 때 보는 것
  model_code      TEXT,                    -- 모델명 — 정확 일치가 이름 유사도를 이긴다 (D2)
  amount          INTEGER NOT NULL,        -- 원 단위 정수. 부동소수 금지 (001 규율)
  effective_from  TEXT NOT NULL,           -- ★ 행마다 산다 — 위저드가 받은 시점과
                                           --   확정 시점 사이가 며칠일 수 있다
  source_hash     TEXT NOT NULL,           -- 어느 파일에서 왔나 (batch.source_hash 표기)
  source_name     TEXT NOT NULL,
  profile_version TEXT NOT NULL,           -- 어느 해석으로 읽었나

  state           TEXT NOT NULL DEFAULT 'pending'
                  CHECK (state IN ('pending','resolved','dismissed')),
  resolved_sku_id TEXT REFERENCES sku(id),
  resolved_at     TEXT,

  first_seen_at   TEXT NOT NULL,
  last_seen_at    TEXT NOT NULL,

  UNIQUE (library_id, kind, source_key)
) STRICT;

-- 화면은 «pending N»을 세고, run-reference는 source_key로 resolved를 찾는다.
CREATE INDEX idx_pending_cost_state ON pending_cost(library_id, state);

-- 적용 기록. 이 줄을 빠뜨리면 schema.test.ts의 '파일 수만큼 적용된다'가 잡는다.
INSERT INTO schema_migration (version, applied_at) VALUES (11, datetime('now'));
