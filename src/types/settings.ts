export interface AppSettings {
  scanDownloads: boolean
  scanDesktop: boolean
  scanDocuments: boolean
  filePollIntervalMs: number
  clipboardPollIntervalMs: number
  clipboardEnabled: boolean
}

export interface MemoryStatistics {
  filesTracked: number
  clipboardEntries: number
  indexedFiles: number
  totalIndexedCharacters: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  scanDownloads: true,
  scanDesktop: true,
  scanDocuments: true,
  filePollIntervalMs: 5000,
  clipboardPollIntervalMs: 2000,
  clipboardEnabled: true,
}

export const FILE_POLL_MIN_MS = 2000
export const FILE_POLL_MAX_MS = 120_000
export const CLIPBOARD_POLL_MIN_MS = 1000
export const CLIPBOARD_POLL_MAX_MS = 60_000

export function clampSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    filePollIntervalMs: Math.min(
      FILE_POLL_MAX_MS,
      Math.max(FILE_POLL_MIN_MS, settings.filePollIntervalMs),
    ),
    clipboardPollIntervalMs: Math.min(
      CLIPBOARD_POLL_MAX_MS,
      Math.max(CLIPBOARD_POLL_MIN_MS, settings.clipboardPollIntervalMs),
    ),
  }
}

export type ScanSourcesOptions = Pick<
  AppSettings,
  'scanDownloads' | 'scanDesktop' | 'scanDocuments'
>
