import { isClipboardItem, type MemoryItem } from '../types/memoryItem'

/** Normalize paths for reliable comparison (macOS NFD/NFC, trimming). */
export function normalizeFilePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return trimmed
  try {
    return trimmed.normalize('NFC')
  } catch {
    return trimmed
  }
}

export function filePathsMatch(a: string, b: string): boolean {
  return normalizeFilePath(a) === normalizeFilePath(b)
}

export function findFileItemByPath(
  items: MemoryItem[],
  filePath: string,
): MemoryItem | undefined {
  return items.find(
    (item) =>
      !isClipboardItem(item) && filePathsMatch(item.filePath, filePath),
  )
}
