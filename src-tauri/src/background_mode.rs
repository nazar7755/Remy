use crate::persistence::RemyStore;
use tauri::{AppHandle, Manager, RunEvent, Runtime, WindowEvent};
use tauri_plugin_notification::NotificationExt;

const BACKGROUND_NOTIFICATION_SHOWN_KEY: &str = "background_close_notification_shown";

fn run_in_background_enabled(store: &RemyStore) -> bool {
    store
        .get_settings()
        .map(|s| s.run_in_background_when_closed)
        .unwrap_or(true)
}

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn maybe_show_background_notification(app: &AppHandle, store: &RemyStore) {
    let already_shown = store
        .load_app_meta_flag(BACKGROUND_NOTIFICATION_SHOWN_KEY)
        .unwrap_or(false);
    if already_shown {
        return;
    }

    let _ = app
        .notification()
        .builder()
        .title("Remy")
        .body("Remy is still running in the background.")
        .show();

    let _ = store.mark_app_meta_flag(BACKGROUND_NOTIFICATION_SHOWN_KEY);
}

fn handle_close_requested(window: &tauri::WebviewWindow, store: &RemyStore) {
    let app = window.app_handle();
    maybe_show_background_notification(&app, store);
    let _ = window.hide();
}

pub fn attach_window_handler(window: &tauri::WebviewWindow) {
    let window = window.clone();
    window.clone().on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            let app = window.app_handle();
            let store = app.state::<RemyStore>();
            if run_in_background_enabled(&store) {
                api.prevent_close();
                handle_close_requested(&window, &store);
            }
        }
    });
}

pub fn handle_run_event(app: &AppHandle, event: &RunEvent) {
    match event {
        RunEvent::ExitRequested { api, code, .. } => {
            if code.is_some() {
                return;
            }
            let store = app.state::<RemyStore>();
            if run_in_background_enabled(&store) {
                api.prevent_exit();
            }
        }
        #[cfg(target_os = "macos")]
        RunEvent::Reopen {
            has_visible_windows, ..
        } => {
            if !has_visible_windows {
                show_main_window(app);
            }
        }
        _ => {}
    }
}
