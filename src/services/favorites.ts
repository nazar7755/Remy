import { buildFavoriteSnapshot } from '../lib/favoriteSnapshot'
import { isTauri, tauriInvoke } from '../lib/tauri'
import type { FavoriteRecord, FavoriteSnapshot } from '../types/favorite'
import type { MemoryItem } from '../types/memoryItem'

const MOCK_STORAGE_KEY = 'remy-favorites'

interface TauriFavoriteDto {
  memory_id: string
  favorited_at_ms: number
  snapshot: FavoriteSnapshot
}

function fromTauriFavorite(dto: TauriFavoriteDto): FavoriteRecord {
  return {
    memoryId: dto.memory_id,
    favoritedAtMs: dto.favorited_at_ms,
    snapshot: dto.snapshot,
  }
}

function loadMockFavorites(): FavoriteRecord[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as FavoriteRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveMockFavorites(records: FavoriteRecord[]): void {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(records))
}

export async function loadFavorites(): Promise<FavoriteRecord[]> {
  if (!isTauri()) return loadMockFavorites()
  const rows = await tauriInvoke<TauriFavoriteDto[]>('get_favorites')
  return rows.map(fromTauriFavorite)
}

export async function persistFavorite(
  item: MemoryItem,
  favorited: boolean,
): Promise<void> {
  if (!isTauri()) {
    const records = loadMockFavorites()
    if (favorited) {
      const snapshot = buildFavoriteSnapshot(item)
      const next: FavoriteRecord = {
        memoryId: item.id,
        favoritedAtMs: Date.now(),
        snapshot,
      }
      const without = records.filter((r) => r.memoryId !== item.id)
      saveMockFavorites([next, ...without])
    } else {
      saveMockFavorites(records.filter((r) => r.memoryId !== item.id))
    }
    return
  }

  await tauriInvoke('set_favorite', {
    memoryId: item.id,
    favorited,
    snapshot: favorited ? buildFavoriteSnapshot(item) : null,
  })
}
