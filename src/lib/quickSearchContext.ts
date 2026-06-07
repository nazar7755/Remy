import {
  parseSearchQuery,
  searchMemoryItems,
  type MemorySearchResult,
} from './contentSearch'
import {
  buildRecentActivityRows,
  FAVORITES_MAX,
  RECENT_CLIPBOARD_MAX,
  RECENT_FILES_MAX,
  type RecentActivity,
  type RecentActivitySection,
  RECENT_ACTIVITY_SECTION_LABELS,
} from './quickSearchRecentActivity'
import { resolveFavoriteItems } from './favorites'
import { normalizeTagName } from './tagNormalize'
import { itemHasAllTags, itemHasTag } from './tags'
import type { FavoriteRecord } from '../types/favorite'
import type { MemoryItem } from '../types/memoryItem'
import { isClipboardItem } from '../types/memoryItem'

export const QUICK_SEARCH_CONTEXTS = [
  'all',
  'recent',
  'clipboard',
  'favorites',
  'tags',
] as const

export type QuickSearchContext = (typeof QUICK_SEARCH_CONTEXTS)[number]

export const QUICK_SEARCH_CONTEXT_LABELS: Record<QuickSearchContext, string> = {
  all: 'All',
  recent: 'Recent',
  clipboard: 'Clipboard',
  favorites: 'Favorites',
  tags: 'Tags',
}

export type QuickSearchNavRow =
  | {
      kind: 'memory'
      result: MemorySearchResult
      section?: RecentActivitySection
      showSectionHeader?: boolean
    }
  | { kind: 'tag'; tagName: string; usageCount?: number }

export { RECENT_ACTIVITY_SECTION_LABELS }

function sortByNewest(items: MemoryItem[]): MemoryItem[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime(),
  )
}

function toMemoryRows(results: MemorySearchResult[]): QuickSearchNavRow[] {
  return results.map((result) => ({ kind: 'memory', result }))
}

function toTagRows(tagNames: string[]): QuickSearchNavRow[] {
  return tagNames.map((tagName) => ({ kind: 'tag', tagName }))
}

function unionSearchableItems(
  items: MemoryItem[],
  favoriteItems: MemoryItem[],
): MemoryItem[] {
  const byId = new Map<string, MemoryItem>()
  for (const item of items) {
    byId.set(item.id, item)
  }
  for (const item of favoriteItems) {
    if (!byId.has(item.id)) {
      byId.set(item.id, item)
    }
  }
  return sortByNewest([...byId.values()])
}

function appendMemorySectionRows(
  rows: QuickSearchNavRow[],
  section: RecentActivitySection,
  sectionItems: MemoryItem[],
  maxResults: number,
): void {
  let lastSection: RecentActivitySection | null = null
  for (const row of rows) {
    if (row.kind === 'memory' && row.section) {
      lastSection = row.section
    }
  }

  for (const item of sectionItems) {
    if (rows.length >= maxResults) return
    rows.push({
      kind: 'memory',
      result: { item, snippet: null },
      section,
      showSectionHeader: section !== lastSection,
    })
    lastSection = section
  }
}

/** Live browse for All — never depends on a stale recent-activity snapshot. */
function buildAllBrowseFromLiveData(
  items: MemoryItem[],
  favoriteItems: MemoryItem[],
  allTagNames: string[],
  maxResults: number,
): QuickSearchNavRow[] {
  const rows: QuickSearchNavRow[] = []
  const files = sortByNewest(items.filter((item) => !isClipboardItem(item)))
  const clipboard = sortByNewest(items.filter(isClipboardItem))
  const favorites = sortByNewest(favoriteItems)

  appendMemorySectionRows(
    rows,
    'recent-files',
    files.slice(0, RECENT_FILES_MAX),
    maxResults,
  )
  appendMemorySectionRows(rows, 'recent-clipboard', clipboard, maxResults)
  appendMemorySectionRows(
    rows,
    'favorites',
    favorites.slice(0, FAVORITES_MAX),
    maxResults,
  )

  for (const tagName of allTagNames) {
    if (rows.length >= maxResults) break
    rows.push({ kind: 'tag', tagName })
  }

  return rows
}

export function quickSearchHasAnyContent(
  items: MemoryItem[],
  favoriteItems: MemoryItem[],
  allTagNames: string[],
): boolean {
  return (
    items.length > 0 ||
    favoriteItems.length > 0 ||
    allTagNames.length > 0
  )
}

function activityRowsToNavRows(
  activity: RecentActivity,
  includeFavorites: boolean,
): QuickSearchNavRow[] {
  const rows = buildRecentActivityRows({
    ...activity,
    favorites: includeFavorites ? activity.favorites : [],
  })
  return rows.map((row) => ({
    kind: 'memory',
    result: row.result,
    section: row.section,
    showSectionHeader: row.showSectionHeader,
  }))
}

export interface QuickSearchTagAutocompleteState {
  /** Tag-name filter after `tag:`, `#`, or empty for bare `tag` / `tag:` / `#`. */
  suffix: string
}

