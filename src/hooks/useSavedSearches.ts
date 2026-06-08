import { useCallback, useEffect, useState } from 'react'
import {
  createSavedSearch,
  deleteSavedSearch,
  loadSavedSearches,
  renameSavedSearch,
} from '../services/savedSearches'
import type { SavedSearch } from '../types/savedSearch'

export interface SavedSearchesState {
  searches: SavedSearch[]
  loading: boolean
  error: string | null
  create: (name: string, query: string) => Promise<SavedSearch | null>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useSavedSearches(): SavedSearchesState {
  const [searches, setSearches] = useState<SavedSearch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await loadSavedSearches()
        if (!cancelled) {
          setSearches(loaded)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load saved searches',
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

  const create = useCallback(async (name: string, query: string) => {
    setError(null)

    try {
      const record = await createSavedSearch(name, query)
      setSearches((prev) => [record, ...prev])
      return record
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save search',
      )
      return null
    }
  }, [])

  const rename = useCallback(async (id: string, name: string) => {
    const previous = searches
    setSearches((prev) =>
      prev.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)),
    )
    setError(null)

    try {
      await renameSavedSearch(id, name)
    } catch (err) {
      setSearches(previous)
      setError(
        err instanceof Error ? err.message : 'Failed to rename saved search',
      )
    }
  }, [searches])

  const remove = useCallback(async (id: string) => {
    const previous = searches
    setSearches((prev) => prev.filter((s) => s.id !== id))
    setError(null)

    try {
      await deleteSavedSearch(id)
    } catch (err) {
      setSearches(previous)
      setError(
        err instanceof Error ? err.message : 'Failed to delete saved search',
      )
    }
  }, [searches])

  return { searches, loading, error, create, rename, remove }
}
