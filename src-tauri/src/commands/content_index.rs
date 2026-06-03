use crate::content_indexer;
use crate::persistence::{file_metadata_fields, FileIndexCacheDto, RemyStore};
use std::path::Path;
use tauri::State;

#[tauri::command]
pub fn index_file_content(
    path: String,
    force: Option<bool>,
    store: State<'_, RemyStore>,
) -> Result<Option<String>, String> {
    let file_path = Path::new(&path);
    if !file_path.is_file() {
        return Err(format!("File not found: {path}"));
    }

    let extension = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !content_indexer::is_indexable(&extension) {
        return Ok(None);
    }

    if force.unwrap_or(false) {
        store.clear_file_index(&path)?;
    } else if let Some(cached) = store.lookup_file_index(&path)? {
        return Ok(Some(cached.content));
    }

    let meta = std::fs::metadata(file_path).map_err(|e| e.to_string())?;
    let (mtime_ms, file_size) = file_metadata_fields(&meta)?;

    let content = content_indexer::extract_text(file_path, &extension);
    if let Some(ref text) = content {
        store.save_file_index(&path, text, mtime_ms, file_size)?;
    }

    Ok(content)
}

#[tauri::command]
pub fn lookup_file_index_cache(
    paths: Vec<String>,
    store: State<'_, RemyStore>,
) -> Result<Vec<FileIndexCacheDto>, String> {
    store.lookup_file_indexes(paths)
}

#[tauri::command]
pub fn clear_file_index(path: String, store: State<'_, RemyStore>) -> Result<(), String> {
    store.clear_file_index(&path)
}
