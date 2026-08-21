//! 벙어리 실행기 — **SQL 문자열과 파라미터를 실행하는 것이 전부다.**
//!
//! ADR-008이 리포지토리를 Rust로 옮기는 안(B)을 기각했다. 그 기각이 의미를
//! 가지려면 여기에 도메인이 없어야 한다. 그래서 이 파일에는 아래 것들이
//! **하나도 없다** — 있으면 안 된다:
//!
//! * 되돌리기 의미론 (ADR-004) · `row_shadow` 규칙 · LIFO 판정
//! * batch·adjustment·fact 같은 테이블 이름
//! * 트랜잭션 **깊이** 관리 (중첩되면 SAVEPOINT로 내리는 판단)
//!
//! 마지막 것이 특히 그렇다. 깊이를 세는 것은 호출 순서에 대한 판단이므로
//! 리포지토리 쪽(`driver-tauri.ts`)이 한다. 여기는 `BEGIN`이 오면 `BEGIN`을
//! 실행할 뿐이다. `tests/tauri-command-surface.test.ts`가 이 표면을 단언한다.
//!
//! 값 계약은 `driver.ts`의 `SqlValue = string | number | null`과 같다.
//! BLOB은 계약 밖이라 조용히 넘기지 않고 오류로 세운다 (헌장 6).

use rusqlite::types::ValueRef;
use rusqlite::Connection;
use serde::Serialize;
use serde_json::{Map, Number, Value};
use std::sync::Mutex;
use tauri::State;

/// 열려 있는 연결 하나 + **그 연결을 지금 누가 쓰는가**(임차 번호).
///
/// ─────────────────────────────────────────────────────────────
/// ★ 왜 번호가 붙었나 (2026-08-16) ★
///
/// 전에는 `Mutex<Option<Connection>>` 하나였고 `db_open`이 있던 것을 **말없이
/// 교체**했다. 로컬퍼스트 단일 사용자 앱이라 «한 번에 한 동작»이면 충분하다는
/// 전제였는데, **앱이 그 전제를 강제하지 않았다.** 화면 쪽 잠금이 둘인데
/// (`busy.current` / `wiz.busy`) 서로를 몰라서, 적재가 도는 중에 원가 저장이
/// 들어오면:
///
/// ```text
/// ① 남의 close가 도는 적재의 연결을 가져간다  → 「DB가 열려 있지 않다」
/// ② 닫지 않아도 **교체**만으로 적재가 남의 연결에서 돈다
///    → 적재의 BEGIN 안에 남의 쓰기가 들어간다 (더 무겁다)
/// ```
///
/// 둘 다 재현됐다 (`tests/tauri-conn-race.test.ts`).
///
/// ★ 처방이 화면이 아니라 여기 있는 이유 ★
/// 버튼 비활성은 UX이고, **계약 강제가 정확성**이다. 화면의 잠금은 새 버튼이
/// 하나 생기는 날 다시 갈라지지만, 저장 계층이 거부하면 그 분기가 애초에
/// 성립하지 않는다. 그래서 「한 번에 하나」를 여기서 **불변식**으로 만든다:
/// 이미 임차 중이면 새 열기를 **거절**하고, 명령은 자기 번호가 아니면 듣지 않는다.
/// ─────────────────────────────────────────────────────────────
struct Open {
    conn: Connection,
    lease: u64,
}

#[derive(Default)]
struct DbState {
    open: Option<Open>,
    /// 마지막으로 발급한 번호. 0은 «아직 없음»이라 발급은 1부터다.
    issued: u64,
}

pub struct Db(Mutex<DbState>);

impl Db {
    pub fn new() -> Self {
        Db(Mutex::new(DbState::default()))
    }
}

impl Default for Db {
    fn default() -> Self {
        Self::new()
    }
}

/// `db_open`의 결과. 번호만 돌려주면 «넘겨받았다»가 조용해진다 (헌장 6).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Opened {
    lease: u64,
    /// 이전 세션의 연결이 남아 있어 넘겨받았나. 부르는 쪽이 알아야 말할 수 있다.
    took_over: bool,
}

type Row = Map<String, Value>;

