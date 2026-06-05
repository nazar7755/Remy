/** Which non-PDF file types background indexing processes (txt always included). */
import { dedupeFolderPaths } from '../lib/watchedFolders'

export type BackgroundIndexScope = 'txt' | 'txt_docx'

export interface AppSettings {
  scanDownloads: boolean
  scanDesktop: boolean
  scanDocuments: boolean
  filePollIntervalMs: number
  clipboardPollIntervalMs: number
  clipboardEnabled: boolean
  backgroundIndexingEnabled: boolean
  backgroundIndexScope: BackgroundIndexScope
  /** Separate toggle — PDF background indexing is off by default. */
  backgroundPdfIndexingEnabled: boolean
  /** Max PDF size for background indexing (MB). */
  backgroundPdfMaxSizeMb: number
  /** Delay between consecutive background PDF jobs (seconds). */
  backgroundPdfDelaySec: number
  /** Absolute paths to user-added watch folders (persisted in SQLite). */
  customWatchedFolders: string[]
  /** When on, closing the window hides Remy instead of quitting. */
  runInBackgroundWhenClosed: boolean
}

export interface MemoryStatistics {
  filesTracked: number
  clipboardEntries: number
  indexedFiles: number
  totalIndexedCharacters: number
}

export const DEFAULT_BACKGROUND_PDF_MAX_SIZE_MB = 5
export const DEFAULT_BACKGROUND_PDF_DELAY_SEC = 10
export const BACKGROUND_PDF_MIN_SIZE_MB = 1
export const BACKGROUND_PDF_MAX_SIZE_MB = 50
export const BACKGROUND_PDF_MIN_DELAY_SEC = 5
export const BACKGROUND_PDF_MAX_DELAY_SEC = 120

/** Frontend invoke timeout — slightly above the Rust PDF worker timeout. */
export const PDF_INDEX_TIMEOUT_MS = 65_000

export const DEFAULT_SETTINGS: AppSettings = {
  scanDownloads: true,
  scanDesktop: true,
  scanDocuments: true,
  filePollIntervalMs: 5000,
  clipboardPollIntervalMs: 2000,
  clipboardEnabled: true,
  backgroundIndexingEnabled: false,
  backgroundIndexScope: 'txt_docx',
  backgroundPdfIndexingEnabled: false,
  backgroundPdfMaxSizeMb: DEFAULT_BACKGROUND_PDF_MAX_SIZE_MB,
  backgroundPdfDelaySec: DEFAULT_BACKGROUND_PDF_DELAY_SEC,
  customWatchedFolders: [],
  runInBackgroundWhenClosed: true,
}

export function isExtensionInBackgroundScope(
  extension: string,
  scope: BackgroundIndexScope,
): boolean {
  if (extension === 'pdf') return false
  if (extension === 'txt') return true
  if (scope === 'txt') return false
  return extension === 'docx'
}

export const FILE_POLL_MIN_MS = 2000
export const FILE_POLL_MAX_MS = 120_000
export const CLIPBOARD_POLL_MIN_MS = 1000
export const CLIPBOARD_POLL_MAX_MS = 60_000

export function clampSettings(settings: AppSettings): AppSettings {
  return {
    ...settings,
    customWatchedFolders: dedupeFolderPaths(settings.customWatchedFolders),
    filePollIntervalMs: Math.min(
      FILE_POLL_MAX_MS,
      Math.max(FILE_POLL_MIN_MS, settings.filePollIntervalMs),
    ),
    clipboardPollIntervalMs: Math.min(
      CLIPBOARD_POLL_MAX_MS,
      Math.max(CLIPBOARD_POLL_MIN_MS, settings.clipboardPollIntervalMs),
    ),
    backgroundPdfMaxSizeMb: Math.min(
      BACKGROUND_PDF_MAX_SIZE_MB,
      Math.max(BACKGROUND_PDF_MIN_SIZE_MB, settings.backgroundPdfMaxSizeMb),
    ),
    backgroundPdfDelaySec: Math.min(
      BACKGROUND_PDF_MAX_DELAY_SEC,
      Math.max(BACKGROUND_PDF_MIN_DELAY_SEC, settings.backgroundPdfDelaySec),
    ),
  }
}

export type ScanSourcesOptions = Pick<
  AppSettings,
  | 'scanDownloads'
  | 'scanDesktop'
  | 'scanDocuments'
  | 'customWatchedFolders'
>
