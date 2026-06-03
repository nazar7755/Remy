import {
  DEFAULT_MEMORIES_PREFERENCES,
  type MemoriesPagePreferences,
  type MemoriesSortOption,
  type MemoriesViewMode,
} from '../types/memoriesPage'

const STORAGE_KEY = 'remy-memories-preferences'

const SORT_VALUES = new Set<MemoriesSortOption>([
  'newest',
  'oldest',
  'name-asc',
  'name-desc',
  'size-desc',
  'size-asc',
])

function clampPreferences(raw: unknown): MemoriesPagePreferences {
  if (!raw || typeof raw !== 'object') return DEFAULT_MEMORIES_PREFERENCES

  const obj = raw as Record<string, unknown>
  const viewMode: MemoriesViewMode =
    obj.viewMode === 'grid' ? 'grid' : 'list'
  const sort =
    typeof obj.sort === 'string' && SORT_VALUES.has(obj.sort as MemoriesSortOption)
      ? (obj.sort as MemoriesSortOption)
      : DEFAULT_MEMORIES_PREFERENCES.sort

  return { viewMode, sort }
}

export function loadMemoriesPreferences(): MemoriesPagePreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_MEMORIES_PREFERENCES
    return clampPreferences(JSON.parse(raw))
  } catch {
    return DEFAULT_MEMORIES_PREFERENCES
  }
}

export function saveMemoriesPreferences(
  prefs: MemoriesPagePreferences,
): MemoriesPagePreferences {
  const clamped = clampPreferences(prefs)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped))
  return clamped
}
