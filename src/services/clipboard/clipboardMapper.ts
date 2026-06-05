import { formatCreatedDate, formatFileSize } from '../fileScanner/formatters'
import type { MemoryItem } from '../../types/memoryItem'

export interface ClipboardEntryDto {
  id: string
  text: string
  capturedAtMs: number
}

const PREVIEW_MAX = 72

function previewLabel(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim()
  if (line.length <= PREVIEW_MAX) return line || 'Empty clipboard'
  return `${line.slice(0, PREVIEW_MAX)}…`
}

export function clipboardEntryToMemoryItem(
  entry: ClipboardEntryDto,
): MemoryItem {
  const bytes = new TextEncoder().encode(entry.text).length

  return {
    id: `clipboard://${entry.id}`,
    fileName: previewLabel(entry.text),
    extension: 'txt',
    type: 'Clipboard',
    createdAt: formatCreatedDate(entry.capturedAtMs),
    createdAtIso: new Date(entry.capturedAtMs).toISOString(),
    fileSize: formatFileSize(bytes),
    fileSizeBytes: bytes,
    filePath: `remy://clipboard/${entry.id}`,
    source: 'Clipboard',
    content: entry.text,
    indexStatus: 'indexed',
    indexError: null,
    indexedCharCount: null,
    indexedAt: null,
    indexedAtIso: null,
    isFavorite: false,
    tags: [],
  }
}

export function clipboardEntriesToMemoryItems(
  entries: ClipboardEntryDto[],
): MemoryItem[] {
  return entries.map(clipboardEntryToMemoryItem)
}
