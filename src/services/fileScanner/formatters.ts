import type { FileMemoryType, SupportedExtension } from '../../types/memoryItem'
import { SUPPORTED_EXTENSIONS } from '../../types/memoryItem'

const EXTENSION_TYPE_MAP: Record<SupportedExtension, FileMemoryType> = {
  pdf: 'PDF',
  png: 'Image',
  jpg: 'Image',
  jpeg: 'Image',
  webp: 'Image',
  txt: 'Text',
  docx: 'Document',
  xlsx: 'Spreadsheet',
  csv: 'Spreadsheet',
  zip: 'Archive',
}

export function parseExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.')
  if (lastDot <= 0) return ''
  return fileName.slice(lastDot + 1).toLowerCase()
}

export function isSupportedExtension(
  ext: string,
): ext is SupportedExtension {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)
}

export function extensionToType(ext: SupportedExtension): FileMemoryType {
  return EXTENSION_TYPE_MAP[ext]
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB'] as const
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  )
  const value = bytes / 1024 ** i
  const digits = i === 0 ? 0 : value < 10 ? 1 : 0
  return `${value.toFixed(digits)} ${units[i]}`
}

export function formatCreatedDate(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms))
}
