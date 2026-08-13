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
use serde_json::{Map, Number, Value};
use std::sync::Mutex;
use tauri::State;

/// 열려 있는 연결 하나. 로컬퍼스트 단일 사용자 앱이라 그 이상이 필요 없다.
pub struct Db(Mutex<Option<Connection>>);

impl Db {
    pub fn new() -> Self {
        Db(Mutex::new(None))
    }
}

impl Default for Db {
    fn default() -> Self {
        Self::new()
    }
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

/// 잠금과 "열려 있는가"를 한 곳에서 처리한다.
fn with_conn<T>(db: &Db, f: impl FnOnce(&Connection) -> Result<T, String>) -> Result<T, String> {
    let guard = db.0.lock().map_err(|e| format!("연결 잠금 실패: {e}"))?;
    let conn = guard.as_ref().ok_or("DB가 열려 있지 않다")?;
    f(conn)
}

#[tauri::command]
pub fn db_open(db: State<'_, Db>, path: String) -> Result<(), String> {
    let conn = Connection::open(&path).map_err(|e| format!("{path} 열기 실패: {e}"))?;
    let mut guard = db.0.lock().map_err(|e| format!("연결 잠금 실패: {e}"))?;
    *guard = Some(conn);
    Ok(())
}

#[tauri::command]
pub fn db_close(db: State<'_, Db>) -> Result<(), String> {
    let mut guard = db.0.lock().map_err(|e| format!("연결 잠금 실패: {e}"))?;
    if let Some(conn) = guard.take() {
        conn.close().map_err(|(_, e)| format!("닫기 실패: {e}"))?;
    }
    Ok(())
}

/// DDL·PRAGMA. 파라미터를 받지 않는다 (`driver.ts`의 `exec`).
#[tauri::command]
pub fn db_exec(db: State<'_, Db>, sql: String) -> Result<(), String> {
    with_conn(&db, |conn| {
        conn.execute_batch(&sql)
            .map_err(|e| format!("실행 실패: {e}\n  SQL: {sql}"))
    })
}

#[tauri::command]
pub fn db_run(db: State<'_, Db>, sql: String, params: Vec<Value>) -> Result<usize, String> {
    let args = params_of(&params)?;
    with_conn(&db, |conn| {
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
pub fn db_get(db: State<'_, Db>, sql: String, params: Vec<Value>) -> Result<Option<Row>, String> {
    let args = params_of(&params)?;
    with_conn(&db, |conn| {
        Ok(query(conn, &sql, &args, true)?.into_iter().next())
    })
}

#[tauri::command]
pub fn db_all(db: State<'_, Db>, sql: String, params: Vec<Value>) -> Result<Vec<Row>, String> {
    let args = params_of(&params)?;
    with_conn(&db, |conn| query(conn, &sql, &args, false))
}

/// 같은 SQL을 여러 파라미터 묶음으로. **이게 없으면 적재가 IPC로 무너진다** —
/// #13 기준 80,137번의 왕복이 청크당 1회가 된다 (`driver.ts` 주석).
///
/// 트랜잭션으로 감싸지 **않는다.** 열지 말지는 호출 깊이를 아는 쪽의 판단이고,
/// 그 판단은 리포지토리 층에 있다. 여기는 N번 실행할 뿐이다.
#[tauri::command]
pub fn db_run_many(db: State<'_, Db>, sql: String, rows: Vec<Vec<Value>>) -> Result<usize, String> {
    // `batch`라 부르지 않는다 — 이 저장소에서 batch는 ImportBatch를 가리키는
    // 도메인 낱말이라(append-only · 되돌리기 단위) 여기 쓰면 읽는 사람이
    // 헷갈린다. 이건 그냥 파라미터 묶음이다.
    let mut bound = Vec::with_capacity(rows.len());
    for r in &rows {
        bound.push(params_of(r)?);
    }
    with_conn(&db, |conn| {
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
