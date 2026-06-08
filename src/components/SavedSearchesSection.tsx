import { useEffect, useState } from 'react'
import type { SavedSearch } from '../types/savedSearch'

interface ContextMenuState {
  id: string
  name: string
  x: number
  y: number
}

interface SavedSearchesSectionProps {
  searches: SavedSearch[]
  activeQuery: string
  loading?: boolean
  emptyHint?: string | null
  onSelect: (query: string) => void
  onSaveCurrent: () => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export function SavedSearchesSection({
  searches,
  activeQuery,
  loading = false,
  emptyHint = null,
  onSelect,
  onSaveCurrent,
  onRename,
  onDelete,
}: SavedSearchesSectionProps) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    if (!menu) return

    const close = () => setMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  const normalizedActive = activeQuery.trim().toLowerCase()

  const openMenu = (search: SavedSearch, event: React.MouseEvent) => {
    event.preventDefault()
    setMenu({
      id: search.id,
      name: search.name,
      x: event.clientX,
      y: event.clientY,
    })
  }

  const handleRename = () => {
    if (!menu) return
    const next = window.prompt('Rename saved search:', menu.name)
    if (next?.trim()) {
      onRename(menu.id, next.trim())
    }
    setMenu(null)
  }

  return (
    <>
      <div className="mt-3 border-t border-remy-border pt-3">
        <div className="mb-1.5 flex items-center justify-between gap-1 px-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <svg
              className="h-3.5 w-3.5 shrink-0 text-remy-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <span className="truncate text-[11px] font-medium uppercase tracking-wide text-remy-muted">
              Saved Searches
            </span>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onSaveCurrent}
            title="Save current search"
            aria-label="Save current search"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-remy-border bg-remy-elevated text-sm font-semibold text-remy-subtle shadow-sm transition-colors hover:border-remy-accent/40 hover:bg-remy-accent/10 hover:text-remy-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>

        {emptyHint && (
          <p className="mb-1 px-2.5 text-[11px] text-amber-400/90">{emptyHint}</p>
        )}

        {loading && searches.length === 0 ? (
          <p className="px-2.5 py-1 text-[11px] text-remy-muted">Loading…</p>
        ) : searches.length === 0 ? (
          <p className="px-2.5 py-1 text-[11px] leading-snug text-remy-muted">
            Save frequent queries like{' '}
            <span className="text-remy-subtle">tag:edu</span>
          </p>
        ) : (
          <ul className="space-y-0.5">
            {searches.map((search) => {
              const isActive =
                normalizedActive.length > 0 &&
                search.query.trim().toLowerCase() === normalizedActive
              const showDelete = hoveredId === search.id
              return (
                <li
                  key={search.id}
                  className="group relative"
                  onMouseEnter={() => setHoveredId(search.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(search.query)}
                    onContextMenu={(e) => openMenu(search, e)}
                    title={`${search.name} — ${search.query}`}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 pr-7 text-left text-xs transition-colors ${
                      isActive
                        ? 'bg-remy-elevated font-medium text-remy-text'
                        : 'text-remy-subtle hover:bg-remy-elevated/60 hover:text-remy-text'
                    }`}
                  >
                    <svg
                      className={`h-3.5 w-3.5 shrink-0 ${
                        isActive ? 'text-remy-accent' : 'text-remy-muted'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                      />
                    </svg>
                    <span className="min-w-0 flex-1 truncate">{search.name}</span>
                  </button>
                  {showDelete && (
                    <button
                      type="button"
                      aria-label={`Delete ${search.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(search.id)
                      }}
                      className="absolute top-1/2 right-1.5 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-remy-muted transition-colors hover:bg-remy-elevated hover:text-red-400"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {menu && (
        <div
          className="fixed z-50 min-w-[140px] rounded-md border border-remy-border bg-remy-surface py-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs text-remy-subtle hover:bg-remy-elevated/60 hover:text-remy-text"
            onClick={handleRename}
          >
            Rename
          </button>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-xs text-red-400 hover:bg-remy-elevated/60"
            onClick={() => {
              onDelete(menu.id)
              setMenu(null)
            }}
          >
            Delete
          </button>
        </div>
      )}
    </>
  )
}
