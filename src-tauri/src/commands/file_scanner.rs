use serde::Serialize;
use std::path::PathBuf;
use std::time::SystemTime;

/// Extensions the frontend FileScanner accepts.
const SUPPORTED: &[&str] = &[
    "pdf", "png", "jpg", "jpeg", "webp", "txt", "docx", "xlsx", "csv", "zip",
];

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ScannedFileDto {
    pub name: String,
    pub extension: String,
    pub created_at_ms: u64,
    pub size_bytes: u64,
    pub path: String,
    pub source_folder: String,
}

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub struct AllowedPathsDto {
    pub downloads: String,
    pub desktop: String,
    pub documents: String,
}

fn system_time_to_ms(time: SystemTime) -> u64 {
    time.duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn scan_directory(dir: PathBuf, source_folder: &str) -> Result<Vec<ScannedFileDto>, String> {
    let mut files = Vec::new();

    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        if !meta.is_file() {
            continue;
        }

        let path = entry.path();
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

        let extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if extension.is_empty() || !SUPPORTED.contains(&extension.as_str()) {
            continue;
        }

        let created_at_ms = meta
            .created()
            .or_else(|_| meta.modified())
            .map(system_time_to_ms)
            .unwrap_or(0);

        files.push(ScannedFileDto {
            name,
            extension,
            created_at_ms,
            size_bytes: meta.len(),
            path: path.to_string_lossy().into_owned(),
            source_folder: source_folder.to_string(),
        });
    }

    Ok(files)
}

#[tauri::command]
pub fn get_downloads_path() -> Result<String, String> {
    dirs::download_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "Downloads folder not found".into())
}

#[tauri::command]
pub fn get_desktop_path() -> Result<String, String> {
    dirs::desktop_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "Desktop folder not found".into())
}

#[tauri::command]
pub fn get_documents_path() -> Result<String, String> {
    dirs::document_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "Documents folder not found".into())
}

#[tauri::command]
pub fn get_allowed_paths() -> Result<AllowedPathsDto, String> {
    Ok(AllowedPathsDto {
        downloads: get_downloads_path()?,
        desktop: get_desktop_path()?,
        documents: get_documents_path()?,
    })
}

#[tauri::command]
pub fn scan_downloads_folder() -> Result<Vec<ScannedFileDto>, String> {
    let dir = dirs::download_dir().ok_or("Downloads folder not found")?;
    scan_directory(dir, "Downloads")
}

#[tauri::command]
pub fn scan_all_memory_folders(
    scan_downloads: bool,
    scan_desktop: bool,
    scan_documents: bool,
) -> Result<Vec<ScannedFileDto>, String> {
    let mut all = Vec::new();

    if scan_downloads {
        if let Some(dir) = dirs::download_dir() {
            all.extend(scan_directory(dir, "Downloads")?);
        }
    }
    if scan_desktop {
        if let Some(dir) = dirs::desktop_dir() {
            all.extend(scan_directory(dir, "Desktop")?);
        }
    }
    if scan_documents {
        if let Some(dir) = dirs::document_dir() {
            all.extend(scan_directory(dir, "Documents")?);
        }
    }

    all.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));
    Ok(all)
}
