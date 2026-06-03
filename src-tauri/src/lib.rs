mod clipboard_monitor;
mod commands;
mod content_indexer;
mod persistence;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let store = persistence::RemyStore::open().expect("failed to open Remy local store");

    tauri::Builder::default()
        .manage(clipboard_monitor::ClipboardMonitor::default())
        .manage(store)
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            if let Ok(entries) = app.state::<persistence::RemyStore>().load_clipboard_entries() {
                let _ = app
                    .state::<clipboard_monitor::ClipboardMonitor>()
                    .restore(entries);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::file_scanner::get_downloads_path,
            commands::file_scanner::get_desktop_path,
            commands::file_scanner::get_documents_path,
            commands::file_scanner::get_allowed_paths,
            commands::file_scanner::scan_downloads_folder,
            commands::file_scanner::scan_all_memory_folders,
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
