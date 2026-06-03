export { FileScanner } from './FileScanner'
export { createFileSystemAdapter } from './adapters/createFileSystemAdapter'
export type {
  FileSystemAdapter,
  FolderPathsDto,
  ScanSourcesOptions,
  ScannedFileEntry,
} from './types'

import { createFileSystemAdapter } from './adapters/createFileSystemAdapter'
import { FileScanner } from './FileScanner'
import type { FolderPathsDto, ScanSourcesOptions } from './types'
import type { MemoryItem } from '../../types/memoryItem'

function createFileScanner(): FileScanner {
  return new FileScanner(createFileSystemAdapter())
}

export async function getFolderPaths(): Promise<FolderPathsDto> {
  return createFileScanner().getFolderPaths()
}

export async function scanAllSources(
  sources: ScanSourcesOptions,
): Promise<MemoryItem[]> {
  return createFileScanner().scanAllSources(sources)
}
