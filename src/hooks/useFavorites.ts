import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildFavoriteSnapshot } from '../lib/favoriteSnapshot'
import { favoriteIdsFromRecords } from '../lib/favorites'
import { loadFavorites, persistFavorite } from '../services/favorites'
import type { FavoriteRecord } from '../types/favorite'
import type { MemoryItem } from '../types/memoryItem'

export interface FavoritesState {
  records: FavoriteRecord[]
  favoriteIds: Set<string>
  loading: boolean
  error: string | null
  toggleFavorite: (item: MemoryItem) => Promise<void>
}

export function useFavorites(): FavoritesState {
  const [records, setRecords] = useState<FavoriteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const favoriteIds = useMemo(() => favoriteIdsFromRecords(records), [records])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await loadFavorites()
        if (!cancelled) {
          setRecords(loaded)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load favorites',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const toggleFavorite = useCallback(async (item: MemoryItem) => {
    const favorited = !favoriteIds.has(item.id)
    const previous = records

    setRecords((prev) => {
      if (!favorited) {
        return prev.filter((r) => r.memoryId !== item.id)
      }
      const record: FavoriteRecord = {
        memoryId: item.id,
        favoritedAtMs: Date.now(),
        snapshot: buildFavoriteSnapshot(item),
      }
      return [record, ...prev.filter((r) => r.memoryId !== item.id)]
    })
    setError(null)

    try {
      await persistFavorite(item, favorited)
    } catch (err) {
      setRecords(previous)
      setError(
        err instanceof Error ? err.message : 'Failed to update favorite',
      )
    }
  }, [favoriteIds, records])

  return { records, favoriteIds, loading, error, toggleFavorite }
}
