use crate::clipboard_monitor::ClipboardMonitor;
use crate::persistence::{AppSettingsDto, MemoryStatisticsDto, RemyStore};
use tauri::State;

#[tauri::command]
pub fn get_app_settings(store: State<'_, RemyStore>) -> Result<AppSettingsDto, String> {
    store.get_settings()
}

#[tauri::command]
pub fn save_app_settings(
    settings: AppSettingsDto,
    store: State<'_, RemyStore>,
) -> Result<AppSettingsDto, String> {
    store.save_settings(&settings)
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
