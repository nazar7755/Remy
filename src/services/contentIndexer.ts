import { OCR_INDEXING_ENABLED } from '../lib/ocrFeature'
import { isTauri, tauriInvoke } from '../lib/tauri'
import {
  OCR_INDEX_TIMEOUT_MS,
  PDF_INDEX_TIMEOUT_MS,
  type AppSettings,
} from '../types/settings'
import {
  isContentIndexableExtension,
  isImageExtension,
  isIndexableExtension,
} from '../types/memoryItem'
import { mockContentForFile } from './fileScanner/mockContent'

export const INDEXING_FAILED_USER_MESSAGE =
  'Indexing failed: unsupported or corrupted file'

/** Map Rust/timeout/internal errors to a safe Details-panel message. */
export function toUserFacingIndexError(message: string): string {
  if (
    message.startsWith('Image exceeds maximum size') ||
    message.startsWith('PDF exceeds maximum size')
  ) {
    return message
  }
  if (message === 'No extractable text found in file') {
    return message
  }
  return INDEXING_FAILED_USER_MESSAGE
}

export async function indexFileContent(
  filePath: string,
  fileName: string,
  options?: { force?: boolean; timeoutMs?: number },
): Promise<string | null> {
  if (!isTauri()) {
    return mockContentForFile(fileName)
  }

  const invokePromise = tauriInvoke<string | null>('index_file_content', {
    path: filePath,
    force: options?.force ?? false,
  })

  const timeoutMs = options?.timeoutMs
  if (timeoutMs == null || timeoutMs <= 0) {
    const result = await invokePromise
    return result?.trim() ? result : null
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  try {
    const result = await Promise.race([
      invokePromise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`Indexing timed out after ${timeoutMs}ms`)),
          timeoutMs,
        )
      }),
    ])
    return result?.trim() ? result : null
  } finally {
    if (timeoutId != null) clearTimeout(timeoutId)
  }
}

export async function clearFileIndex(filePath: string): Promise<void> {
  if (!isTauri()) return
  await tauriInvoke('clear_file_index', { path: filePath })
}

/** Manual Index / Reindex in Details — images only when OCR is enabled. */
export function canManuallyIndexFile(extension: string): boolean {
  if (isImageExtension(extension)) {
    return OCR_INDEXING_ENABLED
  }
  return isIndexableExtension(extension)
}

/** Whether background OCR should run for images. */
export function isBackgroundOcrEnabled(
  settings: Pick<AppSettings, 'ocrImageIndexingEnabled' | 'backgroundIndexingEnabled'>,
): boolean {
  return (
    OCR_INDEXING_ENABLED &&
    settings.backgroundIndexingEnabled &&
    settings.ocrImageIndexingEnabled
  )
}

export function canIndexFile(
  extension: string,
  settings?: Pick<AppSettings, 'ocrImageIndexingEnabled'>,
): boolean {
  if (isIndexableExtension(extension)) return true
  if (isImageExtension(extension)) {
    return OCR_INDEXING_ENABLED && (settings?.ocrImageIndexingEnabled ?? false)
  }
  return false
}

/** Whether cached index text may exist for this file type. */
export function hasIndexableContentType(extension: string): boolean {
  return isContentIndexableExtension(extension)
}

export function pdfIndexTimeoutMs(): number {
  return PDF_INDEX_TIMEOUT_MS
}

export function ocrIndexTimeoutMs(): number {
  return OCR_INDEX_TIMEOUT_MS
}
