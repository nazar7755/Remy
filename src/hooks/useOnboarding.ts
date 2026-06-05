import { useCallback, useEffect, useMemo, useState } from 'react'
import { shouldShowOnboarding } from '../lib/onboarding'
import {
  readOnboardingCompleted,
  writeOnboardingCompleted,
} from '../lib/onboardingStorage'
import { fetchPersistedStatistics } from '../services/settings'
import type { FileScannerState } from './useFileScanner'
import type { FavoritesState } from './useFavorites'

interface UseOnboardingOptions {
  memoryScan: FileScannerState
  favorites: FavoritesState
}

export function useOnboarding({ memoryScan, favorites }: UseOnboardingOptions) {
  const [completed, setCompleted] = useState(readOnboardingCompleted)
  const [clipboardEntryCount, setClipboardEntryCount] = useState<number | null>(
    null,
  )

  useEffect(() => {
    const sync = () => setCompleted(readOnboardingCompleted())
    window.addEventListener('remy:onboarding-completed', sync)
    return () => window.removeEventListener('remy:onboarding-completed', sync)
  }, [])

  useEffect(() => {
    if (completed || memoryScan.loading || favorites.loading) return

    let cancelled = false

    void (async () => {
      try {
        const stats = await fetchPersistedStatistics()
        if (!cancelled) setClipboardEntryCount(stats.clipboardEntries)
      } catch {
        if (!cancelled) setClipboardEntryCount(0)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [completed, memoryScan.loading, favorites.loading])

  const open = useMemo(() => {
    if (clipboardEntryCount === null) return false

    return shouldShowOnboarding({
      fileCount: memoryScan.fileCount,
      clipboardEntryCount,
      favoriteCount: favorites.records.length,
      loading: memoryScan.loading,
      favoritesLoading: favorites.loading,
      onboardingCompleted: completed,
    })
  }, [
    clipboardEntryCount,
    completed,
    favorites.loading,
    favorites.records.length,
    memoryScan.fileCount,
    memoryScan.loading,
  ])

  const complete = useCallback(() => {
    writeOnboardingCompleted()
    setCompleted(true)
  }, [])

  return { open, complete }
}
