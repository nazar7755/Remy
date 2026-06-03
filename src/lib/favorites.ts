import type { FavoriteRecord } from '../types/favorite'
import type { MemoryItem } from '../types/memoryItem'
import { snapshotToMemoryItem } from './favoriteSnapshot'

export function favoriteIdsFromRecords(records: FavoriteRecord[]): Set<string> {
  return new Set(records.map((r) => r.memoryId))
}

/** Mark live scanned items with favorite state (no duplication). */
export function applyFavoritesToItems(
  items: MemoryItem[] | undefined,
  favoriteIds: Set<string> | undefined,
): MemoryItem[] {
  const list = items ?? []
  const ids = favoriteIds ?? new Set<string>()
  if (ids.size === 0) {
    return list.map((item) => ({ ...item, isFavorite: item.isFavorite ?? false }))
  }
  return list.map((item) => ({
    ...item,
    isFavorite: ids.has(item.id),
  }))
}

/**
 * Favorites page list: one entry per saved favorite, preferring live scan data when present.
 */
export function resolveFavoriteItems(
  liveItems: MemoryItem[] | undefined,
  records: FavoriteRecord[] | undefined,
): MemoryItem[] {
  const saved = records ?? []
  if (saved.length === 0) return []

  const liveById = new Map((liveItems ?? []).map((item) => [item.id, item]))

  return saved.map((record) => {
    const live = liveById.get(record.memoryId)
    if (live) {
      return { ...live, isFavorite: true }
    }
    return snapshotToMemoryItem(record.snapshot, true)
  })
}
