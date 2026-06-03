import { isIndexedFile } from './contentSearch'
import type { MemoryItem } from '../types/memoryItem'

/** Files with extracted index text currently loaded in memory (all sources). */
export function resolveIndexedItems(items: MemoryItem[] | undefined): MemoryItem[] {
  if (!items?.length) return []
  return items.filter(isIndexedFile)
}
