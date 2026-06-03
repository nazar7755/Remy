import { convertFileSrc } from '@tauri-apps/api/core'
import { isImageExtension } from '../types/memoryItem'
import { isTauri } from './tauri'

/** Asset URL for a local image path in the Tauri webview; null in browser dev or non-images. */
export function getImageDisplayUrl(
  filePath: string,
  extension: string,
): string | null {
  if (!isTauri() || !filePath || !isImageExtension(extension)) {
    return null
  }
  try {
    return convertFileSrc(filePath)
  } catch {
    return null
  }
}
