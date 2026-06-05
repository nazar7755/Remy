use crate::persistence::{MemoryTagAssignmentDto, RemyStore, TagStatisticsDto};
use tauri::State;

#[tauri::command]
pub fn get_memory_tag_assignments(
    store: State<'_, RemyStore>,
) -> Result<Vec<MemoryTagAssignmentDto>, String> {
    store.load_memory_tag_assignments()
}

#[tauri::command]
pub fn add_memory_tag(
    memory_id: String,
    tag_name: String,
    store: State<'_, RemyStore>,
) -> Result<(), String> {
    store.add_memory_tag(&memory_id, &tag_name)
}

#[tauri::command]
pub fn remove_memory_tag(
    memory_id: String,
    tag_name: String,
    store: State<'_, RemyStore>,
) -> Result<(), String> {
    store.remove_memory_tag(&memory_id, &tag_name)
}

#[tauri::command]
pub fn get_tag_statistics(store: State<'_, RemyStore>) -> Result<TagStatisticsDto, String> {
    store.tag_statistics()
}
