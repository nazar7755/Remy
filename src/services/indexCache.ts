import { normalizeFilePath } from '../lib/filePaths'
import {
  emptyIndexMetadata,
  indexMetadataFromContent,
} from '../lib/indexMetadata'
import { isTauri, tauriInvoke } from '../lib/tauri'
import { INDEXING_FAILED_USER_MESSAGE } from './contentIndexer'
import { hasIndexableContentType } from './contentIndexer'
import type { MemoryItem } from '../types/memoryItem'
import { isClipboardItem } from '../types/memoryItem'

interface FileIndexCacheDto {
  file_path: string
  content: string
  indexed_at_ms: number
}

interface FileIndexFailureDto {
  file_path: string
  extension: string
  failure_reason: string
  failed_at_ms: number
}

export function applyIndexCache(
  items: MemoryItem[],
  cacheByPath: Map<string, FileIndexCacheDto>,
): MemoryItem[] {
  if (cacheByPath.size === 0) return items

  return items.map((item) => {
    if (isClipboardItem(item) || !hasIndexableContentType(item.extension)) {
      return item
    }

    // Do not overwrite an in-flight manual index with stale cache from a parallel scan.
    if (item.indexStatus === 'loading') {
      return item
    }

    const cached = cacheByPath.get(normalizeFilePath(item.filePath))
    if (!cached) return item

    return {
      ...item,
      content: cached.content,
      indexStatus: 'indexed',
      indexError: null,
      ...indexMetadataFromContent(cached.content, cached.indexed_at_ms),
    }
  })
}

export function applyIndexFailures(
  items: MemoryItem[],
  failuresByPath: Map<string, FileIndexFailureDto>,
): MemoryItem[] {
  return items.map((item) => {
    if (isClipboardItem(item) || !hasIndexableContentType(item.extension)) {
      return item
    }

    if (item.indexStatus === 'loading') {
      return item
    }

    const failure = failuresByPath.get(normalizeFilePath(item.filePath))
    if (failure) {
      return {
        ...item,
        content: null,
        indexStatus: 'error',
        indexError: INDEXING_FAILED_USER_MESSAGE,
        ...emptyIndexMetadata(),
      }
    }

    if (
      item.indexStatus === 'error' &&
      item.indexError === INDEXING_FAILED_USER_MESSAGE
    ) {
      return {
        ...item,
        indexStatus: 'idle',
        indexError: null,
        ...emptyIndexMetadata(),
      }
    }

    return item
  })
}

export async function lookupIndexCache(
  items: MemoryItem[],
): Promise<Map<string, FileIndexCacheDto>> {
  if (!isTauri()) return new Map()

  const paths = items
    .filter((item) => !isClipboardItem(item) && hasIndexableContentType(item.extension))
    .map((item) => item.filePath)

  if (paths.length === 0) return new Map()

  const rows = await tauriInvoke<FileIndexCacheDto[]>('lookup_file_index_cache', {
    paths,
  })

  return new Map(
    rows.map((row) => [normalizeFilePath(row.file_path), row]),
  )
}

export async function lookupIndexFailures(
  items: MemoryItem[],
): Promise<Map<string, FileIndexFailureDto>> {
  if (!isTauri()) return new Map()

  const paths = items
    .filter((item) => !isClipboardItem(item) && hasIndexableContentType(item.extension))
    .map((item) => item.filePath)

  if (paths.length === 0) return new Map()

  const rows = await tauriInvoke<FileIndexFailureDto[]>(
    'lookup_file_index_failures',
    { paths },
  )

  return new Map(
    rows.map((row) => [normalizeFilePath(row.file_path), row]),
  )
}
