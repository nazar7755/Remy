import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { HighlightedSnippet } from './HighlightedSnippet'
import { SourceBadge } from './SourceBadge'
import { useFavorites } from '../hooks/useFavorites'
import { useFileScanner } from '../hooks/useFileScanner'
import { useSettings } from '../hooks/useSettings'
import { searchMemoryItems, type MemorySearchResult } from '../lib/contentSearch'
import { memoryItemTypeStyles } from '../lib/memoryItemStyles'
import {
  buildRecentActivity,
  buildRecentActivityRows,
  clipboardPreviewText,
  recentActivityIsEmpty,
  RECENT_ACTIVITY_SECTION_LABELS,
  type RecentActivity,
  type RecentActivityRow,
} from '../lib/quickSearchRecentActivity'
import { isTauri, tauriInvoke } from '../lib/tauri'
import { copyText, openFile } from '../services/fileActions'
import type { MemoryItem } from '../types/memoryItem'
import { isClipboardItem } from '../types/memoryItem'

const MAX_RESULTS = 50

function typeBadgeClass(type: MemoryItem['type']): string {
  return memoryItemTypeStyles[type].badge
}

function SearchResultRowContent({
  result,
  trimmedQuery,
}: {
  result: MemorySearchResult
  trimmedQuery: string
}) {
  const { item, snippet } = result
  const fallbackSnippet =
    snippet ??
    (isClipboardItem(item) && item.content
      ? item.content.slice(0, 120).replace(/\s+/g, ' ').trim()
      : item.filePath)

  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-remy-text">
          {item.fileName}
        </span>
        <SourceBadge source={item.source} />
        <span
          className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${typeBadgeClass(item.type)}`}
        >
          {item.type}
        </span>
      </div>
      {fallbackSnippet &&
        (trimmedQuery && snippet ? (
          <HighlightedSnippet
            snippet={fallbackSnippet}
            query={trimmedQuery}
            className="truncate text-xs leading-snug"
          />
        ) : (
          <p className="truncate text-xs leading-snug text-remy-muted">
            {fallbackSnippet}
          </p>
        ))}
    </>
  )
}

function ResultRowButton({
  result,
  selected,
  index,
  onSelect,
  onActivate,
  registerRef,
  children,
}: {
  result: MemorySearchResult
  selected: boolean
  index: number
  onSelect: (index: number) => void
  onActivate: (result: MemorySearchResult, openInMain: boolean) => void
  registerRef: (index: number, el: HTMLButtonElement | null) => void
  children: React.ReactNode
}) {
  return (
    <button
      ref={(el) => {
        registerRef(index, el)
      }}
      type="button"
      role="option"
      aria-selected={selected}
      onMouseEnter={() => onSelect(index)}
      onClick={() => void onActivate(result, false)}
      className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors ${
        selected
          ? 'bg-remy-accent/15 ring-1 ring-remy-accent/30'
          : 'hover:bg-remy-elevated/80'
      }`}
    >
      {children}
    </button>
  )
}

function RecentFileRowContent({ item }: { item: MemoryItem }) {
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-remy-text">
          {item.fileName}
        </span>
        <SourceBadge source={item.source} />
        <span
          className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${typeBadgeClass(item.type)}`}
        >
          {item.type}
        </span>
        <time
          dateTime={item.createdAtIso}
          className="shrink-0 text-[11px] tabular-nums text-remy-muted"
        >
          {item.createdAt}
        </time>
      </div>
    </>
  )
}

function RecentClipboardRowContent({ item }: { item: MemoryItem }) {
  return (
    <>
      <p className="truncate text-sm text-remy-text">
        {clipboardPreviewText(item)}
      </p>
      <time
        dateTime={item.createdAtIso}
        className="text-[11px] tabular-nums text-remy-muted"
      >
        {item.createdAt}
      </time>
    </>
  )
}

function FavoriteRowContent({ item }: { item: MemoryItem }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-remy-text">
        {item.fileName}
      </span>
      <span
        className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${typeBadgeClass(item.type)}`}
      >
        {item.type}
      </span>
    </div>
  )
}

