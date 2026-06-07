import type { MemoryItem, SourceFilter } from '../types/memoryItem'
import { isClipboardItem, isImageFile } from '../types/memoryItem'
import { itemHasAllTags } from './tags'
import { normalizeTagName } from './tagNormalize'

/**
 * Remy search query parser — operators + free text.
 *
 * Supported operators (case-insensitive):
 * - `tag:name` — item must have tag (e.g. `tag:edu`, `tag:crypto`)
 * - `type:kind` — pdf, docx, txt, image, clipboard, or FileMemoryType name
 * - `source:place` — downloads, desktop, documents, clipboard, favorites, or custom folder name
 *
 * Examples:
 * - `history type:docx` — text "history" in docx files
 * - `invoice type:pdf source:downloads` — pdf from Downloads matching "invoice"
 * - `tag:edu type:docx` — tagged edu + docx extension
 * - `discord source:clipboard` — clipboard snippets matching "discord"
 * - `tag:crypto` — tag filter only (no free text)
 */
export interface SearchQueryFilters {
  tags: string[]
  types: string[]
  sources: string[]
  favoritesOnly: boolean
}

export interface ParsedSearchQuery {
  textQuery: string
  filters: SearchQueryFilters
}

const OPERATOR_PATTERN = /\b(tag|type|source):([^\s]+)/gi

const SOURCE_ALIASES: Record<string, string | 'favorites'> = {
  downloads: 'Downloads',
  download: 'Downloads',
  desktop: 'Desktop',
  documents: 'Documents',
  docs: 'Documents',
  clipboard: 'Clipboard',
  favorites: 'favorites',
  favorite: 'favorites',
}

function normalizeTypeToken(raw: string): string {
  return raw.trim().toLowerCase()
}

function normalizeSourceToken(raw: string): string | 'favorites' | null {
  const token = raw.trim().toLowerCase()
  if (!token) return null
  return SOURCE_ALIASES[token] ?? raw.trim()
}

/** Parse a search string into free text and structured filters. */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const tags: string[] = []
  const types: string[] = []
  const sources: string[] = []
  let favoritesOnly = false
  let text = query

  for (const match of query.matchAll(OPERATOR_PATTERN)) {
    const operator = match[1].toLowerCase()
    const value = match[2]

    if (operator === 'tag') {
      const normalized = normalizeTagName(value)
      if (normalized && !tags.includes(normalized)) {
        tags.push(normalized)
      }
    } else if (operator === 'type') {
      const token = normalizeTypeToken(value)
      if (token && !types.includes(token)) {
        types.push(token)
      }
    } else if (operator === 'source') {
      const normalized = normalizeSourceToken(value)
      if (normalized === 'favorites') {
        favoritesOnly = true
      } else if (normalized && !sources.includes(normalized)) {
        sources.push(normalized)
      }
    }

    text = text.replace(match[0], ' ')
  }

  return {
    textQuery: text.replace(/\s+/g, ' ').trim(),
    filters: { tags, types, sources, favoritesOnly },
  }
}

function itemMatchesTypeFilter(item: MemoryItem, typeToken: string): boolean {
  const token = typeToken.toLowerCase()

  if (token === 'clipboard') {
    return isClipboardItem(item)
  }

  if (token === 'pdf') {
    return item.type === 'PDF' || item.extension === 'pdf'
  }

  if (token === 'docx') {
    return item.extension === 'docx'
  }

  if (token === 'txt') {
    return item.extension === 'txt' || item.type === 'Text'
  }

  if (token === 'image' || token === 'images') {
    return item.type === 'Image' || isImageFile(item)
  }

  if (item.type.toLowerCase() === token) {
    return true
  }

  if (item.extension.toLowerCase() === token) {
    return true
  }

  return false
}

function itemMatchesTypeFilters(item: MemoryItem, types: string[]): boolean {
  if (types.length === 0) return true
  return types.some((token) => itemMatchesTypeFilter(item, token))
}

function itemMatchesSourceFilters(
  item: MemoryItem,
  filters: SearchQueryFilters,
): boolean {
  if (filters.favoritesOnly && !item.isFavorite) {
    return false
  }

  if (filters.sources.length === 0) {
    return true
  }

  return filters.sources.some(
    (source) => item.source.toLowerCase() === source.toLowerCase(),
  )
}

function itemMatchesOperatorFilters(
  item: MemoryItem,
  filters: SearchQueryFilters,
): boolean {
  if (filters.tags.length > 0 && !itemHasAllTags(item, filters.tags)) {
    return false
  }

  if (!itemMatchesTypeFilters(item, filters.types)) {
    return false
  }

  if (!itemMatchesSourceFilters(item, filters)) {
    return false
  }

  return true
}

function itemMatchesTextQuery(item: MemoryItem, textQuery: string): boolean {
  const q = textQuery.toLowerCase()

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

  const { textQuery, filters } = parseSearchQuery(trimmed)

  if (!itemMatchesOperatorFilters(item, filters)) {
    return false
  }

  if (!textQuery) {
    return true
  }

  return itemMatchesTextQuery(item, textQuery)
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
  const { textQuery } = parseSearchQuery(query)
  const q = textQuery.trim()
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
  const { textQuery } = parseSearchQuery(query)
  if (!textQuery) return null

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
  const trimmed = query.trim()
  const { textQuery } = parseSearchQuery(trimmed)

  const filtered = items.filter(
    (item) =>
      itemMatchesSourceFilter(item, sourceFilter) &&
      itemMatchesQuery(item, trimmed),
  )

  if (!textQuery) {
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
