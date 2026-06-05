import { useCallback, useMemo, useState } from 'react'
import { isTauri } from '../lib/tauri'
import { customFolderSourceNames } from '../lib/watchedFolders'
import {
  addCustomWatchedFolder,
  pickWatchedFolder,
  removeCustomWatchedFolder,
  syncWatchedFolderScopes,
  validateNewWatchedFolder,
} from '../services/watchedFolders'
import type { AppSettings } from '../types/settings'
import type { FolderPaths } from '../types/memoryItem'

interface UseWatchedFoldersOptions {
  settings: AppSettings
  folderPaths: FolderPaths | null
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

export function useWatchedFolders({
  settings,
  folderPaths,
  updateSettings,
}: UseWatchedFoldersOptions) {
  const [addingFolder, setAddingFolder] = useState(false)
  const [folderError, setFolderError] = useState<string | null>(null)

  const customFolderSources = useMemo(
    () => customFolderSourceNames(settings.customWatchedFolders),
    [settings.customWatchedFolders],
  )

  const addFolder = useCallback(async () => {
    setFolderError(null)

    if (!isTauri()) {
      const mockPath = window.prompt(
        'Enter a folder path to watch (browser preview only):',
      )
      if (!mockPath?.trim()) return false

      const validationError = validateNewWatchedFolder(
        mockPath,
        settings,
        folderPaths,
      )
      if (validationError) {
        setFolderError(validationError)
        return false
      }

      await updateSettings({
        customWatchedFolders: addCustomWatchedFolder(settings, mockPath)
          .customWatchedFolders,
      })
      return true
    }

    setAddingFolder(true)
    try {
      const picked = await pickWatchedFolder()
      if (!picked) return false

      const validationError = validateNewWatchedFolder(
        picked,
        settings,
        folderPaths,
      )
      if (validationError) {
        setFolderError(validationError)
        return false
      }

      const next = addCustomWatchedFolder(settings, picked)
      await updateSettings({ customWatchedFolders: next.customWatchedFolders })
      await syncWatchedFolderScopes(next, folderPaths)
      return true
    } catch (err) {
      setFolderError(
        err instanceof Error ? err.message : 'Failed to add folder',
      )
      return false
    } finally {
      setAddingFolder(false)
    }
  }, [settings, folderPaths, updateSettings])

  const removeFolder = useCallback(
    async (path: string) => {
      setFolderError(null)
      const next = removeCustomWatchedFolder(settings, path)
      try {
        await updateSettings({ customWatchedFolders: next.customWatchedFolders })
        await syncWatchedFolderScopes(next, folderPaths)
      } catch (err) {
        setFolderError(
          err instanceof Error ? err.message : 'Failed to remove folder',
        )
      }
    },
    [settings, folderPaths, updateSettings],
  )

  return {
    customFolderSources,
    customWatchedFolders: settings.customWatchedFolders,
    addingFolder,
    folderError,
    clearFolderError: () => setFolderError(null),
    addFolder,
    removeFolder,
  }
}
