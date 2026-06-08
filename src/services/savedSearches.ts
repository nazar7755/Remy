import { isTauri, tauriInvoke } from '../lib/tauri'
import type { SavedSearch } from '../types/savedSearch'

const MOCK_STORAGE_KEY = 'remy-saved-searches'

interface TauriSavedSearchDto {
  id: string
  name: string
  query: string
  created_at_ms: number
}

function fromTauriDto(dto: TauriSavedSearchDto): SavedSearch {
  return {
    id: dto.id,
    name: dto.name,
    query: dto.query,
    createdAtMs: dto.created_at_ms,
  }
}

function loadMockSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedSearch[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveMockSavedSearches(searches: SavedSearch[]): void {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(searches))
}

export async function loadSavedSearches(): Promise<SavedSearch[]> {
  if (!isTauri()) return loadMockSavedSearches()
  const rows = await tauriInvoke<TauriSavedSearchDto[]>('get_saved_searches')
  return rows.map(fromTauriDto)
}

export async function createSavedSearch(
  name: string,
  query: string,
): Promise<SavedSearch> {
  const trimmedName = name.trim()
  const trimmedQuery = query.trim()
  if (!trimmedName || !trimmedQuery) {
    throw new Error('Name and query are required')
  }

  if (!isTauri()) {
    const record: SavedSearch = {
      id: crypto.randomUUID(),
      name: trimmedName,
      query: trimmedQuery,
      createdAtMs: Date.now(),
    }
    const existing = loadMockSavedSearches()
    saveMockSavedSearches([record, ...existing])
    return record
  }

  const dto = await tauriInvoke<TauriSavedSearchDto>('create_saved_search', {
    name: trimmedName,
    query: trimmedQuery,
  })
  return fromTauriDto(dto)
}

export async function renameSavedSearch(
  id: string,
  name: string,
): Promise<void> {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('Name is required')

  if (!isTauri()) {
    const existing = loadMockSavedSearches()
    saveMockSavedSearches(
      existing.map((s) => (s.id === id ? { ...s, name: trimmedName } : s)),
    )
    return
  }

  await tauriInvoke('rename_saved_search', { id, name: trimmedName })
}

export async function deleteSavedSearch(id: string): Promise<void> {
  if (!isTauri()) {
    saveMockSavedSearches(
      loadMockSavedSearches().filter((s) => s.id !== id),
    )
    return
  }

  await tauriInvoke('delete_saved_search', { id })
}
