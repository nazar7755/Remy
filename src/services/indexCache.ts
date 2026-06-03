import { normalizeFilePath } from '../lib/filePaths'
import { indexMetadataFromContent } from '../lib/indexMetadata'
import { isTauri, tauriInvoke } from '../lib/tauri'
import { canIndexFile } from './contentIndexer'
import type { MemoryItem } from '../types/memoryItem'
import { isClipboardItem } from '../types/memoryItem'

interface FileIndexCacheDto {
  file_path: string
  content: string
  indexed_at_ms: number
}

export function applyIndexCache(
  items: MemoryItem[],
  cacheByPath: Map<string, FileIndexCacheDto>,
): MemoryItem[] {
  if (cacheByPath.size === 0) return items

  return items.map((item) => {
    if (isClipboardItem(item) || !canIndexFile(item.extension)) {
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

export async function lookupIndexCache(
  items: MemoryItem[],
): Promise<Map<string, FileIndexCacheDto>> {
  if (!isTauri()) return new Map()

  const paths = items
    .filter((item) => !isClipboardItem(item) && canIndexFile(item.extension))
    .map((item) => item.filePath)

  if (paths.length === 0) return new Map()

  const rows = await tauriInvoke<FileIndexCacheDto[]>('lookup_file_index_cache', {
    paths,
  })

  return new Map(
    rows.map((row) => [normalizeFilePath(row.file_path), row]),
  )
}
