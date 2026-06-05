import type { FavoriteRecord } from '../types/favorite'
import type { MemoryItem } from '../types/memoryItem'
import { isClipboardItem } from '../types/memoryItem'
import type { MemorySearchResult } from './contentSearch'
import { resolveFavoriteItems } from './favorites'

export const RECENT_FILES_MAX = 10
export const RECENT_CLIPBOARD_MAX = 5
export const FAVORITES_MAX = 5

export type RecentActivitySection =
  | 'recent-files'
  | 'recent-clipboard'
  | 'favorites'

export interface RecentActivity {
  recentFiles: MemoryItem[]
  recentClipboard: MemoryItem[]
  favorites: MemoryItem[]
}

export interface RecentActivityRow {
  section: RecentActivitySection
  showSectionHeader: boolean
  result: MemorySearchResult
}

function sortByNewest(items: MemoryItem[]): MemoryItem[] {
  return [...items].sort(
    (a, b) =>
      new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime(),
  )
}

export function buildRecentActivity(
  fileItems: MemoryItem[],
  clipboardItems: MemoryItem[],
  favoriteRecords: FavoriteRecord[],
  liveItems: MemoryItem[],
): RecentActivity {
  const recentFiles = sortByNewest(
    fileItems.filter((item) => !isClipboardItem(item)),
  ).slice(0, RECENT_FILES_MAX)

  const recentClipboard = sortByNewest(
    clipboardItems.filter((item) => isClipboardItem(item)),
  ).slice(0, RECENT_CLIPBOARD_MAX)

  const favorites = resolveFavoriteItems(liveItems, favoriteRecords).slice(
    0,
    FAVORITES_MAX,
  )

  return { recentFiles, recentClipboard, favorites }
}

export function recentActivityIsEmpty(activity: RecentActivity): boolean {
  return (
    activity.recentFiles.length === 0 &&
    activity.recentClipboard.length === 0 &&
    activity.favorites.length === 0
  )
}

export function buildRecentActivityRows(
  activity: RecentActivity,
): RecentActivityRow[] {
  const rows: RecentActivityRow[] = []
  let lastSection: RecentActivitySection | null = null

  const append = (section: RecentActivitySection, items: MemoryItem[]) => {
    for (const item of items) {
      rows.push({
        section,
        showSectionHeader: section !== lastSection,
        result: { item, snippet: null },
      })
      lastSection = section
    }
  }

  append('recent-files', activity.recentFiles)
  append('recent-clipboard', activity.recentClipboard)
  append('favorites', activity.favorites)

  return rows
}

export const RECENT_ACTIVITY_SECTION_LABELS: Record<
  RecentActivitySection,
  string
> = {
  'recent-files': 'Recent Files',
  'recent-clipboard': 'Recent Clipboard',
  favorites: 'Favorites',
}

export function clipboardPreviewText(item: MemoryItem): string {
  if (item.content?.trim()) {
    return item.content.replace(/\s+/g, ' ').trim().slice(0, 120)
  }
  return item.fileName
}
