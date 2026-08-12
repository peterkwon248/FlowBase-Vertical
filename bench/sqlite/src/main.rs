//! ADR-003 실측 — rusqlite 청크 적재 성능.
//!
//! FlowBase 세션 2의 종단 게이트와 **같은 모양의 작업**을 Rust에서 재현한다:
//!   80,137행 × fact_ad_spend 스키마 · 청크 1,000행 · 청크당 트랜잭션 하나
//!
//! 비교 대상은 `node:sqlite`로 잰 값이다. 파이프라인(파싱·정규화·매핑)은 TypeScript에
//! 남으므로(ADR-001), 여기서 재는 것은 **적재 부분만**이다.

use rusqlite::{params, Connection};
use std::time::Instant;

const ROWS: usize = 80_137;
const CHUNK: usize = 1_000;

/// 세션 2 `001-initial.sql`의 fact_ad_spend에서 적재에 쓰이는 부분만.
const SCHEMA: &str = "
CREATE TABLE fact_ad_spend (
  id               TEXT PRIMARY KEY,
  connection_id    TEXT NOT NULL,
  batch_id         TEXT NOT NULL,
  library_id       TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT NOT NULL,
  mapping_version  TEXT NOT NULL,
  source_key       TEXT NOT NULL,
  campaign_key     TEXT NOT NULL,
  campaign_name    TEXT,
  spent_on         TEXT NOT NULL,
  campaign_type    TEXT,
  impressions      INTEGER NOT NULL DEFAULT 0,
  clicks           INTEGER NOT NULL DEFAULT 0,
  spend_amount     INTEGER NOT NULL DEFAULT 0,
  conversions      INTEGER NOT NULL DEFAULT 0,
  conversion_amount INTEGER,
  UNIQUE (connection_id, source_key)
) STRICT;
CREATE INDEX idx_ad_scope ON fact_ad_spend(library_id, spent_on);
CREATE INDEX idx_ad_batch ON fact_ad_spend(batch_id);
CREATE INDEX idx_ad_campaign ON fact_ad_spend(library_id, campaign_key);
";

/// `src/core/store/driver.ts`의 PRAGMAS와 같은 설정 (ADR-003 조건 4).
const PRAGMAS: &[&str] = &[
    "PRAGMA journal_mode = WAL",
    "PRAGMA synchronous = NORMAL",
    "PRAGMA foreign_keys = ON",
    "PRAGMA temp_store = MEMORY",
    "PRAGMA cache_size = -32000",
];

struct Row {
    id: String,
    source_key: String,
    campaign_key: String,
    campaign_name: String,
    spent_on: String,
    impressions: i64,
    clicks: i64,
    spend_amount: i64,
    conversions: i64,
}

fn make_rows(n: usize) -> Vec<Row> {
    (0..n)
        .map(|i| Row {
            id: format!("batch-1-{i}"),
            source_key: format!("{:012x}:0", i as u64 * 2_654_435_761),
            campaign_key: format!("{}", 101_766_515 + (i % 40) as u64),
            campaign_name: "AI광고".to_string(),
            spent_on: "2026-07-01".to_string(),
            impressions: (i % 20_000) as i64,
            clicks: (i % 97) as i64,
            spend_amount: (i % 5_000) as i64,
            conversions: (i % 3) as i64,
        })
        .collect()
}

/// Windows 작업 세트 피크 (바이트). 다른 OS에서는 0을 돌려준다 —
/// 지어내지 않는다.
#[cfg(windows)]
fn peak_rss() -> u64 {
    #[repr(C)]
    #[derive(Default)]
    struct Counters {
        cb: u32,
        page_fault_count: u32,
        peak_working_set_size: usize,
        working_set_size: usize,
        quota_peak_paged_pool_usage: usize,
        quota_paged_pool_usage: usize,
        quota_peak_non_paged_pool_usage: usize,
        quota_non_paged_pool_usage: usize,
        pagefile_usage: usize,
        peak_pagefile_usage: usize,
    }
    extern "system" {
        fn GetCurrentProcess() -> isize;
        fn K32GetProcessMemoryInfo(h: isize, c: *mut Counters, cb: u32) -> i32;
    }
    let mut c = Counters::default();
    c.cb = std::mem::size_of::<Counters>() as u32;
    unsafe {
        if K32GetProcessMemoryInfo(GetCurrentProcess(), &mut c, c.cb) != 0 {
            c.peak_working_set_size as u64
        } else {
            0
        }
    }
}

