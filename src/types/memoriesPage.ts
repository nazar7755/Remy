export type MemoriesViewMode = 'list' | 'grid'

export type TimelineFolderFilter =
  | 'All'
  | 'Downloads'
  | 'Desktop'
  | 'Documents'
  | 'Files'

export const TIMELINE_FOLDER_FILTERS: TimelineFolderFilter[] = [
  'All',
  'Downloads',
  'Desktop',
  'Documents',
  'Files',
]

export type TimelineTypeFilter =
  | 'All'
  | 'Images'
  | 'PDF'
  | 'DOCX'
  | 'TXT'
  | 'Clipboard'

export const TIMELINE_TYPE_FILTERS: TimelineTypeFilter[] = [
  'All',
  'Images',
  'PDF',
  'DOCX',
  'TXT',
  'Clipboard',
]

export type MemoriesSortOption =
  | 'newest'
  | 'oldest'
  | 'name-asc'
  | 'name-desc'
  | 'size-desc'
  | 'size-asc'

export type MemoriesTypeFilter = TimelineTypeFilter

export const MEMORIES_TYPE_FILTERS = TIMELINE_TYPE_FILTERS

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
