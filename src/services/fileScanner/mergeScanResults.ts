import { normalizeFilePath } from '../../lib/filePaths'
import type { MemoryItem } from '../../types/memoryItem'

/** Apply a metadata scan while preserving in-memory content index state. */
export function mergeScanResults(
  previous: MemoryItem[],
  scanned: MemoryItem[],
): MemoryItem[] {
  const previousByPath = new Map(
    previous.map((item) => [normalizeFilePath(item.filePath), item]),
  )

  return scanned.map((item) => {
    const existing = previousByPath.get(normalizeFilePath(item.filePath))
    if (!existing) return item

    if (existing.indexStatus === 'loading') {
      return {
        ...item,
        content: existing.content,
        indexStatus: 'loading',
        indexError: existing.indexError,
        indexedCharCount: existing.indexedCharCount,
        indexedAt: existing.indexedAt,
        indexedAtIso: existing.indexedAtIso,
        isFavorite: existing.isFavorite,
      }
    }

    return {
      ...item,
      content: existing.content,
      indexStatus: existing.indexStatus,
      indexError: existing.indexError,
      indexedCharCount: existing.indexedCharCount,
      indexedAt: existing.indexedAt,
      indexedAtIso: existing.indexedAtIso,
      isFavorite: existing.isFavorite,
    }
  })
}
