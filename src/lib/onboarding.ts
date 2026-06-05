import type { MemoryItem } from '../types/memoryItem'

/** True when Remy has no memories to show (files + clipboard). */
export function hasNoMemories(
  items: MemoryItem[],
  loading: boolean,
  previewEmpty: boolean,
): boolean {
  if (previewEmpty) return true
  if (loading) return false
  return items.length === 0
}
