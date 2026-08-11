-- FlowBase 손익 — 첫 마이그레이션
--
-- 헌장 B-1: Fact 행 공통 컬럼은 **첫 마이그레이션부터** 존재해야 하며 소급 추가
-- 불가 항목이다. 아래 모든 Fact 테이블이 여섯 개를 전부 갖는다:
--
--   connection_id     계정 분리 대비 (v1 UI는 마켓당 1개만 보여줘도 지금부터)
--   batch_id          되돌리기 단위
--   library_id        v1 단일값
--   version           행 버전 (재가져오기 시 증가)
--   updated_at        마지막 갱신
--   mapping_version   이 행을 만들 때 쓴 매핑 프로파일 버전
--
-- 헌장 B-8: 이 파일에 마켓 이름(쿠팡·네이버·G마켓·옥션·11번가·ESM) 문자열이
-- 없어야 한다. 마켓은 `connection.pack_id` + `connection.marketplace_key`가
-- 가리키는 팩의 데이터일 뿐 스키마가 아는 것이 아니다.

PRAGMA foreign_keys = ON;

-- ═══════════════════════════════════════════════════════════════
-- 0. 메타
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE schema_migration (
  version     INTEGER PRIMARY KEY,
  applied_at  TEXT NOT NULL
) STRICT;

-- v1은 라이브러리가 하나다. 그래도 모든 Fact 행이 이 값을 들고 다닌다 —
-- 나중에 갈라야 할 때 소급이 불가능하기 때문이다 (B-1).
CREATE TABLE library (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
) STRICT;

-- ═══════════════════════════════════════════════════════════════
-- 1. 연결 · 배치 (기준 데이터 — 헌장 B-4)
-- ═══════════════════════════════════════════════════════════════

-- 마켓 연결. 마켓이 무엇인지는 팩이 안다 — 여기서는 키만 든다 (B-8).
CREATE TABLE connection (
  id               TEXT PRIMARY KEY,
  library_id       TEXT NOT NULL REFERENCES library(id),
  pack_id          TEXT NOT NULL,   -- 예: "kr-marketplace"
  marketplace_key  TEXT NOT NULL,   -- 팩 안에서만 뜻을 갖는 키
  display_name     TEXT NOT NULL,
  -- 상태 머신은 핸드오프 §6-1의 7종. 새 상태를 발명하지 않는다 (헌장 C-7).
  state            TEXT NOT NULL CHECK (state IN (
                     'CONNECTED','SYNCING','ERROR','EXPIRED',
                     'REAUTH_REQUIRED','DISCONNECTED','FORMAT_CHANGED')),
  state_note       TEXT,
  -- 자격증명은 여기 두지 않는다. 참조만 (헌장 B-11 · 인계 문서 2-5).
  credential_ref   TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
) STRICT;

CREATE INDEX idx_connection_library ON connection(library_id);

-- 가져오기 배치. **되돌리기의 단위**다 (헌장 B-2).
CREATE TABLE batch (
  id               TEXT PRIMARY KEY,
  library_id       TEXT NOT NULL REFERENCES library(id),
  connection_id    TEXT NOT NULL REFERENCES connection(id),
  -- 어떤 파일이 어떤 프로파일로 들어왔는가
  source_name      TEXT NOT NULL,
  source_bytes     INTEGER NOT NULL,
  source_sha256    TEXT,
  container_format TEXT NOT NULL,
  sheet_name       TEXT,
  mapping_version  TEXT NOT NULL,
  -- 진행 상태. 'open'인 배치는 아직 적재 중이라 조회에서 제외된다.
  status           TEXT NOT NULL CHECK (status IN ('open','committed','undone')),
  row_count        INTEGER NOT NULL DEFAULT 0,
  excluded_count   INTEGER NOT NULL DEFAULT 0,
  started_at       TEXT NOT NULL,
  committed_at     TEXT,
  undone_at        TEXT
) STRICT;

CREATE INDEX idx_batch_library_status ON batch(library_id, status);
CREATE INDEX idx_batch_connection ON batch(connection_id);

-- 제외된 행. 헌장 A-5 — 읽지 못한 것은 제외하고 **제외를 표시한다.**
-- 사유 코드는 파이프라인의 ExcludedRow.reason과 같은 집합이다.
CREATE TABLE batch_exclusion (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id   TEXT NOT NULL REFERENCES batch(id) ON DELETE CASCADE,
  row_index  INTEGER NOT NULL,   -- 파일 기준 절대 행 번호
  reason     TEXT NOT NULL CHECK (reason IN ('total','subtitle','blank','trailing-blank','error')),
  detail     TEXT NOT NULL
) STRICT;

CREATE INDEX idx_exclusion_batch ON batch_exclusion(batch_id);

