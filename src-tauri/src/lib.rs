//! Tauri 셸 진입점.
//!
//! ★ 커맨드는 **SQL 실행 계열이 전부다** ★
//! 여기 등록된 목록이 곧 ADR-008이 말한 "벙어리 실행기"의 표면이고,
//! `tests/tauri-command-surface.test.ts`가 이 파일을 읽어 단언한다.
//! 새 커맨드를 더할 때는 그것이 정말 SQL 실행인지 먼저 물어야 한다 —
//! 도메인 판단이 하나라도 내려오면 리포지토리를 Rust로 옮기는 안을 기각한
//! 의미가 없어진다.

mod db;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(db::Db::new())
        .invoke_handler(tauri::generate_handler![
            db::db_open,
            db::db_close,
            db::db_exec,
            db::db_run,
            db::db_get,
            db::db_all,
            db::db_run_many,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
