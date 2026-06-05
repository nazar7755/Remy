import { getCurrentWindow } from '@tauri-apps/api/window'
import { isTauri } from './tauri'

export async function isQuickSearchWindow(): Promise<boolean> {
  if (!isTauri()) return false
  try {
    return getCurrentWindow().label === 'quick-search'
  } catch {
    return false
  }
}
