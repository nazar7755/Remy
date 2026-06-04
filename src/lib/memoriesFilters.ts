import { isClipboardItem, type MemoryItem } from '../types/memoryItem'
import type {
  TimelineFolderFilter,
  TimelineTypeFilter,
} from '../types/memoriesPage'

export function itemMatchesFolderFilter(
  item: MemoryItem,
  filter: TimelineFolderFilter,
): boolean {
  if (filter === 'All') return true
  if (filter === 'Files') return !isClipboardItem(item)
  return item.source === filter
}

export function itemMatchesTypeFilter(
  item: MemoryItem,
  filter: TimelineTypeFilter,
): boolean {
  if (filter === 'All') return true
  if (filter === 'Clipboard') return isClipboardItem(item)
  if (filter === 'PDF') return item.extension === 'pdf' || item.type === 'PDF'
  if (filter === 'DOCX') return item.extension === 'docx'
  if (filter === 'TXT') return item.extension === 'txt' || item.type === 'Text'
  if (filter === 'Images') return item.type === 'Image'
  return true
}
