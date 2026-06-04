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
}

fn default_background_indexing_enabled() -> bool {
    false
}

fn default_background_index_scope() -> String {
    "txt_docx".to_string()
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
        }
    }
}

impl AppSettingsDto {
    pub fn clamp(mut self) -> Self {
        self.file_poll_interval_ms = self
            .file_poll_interval_ms
            .clamp(2000, 120_000);
        self.clipboard_poll_interval_ms = self
            .clipboard_poll_interval_ms
            .clamp(1000, 60_000);
        self
    }
}
