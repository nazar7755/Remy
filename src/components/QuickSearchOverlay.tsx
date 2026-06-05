import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { HighlightedSnippet } from './HighlightedSnippet'
import { SourceBadge } from './SourceBadge'
import { TagPill } from './TagPill'
import { useFavorites } from '../hooks/useFavorites'
import { useTags } from '../hooks/useTags'
import { useFileScanner } from '../hooks/useFileScanner'
import { useSettings } from '../hooks/useSettings'
import {
  buildRecentActivity,
  clipboardPreviewText,
} from '../lib/quickSearchRecentActivity'
import {
  memoryRowSnippetQuery,
  QUICK_SEARCH_CONTEXT_LABELS,
  QUICK_SEARCH_CONTEXTS,
  quickSearchEmptyMessage,
  quickSearchHasAnyContent,
  quickSearchIsSearchResults,
  quickSearchShowRecentSections,
  RECENT_ACTIVITY_SECTION_LABELS,
  resolveFavoriteItemsForQuickSearch,
  resolveQuickSearchRows,
  type QuickSearchContext,
  type QuickSearchNavRow,
} from '../lib/quickSearchContext'
import type { MemorySearchResult } from '../lib/contentSearch'
import { memoryItemTypeStyles } from '../lib/memoryItemStyles'
import { isTauri, tauriInvoke } from '../lib/tauri'
import { copyText, openFile } from '../services/fileActions'
import type { MemoryItem } from '../types/memoryItem'
import { isClipboardItem } from '../types/memoryItem'

const MAX_RESULTS = 50

const chipBase =
  'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors'
const chipActive = 'bg-remy-accent text-white shadow-sm'
const chipInactive =
  'text-remy-muted hover:bg-remy-elevated/70 hover:text-remy-subtle'

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

function NavRowButton({
  selected,
  index,
  onSelect,
  onActivate,
  registerRef,
  children,
}: {
  selected: boolean
  index: number
  onSelect: (index: number) => void
  onActivate: () => void
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
      onClick={() => onActivate()}
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

function MemoryRowContent({
  row,
  trimmedQuery,
  showRecentSections,
}: {
  row: Extract<QuickSearchNavRow, { kind: 'memory' }>
  trimmedQuery: string
  showRecentSections: boolean
}) {
  const { item } = row.result

  if (showRecentSections && row.section) {
    if (row.section === 'recent-files') {
      return <RecentFileRowContent item={item} />
    }
    if (row.section === 'recent-clipboard') {
      return <RecentClipboardRowContent item={item} />
    }
    return <FavoriteRowContent item={item} />
  }

  return (
    <SearchResultRowContent result={row.result} trimmedQuery={trimmedQuery} />
  )
}

function ContextChips({
  context,
  onChange,
}: {
  context: QuickSearchContext
  onChange: (context: QuickSearchContext) => void
}) {
  return (
    <div
      className="mt-2 flex flex-wrap gap-1.5"
      role="tablist"
      aria-label="Search context"
    >
      {QUICK_SEARCH_CONTEXTS.map((value) => {
        const active = context === value
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(value)}
            className={`${chipBase} ${active ? chipActive : chipInactive}`}
          >
            {QUICK_SEARCH_CONTEXT_LABELS[value]}
          </button>
        )
      })}
    </div>
  )
}

