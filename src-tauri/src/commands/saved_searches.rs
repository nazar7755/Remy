use crate::persistence::{RemyStore, SavedSearchDto};
use tauri::State;

#[tauri::command]
pub fn get_saved_searches(store: State<'_, RemyStore>) -> Result<Vec<SavedSearchDto>, String> {
    store.load_saved_searches()
}

#[tauri::command]
pub fn create_saved_search(
    name: String,
    query: String,
    store: State<'_, RemyStore>,
) -> Result<SavedSearchDto, String> {
    store.create_saved_search(&name, &query)
}

#[tauri::command]
pub fn rename_saved_search(
    id: String,
    name: String,
    store: State<'_, RemyStore>,
) -> Result<(), String> {
    store.rename_saved_search(&id, &name)
}

#[tauri::command]
pub fn delete_saved_search(id: String, store: State<'_, RemyStore>) -> Result<(), String> {
    store.delete_saved_search(&id)
}
