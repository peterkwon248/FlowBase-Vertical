//! Tauri 셸 진입점.
//!
//! ★ 커맨드는 **SQL 실행 계열이 전부다** ★
//! 여기 등록된 목록이 곧 ADR-008이 말한 "벙어리 실행기"의 표면이고,
//! `tests/tauri-command-surface.test.ts`가 이 파일을 읽어 단언한다.
//! 새 커맨드를 더할 때는 그것이 정말 SQL 실행인지 먼저 물어야 한다 —
//! 도메인 판단이 하나라도 내려오면 리포지토리를 Rust로 옮기는 안을 기각한
//! 의미가 없어진다.

mod db;

use tauri::{LogicalSize, Manager, WebviewWindow};

/// 창을 **현재 모니터의 작업영역 안**으로 들인다.
///
/// `tauri.conf.json`의 크기는 고정값이라 어느 화면에서도 안전할 수 없다.
/// 실제로 이 기기(200% 배율 · 논리 1440x900 · 작업영역 1440x852)에서 기본
/// 높이 860이 작업영역을 넘겼다. 1366x768 노트북이면 더 크게 넘친다.
///
/// 배율이 곧 논리 픽셀 수를 정하므로, "화면 배율에 상관없이 뜬다"는 것은
/// 결국 **작업영역을 실제로 읽어서 맞추는 것**이다. 줄일 때만 손대고 키우지는
/// 않는다 — 사용자가 원한 것보다 큰 창을 밀어붙일 이유는 없다.
fn fit_to_work_area(win: &WebviewWindow) {
    let Ok(Some(monitor)) = win.current_monitor() else { return };
    let scale = monitor.scale_factor();
    let work = monitor.work_area();
    let avail_w = work.size.width as f64 / scale;
    let avail_h = work.size.height as f64 / scale;

    let Ok(outer) = win.outer_size() else { return };
    let cur = outer.to_logical::<f64>(scale);

    // 가장자리에 딱 붙지 않게 약간 남긴다.
    let margin = 24.0;
    let w = cur.width.min((avail_w - margin).max(320.0));
    let h = cur.height.min((avail_h - margin).max(320.0));

    if w < cur.width || h < cur.height {
        let _ = win.set_size(LogicalSize::new(w, h));
        let _ = win.center();
    }
}

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
            if let Some(win) = app.get_webview_window("main") {
                fit_to_work_area(&win);
            }
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
