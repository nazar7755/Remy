import type { MemoryItem, SourceFilter } from '../types/memoryItem'
import { isClipboardItem } from '../types/memoryItem'

export function isIndexedFile(item: MemoryItem): boolean {
  return (
    !isClipboardItem(item) &&
    item.indexStatus === 'indexed' &&
    item.content !== null &&
    item.content.length > 0
  )
}

export interface MemorySearchResult {
  item: MemoryItem
  snippet: string | null
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function itemMatchesQuery(item: MemoryItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  if (item.fileName.toLowerCase().includes(q)) return true
  if (item.filePath.toLowerCase().includes(q)) return true
  if (item.extension.toLowerCase().includes(q)) return true
  if (item.type.toLowerCase().includes(q)) return true
  if (item.source.toLowerCase().includes(q)) return true

  if (isClipboardItem(item) && item.content?.toLowerCase().includes(q)) {
    return true
  }

  if (item.indexStatus === 'indexed' && item.content?.toLowerCase().includes(q)) {
    return true
  }

  return false
}

export function itemMatchesSourceFilter(
  item: MemoryItem,
  filter: SourceFilter,
): boolean {
  if (filter === 'All') return true
  return item.source === filter
}

export function buildContentSnippet(
  content: string,
  query: string,
  contextChars = 55,
): string | null {
  const q = query.trim()
  if (!q) return null

  const lower = content.toLowerCase()
  const needle = q.toLowerCase()
  const index = lower.indexOf(needle)
  if (index === -1) return null

  const start = Math.max(0, index - contextChars)
  const end = Math.min(content.length, index + q.length + contextChars)
  let snippet = content.slice(start, end).replace(/\s+/g, ' ').trim()

  if (start > 0) snippet = `…${snippet}`
  if (end < content.length) snippet = `${snippet}…`

  return snippet
}

export function resolveSnippet(
  item: MemoryItem,
  query: string,
): string | null {
  if (!query.trim()) return null

  if (isClipboardItem(item) && item.content) {
    return buildContentSnippet(item.content, query)
  }

  if (item.indexStatus !== 'indexed' || !item.content) {
    return null
  }
  return buildContentSnippet(item.content, query)
}

export function searchMemoryItems(
  items: MemoryItem[],
  query: string,
  sourceFilter: SourceFilter,
): MemorySearchResult[] {
  const q = query.trim()

  const filtered = items.filter(
    (item) =>
      itemMatchesSourceFilter(item, sourceFilter) && itemMatchesQuery(item, q),
  )

  if (!q) {
    return filtered.map((item) => ({ item, snippet: null }))
  }

  return filtered.map((item) => ({
    item,
    snippet: resolveSnippet(item, q),
  }))
}

export function mergeTimelineItems(
  fileItems: MemoryItem[],
  clipboardItems: MemoryItem[],
): MemoryItem[] {
  return [...fileItems, ...clipboardItems].sort(
    (a, b) =>
      new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime(),
  )
}
