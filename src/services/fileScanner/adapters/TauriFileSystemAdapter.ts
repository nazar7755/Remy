import type { MemorySource } from '../../../types/memoryItem'
import { tauriInvoke } from '../../../lib/tauri'
import type {
  FileSystemAdapter,
  FolderPathsDto,
  ScanSourcesOptions,
  ScannedFileEntry,
} from '../types'

interface TauriScannedFileDto {
  name: string
  extension: string
  created_at_ms: number
  size_bytes: number
  path: string
  source_folder: string
}

interface TauriAllowedPathsDto {
  downloads: string
  desktop: string
  documents: string
}

function toMemorySource(value: string): MemorySource {
  if (
    value === 'Desktop' ||
    value === 'Documents' ||
    value === 'Clipboard' ||
    value === 'Downloads'
  ) {
    return value
  }
  return value
}

export class TauriFileSystemAdapter implements FileSystemAdapter {
  async getFolderPaths(): Promise<FolderPathsDto> {
    return tauriInvoke<TauriAllowedPathsDto>('get_allowed_paths')
  }

  async listAllSources(sources: ScanSourcesOptions): Promise<ScannedFileEntry[]> {
    const rows = await tauriInvoke<TauriScannedFileDto[]>(
      'scan_all_memory_folders',
      {
        scanDownloads: sources.scanDownloads,
        scanDesktop: sources.scanDesktop,
        scanDocuments: sources.scanDocuments,
        customWatchedFolders: sources.customWatchedFolders,
      },
    )
    return rows.map((row) => ({
      name: row.name,
      extension: row.extension,
      createdAtMs: row.created_at_ms,
      sizeBytes: row.size_bytes,
      path: row.path,
      source: toMemorySource(row.source_folder),
    }))
  }
}
