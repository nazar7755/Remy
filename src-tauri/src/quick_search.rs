use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, WindowEvent};

pub const QUICK_SEARCH_LABEL: &str = "quick-search";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenMemoryPayload {
    pub id: String,
    pub file_name: String,
}

fn fallback_to_main<R: Runtime>(app: &AppHandle<R>) {
    crate::background_mode::show_main_window(app);
    let _ = app.emit("focus-global-search", ());
}

pub fn show_quick_search<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(QUICK_SEARCH_LABEL) else {
        eprintln!("quick-search window not found; falling back to main window");
        fallback_to_main(app);
        return;
    };

    if window.is_visible().unwrap_or(false) {
        let _ = window.set_focus();
        let _ = app.emit_to(QUICK_SEARCH_LABEL, "focus-quick-search", ());
        return;
    }

    if let Err(err) = window.center() {
        eprintln!("quick-search center failed: {err}");
    }
    if let Err(err) = window.show() {
        eprintln!("quick-search show failed: {err}; falling back to main window");
        fallback_to_main(app);
        return;
    }
    if let Err(err) = window.set_focus() {
        eprintln!("quick-search focus failed: {err}");
    }
    let _ = app.emit_to(QUICK_SEARCH_LABEL, "focus-quick-search", ());
}

pub fn hide_quick_search<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let window = app
        .get_webview_window(QUICK_SEARCH_LABEL)
        .ok_or_else(|| "quick-search window not found".to_string())?;
    window.hide().map_err(|err| err.to_string())
}

#[tauri::command]
pub fn hide_quick_search_overlay(app: AppHandle) -> Result<(), String> {
    hide_quick_search(&app)
}

#[tauri::command]
pub fn open_memory_in_main_app(
    app: AppHandle,
    id: String,
    file_name: String,
) -> Result<(), String> {
    let _ = hide_quick_search(&app);
    crate::background_mode::show_main_window(&app);
    let _ = app.emit(
        "open-memory-in-main",
        OpenMemoryPayload { id, file_name },
    );
    Ok(())
}

pub fn attach_window_handler(window: &tauri::WebviewWindow) {
    let window = window.clone();
    window.clone().on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = window.hide();
        }
    });
}
