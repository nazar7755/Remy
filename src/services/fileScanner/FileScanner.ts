import type { MemoryItem } from '../../types/memoryItem'
import { toMemoryItem } from './memoryItemMapper'
import type {
  FileSystemAdapter,
  FolderPathsDto,
  ScanSourcesOptions,
} from './types'

export class FileScanner {
  private readonly adapter: FileSystemAdapter

  constructor(adapter: FileSystemAdapter) {
    this.adapter = adapter
  }

  async getFolderPaths(): Promise<FolderPathsDto> {
    return this.adapter.getFolderPaths()
  }

  /** Scan enabled folders; merge and sort newest first. */
  async scanAllSources(sources: ScanSourcesOptions): Promise<MemoryItem[]> {
    const entries = await this.adapter.listAllSources(sources)
    const items = entries
      .map(toMemoryItem)
      .filter((item): item is MemoryItem => item !== null)

    return items.sort(
      (a, b) =>
        new Date(b.createdAtIso).getTime() -
        new Date(a.createdAtIso).getTime(),
    )
  }
}
