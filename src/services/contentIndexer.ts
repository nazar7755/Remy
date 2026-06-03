import { isTauri, tauriInvoke } from '../lib/tauri'
import { isIndexableExtension } from '../types/memoryItem'
import { mockContentForFile } from './fileScanner/mockContent'

export async function indexFileContent(
  filePath: string,
  fileName: string,
  options?: { force?: boolean },
): Promise<string | null> {
  if (!isTauri()) {
    return mockContentForFile(fileName)
  }

  const result = await tauriInvoke<string | null>('index_file_content', {
    path: filePath,
    force: options?.force ?? false,
  })
  return result?.trim() ? result : null
}

export async function clearFileIndex(filePath: string): Promise<void> {
  if (!isTauri()) return
  await tauriInvoke('clear_file_index', { path: filePath })
}

export function canIndexFile(extension: string): boolean {
  return isIndexableExtension(extension)
}
