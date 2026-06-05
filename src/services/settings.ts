import { isTauri, tauriInvoke } from '../lib/tauri'
import {
  clampSettings,
  DEFAULT_SETTINGS,
  type AppSettings,
  type BackgroundIndexScope,
  type MemoryStatistics,
} from '../types/settings'

const MOCK_STORAGE_KEY = 'remy-app-settings'

interface TauriAppSettingsDto {
  scan_downloads: boolean
  scan_desktop: boolean
  scan_documents: boolean
  file_poll_interval_ms: number
  clipboard_poll_interval_ms: number
  clipboard_enabled: boolean
  background_indexing_enabled?: boolean
  background_index_scope?: string
  background_pdf_indexing_enabled?: boolean
  background_pdf_max_size_mb?: number
  background_pdf_delay_sec?: number
  custom_watched_folders?: string[]
  run_in_background_when_closed?: boolean
}

const VALID_SCOPES: BackgroundIndexScope[] = ['txt', 'txt_docx']

function parseBackgroundIndexScope(
  raw: string | undefined,
): { scope: BackgroundIndexScope; enablePdf: boolean } {
  if (raw === 'txt_docx_pdf') {
    return { scope: 'txt_docx', enablePdf: true }
  }
  if (raw && (VALID_SCOPES as readonly string[]).includes(raw)) {
    return { scope: raw as BackgroundIndexScope, enablePdf: false }
  }
  return { scope: DEFAULT_SETTINGS.backgroundIndexScope, enablePdf: false }
}

interface TauriMemoryStatisticsDto {
  clipboard_entries: number
  indexed_files: number
  total_indexed_characters: number
}

function fromTauriSettings(dto: TauriAppSettingsDto): AppSettings {
  const parsedScope = parseBackgroundIndexScope(dto.background_index_scope)
  return clampSettings({
    scanDownloads: dto.scan_downloads,
    scanDesktop: dto.scan_desktop,
    scanDocuments: dto.scan_documents,
    filePollIntervalMs: dto.file_poll_interval_ms,
    clipboardPollIntervalMs: dto.clipboard_poll_interval_ms,
    clipboardEnabled: dto.clipboard_enabled,
    backgroundIndexingEnabled:
      dto.background_indexing_enabled ?? DEFAULT_SETTINGS.backgroundIndexingEnabled,
    backgroundIndexScope: parsedScope.scope,
    backgroundPdfIndexingEnabled:
      dto.background_pdf_indexing_enabled ??
      (parsedScope.enablePdf || DEFAULT_SETTINGS.backgroundPdfIndexingEnabled),
    backgroundPdfMaxSizeMb:
      dto.background_pdf_max_size_mb ?? DEFAULT_SETTINGS.backgroundPdfMaxSizeMb,
    backgroundPdfDelaySec:
      dto.background_pdf_delay_sec ?? DEFAULT_SETTINGS.backgroundPdfDelaySec,
    customWatchedFolders: dto.custom_watched_folders ?? [],
    runInBackgroundWhenClosed:
      dto.run_in_background_when_closed ?? DEFAULT_SETTINGS.runInBackgroundWhenClosed,
  })
}

function toTauriSettings(settings: AppSettings): TauriAppSettingsDto {
  const clamped = clampSettings(settings)
  return {
    scan_downloads: clamped.scanDownloads,
    scan_desktop: clamped.scanDesktop,
    scan_documents: clamped.scanDocuments,
    file_poll_interval_ms: clamped.filePollIntervalMs,
    clipboard_poll_interval_ms: clamped.clipboardPollIntervalMs,
    clipboard_enabled: clamped.clipboardEnabled,
    background_indexing_enabled: clamped.backgroundIndexingEnabled,
    background_index_scope: clamped.backgroundIndexScope,
    background_pdf_indexing_enabled: clamped.backgroundPdfIndexingEnabled,
    background_pdf_max_size_mb: clamped.backgroundPdfMaxSizeMb,
    background_pdf_delay_sec: clamped.backgroundPdfDelaySec,
    custom_watched_folders: clamped.customWatchedFolders,
    run_in_background_when_closed: clamped.runInBackgroundWhenClosed,
  }
}

function loadMockSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    return clampSettings(JSON.parse(raw) as AppSettings)
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveMockSettings(settings: AppSettings): AppSettings {
  const clamped = clampSettings(settings)
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(clamped))
  return clamped
}

export async function loadAppSettings(): Promise<AppSettings> {
  if (!isTauri()) return loadMockSettings()
  const dto = await tauriInvoke<TauriAppSettingsDto>('get_app_settings')
  return fromTauriSettings(dto)
}

export async function saveAppSettings(
  settings: AppSettings,
): Promise<AppSettings> {
  if (!isTauri()) return saveMockSettings(settings)
  const dto = await tauriInvoke<TauriAppSettingsDto>('save_app_settings', {
    settings: toTauriSettings(settings),
  })
  return fromTauriSettings(dto)
}

export async function fetchPersistedStatistics(): Promise<
  Pick<
    MemoryStatistics,
    'clipboardEntries' | 'indexedFiles' | 'totalIndexedCharacters'
  >
> {
  if (!isTauri()) {
    return {
      clipboardEntries: 0,
      indexedFiles: 0,
      totalIndexedCharacters: 0,
    }
  }
  const dto = await tauriInvoke<TauriMemoryStatisticsDto>('get_memory_statistics')
  return {
    clipboardEntries: dto.clipboard_entries,
    indexedFiles: dto.indexed_files,
    totalIndexedCharacters: dto.total_indexed_characters,
  }
}

export async function clearClipboardHistory(): Promise<void> {
  if (!isTauri()) return
  await tauriInvoke('clear_clipboard_history')
}

export async function clearIndexedContent(): Promise<void> {
  if (!isTauri()) return
  await tauriInvoke('clear_indexed_content')
}
