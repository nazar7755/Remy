import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  memoryTagsMapFromAssignments,
  sortedTagNames,
  tagUsageFromAssignments,
} from '../lib/tags'
import {
  loadMemoryTagAssignments,
  persistAddMemoryTag,
  persistRemoveMemoryTag,
} from '../services/tags'
import type { MemoryTagAssignment } from '../types/tag'
import type { MemoryItem } from '../types/memoryItem'

export interface TagsState {
  assignments: MemoryTagAssignment[]
  memoryTags: Map<string, string[]>
  allTagNames: string[]
  loading: boolean
  error: string | null
  addTag: (item: MemoryItem, rawTagName: string) => Promise<string | null>
  removeTag: (item: MemoryItem, tagName: string) => Promise<void>
}

export function useTags(): TagsState {
  const [assignments, setAssignments] = useState<MemoryTagAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const memoryTags = useMemo(
    () => memoryTagsMapFromAssignments(assignments),
    [assignments],
  )

  const allTagNames = useMemo(() => {
    const usage = tagUsageFromAssignments(assignments)
    return sortedTagNames(usage)
  }, [assignments])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await loadMemoryTagAssignments()
        if (!cancelled) {
          setAssignments(loaded)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load tags')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const addTag = useCallback(async (item: MemoryItem, rawTagName: string) => {
    let normalized: string | null = null

    try {
      normalized = await persistAddMemoryTag(item.id, rawTagName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add tag')
      return null
    }

    setAssignments((prev) => {
      if (prev.some((row) => row.memoryId === item.id && row.tagName === normalized)) {
        return prev
      }
      return [
        {
          memoryId: item.id,
          tagName: normalized!,
          taggedAtMs: Date.now(),
        },
        ...prev,
      ]
    })
    setError(null)
    return normalized
  }, [])

  const removeTag = useCallback(async (item: MemoryItem, tagName: string) => {
    const previous = assignments

    setAssignments((prev) =>
      prev.filter((row) => !(row.memoryId === item.id && row.tagName === tagName)),
    )
    setError(null)

    try {
      await persistRemoveMemoryTag(item.id, tagName)
    } catch (err) {
      setAssignments(previous)
      setError(err instanceof Error ? err.message : 'Failed to remove tag')
    }
  }, [assignments])

  return {
    assignments,
    memoryTags,
    allTagNames,
    loading,
    error,
    addTag,
    removeTag,
  }
}
