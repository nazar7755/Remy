import type { MemoryItem, SourceFilter } from '../types/memoryItem'
import { isClipboardItem } from '../types/memoryItem'
import { itemHasAllTags } from './tags'
import { normalizeTagName } from './tagNormalize'

export interface ParsedSearchQuery {
  tags: string[]
  text: string
}

/** Split `tag:crypto ethereum` into tag filters and free-text tokens. */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const tags: string[] = []
  let text = query

  for (const match of query.matchAll(/\btag:([^\s]+)/gi)) {
    const normalized = normalizeTagName(match[1])
    if (normalized && !tags.includes(normalized)) {
      tags.push(normalized)
    }
    text = text.replace(match[0], ' ')
  }

  return {
    tags,
    text: text.replace(/\s+/g, ' ').trim(),
  }
}

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
  const trimmed = query.trim()
  if (!trimmed) return true

  const { tags, text } = parseSearchQuery(trimmed)

  if (tags.length > 0 && !itemHasAllTags(item, tags)) {
    return false
  }

  if (!text) {
    return true
  }

  const q = text.toLowerCase()

  if (item.fileName.toLowerCase().includes(q)) return true
  if (item.filePath.toLowerCase().includes(q)) return true
  if (item.extension.toLowerCase().includes(q)) return true
  if (item.type.toLowerCase().includes(q)) return true
  if (item.source.toLowerCase().includes(q)) return true

  if ((item.tags ?? []).some((tag) => tag.includes(q))) return true

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
  const { text } = parseSearchQuery(query)
  if (!text) return null

  if (isClipboardItem(item) && item.content) {
    return buildContentSnippet(item.content, text)
  }

  if (item.indexStatus !== 'indexed' || !item.content) {
    return null
  }
  return buildContentSnippet(item.content, text)
}

export function searchMemoryItems(
  items: MemoryItem[],
  query: string,
  sourceFilter: SourceFilter,
): MemorySearchResult[] {
  const trimmed = query.trim()
  const { text } = parseSearchQuery(trimmed)

  const filtered = items.filter(
    (item) =>
      itemMatchesSourceFilter(item, sourceFilter) &&
      itemMatchesQuery(item, trimmed),
  )

  if (!text) {
    return filtered.map((item) => ({ item, snippet: null }))
  }

  return filtered.map((item) => ({
    item,
    snippet: resolveSnippet(item, trimmed),
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
