use serde::Serialize;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const DEDUPE_WINDOW_MS: u64 = 30_000;
const MAX_ENTRIES: usize = 500;

#[derive(Clone, Serialize)]
#[serde(rename_all = "snake_case")]
pub struct ClipboardEntryDto {
    pub id: String,
    pub text: String,
    pub captured_at_ms: u64,
}

pub struct ClipboardMonitor {
    entries: Mutex<Vec<ClipboardEntryDto>>,
    last_text: Mutex<Option<String>>,
    last_captured_at_ms: Mutex<u64>,
}

impl Default for ClipboardMonitor {
    fn default() -> Self {
        Self {
            entries: Mutex::new(Vec::new()),
            last_text: Mutex::new(None),
            last_captured_at_ms: Mutex::new(0),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

impl ClipboardMonitor {
    /// Restore in-memory clipboard history from disk (startup hydration).
    pub fn restore(&self, entries: Vec<ClipboardEntryDto>) -> Result<(), String> {
        let mut stored = self.entries.lock().map_err(|e| e.to_string())?;
        *stored = entries;

        let newest = stored.first();
        let mut last_text = self.last_text.lock().map_err(|e| e.to_string())?;
        let mut last_at = self.last_captured_at_ms.lock().map_err(|e| e.to_string())?;

        if let Some(entry) = newest {
            *last_text = Some(entry.text.clone());
            *last_at = entry.captured_at_ms;
        } else {
            *last_text = None;
            *last_at = 0;
        }

        Ok(())
    }

    /// Return a clone of all stored clipboard entries (newest first).
    pub fn get_entries(&self) -> Result<Vec<ClipboardEntryDto>, String> {
        self.entries
            .lock()
            .map_err(|e| e.to_string())
            .map(|entries| entries.clone())
    }

    /// Read system clipboard, append new text entries, return full in-memory list.
    pub fn poll(&self) -> Result<Vec<ClipboardEntryDto>, String> {
        let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
        let text = clipboard.get_text().map_err(|e| e.to_string())?;
        let trimmed = text.trim();

        if trimmed.is_empty() {
            return self.get_entries();
        }

        let now = now_ms();
        let mut last_text = self.last_text.lock().map_err(|e| e.to_string())?;
        let mut last_at = self.last_captured_at_ms.lock().map_err(|e| e.to_string())?;

        let is_duplicate = last_text.as_ref() == Some(&text)
            && now.saturating_sub(*last_at) < DEDUPE_WINDOW_MS;

        if !is_duplicate {
            let mut entries = self.entries.lock().map_err(|e| e.to_string())?;

            let skip_from_history = entries.last().map(|entry| {
                entry.text == text && now.saturating_sub(entry.captured_at_ms) < DEDUPE_WINDOW_MS
            }).unwrap_or(false);

            if !skip_from_history {
                entries.insert(
                    0,
                    ClipboardEntryDto {
                        id: uuid::Uuid::new_v4().to_string(),
                        text: text.clone(),
                        captured_at_ms: now,
                    },
                );

                if entries.len() > MAX_ENTRIES {
                    entries.truncate(MAX_ENTRIES);
                }
            }

            *last_text = Some(text);
            *last_at = now;
        }

        self.get_entries()
    }
}