-- ═══════════════════════════════════════════════════════════════
-- 2. 매핑 프로파일 (헌장 B-6 — 버전 있는 데이터, 코드가 아니다)
-- ═══════════════════════════════════════════════════════════════

-- 키 = (마켓, 문서종류, grain). 기존 버전은 **수정하지 않는다** — 변경은 새 행이다.
CREATE TABLE mapping_profile (
  version          TEXT NOT NULL,
  pack_id          TEXT NOT NULL,
  marketplace_key  TEXT NOT NULL,
  doc_type         TEXT NOT NULL,   -- order · settlement · claim · ad · cost
  grain            TEXT NOT NULL,   -- order · order_item · shipment · day · campaign
  -- 프로파일 본문은 JSON이다. 원격(CDN) 갱신 대상이라 스키마로 굳히지 않는다.
  definition       TEXT NOT NULL,
  source           TEXT NOT NULL CHECK (source IN ('builtin','remote','user')),
  installed_at     TEXT NOT NULL,
  PRIMARY KEY (pack_id, marketplace_key, doc_type, grain, version)
) STRICT;

-- ═══════════════════════════════════════════════════════════════
-- 3. 기준 데이터 (헌장 B-4 — 수동 편집 + 변경 이력)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE product (
  id          TEXT PRIMARY KEY,
  library_id  TEXT NOT NULL REFERENCES library(id),
  name        TEXT NOT NULL,
  category    TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
) STRICT;

CREATE TABLE sku (
  id          TEXT PRIMARY KEY,
  library_id  TEXT NOT NULL REFERENCES library(id),
  product_id  TEXT NOT NULL REFERENCES product(id),
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  -- 핸드오프 §6-5. DRAFT는 마켓에 없는 선등록 상태로 손익에서 제외된다.
  status      TEXT NOT NULL CHECK (status IN ('ACTIVE','DRAFT')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE (library_id, code)
) STRICT;

CREATE INDEX idx_sku_product ON sku(product_id);

-- 마켓 리스팅 ↔ SKU 연결. **연결 저장소는 하나다** (헌장 B-5 ②) —
-- 목업의 `linked`/`linkedHere` 분열을 여기서 통합한다. 어느 화면에서 연결하든
-- 이 테이블에 쓰이므로 배지 카운트가 어긋날 수 없다.
CREATE TABLE marketplace_listing (
  id             TEXT PRIMARY KEY,
  library_id     TEXT NOT NULL REFERENCES library(id),
  connection_id  TEXT NOT NULL REFERENCES connection(id),
  listing_key    TEXT NOT NULL,   -- 마켓의 상품/옵션 식별자 (문자열 유지)
  title          TEXT NOT NULL,
  sku_id         TEXT REFERENCES sku(id),
  -- 연결하지 않기로 한 것도 상태다 — 매번 다시 물어보지 않기 위해.
  link_state     TEXT NOT NULL CHECK (link_state IN ('linked','ignored','unlinked')),
  linked_at      TEXT,
  linked_by      TEXT CHECK (linked_by IN ('user','rule','ai')),
  updated_at     TEXT NOT NULL,
  UNIQUE (connection_id, listing_key)
) STRICT;

CREATE INDEX idx_listing_sku ON marketplace_listing(sku_id);
CREATE INDEX idx_listing_state ON marketplace_listing(library_id, link_state);

-- 원가는 숫자 하나가 아니라 **시계열**이다 (인계 문서 §5).
-- `costAt(sku, 주문일)`이 그 주문일 이전 중 가장 늦은 단가를 쓴다.
--
-- 헌장 B-5 ① — 원가 저장소는 하나다. 목업의 `costAdds`/`costQuick` 분열을
-- 통합한다. 상품 화면의 빠른 입력도 이 표에 이력으로 남는다.
CREATE TABLE cost_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id   TEXT NOT NULL REFERENCES library(id),
  sku_id       TEXT NOT NULL REFERENCES sku(id),
  kind         TEXT NOT NULL CHECK (kind IN ('COGS','PACKAGING','LOGISTICS','OTHER')),
  amount       INTEGER NOT NULL,       -- 원 단위 정수. 부동소수 금지
  effective_from TEXT NOT NULL,        -- 적용 시작일 (YYYY-MM-DD)
  note         TEXT,
  entered_at   TEXT NOT NULL,
  entered_by   TEXT NOT NULL CHECK (entered_by IN ('user','import')),
  UNIQUE (library_id, sku_id, kind, effective_from)
) STRICT;

CREATE INDEX idx_cost_lookup ON cost_history(sku_id, kind, effective_from);

-- ═══════════════════════════════════════════════════════════════
-- 4. 사실(Fact) — 공통 6컬럼 필수 (헌장 B-1)
-- ═══════════════════════════════════════════════════════════════

