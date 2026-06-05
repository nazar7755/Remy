import type { MemoryItem, MemorySource } from '../../types/memoryItem'
import type { ScannedFileEntry } from './types'
import {
  extensionToType,
  formatCreatedDate,
  formatFileSize,
  isSupportedExtension,
  parseExtension,
} from './formatters'

function toMemorySource(value: string): MemorySource {
  if (
    value === 'Desktop' ||
    value === 'Documents' ||
    value === 'Clipboard' ||
    value === 'Downloads'
  ) {
    return value
  }
  return value
}

export function toMemoryItem(entry: ScannedFileEntry): MemoryItem | null {
  const ext = entry.extension || parseExtension(entry.name)
  if (!isSupportedExtension(ext)) return null

  return {
    id: entry.path,
    fileName: entry.name,
    extension: ext,
    type: extensionToType(ext),
    createdAt: formatCreatedDate(entry.createdAtMs),
    createdAtIso: new Date(entry.createdAtMs).toISOString(),
    fileSize: formatFileSize(entry.sizeBytes),
    fileSizeBytes: entry.sizeBytes,
    filePath: entry.path,
    source: toMemorySource(entry.source),
    content: null,
    indexStatus: 'idle',
    indexError: null,
    indexedCharCount: null,
    indexedAt: null,
    indexedAtIso: null,
    isFavorite: false,
    tags: [],
  }
}