function RecentActivityRowContent({
  row,
}: {
  row: RecentActivityRow
}) {
  const { item } = row.result

  if (row.section === 'recent-files') {
    return <RecentFileRowContent item={item} />
  }
  if (row.section === 'recent-clipboard') {
    return <RecentClipboardRowContent item={item} />
  }
  return <FavoriteRowContent item={item} />
}

export function QuickSearchOverlay() {
  const settingsState = useSettings()
  const favoritesState = useFavorites()
  const memoryScan = useFileScanner(
    true,
    settingsState.settings,
    favoritesState.favoriteIds,
  )
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(
    null,
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const hasSnapshottedRef = useRef(false)

  const registerItemRef = useCallback(
    (index: number, el: HTMLButtonElement | null) => {
      itemRefs.current[index] = el
    },
    [],
  )

  const items = useMemo(() => memoryScan.items ?? [], [memoryScan.items])

  const snapshotRecentActivity = useCallback(() => {
    const clipboardItems = items.filter(isClipboardItem)
    setRecentActivity(
      buildRecentActivity(
        memoryScan.fileItems,
        clipboardItems,
        favoritesState.records,
        items,
      ),
    )
  }, [memoryScan.fileItems, items, favoritesState.records])

  const trimmedQuery = query.trim()
  const isSearchMode = trimmedQuery.length > 0

  const searchResults = useMemo(() => {
    const searched = searchMemoryItems(items, query, 'All')
    return searched.slice(0, MAX_RESULTS)
  }, [items, query])

  const recentRows = useMemo(() => {
    if (!recentActivity) return []
    return buildRecentActivityRows(recentActivity)
  }, [recentActivity])

  const navigableResults = isSearchMode
    ? searchResults
    : recentRows.map((row) => row.result)

  const activeIndex =
    navigableResults.length === 0
      ? 0
      : Math.min(selectedIndex, navigableResults.length - 1)

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      const input = inputRef.current
      if (!input) return
      input.focus()
      input.select()
    })
  }, [])

  const hideOverlay = useCallback(async () => {
    if (!isTauri()) return
    await tauriInvoke('hide_quick_search_overlay')
  }, [])

  useEffect(() => {
    focusInput()
  }, [focusInput])

  useEffect(() => {
    if (memoryScan.loading && items.length === 0) return
    if (favoritesState.loading) return
    if (!hasSnapshottedRef.current) {
      snapshotRecentActivity()
      hasSnapshottedRef.current = true
    }
  }, [
    memoryScan.loading,
    items.length,
    favoritesState.loading,
    snapshotRecentActivity,
  ])

  useEffect(() => {
    if (!isTauri()) return

    const unlisteners: Array<() => void> = []

    void listen('focus-quick-search', () => {
      setQuery('')
      setSelectedIndex(0)
      snapshotRecentActivity()
      focusInput()
    }).then((fn) => {
      unlisteners.push(fn)
    })

    return () => {
      for (const unlisten of unlisteners) {
        unlisten()
      }
    }
  }, [focusInput, snapshotRecentActivity])

  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, navigableResults.length])

  const activateResult = useCallback(
    async (result: MemorySearchResult, openInMain: boolean) => {
      const { item } = result

      if (openInMain) {
        await tauriInvoke('open_memory_in_main_app', {
          id: item.id,
          fileName: item.fileName,
        })
        return
      }

      if (isClipboardItem(item)) {
        if (item.content) {
          await copyText(item.content)
        }
        await hideOverlay()
        return
      }

      await openFile(item.filePath)
      await hideOverlay()
    },
    [hideOverlay],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      void hideOverlay()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (navigableResults.length === 0) return
      setSelectedIndex((i) => Math.min(i + 1, navigableResults.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (navigableResults.length === 0) return
      setSelectedIndex((i) => Math.max(i - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const selected = navigableResults[activeIndex]
      if (!selected) return
      const openInMain = event.metaKey || event.ctrlKey
      void activateResult(selected, openInMain)
    }
  }

  const showLoading =
    memoryScan.loading && items.length === 0 && !recentActivity
  const showRecentEmpty =
    !isSearchMode &&
    recentActivity !== null &&
    recentActivityIsEmpty(recentActivity)
  const showSearchEmpty = isSearchMode && searchResults.length === 0

  return (
    <div className="flex h-svh flex-col overflow-hidden rounded-xl border border-remy-border bg-remy-bg shadow-2xl shadow-black/50">
      <div className="shrink-0 border-b border-remy-border px-4 py-3">
        <div className="relative">
          <svg
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-remy-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search files, clipboard, and indexed content…"
            className="h-11 w-full rounded-lg border border-remy-border bg-remy-elevated pr-4 pl-9 text-sm text-remy-text shadow-sm transition-colors placeholder:text-remy-muted hover:border-zinc-600 focus:border-remy-accent/60 focus:ring-2 focus:ring-remy-accent/20 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {showLoading && (
          <p className="px-3 py-8 text-center text-sm text-remy-muted">
            Loading memories…
          </p>
        )}

        {showRecentEmpty && (
          <p className="px-3 py-8 text-center text-sm text-remy-muted">
            No recent activity yet
          </p>
        )}

        {showSearchEmpty && (
          <p className="px-3 py-8 text-center text-sm text-remy-muted">
            No results found
          </p>
        )}

        {isSearchMode && searchResults.length > 0 && (
          <ul className="space-y-0.5" role="listbox" aria-label="Search results">
            {searchResults.map((result, index) => (
              <li key={result.item.id}>
                <ResultRowButton
                  result={result}
                  selected={index === activeIndex}
                  index={index}
                  onSelect={setSelectedIndex}
                  onActivate={activateResult}
                  registerRef={registerItemRef}
                >
                  <SearchResultRowContent
                    result={result}
                    trimmedQuery={trimmedQuery}
                  />
                </ResultRowButton>
              </li>
            ))}
          </ul>
        )}

        {!isSearchMode && recentRows.length > 0 && (
          <ul
            className="space-y-0.5"
            role="listbox"
            aria-label="Recent activity"
          >
            {recentRows.map((row, index) => (
              <li key={`${row.section}-${row.result.item.id}`}>
                {row.showSectionHeader && (
                  <h3 className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-remy-muted uppercase first:pt-1">
                    {RECENT_ACTIVITY_SECTION_LABELS[row.section]}
                  </h3>
                )}
                <ResultRowButton
                  result={row.result}
                  selected={index === activeIndex}
                  index={index}
                  onSelect={setSelectedIndex}
                  onActivate={activateResult}
                  registerRef={registerItemRef}
                >
                  <RecentActivityRowContent row={row} />
                </ResultRowButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-remy-border px-4 py-2 text-[11px] text-remy-muted">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="rounded border border-remy-border bg-remy-elevated px-1 py-0.5 font-mono">
              ↑↓
            </kbd>{' '}
            navigate
          </span>
          <span>
            <kbd className="rounded border border-remy-border bg-remy-elevated px-1 py-0.5 font-mono">
              ↵
            </kbd>{' '}
            open
          </span>
          <span>
            <kbd className="rounded border border-remy-border bg-remy-elevated px-1 py-0.5 font-mono">
              ⌘↵
            </kbd>{' '}
            open in Remy
          </span>
        </div>
        <span>
          <kbd className="rounded border border-remy-border bg-remy-elevated px-1 py-0.5 font-mono">
            esc
          </kbd>{' '}
          close
        </span>
      </footer>
    </div>
  )
}
