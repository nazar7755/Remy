use crate::persistence::{FavoriteDto, FavoriteSnapshotDto, RemyStore};
use tauri::State;

#[tauri::command]
pub fn get_favorites(store: State<'_, RemyStore>) -> Result<Vec<FavoriteDto>, String> {
    store.load_favorites()
}

#[tauri::command]
pub fn set_favorite(
    memory_id: String,
    favorited: bool,
    snapshot: Option<FavoriteSnapshotDto>,
    store: State<'_, RemyStore>,
) -> Result<(), String> {
    store.set_favorite(&memory_id, favorited, snapshot)
}
