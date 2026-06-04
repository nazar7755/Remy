import { isTauri, tauriInvoke } from '../lib/tauri'
import { PDF_INDEX_TIMEOUT_MS } from '../types/settings'
import { isIndexableExtension } from '../types/memoryItem'
import { mockContentForFile } from './fileScanner/mockContent'

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
          () => reject(new Error(`PDF indexing timed out after ${timeoutMs}ms`)),
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

export function canIndexFile(extension: string): boolean {
  return isIndexableExtension(extension)
}

export function pdfIndexTimeoutMs(): number {
  return PDF_INDEX_TIMEOUT_MS
}
