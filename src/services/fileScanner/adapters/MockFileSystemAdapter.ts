import type { MemorySource, SupportedExtension } from '../../../types/memoryItem'
import type {
  FileSystemAdapter,
  FolderPathsDto,
  ScanSourcesOptions,
  ScannedFileEntry,
} from '../types'

interface MockFile {
  name: string
  extension: SupportedExtension
  daysAgo: number
  sizeBytes: number
  source: MemorySource
}

const MOCK_FILES: MockFile[] = [
  {
    name: 'invoice-march.pdf',
    extension: 'pdf',
    daysAgo: 0,
    sizeBytes: 284_102,
    source: 'Downloads',
  },
  {
    name: 'wireframe-v2.png',
    extension: 'png',
    daysAgo: 0,
    sizeBytes: 1_842_560,
    source: 'Downloads',
  },
  {
    name: 'Screenshot 2026-06-01.png',
    extension: 'png',
    daysAgo: 0,
    sizeBytes: 920_000,
    source: 'Desktop',
  },
  {
    name: 'proposal-draft.docx',
    extension: 'docx',
    daysAgo: 3,
    sizeBytes: 156_672,
    source: 'Documents',
  },
]

function mockBasePath(folder: MemorySource): string {
  const platform =
    typeof navigator !== 'undefined' ? navigator.platform : 'unknown'
  const home = /Win/i.test(platform)
    ? 'C:\\Users\\user'
    : /Mac|iPhone|iPad/i.test(platform)
      ? '/Users/user'
      : '/home/user'

  switch (folder) {
    case 'Desktop':
      return /Win/i.test(platform) ? `${home}\\Desktop` : `${home}/Desktop`
    case 'Documents':
      return /Win/i.test(platform)
        ? `${home}\\Documents`
        : `${home}/Documents`
    default:
      return /Win/i.test(platform)
        ? `${home}\\Downloads`
        : `${home}/Downloads`
  }
}

function createdAtMs(daysAgo: number): number {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(14, 30, 0, 0)
  return d.getTime()
}

export class MockFileSystemAdapter implements FileSystemAdapter {
  async getFolderPaths(): Promise<FolderPathsDto> {
    return {
      downloads: mockBasePath('Downloads'),
      desktop: mockBasePath('Desktop'),
      documents: mockBasePath('Documents'),
    }
  }

  async listAllSources(sources: ScanSourcesOptions): Promise<ScannedFileEntry[]> {
    const enabled = new Set<MemorySource>()
    if (sources.scanDownloads) enabled.add('Downloads')
    if (sources.scanDesktop) enabled.add('Desktop')
    if (sources.scanDocuments) enabled.add('Documents')

    return MOCK_FILES.filter((file) => enabled.has(file.source))
      .map((file) => ({
      name: file.name,
      extension: file.extension,
      createdAtMs: createdAtMs(file.daysAgo),
      sizeBytes: file.sizeBytes,
      path: `${mockBasePath(file.source)}/${file.name}`,
      source: file.source,
    }))
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
  }
}
