import { isClipboardItem, type MemoryItem } from '../types/memoryItem'

function truncate(text: string, maxLen: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLen) return normalized
  return `${normalized.slice(0, maxLen - 1)}…`
}

/** Short preview for Memories browse view (not search highlighting). */
export function getMemoryPreview(item: MemoryItem, maxLen = 120): string {
  if (isClipboardItem(item) && item.content) {
    return truncate(item.content, maxLen)
  }

  if (item.indexStatus === 'indexed' && item.content) {
    return truncate(item.content, maxLen)
  }

  if (!isClipboardItem(item)) {
    return item.filePath
  }

  return ''
}
