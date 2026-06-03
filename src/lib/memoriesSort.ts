import type { MemoryItem } from '../types/memoryItem'
import type { MemoriesSortOption } from '../types/memoriesPage'

export function sortMemoryItems(
  items: MemoryItem[],
  sort: MemoriesSortOption,
): MemoryItem[] {
  const sorted = [...items]

  switch (sort) {
    case 'oldest':
      sorted.sort(
        (a, b) =>
          new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime(),
      )
      break
    case 'name-asc':
      sorted.sort((a, b) =>
        a.fileName.localeCompare(b.fileName, undefined, { sensitivity: 'base' }),
      )
      break
    case 'name-desc':
      sorted.sort((a, b) =>
        b.fileName.localeCompare(a.fileName, undefined, { sensitivity: 'base' }),
      )
      break
    case 'size-desc':
      sorted.sort((a, b) => b.fileSizeBytes - a.fileSizeBytes)
      break
    case 'size-asc':
      sorted.sort((a, b) => a.fileSizeBytes - b.fileSizeBytes)
      break
    case 'newest':
    default:
      sorted.sort(
        (a, b) =>
          new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime(),
      )
      break
  }

  return sorted
}