export function QuickSearchOverlay() {
  const settingsState = useSettings()
  const favoritesState = useFavorites()
  const tagsState = useTags()
  const memoryScan = useFileScanner(
    true,
    settingsState.settings,
    favoritesState.favoriteIds,
    tagsState.memoryTags,
  )
  const [query, setQuery] = useState('')
  const [context, setContext] = useState<QuickSearchContext>('all')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentActivity, setRecentActivity] = useState<ReturnType<
    typeof buildRecentActivity
  > | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const registerItemRef = useCallback(
    (index: number, el: HTMLButtonElement | null) => {
      itemRefs.current[index] = el
    },
    [],
  )

  const items = useMemo(() => memoryScan.items ?? [], [memoryScan.items])

  const favoriteItems = useMemo(
    () =>
      resolveFavoriteItemsForQuickSearch(
        items,
        favoritesState.records,
        tagsState.memoryTags,
      ),
    [items, favoritesState.records, tagsState.memoryTags],
  )

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
  const snippetQuery = memoryRowSnippetQuery(context, query)

  const navRows = useMemo(
    () =>
      resolveQuickSearchRows({
        context,
        query,
        items,
        favoriteItems,
        recentActivity,
        allTagNames: tagsState.allTagNames,
        selectedTag,
        maxResults: MAX_RESULTS,
      }),
    [
      context,
      query,
      items,
      favoriteItems,
      recentActivity,
      tagsState.allTagNames,
      selectedTag,
    ],
  )

  const showRecentSections = quickSearchShowRecentSections(context, query)
  const isSearchResults = quickSearchIsSearchResults(
    context,
    query,
    selectedTag,
    navRows,
  )

  const activeIndex =
    navRows.length === 0 ? 0 : Math.min(selectedIndex, navRows.length - 1)

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

  const handleContextChange = useCallback((next: QuickSearchContext) => {
    setContext(next)
    setSelectedIndex(0)
    if (next !== 'tags') {
      setSelectedTag(null)
    }
  }, [])

  const selectTag = useCallback((tagName: string) => {
    setSelectedTag(tagName)
    setSelectedIndex(0)
  }, [])

  useEffect(() => {
    focusInput()
  }, [focusInput])

  useEffect(() => {
    if (memoryScan.loading && items.length === 0) return
    if (favoritesState.loading) return
    snapshotRecentActivity()
  }, [
    memoryScan.loading,
    items.length,
    favoritesState.loading,
    snapshotRecentActivity,
  ])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      void hideOverlay()
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [hideOverlay])

  useEffect(() => {
    if (!isTauri()) return

    const unlisteners: Array<() => void> = []

    void listen('focus-quick-search', () => {
      setQuery('')
      setContext('all')
      setSelectedTag(null)
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
  }, [activeIndex, navRows.length])

  const activateMemoryResult = useCallback(
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

  const activateRow = useCallback(
    (row: QuickSearchNavRow, openInMain: boolean) => {
      if (row.kind === 'tag') {
        setContext('tags')
        selectTag(row.tagName)
        return
      }
      void activateMemoryResult(row.result, openInMain)
    },
    [activateMemoryResult, selectTag],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      void hideOverlay()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (navRows.length === 0) return
      setSelectedIndex((i) => Math.min(i + 1, navRows.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (navRows.length === 0) return
      setSelectedIndex((i) => Math.max(i - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const row = navRows[activeIndex]
      if (!row) return
      const openInMain = event.metaKey || event.ctrlKey
      activateRow(row, openInMain)
    }
  }

  const showLoading =
    memoryScan.loading && items.length === 0 && !recentActivity
  const hasAnyContent = quickSearchHasAnyContent(
    items,
    favoriteItems,
    tagsState.allTagNames,
  )
  const showEmpty = !showLoading && navRows.length === 0
  const emptyMessage = quickSearchEmptyMessage(
    context,
    query,
    selectedTag,
    hasAnyContent,
  )

  const listLabel =
    context === 'tags' && !selectedTag && !trimmedQuery
      ? 'Tags'
      : isSearchResults
        ? 'Search results'
        : 'Recent activity'

  return (
    <div
      className="flex h-svh flex-col overflow-hidden rounded-xl border border-remy-border bg-remy-bg shadow-2xl shadow-black/50"
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          void hideOverlay()
        }
      }}
    >
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
        <ContextChips context={context} onChange={handleContextChange} />
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {context === 'tags' && selectedTag && !trimmedQuery && (
          <div className="flex items-center gap-2 px-3 pt-1 pb-2">
            <TagPill tagName={selectedTag} size="sm" active />
            <button
              type="button"
              onClick={() => {
                setSelectedTag(null)
                setSelectedIndex(0)
              }}
              className="text-[11px] text-remy-muted transition-colors hover:text-remy-text"
            >
              Show all tags
            </button>
          </div>
        )}

        {showLoading && (
          <p className="px-3 py-8 text-center text-sm text-remy-muted">
            Loading memories…
          </p>
        )}

        {showEmpty && (
          <p className="px-3 py-8 text-center text-sm text-remy-muted">
            {emptyMessage}
          </p>
        )}

        {navRows.length > 0 && (
          <ul className="space-y-0.5" role="listbox" aria-label={listLabel}>
            {navRows.map((row, index) => (
              <li key={row.kind === 'tag' ? `tag-${row.tagName}` : row.result.item.id}>
                {row.kind === 'memory' &&
                  showRecentSections &&
                  row.showSectionHeader &&
                  row.section && (
                    <h3 className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-remy-muted uppercase first:pt-1">
                      {RECENT_ACTIVITY_SECTION_LABELS[row.section]}
                    </h3>
                  )}
                <NavRowButton
                  selected={index === activeIndex}
                  index={index}
                  onSelect={setSelectedIndex}
                  onActivate={() => activateRow(row, false)}
                  registerRef={registerItemRef}
                >
                  {row.kind === 'tag' ? (
                    <TagPill tagName={row.tagName} size="sm" />
                  ) : (
                    <MemoryRowContent
                      row={row}
                      trimmedQuery={snippetQuery}
                      showRecentSections={showRecentSections}
                    />
                  )}
                </NavRowButton>
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