/// JS가 보낸 값 → SQLite 값. 계약 밖의 타입은 거부한다.
fn bind(v: &Value) -> Result<rusqlite::types::Value, String> {
    Ok(match v {
        Value::Null => rusqlite::types::Value::Null,
        Value::String(s) => rusqlite::types::Value::Text(s.clone()),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                rusqlite::types::Value::Integer(i)
            } else if let Some(f) = n.as_f64() {
                rusqlite::types::Value::Real(f)
            } else {
                return Err(format!("숫자를 SQLite 값으로 옮길 수 없다: {n}"));
            }
        }
        other => Err(format!(
            "드라이버 계약(SqlValue = string | number | null) 밖의 파라미터다: {other}"
        ))?,
    })
}

/// SQLite 값 → JS 값.
fn cell(v: ValueRef<'_>) -> Result<Value, String> {
    Ok(match v {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::Number(i.into()),
        ValueRef::Real(f) => Number::from_f64(f)
            .map(Value::Number)
            .ok_or_else(|| format!("표현할 수 없는 실수다: {f}"))?,
        ValueRef::Text(t) => Value::String(String::from_utf8_lossy(t).into_owned()),
        ValueRef::Blob(_) => {
            return Err("BLOB은 드라이버 계약 밖이다 — 읽으려면 계약부터 고쳐야 한다".into())
        }
    })
}

fn params_of(params: &[Value]) -> Result<Vec<rusqlite::types::Value>, String> {
    params.iter().map(bind).collect()
}

/// 잠금·"열려 있는가"·**"네 것이 맞는가"**를 한 곳에서 처리한다.
///
/// 번호가 다르면 실행하지 않는다. 이 거절이 없으면 넘겨받기 이후의 명령이
/// **남의 연결에서** 돌고, 그게 재현된 결함 ②(트랜잭션 경계가 섞인다)다.
fn with_conn<T>(
    db: &Db,
    lease: u64,
    f: impl FnOnce(&Connection) -> Result<T, String>,
) -> Result<T, String> {
    let guard = db.0.lock().map_err(|e| format!("연결 잠금 실패: {e}"))?;
    let open = guard.open.as_ref().ok_or("DB가 열려 있지 않다")?;
    if open.lease != lease {
        return Err(
            "이 연결은 더 이상 유효하지 않다 — 다른 동작이 DB를 넘겨받았다".into(),
        );
    }
    f(&open.conn)
}

/// 연다. **이미 임차 중이면 거절한다** — 남의 연결을 말없이 교체하지 않는다.
///
/// `force`는 **세션의 첫 열기**만 쓴다. 웹뷰가 새로 뜨면(새로고침·재실행) 이전
/// 세션이 들고 있던 번호는 아무도 쓸 수 없는데, 거절만 하면 앱이 영영 못 연다.
/// 그 자리를 시계로 판정하지 않는다(느린 기기에서 정상 동작이 «오래됐다»가
/// 된다) — **«새 세션이 시작됐다»는 사실 자체**가 근거다.
///
/// ★ 커맨드에서 알맹이를 꺼내 둔 이유는 **시험** 때문이다 ★ Tauri 런타임 없이
/// 임차 계약(거절·넘겨받기·남의 것 안 닫기)을 그대로 잴 수 있다. TS 쪽 가짜
/// `invoke`는 «어댑터가 계약을 이렇게 안다»를 재고, 여기는 **계약 자체**를 잰다.
fn open_conn(db: &Db, path: &str, force: bool) -> Result<Opened, String> {
    let mut guard = db.0.lock().map_err(|e| format!("연결 잠금 실패: {e}"))?;

    let mut took_over = false;
    if let Some(prev) = guard.open.take() {
        if !force {
            // 되돌려 놓는다. 거절은 «아무 일도 일어나지 않았다»여야 한다.
            guard.open = Some(prev);
            return Err(
                "DB를 이미 다른 동작이 쓰고 있다 — 한 번에 하나만 연다. 끝난 뒤 다시 시도한다"
                    .into(),
            );
        }
        took_over = true;
        // 이전 세션의 연결이다. 닫기 실패로 새 세션을 막지 않는다 — 프로세스가
        // 살아 있는 한 파일 잠금은 어차피 우리 것이다.
        let _ = prev.conn.close();
    }

    // ★ 부모 폴더를 만든다 (ADR-024 결정 3 · 2026-08-21) ★
    //
    // `Connection::open`은 파일은 만들어도 **폴더는 안 만든다.** 지금까지는 앱이
    // 여는 자리가 늘 존재하는 프로젝트 폴더라 안 드러났는데, 설치본이 자기
    // 데이터 폴더(`appDataDir`)를 열게 되면 **첫 실행에는 그 폴더가 없다.**
    //
    // 경로를 누가 정하든 「폴더가 없으면 못 연다」는 사실은 같으므로, 이 보정은
    // 경로 결정과 독립이고 **JS가 어떤 경로를 주든** 성립해야 한다. 그래서 여기다.
    // 도메인이 아니라 파일시스템 사실이라 「벙어리 실행기」 원칙도 안 깬다.
    //
    // 실패를 삼키지 않는다 (LOCK 6) — 못 만들었으면 `Connection::open`이 낼
    // 오류보다 **여기서 나는 오류가 원인에 가깝다**(권한·읽기전용 볼륨).
    if let Some(dir) = std::path::Path::new(path).parent() {
        if !dir.as_os_str().is_empty() {
            std::fs::create_dir_all(dir)
                .map_err(|e| format!("{} 폴더를 만들지 못했다: {e}", dir.display()))?;
        }
    }

    let conn = Connection::open(path).map_err(|e| format!("{path} 열기 실패: {e}"))?;
    guard.issued += 1;
    let lease = guard.issued;
    guard.open = Some(Open { conn, lease });
    Ok(Opened { lease, took_over })
}

