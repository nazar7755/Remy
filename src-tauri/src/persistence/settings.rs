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
