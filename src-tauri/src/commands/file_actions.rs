use std::path::Path;
use std::process::Command;

#[tauri::command]
pub fn open_file_path(path: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("Empty file path".into());
    }
    if !Path::new(path).exists() {
        return Err(format!("File not found: {path}"));
    }

    open::that(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reveal_file_path(path: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("Empty file path".into());
    }
    if !Path::new(path).exists() {
        return Err(format!("File not found: {path}"));
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        if let Some(parent) = Path::new(path).parent() {
            open::that(parent).map_err(|e| e.to_string())?;
        } else {
            open::that(path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
