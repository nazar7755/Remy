use serde::{Deserialize, Serialize};

pub const SETTINGS_KEY: &str = "app_settings";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct AppSettingsDto {
    pub scan_downloads: bool,
    pub scan_desktop: bool,
    pub scan_documents: bool,
    pub file_poll_interval_ms: u32,
    pub clipboard_poll_interval_ms: u32,
    pub clipboard_enabled: bool,
    #[serde(default = "default_background_indexing_enabled")]
    pub background_indexing_enabled: bool,
    #[serde(default = "default_background_index_scope")]
    pub background_index_scope: String,
    #[serde(default = "default_background_pdf_indexing_enabled")]
    pub background_pdf_indexing_enabled: bool,
    #[serde(default = "default_background_pdf_max_size_mb")]
    pub background_pdf_max_size_mb: u32,
    #[serde(default = "default_background_pdf_delay_sec")]
    pub background_pdf_delay_sec: u32,
    #[serde(default = "default_custom_watched_folders")]
    pub custom_watched_folders: Vec<String>,
    #[serde(default = "default_run_in_background_when_closed")]
    pub run_in_background_when_closed: bool,
    #[serde(default = "default_launch_at_login")]
    pub launch_at_login: bool,
}

fn default_launch_at_login() -> bool {
    false
}

fn default_run_in_background_when_closed() -> bool {
    true
}

fn default_custom_watched_folders() -> Vec<String> {
    Vec::new()
}

fn default_background_indexing_enabled() -> bool {
    false
}

fn default_background_index_scope() -> String {
    "txt_docx".to_string()
}

fn default_background_pdf_indexing_enabled() -> bool {
    false
}

fn default_background_pdf_max_size_mb() -> u32 {
    5
}

fn default_background_pdf_delay_sec() -> u32 {
    10
}

impl Default for AppSettingsDto {
    fn default() -> Self {
        Self {
            scan_downloads: true,
            scan_desktop: true,
            scan_documents: true,
            file_poll_interval_ms: 5000,
            clipboard_poll_interval_ms: 2000,
            clipboard_enabled: true,
            background_indexing_enabled: default_background_indexing_enabled(),
            background_index_scope: default_background_index_scope(),
            background_pdf_indexing_enabled: default_background_pdf_indexing_enabled(),
            background_pdf_max_size_mb: default_background_pdf_max_size_mb(),
            background_pdf_delay_sec: default_background_pdf_delay_sec(),
            custom_watched_folders: default_custom_watched_folders(),
            run_in_background_when_closed: default_run_in_background_when_closed(),
            launch_at_login: default_launch_at_login(),
        }
    }
}

impl AppSettingsDto {
    pub fn clamp(mut self) -> Self {
        self.file_poll_interval_ms = self.file_poll_interval_ms.clamp(2000, 120_000);
        self.clipboard_poll_interval_ms = self.clipboard_poll_interval_ms.clamp(1000, 60_000);
        self.background_pdf_max_size_mb = self.background_pdf_max_size_mb.clamp(1, 50);
        self.background_pdf_delay_sec = self.background_pdf_delay_sec.clamp(5, 120);
        self.custom_watched_folders = dedupe_folder_paths(self.custom_watched_folders);
        self
    }
}

fn dedupe_folder_paths(paths: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for path in paths {
        let trimmed = path.trim().trim_end_matches(['/', '\\']).to_string();
        if trimmed.is_empty() || !seen.insert(trimmed.clone()) {
            continue;
        }
        out.push(trimmed);
    }
    out
}
