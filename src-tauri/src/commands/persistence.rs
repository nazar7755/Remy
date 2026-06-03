use crate::clipboard_monitor::ClipboardMonitor;
use crate::persistence::RemyStore;
use tauri::State;

/// Load persisted clipboard history into memory without blocking the UI thread.
#[tauri::command]
pub fn hydrate_clipboard_history(
    monitor: State<'_, ClipboardMonitor>,
    store: State<'_, RemyStore>,
) -> Result<(), String> {
    let entries = store.load_clipboard_entries()?;
    monitor.restore(entries)?;
    Ok(())
}
