import { useEffect, useMemo, useState } from 'react'
import {
  itemMatchesQuery,
  resolveSnippet,
} from '../lib/contentSearch'
import { folderDisplayName } from '../lib/watchedFolders'
import {
  itemMatchesFolderFilter,
  itemMatchesTypeFilter,
} from '../lib/memoriesFilters'
import { sortMemoryItems } from '../lib/memoriesSort'
import {
  loadMemoriesPreferences,
  saveMemoriesPreferences,
} from '../services/memoriesPreferences'
import {
  type MemoriesSortOption,
  type MemoriesViewMode,
  type TimelineFolderFilter,
  type TimelineTypeFilter,
} from '../types/memoriesPage'
import type { MemoryItem } from '../types/memoryItem'
import { EmptyState } from './EmptyState'
import { FileDetailsPanel } from './FileDetailsPanel'
import { MemoriesListRow } from './MemoriesListRow'
import { MemoryItemCard } from './MemoryItemCard'
import { TimelineToolbar } from './TimelineToolbar'
import {
  primaryButtonClassName,
  secondaryButtonClassName,
} from '../lib/uiButtons'

interface FileMemoryTimelineProps {
  items: MemoryItem[]
  loading: boolean
  error: string | null
  isMocked: boolean
  isWatching: boolean
  lastUpdatedAt: Date | null
  indexNotice: string | null
  clipboardError: string | null
  query: string
  customWatchedFolders: string[]
  addingFolder?: boolean
  foldersDisabled?: boolean
  folderError?: string | null
  onAddFolder: () => void
  onRemoveCustomFolder: (path: string) => void | Promise<void>
  onRefresh: () => void
  onIndexContent: (filePath: string) => void
  onReindexContent: (filePath: string) => void
  onToggleFavorite: (item: MemoryItem) => void
  previewEmpty?: boolean
}

export function FileMemoryTimeline({
  items,
  loading,
  error,
  indexNotice,
  clipboardError,
  query,
  customWatchedFolders,
  addingFolder = false,
  foldersDisabled = false,
  folderError,
  onAddFolder,
  onRemoveCustomFolder,
  onRefresh,
  onIndexContent,
  onReindexContent,
  onToggleFavorite,
  previewEmpty = false,
}: FileMemoryTimelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [folderFilter, setFolderFilter] = useState<TimelineFolderFilter>('All')
  const [typeFilter, setTypeFilter] = useState<TimelineTypeFilter>('All')
  const [viewMode, setViewMode] = useState<MemoriesViewMode>(() =>
    loadMemoriesPreferences().viewMode,
  )
  const [sort, setSort] = useState<MemoriesSortOption>(() =>
    loadMemoriesPreferences().sort,
  )
  const q = query.trim()

  const effectiveItems = useMemo(
    () => (previewEmpty ? [] : items),
    [previewEmpty, items],
  )

  useEffect(() => {
    saveMemoriesPreferences({ viewMode, sort })
  }, [viewMode, sort])

  const displayed = useMemo(() => {
    const filtered = effectiveItems.filter(
      (item) =>
        itemMatchesFolderFilter(item, folderFilter) &&
        itemMatchesTypeFilter(item, typeFilter) &&
        itemMatchesQuery(item, q),
    )
    const withSnippets = filtered.map((item) => ({
      item,
      snippet: resolveSnippet(item, q),
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
  }, [effectiveItems, folderFilter, typeFilter, q, sort])

  const selected = useMemo(() => {
    if (!selectedId) return null
    if (!effectiveItems.some((item) => item.id === selectedId)) return null
    return displayed.find((r) => r.item.id === selectedId)?.item ?? null
  }, [selectedId, displayed, effectiveItems])

  useEffect(() => {
    setSelectedId(null)
  }, [query, folderFilter, typeFilter, sort, viewMode])

  const handleFolderFilterChange = (filter: TimelineFolderFilter) => {
    setFolderFilter(filter)
  }

  const handleRemoveCustomFolder = async (path: string) => {
    const removedName = folderDisplayName(path)
    await onRemoveCustomFolder(path)
    if (folderFilter === removedName) {
      handleFolderFilterChange('All')
    }
  }

  const hasActiveFilters =
    q.length > 0 || folderFilter !== 'All' || typeFilter !== 'All'

  return (
    <section className="space-y-2">
      <TimelineToolbar
        folderFilter={folderFilter}
        customFolders={customWatchedFolders}
        typeFilter={typeFilter}
        sort={sort}
        viewMode={viewMode}
        loading={loading}
        addingFolder={addingFolder}
        foldersDisabled={foldersDisabled}
        onFolderFilterChange={handleFolderFilterChange}
        onAddFolder={onAddFolder}
        onRemoveCustomFolder={(path) => void handleRemoveCustomFolder(path)}
        onTypeFilterChange={setTypeFilter}
        onSortChange={setSort}
        onViewModeChange={setViewMode}
        onRefresh={onRefresh}
      />

      {folderError && (
        <p className="text-xs text-red-300/90" role="status">
          {folderError}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-300/90" role="status">
          {error}
        </p>
      )}
      {clipboardError && (
        <p className="text-xs text-amber-200/90" role="status">
          {clipboardError}
        </p>
      )}
      {indexNotice && !error && (
        <p className="text-xs text-amber-200/90" role="status">
          {indexNotice}
        </p>
      )}

      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          {loading && effectiveItems.length === 0 ? (
            <p className="text-sm text-remy-muted">Scanning memory folders…</p>
          ) : displayed.length === 0 ? (
            hasActiveFilters ? (
              <p className="text-sm text-remy-muted">No items match your filters.</p>
            ) : (
              <EmptyState
                title="No memories yet"
                description="Add a folder or enable scanning to start building your memory."
              >
                <button
                  type="button"
                  onClick={onAddFolder}
                  disabled={addingFolder || foldersDisabled}
                  className={primaryButtonClassName}
                >
                  {addingFolder ? 'Opening…' : 'Add Folder'}
                </button>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className={secondaryButtonClassName}
                >
                  {loading ? 'Scanning…' : 'Scan now'}
                </button>
              </EmptyState>
            )
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {displayed.map(({ item, snippet }) => (
                <MemoryItemCard
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  searchQuery={q}
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
                  searchQuery={q}
                  contentSnippet={snippet}
                  onToggleFavorite={() => onToggleFavorite(item)}
                  onSelect={() =>
                    setSelectedId((id) => (id === item.id ? null : item.id))
                  }
                />
              ))}
            </div>
          )}

          {displayed.length > 0 && (
            <p className="mt-6 text-xs text-remy-muted">
              {displayed.length} of {effectiveItems.length} item
              {effectiveItems.length === 1 ? '' : 's'}
              {typeFilter !== 'All' ? ` · ${typeFilter}` : ''}
              {folderFilter !== 'All' ? ` · ${folderFilter}` : ''}
            </p>
          )}
        </div>

        {selected && (
          <FileDetailsPanel
            item={selected}
            onClose={() => setSelectedId(null)}
            onToggleFavorite={() => onToggleFavorite(selected)}
            onIndexContent={onIndexContent}
            onReindexContent={onReindexContent}
          />
        )}
      </div>
    </section>
  )
}
