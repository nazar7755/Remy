const STORAGE_KEY = 'remy.previewEmptyStates'

/** Dev-only UI flag — pretends lists are empty without touching SQLite or files. */
export function isPreviewEmptyStatesAvailable(): boolean {
  return import.meta.env.DEV
}

export function readPreviewEmptyStates(): boolean {
  if (!isPreviewEmptyStatesAvailable()) return false
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writePreviewEmptyStates(enabled: boolean): void {
  if (!isPreviewEmptyStatesAvailable()) return
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY, '1')
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    window.dispatchEvent(new CustomEvent('remy:preview-empty-states'))
  } catch {
    // ignore quota / private mode
  }
}
