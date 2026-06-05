import type { MemorySource } from '../../types/memoryItem'

/** Raw file metadata returned by a filesystem adapter. */
export interface ScannedFileEntry {
  name: string
  extension: string
  createdAtMs: number
  sizeBytes: number
  path: string
  source: MemorySource
}

export interface FolderPathsDto {
  downloads: string
  desktop: string
  documents: string
}

export interface ScanSourcesOptions {
  scanDownloads: boolean
  scanDesktop: boolean
  scanDocuments: boolean
  customWatchedFolders: string[]
}

export interface FileSystemAdapter {
  getFolderPaths(): Promise<FolderPathsDto>
  listAllSources(sources: ScanSourcesOptions): Promise<ScannedFileEntry[]>
}
