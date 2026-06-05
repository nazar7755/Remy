use crate::clipboard_monitor::ClipboardMonitor;
use crate::launch_at_login;
use crate::persistence::{AppSettingsDto, MemoryStatisticsDto, RemyStore};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_app_settings(store: State<'_, RemyStore>) -> Result<AppSettingsDto, String> {
    store.get_settings()
}

#[tauri::command]
pub fn save_app_settings(
    settings: AppSettingsDto,
    app: AppHandle,
    store: State<'_, RemyStore>,
) -> Result<AppSettingsDto, String> {
    let saved = store.save_settings(&settings)?;
    launch_at_login::sync_launch_at_login(&app, saved.launch_at_login)?;
    Ok(saved)
}

#[tauri::command]
pub fn get_memory_statistics(
    store: State<'_, RemyStore>,
) -> Result<MemoryStatisticsDto, String> {
    store.memory_statistics()
}

#[tauri::command]
pub fn clear_clipboard_history(
    monitor: State<'_, ClipboardMonitor>,
    store: State<'_, RemyStore>,
) -> Result<(), String> {
    store.clear_clipboard_entries()?;
    monitor.restore(vec![])?;
    Ok(())
}

#[tauri::command]
pub fn clear_indexed_content(store: State<'_, RemyStore>) -> Result<(), String> {
    store.clear_file_index_cache()
}
