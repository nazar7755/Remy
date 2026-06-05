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
  | { kind: 'tag'; tagName: string }

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

function filterTagNames(allTagNames: string[], query: string): string[] {
  const { tags, text } = parseSearchQuery(query)
  if (tags.length > 0) return []
  const needle = text.toLowerCase()
  if (!needle) return allTagNames
  return allTagNames.filter((name) => name.includes(needle))
}

function resolveRequiredTags(
  query: string,
  selectedTag: string | null,
): string[] {
  const { tags } = parseSearchQuery(query)
  if (tags.length > 0) return tags
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
    selectedTag,
    maxResults,
  } = options

  const trimmed = query.trim()
  const hasQuery = trimmed.length > 0

  if (context === 'tags') {
    const requiredTags = resolveRequiredTags(trimmed, selectedTag)

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
      const matchingTags = filterTagNames(allTagNames, trimmed)
      if (matchingTags.length > 0) {
        return toTagRows(matchingTags)
      }
    }

    if (requiredTags.length > 0) {
      const tagged = items.filter((item) => itemHasAllTags(item, requiredTags))
      const { text } = parseSearchQuery(trimmed)
      if (!text) {
        return toMemoryRows(
          sortByNewest(tagged)
            .slice(0, maxResults)
            .map((item) => ({ item, snippet: null })),
        )
      }
      return toMemoryRows(searchInPool(tagged, trimmed, maxResults))
    }

    return toMemoryRows(searchInPool(items, trimmed, maxResults))
  }

  if (context === 'all') {
    if (hasQuery) {
      const allPool = unionSearchableItems(items, favoriteItems)
      return toMemoryRows(searchInPool(allPool, trimmed, maxResults))
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
      return toMemoryRows(searchInPool(items, trimmed, maxResults))
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
    return toMemoryRows(searchInPool(pool, trimmed, maxResults))
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
): string {
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
  const { text } = parseSearchQuery(query)
  return text || query
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
