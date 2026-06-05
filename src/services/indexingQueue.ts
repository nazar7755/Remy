import { OCR_INDEXING_ENABLED } from '../lib/ocrFeature'
import { normalizeFilePath } from '../lib/filePaths'
import { isExtensionInBackgroundScope, type AppSettings } from '../types/settings'
import {
  isClipboardItem,
  isImageExtension,
  type MemoryItem,
} from '../types/memoryItem'

/** Outcome of a single background index attempt. */
export type BackgroundIndexOutcome = 'indexed' | 'error' | 'skipped'

/** Minimum delay between consecutive TXT/DOCX background index jobs. */
export const INDEX_JOB_DELAY_MS = 5000

/** Wait after enabling before the first background job. */
export const INDEX_QUEUE_STARTUP_DELAY_MS = 2000

/** Skip TXT/DOCX background indexing for files larger than this. */
export const BACKGROUND_INDEX_MAX_FILE_BYTES = 10 * 1024 * 1024

export interface IndexQueueCandidate {
  filePath: string
  fileName: string
}

export function isPdfFilePath(filePath: string, item?: MemoryItem): boolean {
  if (item?.extension === 'pdf') return true
  return filePath.toLowerCase().endsWith('.pdf')
}

export function isOcrImageItem(item: MemoryItem): boolean {
  return (
    OCR_INDEXING_ENABLED &&
    !isClipboardItem(item) &&
    isImageExtension(item.extension)
  )
}

/** Files eligible for automatic background indexing. */
export function isEligibleForBackgroundIndex(
  item: MemoryItem,
  settings: AppSettings,
): boolean {
  if (isClipboardItem(item)) return false
  if (item.indexStatus !== 'idle') return false

  if (item.extension === 'pdf') {
    return settings.backgroundPdfIndexingEnabled
  }

  if (isImageExtension(item.extension)) {
    return false
  }

  if (item.fileSizeBytes > BACKGROUND_INDEX_MAX_FILE_BYTES) return false
  return isExtensionInBackgroundScope(item.extension, settings.backgroundIndexScope)
}

/** Collect not-yet-indexed paths in stable chronological order (oldest first). */
export function collectBackgroundIndexCandidates(
  items: MemoryItem[],
  settings: AppSettings,
  skipPaths: ReadonlySet<string>,
): IndexQueueCandidate[] {
  const candidates: IndexQueueCandidate[] = []

  for (const item of items) {
    if (!isEligibleForBackgroundIndex(item, settings)) continue

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

export function countOcrCandidatesInQueue(
  queuePaths: readonly string[],
  items: MemoryItem[],
): number {
  return queuePaths.filter((path) => {
    const item = items.find(
      (i) => normalizeFilePath(i.filePath) === normalizeFilePath(path),
    )
    return item != null && isOcrImageItem(item)
  }).length
}

export function getPostJobDelayMs(item: MemoryItem, settings: AppSettings): number {
  if (item.extension === 'pdf') {
    return settings.backgroundPdfDelaySec * 1000
  }
  if (isImageExtension(item.extension)) {
    return settings.backgroundOcrDelaySec * 1000
  }
  return INDEX_JOB_DELAY_MS
}

export function countIndexedFiles(items: MemoryItem[]): number {
  return items.filter(
    (item) => !isClipboardItem(item) && item.indexStatus === 'indexed',
  ).length
}