/** Detect tag-autocomplete mode (not full-text search). */
export function parseQuickSearchTagAutocomplete(
  query: string,
): QuickSearchTagAutocompleteState | null {
  const trimmed = query.trim()
  if (!trimmed) return null

  if (trimmed.toLowerCase() === 'tag') {
    return { suffix: '' }
  }

  if (/^tag:/i.test(trimmed)) {
    const { textQuery } = parseSearchQuery(trimmed)
    if (textQuery) return null
    const colonAt = trimmed.toLowerCase().indexOf('tag:')
    const afterTag = trimmed.slice(colonAt + 4)
    const suffix = afterTag.split(/\s/)[0] ?? ''
    return { suffix }
  }

  if (trimmed.startsWith('#')) {
    const suffix = trimmed.slice(1)
    if (/\s/.test(suffix)) return null
    return { suffix }
  }

  return null
}

export function quickSearchTagAutocompleteActive(
  query: string,
  allTagNames: string[],
): boolean {
  const state = parseQuickSearchTagAutocomplete(query)
  if (!state) return false
  return tagAutocompleteShowsSuggestions(state.suffix, allTagNames)
}

function tagAutocompleteShowsSuggestions(
  suffix: string,
  allTagNames: string[],
): boolean {
  if (!suffix) return true

  const normalized = normalizeTagName(suffix)
  if (
    normalized &&
    allTagNames.includes(normalized) &&
    suffix.toLowerCase() === normalized
  ) {
    return false
  }

  return true
}

function filterTagsForAutocomplete(
  allTagNames: string[],
  suffix: string,
): string[] {
  const needle = suffix.toLowerCase()
  if (!needle) return allTagNames

  return allTagNames.filter((name) => name.toLowerCase().startsWith(needle))
}

/** Map completed `#name` / `tag:name` autocomplete input to a tag search query. */
function resolveTagSearchQuery(query: string, allTagNames: string[]): string {
  const state = parseQuickSearchTagAutocomplete(query)
  if (!state) return query
  if (tagAutocompleteShowsSuggestions(state.suffix, allTagNames)) return query

  const normalized = normalizeTagName(state.suffix)
  if (normalized && allTagNames.includes(normalized)) {
    return `tag:${normalized}`
  }

  return query
}

export function buildTagAutocompleteRows(
  query: string,
  allTagNames: string[],
  tagUsage: Map<string, number>,
  maxResults: number,
): QuickSearchNavRow[] | null {
  const state = parseQuickSearchTagAutocomplete(query)
  if (!state) return null
  if (!tagAutocompleteShowsSuggestions(state.suffix, allTagNames)) return null

  return filterTagsForAutocomplete(allTagNames, state.suffix)
    .slice(0, maxResults)
    .map((tagName) => ({
      kind: 'tag' as const,
      tagName,
      usageCount: tagUsage.get(tagName) ?? 0,
    }))
}

export function formatTagMemoryCount(count: number): string {
  return count === 1 ? '1 memory' : `${count} memories`
}

function filterTagNames(allTagNames: string[], query: string): string[] {
  const { textQuery, filters } = parseSearchQuery(query)
  if (filters.tags.length > 0) return []
  const needle = textQuery.toLowerCase()
  if (!needle) return allTagNames
  return allTagNames.filter((name) => name.includes(needle))
}

function resolveRequiredTags(
  query: string,
  selectedTag: string | null,
): string[] {
  const { filters } = parseSearchQuery(query)
  if (filters.tags.length > 0) return filters.tags
  if (selectedTag) return [selectedTag]
  return []
}

export function resolveFavoriteItemsForQuickSearch(
  liveItems: MemoryItem[],
  favoriteRecords: FavoriteRecord[],
  memoryTags: Map<string, string[]>,
): MemoryItem[] {
  return resolveFavoriteItems(liveItems, favoriteRecords, memoryTags)
}

function searchPool(
  context: QuickSearchContext,
  items: MemoryItem[],
  favoriteItems: MemoryItem[],
): MemoryItem[] {
  switch (context) {
    case 'clipboard':
      return items.filter(isClipboardItem)
    case 'favorites':
      return favoriteItems
    default:
      return items
  }
}

function searchInPool(
  pool: MemoryItem[],
  query: string,
  maxResults: number,
): MemorySearchResult[] {
  return searchMemoryItems(pool, query, 'All').slice(0, maxResults)
}

export interface ResolveQuickSearchRowsOptions {
  context: QuickSearchContext
  query: string
  items: MemoryItem[]
  favoriteItems: MemoryItem[]
  recentActivity: RecentActivity | null
  allTagNames: string[]
  tagUsage: Map<string, number>
  selectedTag: string | null
  maxResults: number
}