#[tauri::command]
pub fn db_open(db: State<'_, Db>, path: String, force: bool) -> Result<Opened, String> {
    open_conn(&db, &path, force)
}

/// 닫는다. **자기 번호일 때만.**
///
/// 번호가 다르면 «내 것은 이미 없다»이므로 할 일이 없다 — 오류가 아니다. 그리고
/// 여기서 남의 것을 닫지 않는 것이 결함 ①(도는 적재의 연결을 남의 close가
/// 가져간다)을 구조적으로 없앤다.
fn close_conn(db: &Db, lease: u64) -> Result<(), String> {
    let mut guard = db.0.lock().map_err(|e| format!("연결 잠금 실패: {e}"))?;
    let mine = guard.open.as_ref().is_some_and(|o| o.lease == lease);
    if !mine {
        return Ok(());
    }
    if let Some(open) = guard.open.take() {
        open.conn.close().map_err(|(_, e)| format!("닫기 실패: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn db_close(db: State<'_, Db>, lease: u64) -> Result<(), String> {
    close_conn(&db, lease)
}

/// DDL·PRAGMA. 파라미터를 받지 않는다 (`driver.ts`의 `exec`).
#[tauri::command]
pub fn db_exec(db: State<'_, Db>, lease: u64, sql: String) -> Result<(), String> {
    with_conn(&db, lease, |conn| {
        conn.execute_batch(&sql)
            .map_err(|e| format!("실행 실패: {e}\n  SQL: {sql}"))
    })
}

#[tauri::command]
pub fn db_run(db: State<'_, Db>, lease: u64, sql: String, params: Vec<Value>) -> Result<usize, String> {
    let args = params_of(&params)?;
    with_conn(&db, lease, |conn| {
        // `prepare_cached`가 조건 1의 "prepared 캐싱"이다. 청크 적재가 행마다
        // 파싱 비용을 다시 내지 않게 한다 (ADR-001 조건 3).
        let mut stmt = conn
            .prepare_cached(&sql)
            .map_err(|e| format!("준비 실패: {e}\n  SQL: {sql}"))?;
        stmt.execute(rusqlite::params_from_iter(args.iter()))
            .map_err(|e| format!("실행 실패: {e}\n  SQL: {sql}"))
    })
}

fn query(conn: &Connection, sql: &str, args: &[rusqlite::types::Value], limit_one: bool) -> Result<Vec<Row>, String> {
    let mut stmt = conn
        .prepare_cached(sql)
        .map_err(|e| format!("준비 실패: {e}\n  SQL: {sql}"))?;
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    let mut rows = stmt
        .query(rusqlite::params_from_iter(args.iter()))
        .map_err(|e| format!("조회 실패: {e}\n  SQL: {sql}"))?;

    let mut out = Vec::new();
    while let Some(r) = rows.next().map_err(|e| format!("행 읽기 실패: {e}"))? {
        let mut row = Map::with_capacity(names.len());
        for (i, name) in names.iter().enumerate() {
            let v = r.get_ref(i).map_err(|e| format!("{name} 읽기 실패: {e}"))?;
            row.insert(name.clone(), cell(v)?);
        }
        out.push(row);
        if limit_one {
            break;
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn db_get(db: State<'_, Db>, lease: u64, sql: String, params: Vec<Value>) -> Result<Option<Row>, String> {
    let args = params_of(&params)?;
    with_conn(&db, lease, |conn| {
        Ok(query(conn, &sql, &args, true)?.into_iter().next())
    })
}

#[tauri::command]
pub fn db_all(db: State<'_, Db>, lease: u64, sql: String, params: Vec<Value>) -> Result<Vec<Row>, String> {
    let args = params_of(&params)?;
    with_conn(&db, lease, |conn| query(conn, &sql, &args, false))
}

/// 같은 SQL을 여러 파라미터 묶음으로. **이게 없으면 적재가 IPC로 무너진다** —
/// #13 기준 80,137번의 왕복이 청크당 1회가 된다 (`driver.ts` 주석).
///
/// 트랜잭션으로 감싸지 **않는다.** 열지 말지는 호출 깊이를 아는 쪽의 판단이고,
/// 그 판단은 리포지토리 층에 있다. 여기는 N번 실행할 뿐이다.
#[tauri::command]
pub fn db_run_many(
    db: State<'_, Db>,
    lease: u64,
    sql: String,
    rows: Vec<Vec<Value>>,
) -> Result<usize, String> {
    // `batch`라 부르지 않는다 — 이 저장소에서 batch는 ImportBatch를 가리키는
    // 도메인 낱말이라(append-only · 되돌리기 단위) 여기 쓰면 읽는 사람이
    // 헷갈린다. 이건 그냥 파라미터 묶음이다.
    let mut bound = Vec::with_capacity(rows.len());
    for r in &rows {
        bound.push(params_of(r)?);
    }
    with_conn(&db, lease, |conn| {
        let mut stmt = conn
            .prepare_cached(&sql)
            .map_err(|e| format!("준비 실패: {e}\n  SQL: {sql}"))?;
        let mut changes = 0usize;
        for args in &bound {
            changes += stmt
                .execute(rusqlite::params_from_iter(args.iter()))
                .map_err(|e| format!("실행 실패: {e}\n  SQL: {sql}"))?;
        }
        Ok(changes)
    })
}

// ═══════════════════════════════════════════════════════════════
// 임차 계약 — **여기가 「한 번에 하나」의 실제 판정이다**
// ═══════════════════════════════════════════════════════════════
//
// TS 쪽 시험(`tests/tauri-conn-race.test.ts`)은 가짜 `invoke`로 «어댑터가 계약을
// 이렇게 안다»를 잰다. 그 가짜가 진짜와 어긋나면 둘 다 초록인 채로 앱만 깨진다 —
// 이 저장소가 이미 아는 모양이다(테스트 세계와 앱 세계의 비대칭). 그래서 계약
// 자체는 여기서 잰다. 창을 띄우지 않아도 되는 순수 판정이라 값이 싸다.
#[cfg(test)]
mod tests {
    use super::*;

    /// 파일을 만들지 않는 연결. 계약 판정에 실제 파일이 필요 없다.
    const MEM: &str = ":memory:";

    #[test]
    fn 이미_임차_중이면_거절한다() {
        let db = Db::new();
        let first = open_conn(&db, MEM, false).expect("첫 열기는 된다");
        let refused = open_conn(&db, MEM, false);
        assert!(refused.is_err(), "두 번째 열기가 통과했다");

        // ★ 거절은 «아무 일도 일어나지 않았다»여야 한다 ★
        // 되돌려 놓지 않으면 거절하면서 남의 연결을 없애는 셈이 된다.
        with_conn(&db, first.lease, |_| Ok(())).expect("첫 연결이 그대로 살아 있어야 한다");
    }

    #[test]
    fn force는_넘겨받고_그_사실을_말한다() {
        let db = Db::new();
        let first = open_conn(&db, MEM, false).unwrap();
        let second = open_conn(&db, MEM, true).expect("새 세션의 첫 열기는 넘겨받는다");

        assert!(second.took_over, "넘겨받고도 말하지 않으면 조용한 정리다");
        assert_ne!(first.lease, second.lease, "번호가 같으면 옛 것이 계속 통한다");
    }

    /// ★ 조사 2.9 — 설치본의 첫 열기 ★
    ///
    /// 새 기계의 앱 데이터 폴더는 **없는 채로 시작한다**. `Connection::open`은
    /// 파일은 만들어도 폴더는 안 만들므로, 이 보정이 없으면 첫 열기에서 끝난다
    /// (「이 동작을 마치지 못했습니다」 모달 하나). 없는 폴더를 실제로 지어
    /// **부러뜨려 확인한다** — 이 시험을 지우고 `create_dir_all`을 빼면 붉어진다.
    #[test]
    fn 없는_폴더에도_db를_연다() {
        let base = std::env::temp_dir().join(format!("fb-adr024-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        // 두 겹이다 — 한 겹만 만들면 되는 구현(`create_dir`)도 통과해 버린다.
        let path = base.join("깊은").join("자리").join("pnl.sqlite");
        assert!(!path.parent().unwrap().exists(), "시험 전제: 폴더가 없어야 한다");

        let db = Db::new();
        // `Opened`에 `Debug`를 달지 않는다 — 시험 편의로 제품 타입을 넓히지 않는다.
        if let Err(e) = open_conn(&db, path.to_str().unwrap(), false) {
            panic!("없는 폴더에서 열기가 실패했다: {e}");
        }
        assert!(path.exists(), "파일이 안 생겼다 — 폴더는 만들었는데 열지 못한 것이다");

        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn 넘겨받을_것이_없으면_말하지_않는다() {
        let db = Db::new();
        let opened = open_conn(&db, MEM, true).unwrap();
        assert!(!opened.took_over, "0이면 말하지 않는다");
    }

    #[test]
    fn 옛_번호로는_명령이_돌지_않는다() {
        let db = Db::new();
        let stale = open_conn(&db, MEM, false).unwrap();
        let fresh = open_conn(&db, MEM, true).unwrap();

        // 이것이 재현됐던 결함 ②를 막는 문이다 — 옛 드라이버가 남의 연결에서
        // 돌면 트랜잭션 경계가 통째로 섞인다.
        assert!(with_conn(&db, stale.lease, |_| Ok(())).is_err());
        assert!(with_conn(&db, fresh.lease, |_| Ok(())).is_ok());
    }

    #[test]
    fn 남의_것은_닫지_않는다() {
        let db = Db::new();
        let mine = open_conn(&db, MEM, false).unwrap();

        // 결함 ①: 남의 close가 도는 적재의 연결을 가져갔다. 이제 무시된다.
        close_conn(&db, mine.lease + 999).expect("남의 번호로 닫아도 오류는 아니다");
        with_conn(&db, mine.lease, |_| Ok(())).expect("내 연결이 살아 있어야 한다");

        // 자기 번호면 닫힌다. 그 뒤에는 «열려 있지 않다»가 된다.
        close_conn(&db, mine.lease).unwrap();
        assert!(with_conn(&db, mine.lease, |_| Ok(())).is_err());
    }

    #[test]
    fn 닫은_뒤에는_다시_열_수_있다() {
        // 정상 경로가 막히면 처방이 병보다 나쁘다.
        let db = Db::new();
        let a = open_conn(&db, MEM, false).unwrap();
        close_conn(&db, a.lease).unwrap();
        let b = open_conn(&db, MEM, false).expect("직렬화된 다음 동작은 그냥 된다");
        assert_ne!(a.lease, b.lease);
    }
}
