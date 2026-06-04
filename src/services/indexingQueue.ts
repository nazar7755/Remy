import { normalizeFilePath } from '../lib/filePaths'
import {
  isExtensionInBackgroundScope,
  type BackgroundIndexScope,
} from '../types/settings'
import { isClipboardItem, type MemoryItem } from '../types/memoryItem'

/** Minimum delay between consecutive background index jobs. */
export const INDEX_JOB_DELAY_MS = 5000

/** Wait after enabling before the first background job. */
export const INDEX_QUEUE_STARTUP_DELAY_MS = 2000

/** Skip background indexing for files larger than this. */
export const BACKGROUND_INDEX_MAX_FILE_BYTES = 10 * 1024 * 1024

export interface IndexQueueCandidate {
  filePath: string
  fileName: string
}

/** Files eligible for automatic background indexing. */
export function isEligibleForBackgroundIndex(
  item: MemoryItem,
  scope: BackgroundIndexScope,
): boolean {
  if (isClipboardItem(item)) return false
  if (item.indexStatus !== 'idle') return false
  if (item.fileSizeBytes > BACKGROUND_INDEX_MAX_FILE_BYTES) return false
  return isExtensionInBackgroundScope(item.extension, scope)
}

/** Collect not-yet-indexed paths in stable chronological order (oldest first). */
export function collectBackgroundIndexCandidates(
  items: MemoryItem[],
  scope: BackgroundIndexScope,
  skipPaths: ReadonlySet<string>,
): IndexQueueCandidate[] {
  const candidates: IndexQueueCandidate[] = []

  for (const item of items) {
    if (!isEligibleForBackgroundIndex(item, scope)) continue

    const normalized = normalizeFilePath(item.filePath)
    if (skipPaths.has(normalized)) continue

    candidates.push({
      filePath: item.filePath,
      fileName: item.fileName,
    })
  }

  candidates.sort((a, b) => {
    const itemA = items.find(
      (i) => normalizeFilePath(i.filePath) === normalizeFilePath(a.filePath),
    )
    const itemB = items.find(
      (i) => normalizeFilePath(i.filePath) === normalizeFilePath(b.filePath),
    )
    const timeA = itemA?.createdAtIso ?? ''
    const timeB = itemB?.createdAtIso ?? ''
    return timeA.localeCompare(timeB)
  })

  return candidates
}

export function countIndexedFiles(items: MemoryItem[]): number {
  return items.filter(
    (item) => !isClipboardItem(item) && item.indexStatus === 'indexed',
  ).length
}
