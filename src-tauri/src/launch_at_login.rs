use tauri::{AppHandle, Manager, Runtime};

#[cfg(target_os = "macos")]
use tauri_plugin_autostart::ManagerExt;

pub const BACKGROUND_LAUNCH_ARG: &str = "--background-launch";

pub fn is_background_launch() -> bool {
    std::env::args().any(|arg| arg == BACKGROUND_LAUNCH_ARG)
}

pub fn hide_main_window_if_background_launch<R: Runtime>(app: &AppHandle<R>) {
    if !is_background_launch() {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[cfg(target_os = "macos")]
pub fn sync_launch_at_login<R: Runtime>(
    app: &AppHandle<R>,
    enabled: bool,
) -> Result<(), String> {
    let autolaunch = app.autolaunch();
    let currently_enabled = autolaunch.is_enabled().map_err(|e| e.to_string())?;

    if enabled && !currently_enabled {
        autolaunch.enable().map_err(|e| e.to_string())?;
    } else if !enabled && currently_enabled {
        autolaunch.disable().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn sync_launch_at_login<R: Runtime>(
    _app: &AppHandle<R>,
    _enabled: bool,
) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn autostart_plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri_plugin_autostart::init(
        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
        Some(vec![BACKGROUND_LAUNCH_ARG]),
    )
}

#[cfg(not(target_os = "macos"))]
pub fn autostart_plugin<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("launch-at-login-stub").build()
}
