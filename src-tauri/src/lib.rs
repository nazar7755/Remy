mod clipboard_monitor;
mod commands;
mod content_indexer;
mod persistence;

use tauri::Manager;

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

    tauri::Builder::default()
        .manage(clipboard_monitor::ClipboardMonitor::default())
        .manage(store)
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Ok(entries) = app.state::<persistence::RemyStore>().load_clipboard_entries() {
                let _ = app
                    .state::<clipboard_monitor::ClipboardMonitor>()
                    .restore(entries);
            }
            let _ = register_watched_scopes_from_settings(&app.handle());
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
            commands::settings::get_app_settings,
            commands::settings::save_app_settings,
            commands::settings::get_memory_statistics,
            commands::settings::clear_clipboard_history,
            commands::settings::clear_indexed_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Remy");
}