#[cfg(not(windows))]
fn peak_rss() -> u64 {
    0
}

fn main() -> rusqlite::Result<()> {
    let path = std::env::temp_dir().join("flowbase-bench.sqlite");
    for suffix in ["", "-wal", "-shm"] {
        let _ = std::fs::remove_file(format!("{}{}", path.display(), suffix));
    }

    let t_gen = Instant::now();
    let rows = make_rows(ROWS);
    let gen_ms = t_gen.elapsed().as_millis();

    let conn = Connection::open(&path)?;
    for p in PRAGMAS {
        // journal_mode는 값을 돌려주므로 query 계열로 받아야 한다.
        conn.query_row(p, [], |_| Ok(())).or_else(|_| conn.execute_batch(p))?;
    }
    conn.execute_batch(SCHEMA)?;

    let t0 = Instant::now();
    let mut inserted = 0usize;

    for chunk in rows.chunks(CHUNK) {
        let tx = conn.unchecked_transaction()?;
        {
            // 문장은 청크마다 한 번만 준비한다 — 행마다 준비하면 파싱 비용이 행 수만큼 든다.
            let mut stmt = tx.prepare_cached(
                "INSERT INTO fact_ad_spend
                   (id, connection_id, batch_id, library_id, version, updated_at,
                    mapping_version, source_key, campaign_key, campaign_name, spent_on,
                    campaign_type, impressions, clicks, spend_amount, conversions,
                    conversion_amount)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17)
                 ON CONFLICT (connection_id, source_key) DO UPDATE SET
                   batch_id = excluded.batch_id,
                   updated_at = excluded.updated_at,
                   version = fact_ad_spend.version + 1",
            )?;
            for r in chunk {
                stmt.execute(params![
                    r.id,
                    "conn-1",
                    "batch-1",
                    "lib-1",
                    1i64,
                    "2026-08-12T00:00:00Z",
                    "coupang/ad/campaign-breakdown@1",
                    r.source_key,
                    r.campaign_key,
                    r.campaign_name,
                    r.spent_on,
                    "GROWTH",
                    r.impressions,
                    r.clicks,
                    r.spend_amount,
                    r.conversions,
                    Option::<i64>::None,
                ])?;
                inserted += 1;
            }
        }
        tx.commit()?;
    }

    let load_ms = t0.elapsed().as_millis();

    let counted: i64 =
        conn.query_row("SELECT COUNT(*) FROM fact_ad_spend", [], |r| r.get(0))?;
    let spend: i64 = conn.query_row(
        "SELECT COALESCE(SUM(spend_amount),0) FROM fact_ad_spend
          WHERE library_id = ?1 AND spent_on BETWEEN ?2 AND ?3",
        params!["lib-1", "2026-01-01", "2026-12-31"],
        |r| r.get(0),
    )?;

    let peak_mb = peak_rss() as f64 / 1024.0 / 1024.0;

    println!("rusqlite {} (bundled SQLite {})", env!("CARGO_PKG_VERSION"), rusqlite::version());
    println!("행 생성      {gen_ms}ms  ({ROWS} 행)");
    println!("적재         {load_ms}ms  (청크 {CHUNK}행, 청크당 트랜잭션 1개)");
    println!("되세기       {counted}행 · 광고비 합계 {spend}");
    println!("삽입         {inserted}행");
    println!("피크 작업세트 {peak_mb:.1}MB  (프로세스 전체 — 행 생성분 포함)");
    Ok(())
}