-- 주문. `source_key`는 마켓의 주문 식별자이며 **문자열로 유지한다**
-- (ADR-002 · 대조표 함정 #3 — 숫자로 바꾸면 정밀도를 잃는다).
CREATE TABLE fact_order (
  id               TEXT PRIMARY KEY,
  -- ── 공통 6컬럼 (B-1) ──
  connection_id    TEXT NOT NULL REFERENCES connection(id),
  batch_id         TEXT NOT NULL REFERENCES batch(id),
  library_id       TEXT NOT NULL REFERENCES library(id),
  version          INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT NOT NULL,
  mapping_version  TEXT NOT NULL,
  -- ── 본문 ──
  source_key       TEXT NOT NULL,
  ordered_at       TEXT NOT NULL,
  status           TEXT NOT NULL,
  buyer_ref        TEXT,
  total_amount     INTEGER NOT NULL DEFAULT 0,
  -- 같은 연결 안에서 source_key가 겹치면 UPSERT다 (헌장 B-2).
  UNIQUE (connection_id, source_key)
) STRICT;

CREATE INDEX idx_order_scope ON fact_order(library_id, ordered_at);
CREATE INDEX idx_order_batch ON fact_order(batch_id);

CREATE TABLE fact_order_item (
  id               TEXT PRIMARY KEY,
  connection_id    TEXT NOT NULL REFERENCES connection(id),
  batch_id         TEXT NOT NULL REFERENCES batch(id),
  library_id       TEXT NOT NULL REFERENCES library(id),
  version          INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT NOT NULL,
  mapping_version  TEXT NOT NULL,
  source_key       TEXT NOT NULL,
  order_id         TEXT NOT NULL REFERENCES fact_order(id),
  listing_id       TEXT REFERENCES marketplace_listing(id),
  sku_id           TEXT REFERENCES sku(id),
  quantity         INTEGER NOT NULL,
  gross_amount     INTEGER NOT NULL DEFAULT 0,
  discount_amount  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (connection_id, source_key)
) STRICT;

CREATE INDEX idx_item_order ON fact_order_item(order_id);
CREATE INDEX idx_item_batch ON fact_order_item(batch_id);
CREATE INDEX idx_item_scope ON fact_order_item(library_id, sku_id);

CREATE TABLE fact_settlement (
  id               TEXT PRIMARY KEY,
  connection_id    TEXT NOT NULL REFERENCES connection(id),
  batch_id         TEXT NOT NULL REFERENCES batch(id),
  library_id       TEXT NOT NULL REFERENCES library(id),
  version          INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT NOT NULL,
  mapping_version  TEXT NOT NULL,
  source_key       TEXT NOT NULL,
  order_source_key TEXT,
  settled_on       TEXT NOT NULL,
  pay_out_on       TEXT,
  gross_amount     INTEGER NOT NULL DEFAULT 0,
  fee_amount       INTEGER NOT NULL DEFAULT 0,
  vat_amount       INTEGER NOT NULL DEFAULT 0,
  shipping_amount  INTEGER NOT NULL DEFAULT 0,
  net_amount       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (connection_id, source_key)
) STRICT;

CREATE INDEX idx_settlement_scope ON fact_settlement(library_id, settled_on);
CREATE INDEX idx_settlement_batch ON fact_settlement(batch_id);

CREATE TABLE fact_claim (
  id               TEXT PRIMARY KEY,
  connection_id    TEXT NOT NULL REFERENCES connection(id),
  batch_id         TEXT NOT NULL REFERENCES batch(id),
  library_id       TEXT NOT NULL REFERENCES library(id),
  version          INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT NOT NULL,
  mapping_version  TEXT NOT NULL,
  source_key       TEXT NOT NULL,
  order_source_key TEXT,
  -- 핸드오프 §6-10.
  claim_type       TEXT NOT NULL CHECK (claim_type IN ('CANCEL','RETURN','EXCHANGE','REFUND')),
  status           TEXT NOT NULL,
  claimed_at       TEXT NOT NULL,
  amount           INTEGER NOT NULL DEFAULT 0,
  UNIQUE (connection_id, source_key)
) STRICT;

CREATE INDEX idx_claim_scope ON fact_claim(library_id, claimed_at);
CREATE INDEX idx_claim_batch ON fact_claim(batch_id);

-- 광고. 광고비는 SKU가 아니라 **캠페인에 붙는다** (인계 문서 §5).
CREATE TABLE fact_ad_spend (
  id               TEXT PRIMARY KEY,
  connection_id    TEXT NOT NULL REFERENCES connection(id),
  batch_id         TEXT NOT NULL REFERENCES batch(id),
  library_id       TEXT NOT NULL REFERENCES library(id),
  version          INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT NOT NULL,
  mapping_version  TEXT NOT NULL,
  source_key       TEXT NOT NULL,
  campaign_key     TEXT NOT NULL,
  campaign_name    TEXT,
  spent_on         TEXT NOT NULL,
  -- 핸드오프 §6-9. NEW에는 ROAS를 계산하지 않는다 — 전환매출이 존재하지 않는다.
  campaign_type    TEXT CHECK (campaign_type IN ('GROWTH','NEW')),
  impressions      INTEGER NOT NULL DEFAULT 0,
  clicks           INTEGER NOT NULL DEFAULT 0,
  spend_amount     INTEGER NOT NULL DEFAULT 0,
  conversions      INTEGER NOT NULL DEFAULT 0,
  conversion_amount INTEGER,   -- NEW면 NULL. 0이 아니다 — 없는 것과 0은 다르다
  UNIQUE (connection_id, source_key)
) STRICT;

CREATE INDEX idx_ad_scope ON fact_ad_spend(library_id, spent_on);
CREATE INDEX idx_ad_batch ON fact_ad_spend(batch_id);
CREATE INDEX idx_ad_campaign ON fact_ad_spend(library_id, campaign_key);

-- ═══════════════════════════════════════════════════════════════
-- 5. 조정 레이어 (헌장 B-3 — 원본 불변)
-- ═══════════════════════════════════════════════════════════════

-- 유효값 = 원본 + 조정 스택. 조정은 Fact 행을 **덮어쓰지 않는다.**
-- 재가져오기는 원본만 갱신하고 이 표는 건드리지 않으므로 조정이 살아남는다.
--
-- 헌장 B-5 ③ — 조정 저장소는 하나다. 목업의 `adjust`(필드별 단일 값)와
-- `setAdj`(스택 배열) 분열을 스택 하나로 통합한다.
CREATE TABLE adjustment (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id     TEXT NOT NULL REFERENCES library(id),
  -- 대상은 (테이블, 행 id, 필드)로 지정한다. 배치가 아니라 **행**에 붙으므로
  -- 되돌리기로 행이 사라져도 조정은 남고, 같은 source_key가 다시 들어오면
  -- 다시 적용된다.
  target_table   TEXT NOT NULL,
  target_source_key TEXT NOT NULL,
  target_connection_id TEXT NOT NULL REFERENCES connection(id),
  field          TEXT NOT NULL,
  previous_value TEXT,
  new_value      TEXT,
  reason         TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  created_by     TEXT NOT NULL DEFAULT 'user',
  -- 조정을 되돌리는 것도 조정이다 — 삭제하지 않고 무효화 표시만 한다.
  revoked_at     TEXT
) STRICT;

CREATE INDEX idx_adjustment_target
  ON adjustment(target_connection_id, target_table, target_source_key);

-- 대사 확인. **조정과 별개다** — 헌장 B-3: 대사는 원본끼리만 비교하며
-- 조정으로 불일치를 일치로 만들 수 없다. 불일치를 "확인함"으로 표시할 뿐이다.
CREATE TABLE recon_ack (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id     TEXT NOT NULL REFERENCES library(id),
  connection_id  TEXT NOT NULL REFERENCES connection(id),
  recon_key      TEXT NOT NULL,   -- 무엇과 무엇을 비교했는지의 식별자
  difference     INTEGER NOT NULL,
  reason         TEXT NOT NULL,
  acked_at       TEXT NOT NULL,
  UNIQUE (connection_id, recon_key)
) STRICT;

-- ═══════════════════════════════════════════════════════════════
-- 6. 조회 뷰 — "활성 데이터만" 규율의 출발점
-- ═══════════════════════════════════════════════════════════════

-- 되돌린 배치의 행은 **물리적으로 삭제**되므로(헌장 B-2) 뷰가 상태를 거를
-- 필요는 없다. 다만 적재 중('open')인 배치는 아직 사실이 아니다.
CREATE VIEW active_order AS
  SELECT o.* FROM fact_order o
  JOIN batch b ON b.id = o.batch_id
  WHERE b.status = 'committed';

CREATE VIEW active_order_item AS
  SELECT i.* FROM fact_order_item i
  JOIN batch b ON b.id = i.batch_id
  WHERE b.status = 'committed';

CREATE VIEW active_settlement AS
  SELECT s.* FROM fact_settlement s
  JOIN batch b ON b.id = s.batch_id
  WHERE b.status = 'committed';

CREATE VIEW active_claim AS
  SELECT c.* FROM fact_claim c
  JOIN batch b ON b.id = c.batch_id
  WHERE b.status = 'committed';

CREATE VIEW active_ad_spend AS
  SELECT a.* FROM fact_ad_spend a
  JOIN batch b ON b.id = a.batch_id
  WHERE b.status = 'committed';

INSERT INTO schema_migration (version, applied_at) VALUES (1, datetime('now'));
