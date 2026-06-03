import type { FavoriteSnapshot } from '../types/favorite'
import type { MemoryItem } from '../types/memoryItem'
import { emptyIndexMetadata } from './indexMetadata'

export function buildFavoriteSnapshot(item: MemoryItem): FavoriteSnapshot {
  return {
    id: item.id,
    fileName: item.fileName,
    filePath: item.filePath,
    source: item.source,
    type: item.type,
    extension: item.extension,
    createdAt: item.createdAt,
    createdAtIso: item.createdAtIso,
    fileSize: item.fileSize,
    fileSizeBytes: item.fileSizeBytes,
  }
}

export function snapshotToMemoryItem(
  snapshot: FavoriteSnapshot,
  isFavorite = true,
): MemoryItem {
  return {
    ...snapshot,
    content: null,
    indexStatus: 'idle',
    indexError: null,
    ...emptyIndexMetadata(),
    isFavorite,
  }
}
