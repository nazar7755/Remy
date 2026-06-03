use crate::clipboard_monitor::ClipboardEntryDto;
use crate::persistence::settings::{AppSettingsDto, SETTINGS_KEY};
use rusqlite::{params, Connection};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const CLIPBOARD_MAX_ENTRIES: usize = 500;

pub struct RemyStore {
    conn: Mutex<Connection>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub struct FileIndexCacheDto {
    pub file_path: String,
    pub content: String,
    pub indexed_at_ms: u64,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub struct MemoryStatisticsDto {
    pub clipboard_entries: u64,
    pub indexed_files: u64,
    pub total_indexed_characters: u64,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteSnapshotDto {
    pub id: String,
    pub file_name: String,
    pub file_path: String,
    pub source: String,
    #[serde(rename = "type")]
    pub memory_type: String,
    pub extension: String,
    pub created_at: String,
    pub created_at_iso: String,
    pub file_size: String,
    pub file_size_bytes: u64,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub struct FavoriteDto {
    pub memory_id: String,
    pub favorited_at_ms: u64,
    pub snapshot: FavoriteSnapshotDto,
}

impl RemyStore {
    pub fn open() -> Result<Self, String> {
        let path = Self::database_path()?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let conn = Connection::open(&path).map_err(|e| e.to_string())?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS clipboard_entries (
                id TEXT PRIMARY KEY NOT NULL,
                text TEXT NOT NULL,
                captured_at_ms INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_clipboard_captured
                ON clipboard_entries (captured_at_ms DESC);

            CREATE TABLE IF NOT EXISTS file_index_cache (
                file_path TEXT PRIMARY KEY NOT NULL,
                content TEXT NOT NULL,
                file_mtime_ms INTEGER NOT NULL,
                file_size INTEGER NOT NULL,
                indexed_at_ms INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS favorites (
                memory_id TEXT PRIMARY KEY NOT NULL,
                favorited_at_ms INTEGER NOT NULL,
                snapshot_json TEXT NOT NULL DEFAULT '{}'
            );
            ",
        )
        .map_err(|e| e.to_string())?;

        let _ = conn.execute(
            "ALTER TABLE favorites ADD COLUMN snapshot_json TEXT NOT NULL DEFAULT '{}'",
            [],
        );

        let store = Self {
            conn: Mutex::new(conn),
        };
        let _ = store.ensure_default_settings();
        let _ = store.drop_favorites_without_snapshot();
        Ok(store)
    }

    fn ensure_default_settings(&self) -> Result<(), String> {
        if self.load_settings()?.is_none() {
            self.save_settings(&AppSettingsDto::default())?;
        }
        Ok(())
    }

    pub fn load_settings(&self) -> Result<Option<AppSettingsDto>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let json: Option<String> = conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                params![SETTINGS_KEY],
                |row| row.get(0),
            )
            .ok();

        let Some(json) = json else {
            return Ok(None);
        };

        let parsed: AppSettingsDto =
            serde_json::from_str(&json).map_err(|e| e.to_string())?;
        Ok(Some(parsed.clamp()))
    }

    pub fn save_settings(&self, settings: &AppSettingsDto) -> Result<AppSettingsDto, String> {
        let clamped = settings.clone().clamp();
        let json = serde_json::to_string(&clamped).map_err(|e| e.to_string())?;
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![SETTINGS_KEY, json],
        )
        .map_err(|e| e.to_string())?;
        Ok(clamped)
    }

    pub fn get_settings(&self) -> Result<AppSettingsDto, String> {
        Ok(self
            .load_settings()?
            .unwrap_or_default()
            .clamp())
    }

    pub fn clear_clipboard_entries(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM clipboard_entries", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn drop_favorites_without_snapshot(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM favorites WHERE snapshot_json IS NULL OR snapshot_json = '' OR snapshot_json = '{}'",
            [],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn load_favorites(&self) -> Result<Vec<FavoriteDto>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT memory_id, favorited_at_ms, snapshot_json
                 FROM favorites
                 WHERE snapshot_json IS NOT NULL AND snapshot_json != '' AND snapshot_json != '{}'
                 ORDER BY favorited_at_ms DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut out = Vec::new();
        for row in rows {
            let (memory_id, favorited_at_ms, snapshot_json) =
                row.map_err(|e| e.to_string())?;
            let snapshot: FavoriteSnapshotDto =
                serde_json::from_str(&snapshot_json).map_err(|e| e.to_string())?;
            out.push(FavoriteDto {
                memory_id,
                favorited_at_ms: favorited_at_ms.max(0) as u64,
                snapshot,
            });
        }
        Ok(out)
    }

    pub fn set_favorite(
        &self,
        memory_id: &str,
        favorited: bool,
        snapshot: Option<FavoriteSnapshotDto>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        if favorited {
            let snap = snapshot.ok_or_else(|| {
                "Favorite snapshot is required when adding a favorite".to_string()
            })?;
            let snapshot_json =
                serde_json::to_string(&snap).map_err(|e| e.to_string())?;
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            conn.execute(
                "INSERT INTO favorites (memory_id, favorited_at_ms, snapshot_json)
                 VALUES (?1, ?2, ?3)
                 ON CONFLICT(memory_id) DO UPDATE SET
                    favorited_at_ms = excluded.favorited_at_ms,
                    snapshot_json = excluded.snapshot_json",
                params![memory_id, now as i64, snapshot_json],
            )
            .map_err(|e| e.to_string())?;
        } else {
            conn.execute(
                "DELETE FROM favorites WHERE memory_id = ?1",
                params![memory_id],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn clear_file_index_cache(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM file_index_cache", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn count_clipboard_entries(&self) -> Result<u64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT COUNT(*) FROM clipboard_entries",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())
    }

    pub fn count_indexed_files(&self) -> Result<u64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT COUNT(*) FROM file_index_cache",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())
    }

    pub fn total_indexed_characters(&self) -> Result<u64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT COALESCE(SUM(LENGTH(content)), 0) FROM file_index_cache",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())
    }

    pub fn memory_statistics(&self) -> Result<MemoryStatisticsDto, String> {
        Ok(MemoryStatisticsDto {
            clipboard_entries: self.count_clipboard_entries()?,
            indexed_files: self.count_indexed_files()?,
            total_indexed_characters: self.total_indexed_characters()?,
        })
    }

    pub fn clear_file_index(&self, file_path: &str) -> Result<(), String> {
        self.delete_file_index(file_path)
    }

    fn database_path() -> Result<PathBuf, String> {
        let base = dirs::data_local_dir().ok_or_else(|| {
            "Could not resolve local data directory for Remy persistence".to_string()
        })?;
        Ok(base.join("com.remy.app").join("remy.sqlite"))
    }

    pub fn load_clipboard_entries(&self) -> Result<Vec<ClipboardEntryDto>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, text, captured_at_ms
                 FROM clipboard_entries
                 ORDER BY captured_at_ms DESC
                 LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![CLIPBOARD_MAX_ENTRIES as i64], |row| {
                Ok(ClipboardEntryDto {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    captured_at_ms: row.get::<_, i64>(2)? as u64,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }

    pub fn replace_clipboard_entries(&self, entries: &[ClipboardEntryDto]) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

        tx.execute("DELETE FROM clipboard_entries", [])
            .map_err(|e| e.to_string())?;

        let mut insert = tx
            .prepare(
                "INSERT INTO clipboard_entries (id, text, captured_at_ms)
                 VALUES (?1, ?2, ?3)",
            )
            .map_err(|e| e.to_string())?;

        for entry in entries.iter().take(CLIPBOARD_MAX_ENTRIES) {
            insert
                .execute(params![
                    entry.id,
                    entry.text,
                    entry.captured_at_ms as i64
                ])
                .map_err(|e| e.to_string())?;
        }

        drop(insert);
        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn lookup_file_index(
        &self,
        file_path: &str,
    ) -> Result<Option<FileIndexCacheDto>, String> {
        let path = Path::new(file_path);
        if !path.is_file() {
            let _ = self.delete_file_index(file_path);
            return Ok(None);
        }

        let meta = fs::metadata(path).map_err(|e| e.to_string())?;
        let (mtime_ms, size) = file_metadata_fields(&meta)?;

        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let cached: Option<(String, i64, i64, i64)> = conn
            .query_row(
                "SELECT content, file_mtime_ms, file_size, indexed_at_ms
                 FROM file_index_cache
                 WHERE file_path = ?1",
                params![file_path],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .ok();

        let Some((content, cached_mtime, cached_size, indexed_at_ms)) = cached else {
            return Ok(None);
        };

        if cached_mtime == mtime_ms as i64 && cached_size == size as i64 {
            return Ok(Some(FileIndexCacheDto {
                file_path: file_path.to_string(),
                content,
                indexed_at_ms: indexed_at_ms.max(0) as u64,
            }));
        }

        drop(conn);
        self.delete_file_index(file_path)?;
        Ok(None)
    }

    pub fn lookup_file_indexes(
        &self,
        file_paths: Vec<String>,
    ) -> Result<Vec<FileIndexCacheDto>, String> {
        let mut hits = Vec::new();
        for path in file_paths {
            if let Some(entry) = self.lookup_file_index(&path)? {
                hits.push(entry);
            }
        }
        Ok(hits)
    }

    pub fn save_file_index(
        &self,
        file_path: &str,
        content: &str,
        file_mtime_ms: u64,
        file_size: u64,
    ) -> Result<(), String> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO file_index_cache (file_path, content, file_mtime_ms, file_size, indexed_at_ms)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(file_path) DO UPDATE SET
                content = excluded.content,
                file_mtime_ms = excluded.file_mtime_ms,
                file_size = excluded.file_size,
                indexed_at_ms = excluded.indexed_at_ms",
            params![
                file_path,
                content,
                file_mtime_ms as i64,
                file_size as i64,
                now as i64
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn delete_file_index(&self, file_path: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM file_index_cache WHERE file_path = ?1",
            params![file_path],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}

pub fn file_metadata_fields(meta: &fs::Metadata) -> Result<(u64, u64), String> {
    let modified = meta.modified().map_err(|e| e.to_string())?;
    let mtime_ms = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis() as u64;
    Ok((mtime_ms, meta.len()))
}
