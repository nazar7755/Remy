import { OCR_INDEXING_ENABLED } from '../lib/ocrFeature'

/** Extensions whose text is extracted and stored in memory for search. */
export const INDEXABLE_EXTENSIONS = ['txt', 'pdf', 'docx'] as const

export type IndexableExtension = (typeof INDEXABLE_EXTENSIONS)[number]

export const SUPPORTED_EXTENSIONS = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'txt',
  'docx',
  'xlsx',
  'csv',
  'zip',
] as const

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number]

/** Raster image extensions shown as lazy-loaded thumbnails in the UI. */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const

export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number]

export function isImageExtension(ext: string): ext is ImageExtension {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(ext)
}

export function isImageFile(item: MemoryItem): boolean {
  return !isClipboardItem(item) && isImageExtension(item.extension)
}

export type MemorySource =
  | 'Downloads'
  | 'Desktop'
  | 'Documents'
  | 'Clipboard'
  | (string & {})

export const DEFAULT_FILE_SOURCES = [
  'Downloads',
  'Desktop',
  'Documents',
] as const

export type DefaultFileSource = (typeof DEFAULT_FILE_SOURCES)[number]

export type SourceFilter = 'All' | MemorySource

export const MEMORY_SOURCES: MemorySource[] = [
  'Downloads',
  'Desktop',
  'Documents',
  'Clipboard',
]

export type IndexStatus = 'idle' | 'loading' | 'indexed' | 'error'

export function isIndexableExtension(
  ext: string,
): ext is IndexableExtension {
  return (INDEXABLE_EXTENSIONS as readonly string[]).includes(ext)
}

/** File types that may have cached extracted text (documents + OCR images when enabled). */
export function isContentIndexableExtension(ext: string): boolean {
  if (isImageExtension(ext)) {
    return OCR_INDEXING_ENABLED
  }
  return isIndexableExtension(ext)
}

export function isClipboardItem(item: MemoryItem): boolean {
  return item.source === 'Clipboard'
}

export type FileMemoryType =
  | 'PDF'
  | 'Image'
  | 'Text'
  | 'Document'
  | 'Spreadsheet'
  | 'Archive'
  | 'Clipboard'

export interface MemoryItem {
  id: string
  fileName: string
  extension: SupportedExtension
  type: FileMemoryType
  createdAt: string
  createdAtIso: string
  fileSize: string
  fileSizeBytes: number
  filePath: string
  source: MemorySource
  content: string | null
  indexStatus: IndexStatus
  indexError: string | null
  indexedCharCount: number | null
  indexedAt: string | null
  indexedAtIso: string | null
  isFavorite: boolean
  tags: string[]
}

export interface FolderPaths {
  downloads: string
  desktop: string
  documents: string
}
