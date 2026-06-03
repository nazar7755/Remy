import { useEffect, useMemo, useState } from 'react'
import { itemMatchesQuery, resolveSnippet } from '../lib/contentSearch'
import { sortMemoryItems } from '../lib/memoriesSort'
import {
  loadMemoriesPreferences,
  saveMemoriesPreferences,
} from '../services/memoriesPreferences'
import {
  MEMORIES_SORT_OPTIONS,
  type MemoriesSortOption,
  type MemoriesViewMode,
} from '../types/memoriesPage'
import type { MemoryItem } from '../types/memoryItem'
import { FileDetailsPanel } from './FileDetailsPanel'
import { MemoriesListRow } from './MemoriesListRow'
import { MemoryItemCard } from './MemoryItemCard'
import { SearchBar } from './SearchBar'

interface FavoritesPageProps {
  favoriteItems: MemoryItem[]
  loading: boolean
  error: string | null
  favoritesError: string | null
  query: string
  onToggleFavorite: (item: MemoryItem) => void
  onIndexContent: (filePath: string) => void
  onReindexContent: (filePath: string) => void
  onClearIndex: (filePath: string) => void
}

export function FavoritesPage({
  favoriteItems,
  loading,
  error,
  favoritesError,
  query,
  onToggleFavorite,
  onIndexContent,
  onReindexContent,
  onClearIndex,
}: FavoritesPageProps) {
  const [localQuery, setLocalQuery] = useState('')
  const [viewMode, setViewMode] = useState<MemoriesViewMode>(() =>
    loadMemoriesPreferences().viewMode,
  )
  const [sort, setSort] = useState<MemoriesSortOption>(() =>
    loadMemoriesPreferences().sort,
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const effectiveQuery = query.trim() || localQuery.trim()

  useEffect(() => {
    saveMemoriesPreferences({ viewMode, sort })
  }, [viewMode, sort])

  const displayed = useMemo(() => {
    const filtered = favoriteItems.filter((item) =>
      itemMatchesQuery(item, effectiveQuery),
    )
    const withSnippets = filtered.map((item) => ({
      item,
      snippet: resolveSnippet(item, effectiveQuery),
    }))
    const sorted = sortMemoryItems(
      withSnippets.map((r) => r.item),
      sort,
    )
    const snippetById = new Map(
      withSnippets.map((r) => [r.item.id, r.snippet]),
    )
    return sorted.map((item) => ({
      item,
      snippet: snippetById.get(item.id) ?? null,
    }))
  }, [favoriteItems, effectiveQuery, sort])

  const selected = useMemo(() => {
    if (!selectedId) return null
    return displayed.find((r) => r.item.id === selectedId)?.item ?? null
  }, [selectedId, displayed])

  const statusError = favoritesError ?? error

  return (
    <section className="space-y-6">
      <SearchBar
        value={localQuery}
        onChange={setLocalQuery}
        placeholder="Search favorites by name, path, type, source, or text…"
        className="max-w-xl"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-lg border border-remy-border bg-remy-elevated/50 p-0.5"
          role="group"
          aria-label="View mode"
        >
          {(['list', 'grid'] as const).map((mode) => {
            const active = viewMode === mode
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  active
                    ? 'bg-remy-elevated text-remy-text shadow-sm ring-1 ring-remy-border'
                    : 'text-remy-muted hover:text-remy-subtle'
                }`}
              >
                {mode}
              </button>
            )
          })}
        </div>

        <label className="flex items-center gap-2 text-xs text-remy-muted">
          <span className="font-medium">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as MemoriesSortOption)}
            className="rounded-md border border-remy-border bg-remy-elevated px-2.5 py-1.5 text-xs text-remy-text transition-colors hover:border-zinc-600 focus:border-remy-accent/60 focus:ring-2 focus:ring-remy-accent/20 focus:outline-none"
          >
            {MEMORIES_SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {statusError && (
        <p className="text-xs text-red-300/90" role="status">
          {statusError}
        </p>
      )}

      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          {loading && favoriteItems.length === 0 ? (
            <p className="text-sm text-remy-muted">Loading favorites…</p>
          ) : displayed.length === 0 ? (
            <p className="text-sm text-remy-muted">
              {effectiveQuery
                ? 'No favorites match your search.'
                : 'No favorites yet. Star items from Timeline or Memories.'}
            </p>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {displayed.map(({ item, snippet }) => (
                <MemoryItemCard
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  searchQuery={effectiveQuery}
                  contentSnippet={snippet}
                  onToggleFavorite={() => onToggleFavorite(item)}
                  onSelect={() =>
                    setSelectedId((id) => (id === item.id ? null : item.id))
                  }
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map(({ item, snippet }) => (
                <MemoriesListRow
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  searchQuery={effectiveQuery}
                  contentSnippet={snippet}
                  onToggleFavorite={() => onToggleFavorite(item)}
                  onSelect={() =>
                    setSelectedId((id) => (id === item.id ? null : item.id))
                  }
                />
              ))}
            </div>
          )}

          <p className="mt-6 text-xs text-remy-muted">
            {displayed.length} favorite{displayed.length === 1 ? '' : 's'}
          </p>
        </div>

        {selected && (
          <FileDetailsPanel
            item={selected}
            onClose={() => setSelectedId(null)}
            onToggleFavorite={() => onToggleFavorite(selected)}
            onIndexContent={onIndexContent}
            onReindexContent={onReindexContent}
            onClearIndex={onClearIndex}
          />
        )}
      </div>
    </section>
  )
}
