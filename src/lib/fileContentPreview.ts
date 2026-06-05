import {
  canManuallyIndexFile,
  hasIndexableContentType,
} from '../services/contentIndexer'
import {
  isClipboardItem,
  isImageFile,
  type MemoryItem,
} from '../types/memoryItem'
export const TXT_PREVIEW_MAX_CHARS = 2000
export const OCR_PREVIEW_MAX_CHARS = 2000

export function shouldShowFileContentPreview(item: MemoryItem): boolean {
  if (isClipboardItem(item)) return false
  if (isImageFile(item)) return true
  return canManuallyIndexFile(item.extension)
}

/** Indexed body text for the Details panel preview (TXT capped at 2000 chars). */
export function getFileContentPreview(item: MemoryItem): string | null {
  if (!hasIndexableContentType(item.extension)) return null
  if (isImageFile(item)) return null
  if (item.indexStatus !== 'indexed' || !item.content) return null

  const content = item.content
  if (item.extension === 'txt' && content.length > TXT_PREVIEW_MAX_CHARS) {
    return `${content.slice(0, TXT_PREVIEW_MAX_CHARS)}…`
  }

  return content
}

/** OCR text preview for image files in the Details panel. */
export function getOcrPreview(item: MemoryItem): string | null {
  if (!isImageFile(item)) return null
  if (item.indexStatus !== 'indexed' || !item.content) return null

  const content = item.content
  if (content.length > OCR_PREVIEW_MAX_CHARS) {
    return `${content.slice(0, OCR_PREVIEW_MAX_CHARS)}…`
  }

  return content
}
