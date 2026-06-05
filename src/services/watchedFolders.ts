import { open } from '@tauri-apps/plugin-dialog'
import { isTauri, tauriInvoke } from '../lib/tauri'
import {
  dedupeFolderPaths,
  folderDisplayName,
  isDefaultFolderPath,
  normalizeFolderPath,
} from '../lib/watchedFolders'
import type { AppSettings } from '../types/settings'
import type { FolderPaths } from '../types/memoryItem'

export async function pickWatchedFolder(): Promise<string | null> {
  if (!isTauri()) return null

  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Choose a folder for Remy to watch',
  })

  if (selected === null) return null
  return typeof selected === 'string' ? selected : null
}

export function validateNewWatchedFolder(
  path: string,
  settings: AppSettings,
  folderPaths: FolderPaths | null,
): string | null {
  const normalized = normalizeFolderPath(path)
  if (!normalized) return 'Invalid folder path'

  if (folderPaths && isDefaultFolderPath(normalized, folderPaths)) {
    return 'Downloads, Desktop, and Documents are already watched by default'
  }

  const existing = dedupeFolderPaths(settings.customWatchedFolders)
  if (existing.some((p) => normalizeFolderPath(p) === normalized)) {
    return 'This folder is already in your watched list'
  }

  return null
}

export function addCustomWatchedFolder(
  settings: AppSettings,
  path: string,
): AppSettings {
  const normalized = normalizeFolderPath(path)
  return {
    ...settings,
    customWatchedFolders: dedupeFolderPaths([
      ...settings.customWatchedFolders,
      normalized,
    ]),
  }
}

export function removeCustomWatchedFolder(
  settings: AppSettings,
  path: string,
): AppSettings {
  const normalized = normalizeFolderPath(path)
  return {
    ...settings,
    customWatchedFolders: settings.customWatchedFolders.filter(
      (p) => normalizeFolderPath(p) !== normalized,
    ),
  }
}

/** Register asset-protocol scope for thumbnails in watched folders. */
export async function syncWatchedFolderScopes(
  settings: AppSettings,
  folderPaths: FolderPaths | null,
): Promise<void> {
  if (!isTauri()) return

  const paths: string[] = [...settings.customWatchedFolders]
  if (folderPaths) {
    if (settings.scanDownloads) paths.push(folderPaths.downloads)
    if (settings.scanDesktop) paths.push(folderPaths.desktop)
    if (settings.scanDocuments) paths.push(folderPaths.documents)
  }

  await tauriInvoke('register_watched_folder_scopes', {
    paths: dedupeFolderPaths(paths),
  })
}

export { folderDisplayName }
