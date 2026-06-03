export type MemoriesViewMode = 'list' | 'grid'

export type MemoriesSortOption =
  | 'newest'
  | 'oldest'
  | 'name-asc'
  | 'name-desc'
  | 'size-desc'
  | 'size-asc'

export type MemoriesTypeFilter =
  | 'All'
  | 'Files'
  | 'Clipboard'
  | 'PDF'
  | 'DOCX'
  | 'TXT'
  | 'Images'

export const MEMORIES_TYPE_FILTERS: MemoriesTypeFilter[] = [
  'All',
  'Files',
  'Clipboard',
  'PDF',
  'DOCX',
  'TXT',
  'Images',
]

export const MEMORIES_SORT_OPTIONS: {
  value: MemoriesSortOption
  label: string
}[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'size-desc', label: 'Size largest' },
  { value: 'size-asc', label: 'Size smallest' },
]

export interface MemoriesPagePreferences {
  viewMode: MemoriesViewMode
  sort: MemoriesSortOption
}

export const DEFAULT_MEMORIES_PREFERENCES: MemoriesPagePreferences = {
  viewMode: 'list',
  sort: 'newest',
}
