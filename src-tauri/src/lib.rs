mod background_mode;
mod launch_at_login;
mod clipboard_monitor;
mod commands;
mod content_indexer;
mod global_hotkey;
mod ocr_engine;
mod persistence;
mod quick_search;
mod tray;

use std::path::PathBuf;
use tauri::Manager;

fn resolve_ocr_models_dir(handle: &tauri::AppHandle) -> PathBuf {
    if let Ok(resource_dir) = handle.path().resource_dir() {
        let bundled = resource_dir.join("ocr-models");
        if bundled.join("text-detection.rten").exists() {
            return bundled;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("ocr-models")
}

fn register_core_plugins(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    let builder = builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(launch_at_login::autostart_plugin());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    let builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());

    builder
}

fn register_watched_scopes_from_settings(app: &tauri::AppHandle) -> Result<(), String> {
    let store = app.state::<persistence::RemyStore>();
    let settings = store.get_settings()?;
    let mut paths = settings.custom_watched_folders;

    if settings.scan_downloads {
        if let Some(dir) = dirs::download_dir() {
            paths.push(dir.to_string_lossy().into_owned());
        }
    }
    if settings.scan_desktop {
        if let Some(dir) = dirs::desktop_dir() {
            paths.push(dir.to_string_lossy().into_owned());
        }
    }
    if settings.scan_documents {
        if let Some(dir) = dirs::document_dir() {
            paths.push(dir.to_string_lossy().into_owned());
        }
    }

    commands::file_scanner::register_watched_folder_scopes(app.clone(), paths)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let store = persistence::RemyStore::open().expect("failed to open Remy local store");

    register_core_plugins(tauri::Builder::default())
        .manage(clipboard_monitor::ClipboardMonitor::default())
        .manage(store)
        .manage(global_hotkey::GlobalHotkeyState::new())
        .setup(|app| {
            let models_dir = resolve_ocr_models_dir(&app.handle());
            ocr_engine::init(&models_dir);

            if let Ok(entries) = app.state::<persistence::RemyStore>().load_clipboard_entries() {
                let _ = app
                    .state::<clipboard_monitor::ClipboardMonitor>()
                    .restore(entries);
            }
            let _ = register_watched_scopes_from_settings(&app.handle());
            launch_at_login::hide_main_window_if_background_launch(&app.handle());
            if let Ok(settings) = app.state::<persistence::RemyStore>().get_settings() {
                let _ = launch_at_login::sync_launch_at_login(&app.handle(), settings.launch_at_login);
            }
            if let Some(window) = app.get_webview_window("main") {
                background_mode::attach_window_handler(&window);
            }
            if let Some(window) = app.get_webview_window(quick_search::QUICK_SEARCH_LABEL) {
                quick_search::attach_window_handler(&window);
            }
            if let Err(err) = tray::setup_tray(&app.handle()) {
                eprintln!("failed to create tray icon: {err}");
            }
            global_hotkey::setup(&app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::file_scanner::get_downloads_path,
            commands::file_scanner::get_desktop_path,
            commands::file_scanner::get_documents_path,
            commands::file_scanner::get_allowed_paths,
            commands::file_scanner::scan_downloads_folder,
            commands::file_scanner::scan_all_memory_folders,
            commands::file_scanner::register_watched_folder_scopes,
            commands::file_actions::open_file_path,
            commands::file_actions::reveal_file_path,
            commands::content_index::index_file_content,
            commands::content_index::lookup_file_index_cache,
            commands::content_index::clear_file_index,
            commands::clipboard::poll_clipboard,
            commands::clipboard::get_clipboard_entries,
            commands::persistence::hydrate_clipboard_history,
            commands::favorites::get_favorites,
            commands::favorites::set_favorite,
            commands::tags::get_memory_tag_assignments,
            commands::tags::add_memory_tag,
            commands::tags::remove_memory_tag,
            commands::tags::get_tag_statistics,
            commands::settings::get_app_settings,
            commands::settings::save_app_settings,
            commands::settings::get_memory_statistics,
            commands::settings::clear_clipboard_history,
            commands::settings::clear_indexed_content,
            global_hotkey::get_global_hotkey_status,
            quick_search::hide_quick_search_overlay,
            quick_search::open_memory_in_main_app,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Remy")
        .run(|app_handle, event| {
            background_mode::handle_run_event(app_handle, &event);
        });
}
