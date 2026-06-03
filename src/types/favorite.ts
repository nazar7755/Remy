import type {
  FileMemoryType,
  MemorySource,
  SupportedExtension,
} from './memoryItem'

/** Minimal persisted reference for a favorited memory (live scan data merged when available). */
export interface FavoriteSnapshot {
  id: string
  fileName: string
  filePath: string
  source: MemorySource
  type: FileMemoryType
  extension: SupportedExtension
  createdAt: string
  createdAtIso: string
  fileSize: string
  fileSizeBytes: number
}

export interface FavoriteRecord {
  memoryId: string
  favoritedAtMs: number
  snapshot: FavoriteSnapshot
}
