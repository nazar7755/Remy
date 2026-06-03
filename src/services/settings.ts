import { isTauri, tauriInvoke } from '../lib/tauri'
import {
  clampSettings,
  DEFAULT_SETTINGS,
  type AppSettings,
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
}

interface TauriMemoryStatisticsDto {
  clipboard_entries: number
  indexed_files: number
  total_indexed_characters: number
}

function fromTauriSettings(dto: TauriAppSettingsDto): AppSettings {
  return clampSettings({
    scanDownloads: dto.scan_downloads,
    scanDesktop: dto.scan_desktop,
    scanDocuments: dto.scan_documents,
    filePollIntervalMs: dto.file_poll_interval_ms,
    clipboardPollIntervalMs: dto.clipboard_poll_interval_ms,
    clipboardEnabled: dto.clipboard_enabled,
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