export function resolveQuickSearchRows(
  options: ResolveQuickSearchRowsOptions,
): QuickSearchNavRow[] {
  const {
    context,
    query,
    items,
    favoriteItems,
    recentActivity,
    allTagNames,
    tagUsage,
    selectedTag,
    maxResults,
  } = options

  const trimmed = query.trim()
  const hasQuery = trimmed.length > 0
  const searchQuery = resolveTagSearchQuery(trimmed, allTagNames)

  const tagAutocompleteRows = buildTagAutocompleteRows(
    trimmed,
    allTagNames,
    tagUsage,
    maxResults,
  )
  if (tagAutocompleteRows !== null) {
    return tagAutocompleteRows
  }

  if (context === 'tags') {
    const requiredTags = resolveRequiredTags(searchQuery, selectedTag)

    if (!hasQuery && !selectedTag) {
      return toTagRows(filterTagNames(allTagNames, trimmed))
    }

    if (!hasQuery && selectedTag) {
      const tagged = items.filter((item) => itemHasTag(item, selectedTag))
      return toMemoryRows(
        sortByNewest(tagged)
          .slice(0, maxResults)
          .map((item) => ({ item, snippet: null })),
      )
    }

    if (hasQuery && requiredTags.length === 0) {
      const matchingTags = filterTagNames(allTagNames, searchQuery)
      if (matchingTags.length > 0) {
        return toTagRows(matchingTags)
      }
    }

    if (requiredTags.length > 0) {
      const tagged = items.filter((item) => itemHasAllTags(item, requiredTags))
      const { textQuery } = parseSearchQuery(searchQuery)
      if (!textQuery) {
        return toMemoryRows(
          sortByNewest(tagged)
            .slice(0, maxResults)
            .map((item) => ({ item, snippet: null })),
        )
      }
      return toMemoryRows(searchInPool(tagged, searchQuery, maxResults))
    }

    return toMemoryRows(searchInPool(items, searchQuery, maxResults))
  }

  if (context === 'all') {
    if (hasQuery) {
      const allPool = unionSearchableItems(items, favoriteItems)
      return toMemoryRows(searchInPool(allPool, searchQuery, maxResults))
    }
    return buildAllBrowseFromLiveData(
      items,
      favoriteItems,
      allTagNames,
      maxResults,
    )
  }

  if (context === 'recent') {
    if (hasQuery) {
      return toMemoryRows(searchInPool(items, searchQuery, maxResults))
    }
    if (recentActivity) {
      const activityRows = activityRowsToNavRows(recentActivity, false)
      if (activityRows.length > 0) {
        return activityRows
      }
    }
    const rows: QuickSearchNavRow[] = []
    const files = sortByNewest(items.filter((item) => !isClipboardItem(item)))
    const clipboard = sortByNewest(items.filter(isClipboardItem))
    appendMemorySectionRows(
      rows,
      'recent-files',
      files.slice(0, RECENT_FILES_MAX),
      maxResults,
    )
    appendMemorySectionRows(
      rows,
      'recent-clipboard',
      clipboard.slice(0, RECENT_CLIPBOARD_MAX),
      maxResults,
    )
    return rows
  }

  const pool = searchPool(context, items, favoriteItems)

  if (hasQuery) {
    return toMemoryRows(searchInPool(pool, searchQuery, maxResults))
  }

  if (context === 'clipboard') {
    const clipboard = sortByNewest(pool).slice(0, maxResults)
    return toMemoryRows(clipboard.map((item) => ({ item, snippet: null })))
  }

  if (context === 'favorites') {
    const favorites = sortByNewest(pool).slice(0, maxResults)
    return toMemoryRows(favorites.map((item) => ({ item, snippet: null })))
  }

  return []
}

export function quickSearchEmptyMessage(
  context: QuickSearchContext,
  query: string,
  selectedTag: string | null,
  hasAnyContent = true,
  allTagNames: string[] = [],
): string {
  if (parseQuickSearchTagAutocomplete(query.trim()) !== null) {
    if (allTagNames.length === 0) return 'No tags yet'
    return 'No matching tags'
  }

  if (query.trim()) return 'No results found'

  switch (context) {
    case 'all':
      return hasAnyContent ? 'No results found' : 'No memories yet'
    case 'recent':
      return 'No recent files or clipboard yet'
    case 'clipboard':
      return 'No clipboard entries yet'
    case 'favorites':
      return 'No favorites yet'
    case 'tags':
      return selectedTag ? 'No items with this tag' : 'No tags yet'
    default:
      return 'Nothing here yet'
  }
}

export function memoryRowSnippetQuery(
  context: QuickSearchContext,
  query: string,
): string {
  if (context !== 'tags') return query
  const { textQuery } = parseSearchQuery(query)
  return textQuery || query
}

export function quickSearchIsSearchResults(
  context: QuickSearchContext,
  query: string,
  selectedTag: string | null,
  rows: QuickSearchNavRow[],
): boolean {
  if (rows.length === 0) return false
  if (rows.every((row) => row.kind === 'tag')) return false
  if (context === 'tags') {
    return Boolean(query.trim() || selectedTag)
  }
  return Boolean(query.trim())
}

export function quickSearchShowRecentSections(
  context: QuickSearchContext,
  query: string,
): boolean {
  return !query.trim() && (context === 'all' || context === 'recent')
}
