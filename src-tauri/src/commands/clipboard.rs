use crate::clipboard_monitor::{ClipboardEntryDto, ClipboardMonitor};
use crate::persistence::RemyStore;
use tauri::State;

#[tauri::command]
pub fn poll_clipboard(
    monitor: State<'_, ClipboardMonitor>,
    store: State<'_, RemyStore>,
) -> Result<Vec<ClipboardEntryDto>, String> {
    let entries = monitor.poll()?;
    store.replace_clipboard_entries(&entries)?;
    Ok(entries)
}

#[tauri::command]
pub fn get_clipboard_entries(
    monitor: State<'_, ClipboardMonitor>,
) -> Result<Vec<ClipboardEntryDto>, String> {
    monitor.get_entries()
}
