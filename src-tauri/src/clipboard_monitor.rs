use chrono::{Local, TimeZone};
use serde::Serialize;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

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
    /// Last normalized clipboard text seen during polling (for skip logging).
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

/// Trim and collapse repeated whitespace/newlines (case preserved).
pub fn normalize_clipboard_text(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn local_day_key(ms: u64) -> String {
    Local
        .timestamp_millis_opt(ms as i64)
        .single()
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

fn has_same_normalized_text_on_day(
    entries: &[ClipboardEntryDto],
    normalized: &str,
    day_key: &str,
) -> bool {
    entries.iter().any(|entry| {
        local_day_key(entry.captured_at_ms) == day_key
            && normalize_clipboard_text(&entry.text) == normalized
    })
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
            *last_text = Some(normalize_clipboard_text(&entry.text));
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
        let normalized = normalize_clipboard_text(&text);

        if normalized.is_empty() {
            return self.get_entries();
        }

        let now = now_ms();
        let today = local_day_key(now);
        let mut last_text = self.last_text.lock().map_err(|e| e.to_string())?;
        let mut last_at = self.last_captured_at_ms.lock().map_err(|e| e.to_string())?;

        let mut entries = self.entries.lock().map_err(|e| e.to_string())?;

        if has_same_normalized_text_on_day(&entries, &normalized, &today) {
            let is_new_copy_attempt = last_text.as_deref() != Some(normalized.as_str());
            if is_new_copy_attempt {
                eprintln!("Clipboard duplicate skipped");
            }
            *last_text = Some(normalized);
            *last_at = now;
            drop(entries);
            return self.get_entries();
        }

        entries.insert(
            0,
            ClipboardEntryDto {
                id: uuid::Uuid::new_v4().to_string(),
                text: normalized.clone(),
                captured_at_ms: now,
            },
        );

        if entries.len() > MAX_ENTRIES {
            entries.truncate(MAX_ENTRIES);
        }

        *last_text = Some(normalized);
        *last_at = now;

        drop(entries);
        self.get_entries()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_trims_and_collapses_whitespace() {
        assert_eq!(
            normalize_clipboard_text("  Андреа   Мальдера \n\n"),
            "Андреа Мальдера"
        );
    }

    #[test]
    fn normalize_is_case_sensitive() {
        assert_ne!(
            normalize_clipboard_text("Hello"),
            normalize_clipboard_text("hello")
        );
    }

    #[test]
    fn same_day_dedupe_blocks_second_insert() {
        let monitor = ClipboardMonitor::default();
        let now = now_ms();
        let text = "Андреа Мальдера".to_string();

        monitor
            .restore(vec![ClipboardEntryDto {
                id: "a".into(),
                text: text.clone(),
                captured_at_ms: now,
            }])
            .unwrap();

        assert!(has_same_normalized_text_on_day(
            &monitor.get_entries().unwrap(),
            &text,
            &local_day_key(now),
        ));
    }
}
