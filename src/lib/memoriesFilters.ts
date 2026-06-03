import { isClipboardItem, type MemoryItem } from '../types/memoryItem'
import type { MemoriesTypeFilter } from '../types/memoriesPage'

export function itemMatchesTypeFilter(
  item: MemoryItem,
  filter: MemoriesTypeFilter,
): boolean {
  if (filter === 'All') return true
  if (filter === 'Files') return !isClipboardItem(item)
  if (filter === 'Clipboard') return isClipboardItem(item)
  if (filter === 'PDF') return item.extension === 'pdf' || item.type === 'PDF'
  if (filter === 'DOCX') return item.extension === 'docx'
  if (filter === 'TXT') return item.extension === 'txt' || item.type === 'Text'
  if (filter === 'Images') return item.type === 'Image'
  return true
}
