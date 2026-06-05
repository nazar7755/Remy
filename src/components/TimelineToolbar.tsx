import { useEffect, useState } from 'react'
import { folderDisplayName } from '../lib/watchedFolders'
import { TagPill } from './TagPill'
import {
  MEMORIES_SORT_OPTIONS,
  TIMELINE_DEFAULT_FOLDER_FILTERS,
  TIMELINE_TYPE_FILTERS,
  type MemoriesSortOption,
  type MemoriesViewMode,
  type TimelineFolderFilter,
  type TimelineTypeFilter,
} from '../types/memoriesPage'

const pillBase =
  'shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors'
const pillActive = 'bg-remy-elevated text-remy-text ring-1 ring-remy-border'
const pillInactive =
  'text-remy-muted hover:bg-remy-elevated/60 hover:text-remy-subtle'

const controlSelectClassName =
  'rounded-md border border-remy-border bg-remy-elevated px-2 py-1.5 text-xs text-remy-text transition-colors hover:border-zinc-600 focus:border-remy-accent/60 focus:ring-2 focus:ring-remy-accent/20 focus:outline-none'

interface FolderContextMenuState {
  path: string
  name: string
  x: number
  y: number
}

interface TimelineToolbarProps {
  folderFilter: TimelineFolderFilter
  customFolders: string[]
  typeFilter: TimelineTypeFilter
  sort: MemoriesSortOption
  viewMode: MemoriesViewMode
  loading: boolean
  addingFolder?: boolean
  foldersDisabled?: boolean
  tagFilter: string | 'All'
  availableTags: string[]
  onFolderFilterChange: (filter: TimelineFolderFilter) => void
  onAddFolder: () => void
  onRemoveCustomFolder: (path: string) => void
  onTypeFilterChange: (filter: TimelineTypeFilter) => void
  onTagFilterChange: (filter: string | 'All') => void
  onSortChange: (sort: MemoriesSortOption) => void
  onViewModeChange: (mode: MemoriesViewMode) => void
  onRefresh: () => void
}

export function TimelineToolbar({
  folderFilter,
  customFolders,
  typeFilter,
  sort,
  viewMode,
  loading,
  addingFolder = false,
  foldersDisabled = false,
  tagFilter,
  availableTags,
  onFolderFilterChange,
  onAddFolder,
  onRemoveCustomFolder,
  onTypeFilterChange,
  onTagFilterChange,
  onSortChange,
  onViewModeChange,
  onRefresh,
}: TimelineToolbarProps) {
  const [folderMenu, setFolderMenu] = useState<FolderContextMenuState | null>(
    null,
  )

  useEffect(() => {
    if (!folderMenu) return

    const close = () => setFolderMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [folderMenu])

  const openFolderMenu = (
    path: string,
    name: string,
    event: React.MouseEvent,
  ) => {
    event.preventDefault()
    setFolderMenu({ path, name, x: event.clientX, y: event.clientY })
  }

  const handleRemoveFromMenu = () => {
    if (!folderMenu) return
    onRemoveCustomFolder(folderMenu.path)
    setFolderMenu(null)
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b border-remy-border pb-2">
        <div
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Filter by folder"
        >
          {TIMELINE_DEFAULT_FOLDER_FILTERS.map((filter) => {
            const active = folderFilter === filter
            return (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={foldersDisabled}
                onClick={() => onFolderFilterChange(filter)}
                className={`${pillBase} ${active ? pillActive : pillInactive} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {filter}
              </button>
            )
          })}

          {customFolders.map((path) => {
            const name = folderDisplayName(path)
            const active = folderFilter === name
            return (
              <button
                key={path}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={foldersDisabled}
                title={`${name} — right-click to remove`}
                onClick={() => onFolderFilterChange(name)}
                onContextMenu={(e) => openFolderMenu(path, name, e)}
                className={`${pillBase} ${active ? pillActive : pillInactive} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {name}
              </button>
            )
          })}

          <span
            className="mx-0.5 h-4 w-px shrink-0 bg-remy-border/80"
            aria-hidden
          />

          <button
            type="button"
            disabled={foldersDisabled || addingFolder}
            onClick={onAddFolder}
            className="shrink-0 rounded-md bg-remy-accent px-2.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_10px_rgba(139,92,246,0.2)] transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {addingFolder ? 'Opening…' : '+ Folder'}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 border-l border-remy-border pl-2">
          <label className="flex shrink-0 items-center gap-1.5 text-xs text-remy-muted">
            <span className="hidden font-medium sm:inline">Type</span>
            <select
              value={typeFilter}
              onChange={(e) =>
                onTypeFilterChange(e.target.value as TimelineTypeFilter)
              }
              className={controlSelectClassName}
              aria-label="Filter by type"
            >
              {TIMELINE_TYPE_FILTERS.map((filter) => (
                <option key={filter} value={filter}>
                  {filter}
                </option>
              ))}
            </select>
          </label>

          <label className="flex shrink-0 items-center gap-1.5 text-xs text-remy-muted">
            <span className="hidden font-medium sm:inline">Sort</span>
            <select
              value={sort}
              onChange={(e) =>
                onSortChange(e.target.value as MemoriesSortOption)
              }
              className={controlSelectClassName}
              aria-label="Sort items"
            >
              {MEMORIES_SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div
            className="inline-flex shrink-0 rounded-md border border-remy-border bg-remy-elevated/50 p-0.5"
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
                  onClick={() => onViewModeChange(mode)}
                  className={`rounded px-2 py-1 text-xs font-medium capitalize transition-colors ${
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

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="shrink-0 rounded-md border border-remy-border bg-remy-elevated px-2.5 py-1.5 text-xs font-medium text-remy-subtle transition-colors hover:border-zinc-600 hover:text-remy-text disabled:opacity-50"
          >
            {loading ? 'Scanning…' : 'Rescan'}
          </button>
        </div>
      </div>

      {availableTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto overscroll-x-contain border-b border-remy-border/60 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 text-[10px] font-medium tracking-wide text-remy-muted uppercase">
            Tags
          </span>
          <button
            type="button"
            onClick={() => onTagFilterChange('All')}
            className={`${pillBase} ${tagFilter === 'All' ? pillActive : pillInactive}`}
          >
            All
          </button>
          {availableTags.map((tagName) => (
            <TagPill
              key={tagName}
              tagName={tagName}
              size="sm"
              active={tagFilter === tagName}
              onClick={() =>
                onTagFilterChange(tagFilter === tagName ? 'All' : tagName)
              }
            />
          ))}
        </div>
      )}

      {folderMenu && (
        <div
          className="fixed z-50 min-w-[9rem] rounded-lg border border-remy-border bg-remy-surface py-1 shadow-lg"
          style={{ left: folderMenu.x, top: folderMenu.y }}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleRemoveFromMenu}
            className="w-full px-3 py-1.5 text-left text-xs text-red-300 transition-colors hover:bg-red-950/40"
          >
            Remove “{folderMenu.name}”
          </button>
        </div>
      )}
    </>
  )
}
