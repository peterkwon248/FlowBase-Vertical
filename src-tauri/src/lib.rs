//! Tauri 셸 진입점.
//!
//! ★ 커맨드는 **SQL 실행 계열이 전부다** ★
//! 여기 등록된 목록이 곧 ADR-008이 말한 "벙어리 실행기"의 표면이고,
//! `tests/tauri-command-surface.test.ts`가 이 파일을 읽어 단언한다.
//! 새 커맨드를 더할 때는 그것이 정말 SQL 실행인지 먼저 물어야 한다 —
//! 도메인 판단이 하나라도 내려오면 리포지토리를 Rust로 옮기는 안을 기각한
//! 의미가 없어진다.

mod db;

use tauri::{LogicalSize, Manager, Monitor, PhysicalPosition, WebviewWindow};

/// 어떤 계산 결과로도 창을 이보다 작게 만들지 않는다. 크기 계산이 어긋나
/// 0에 가까운 값이 나오면 **창이 있으나 마나가 되고, 안 뜬 것과 구분되지 않는다.**
const MIN_SIDE: f64 = 320.0;

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
    let Ok(inner) = win.inner_size() else { return };
    let cur = outer.to_logical::<f64>(scale);

    // ★ `set_size`가 정하는 것은 **내부 크기**다 ★
    //
    // 이 자리가 실제로 틀려 있었다. 목표를 `outer_size()` 기준으로 계산해 그대로
    // 넘기면 창은 **프레임만큼 더 커진다.** 실측(200% · 작업영역 852논리):
    //
    //   outer 1293x835.5 → set_size(1293x828) → outer 1306x**863.5**
    //                                                   ↑ 852를 여전히 넘는다
    //
    // 작업영역에 맞추라고 만든 함수가 맞추지 못하고, center()가 그 큰 창을
    // 가운데 두면서 제목 표시줄이 화면 위로 밀려났다(y = -3).
    let frame_w = (outer.width.saturating_sub(inner.width)) as f64 / scale;
    let frame_h = (outer.height.saturating_sub(inner.height)) as f64 / scale;

    // 가장자리에 딱 붙지 않게 약간 남긴다.
    let margin = 24.0;
    let max_w = (avail_w - margin).max(MIN_SIDE);
    let max_h = (avail_h - margin).max(MIN_SIDE);

    if cur.width > max_w || cur.height > max_h {
        let target_w = cur.width.min(max_w);
        let target_h = cur.height.min(max_h);
        let _ = win.set_size(LogicalSize::new(
            (target_w - frame_w).max(MIN_SIDE),
            (target_h - frame_h).max(MIN_SIDE),
        ));
    }

    ensure_on_work_area(win, &monitor);
}

/// 창이 **작업영역 밖으로 나가 있으면 중앙으로 되돌린다.**
///
/// 크기를 맞춰도 위치는 따로 어긋날 수 있다 — 줄이지 않은 경우(이미 작은 창)에도
/// 이전 위치가 화면 밖일 수 있고, 모니터 구성이 바뀌면 저장된 좌표가 아니어도
/// 창이 허공에 놓인다. 그때 사용자에게는 **앱이 안 뜬 것과 구분되지 않는다.**
///
/// 음수 좌표·화면 밖을 정상으로 보지 않는 것이 요점이다. 실제로 이 기기에서
/// 위 버그 때문에 `y = -3`이 나왔고, 그건 제목 표시줄을 잡을 수 없다는 뜻이다.
fn ensure_on_work_area(win: &WebviewWindow, monitor: &Monitor) {
    let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) else { return };
    let work = monitor.work_area();
    let (wx, wy) = (work.position.x, work.position.y);
    let (ww, wh) = (work.size.width as i32, work.size.height as i32);

    let inside = pos.x >= wx
        && pos.y >= wy
        && pos.x + size.width as i32 <= wx + ww
        && pos.y + size.height as i32 <= wy + wh;

    if !inside {
        let _ = win.center();
        // center()는 **모니터** 기준이라 작업표시줄을 모른다. 그래도 남으면 직접 민다.
        if let Ok(p) = win.outer_position() {
            let x = p.x.clamp(wx, (wx + ww - size.width as i32).max(wx));
            let y = p.y.clamp(wy, (wy + wh - size.height as i32).max(wy));
            if (x, y) != (p.x, p.y) {
                let _ = win.set_position(PhysicalPosition::new(x, y));
            }
        }
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
                // 창 기하는 테스트로 덮을 수 없는 자리다(모니터·배율·작업표시줄이
                // 기기마다 다르다). 개발 빌드에서 한 줄이라도 남겨두면 회귀가
                // 눈에 띈다 — 이 값이 작업영역을 넘으면 그때가 회귀다.
                if cfg!(debug_assertions) {
                    if let (Ok(p), Ok(s)) = (win.outer_position(), win.outer_size()) {
                        eprintln!("[win] outer={:?} at {:?}", s, p);
                    }
                }
            } else {
                eprintln!("[win] get_webview_window(\"main\") == None — 창이 없다");
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
