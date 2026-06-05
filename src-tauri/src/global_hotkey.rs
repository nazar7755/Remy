use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub const OPEN_SEARCH_SHORTCUT: &str = "Command+Shift+Space";
pub const OPEN_SEARCH_SHORTCUT_DISPLAY: &str = "Cmd + Shift + Space";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalHotkeyStatus {
    pub shortcut: String,
    pub registered: bool,
    pub error: Option<String>,
}

pub struct GlobalHotkeyState {
    status: Mutex<GlobalHotkeyStatus>,
}

impl GlobalHotkeyState {
    pub fn new() -> Self {
        Self {
            status: Mutex::new(GlobalHotkeyStatus {
                shortcut: OPEN_SEARCH_SHORTCUT_DISPLAY.to_string(),
                registered: false,
                error: None,
            }),
        }
    }
}

fn on_hotkey_pressed<R: Runtime>(app: &AppHandle<R>) {
    crate::background_mode::show_main_window(app);
    let _ = app.emit("focus-global-search", ());
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn setup<R: Runtime>(app: &AppHandle<R>) {
    let shortcut = match OPEN_SEARCH_SHORTCUT.parse::<Shortcut>() {
        Ok(shortcut) => shortcut,
        Err(err) => {
            record_registration_failure(app, err.to_string());
            return;
        }
    };

    match app.global_shortcut().on_shortcut(shortcut, |app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            on_hotkey_pressed(app);
        }
    }) {
        Ok(_) => record_registration_success(app),
        Err(err) => {
            eprintln!("global hotkey registration failed: {err}");
            record_registration_failure(app, err.to_string());
        }
    }
}

#[cfg(any(target_os = "android", target_os = "ios"))]
pub fn setup<R: Runtime>(_app: &AppHandle<R>) {}

fn record_registration_success<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(mut status) = app.state::<GlobalHotkeyState>().status.lock() {
        status.registered = true;
        status.error = None;
    }
}

fn record_registration_failure<R: Runtime>(app: &AppHandle<R>, message: String) {
    if let Ok(mut status) = app.state::<GlobalHotkeyState>().status.lock() {
        status.registered = false;
        status.error = Some(message);
    }
}

#[tauri::command]
pub fn get_global_hotkey_status(
    state: State<'_, GlobalHotkeyState>,
) -> Result<GlobalHotkeyStatus, String> {
    state
        .status
        .lock()
        .map(|status| status.clone())
        .map_err(|err| err.to_string())
}
