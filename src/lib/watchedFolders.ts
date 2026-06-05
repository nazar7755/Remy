import { normalizeFilePath } from './filePaths'
import type { AppSettings } from '../types/settings'
import type { FolderPaths } from '../types/memoryItem'

/** Strip trailing slashes and normalize for folder-path comparison. */
export function normalizeFolderPath(path: string): string {
  return normalizeFilePath(path.replace(/[/\\]+$/, ''))
}

/** Last path segment for display (e.g. `/Users/me/Projects` → `Projects`). */
export function folderDisplayName(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '')
  const parts = trimmed.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

export function isDefaultFolderPath(
  path: string,
  folderPaths: FolderPaths,
): boolean {
  const normalized = normalizeFolderPath(path)
  return (
    normalized === normalizeFolderPath(folderPaths.downloads) ||
    normalized === normalizeFolderPath(folderPaths.desktop) ||
    normalized === normalizeFolderPath(folderPaths.documents)
  )
}

export function countWatchedFolders(settings: AppSettings): number {
  let count = 0
  if (settings.scanDownloads) count += 1
  if (settings.scanDesktop) count += 1
  if (settings.scanDocuments) count += 1
  count += settings.customWatchedFolders.length
  return count
}

export function customFolderSourceNames(folders: string[]): string[] {
  return folders.map(folderDisplayName)
}

export function dedupeFolderPaths(paths: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const path of paths) {
    const normalized = normalizeFolderPath(path)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}
