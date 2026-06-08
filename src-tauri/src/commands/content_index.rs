use crate::content_indexer;
use crate::persistence::{file_metadata_fields, FileIndexCacheDto, FileIndexFailureDto, RemyStore};
use std::path::Path;
use tauri::State;

const EMPTY_CONTENT_REASON: &str = "No extractable text found in file";

fn record_index_failure(
    store: &RemyStore,
    path: &str,
    extension: &str,
    reason: &str,
    mtime_ms: u64,
    file_size: u64,
) -> Result<(), String> {
    store.save_file_index_failure(path, extension, reason, mtime_ms, file_size)
}

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
    } else if store.lookup_file_index_failure(&path)?.is_some() {
        return Err(content_indexer::INDEXING_FAILED_USER_MSG.to_string());
    }

    let meta = std::fs::metadata(file_path).map_err(|e| e.to_string())?;
    let (mtime_ms, file_size) = file_metadata_fields(&meta)?;

    if crate::ocr_engine::is_ocr_image(&extension)
        && file_size > crate::ocr_engine::OCR_ABSOLUTE_MAX_FILE_BYTES
    {
        return Err(format!(
            "Image exceeds maximum size ({} MB)",
            crate::ocr_engine::OCR_ABSOLUTE_MAX_FILE_BYTES / (1024 * 1024)
        ));
    }

    if extension == "pdf" {
        return match content_indexer::extract_pdf_for_index(file_path) {
            Ok(Some(text)) => {
                store.save_file_index(&path, &text, mtime_ms, file_size)?;
                store.clear_file_index_failure(&path)?;
                Ok(Some(text))
            }
            Ok(None) => {
                record_index_failure(
                    &store,
                    &path,
                    &extension,
                    EMPTY_CONTENT_REASON,
                    mtime_ms,
                    file_size,
                )?;
                Err(content_indexer::INDEXING_FAILED_USER_MSG.to_string())
            }
            Err(internal_reason) => {
                record_index_failure(
                    &store,
                    &path,
                    &extension,
                    &internal_reason,
                    mtime_ms,
                    file_size,
                )?;
                Err(content_indexer::INDEXING_FAILED_USER_MSG.to_string())
            }
        };
    }

    match content_indexer::extract_text(file_path, &extension) {
        Ok(Some(text)) => {
            store.save_file_index(&path, &text, mtime_ms, file_size)?;
            store.clear_file_index_failure(&path)?;
            Ok(Some(text))
        }
        Ok(None) => {
            record_index_failure(
                &store,
                &path,
                &extension,
                EMPTY_CONTENT_REASON,
                mtime_ms,
                file_size,
            )?;
            Err(content_indexer::INDEXING_FAILED_USER_MSG.to_string())
        }
        Err(internal_reason) => {
            record_index_failure(
                &store,
                &path,
                &extension,
                &internal_reason,
                mtime_ms,
                file_size,
            )?;
            Err(content_indexer::INDEXING_FAILED_USER_MSG.to_string())
        }
    }
}

#[tauri::command]
pub fn lookup_file_index_cache(
    paths: Vec<String>,
    store: State<'_, RemyStore>,
) -> Result<Vec<FileIndexCacheDto>, String> {
    store.lookup_file_indexes(paths)
}

#[tauri::command]
pub fn lookup_file_index_failures(
    paths: Vec<String>,
    store: State<'_, RemyStore>,
) -> Result<Vec<FileIndexFailureDto>, String> {
    store.lookup_file_index_failures(paths)
}

#[tauri::command]
pub fn clear_file_index(path: String, store: State<'_, RemyStore>) -> Result<(), String> {
    store.clear_file_index(&path)
}
