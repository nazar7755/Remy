import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { HighlightedSnippet } from './HighlightedSnippet'
import { SourceBadge } from './SourceBadge'
import { useFileScanner } from '../hooks/useFileScanner'
import { useSettings } from '../hooks/useSettings'
import { searchMemoryItems } from '../lib/contentSearch'
import { memoryItemTypeStyles } from '../lib/memoryItemStyles'
import { isTauri, tauriInvoke } from '../lib/tauri'
import { copyText, openFile } from '../services/fileActions'
import type { MemoryItem } from '../types/memoryItem'
import { isClipboardItem } from '../types/memoryItem'

const MAX_RESULTS = 50

function typeBadgeClass(type: MemoryItem['type']): string {
  return memoryItemTypeStyles[type].badge
}

export function QuickSearchOverlay() {
  const settingsState = useSettings()
  const memoryScan = useFileScanner(true, settingsState.settings, new Set())
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const items = useMemo(() => memoryScan.items ?? [], [memoryScan.items])

  const results = useMemo(() => {
    const searched = searchMemoryItems(items, query, 'All')
    return searched.slice(0, MAX_RESULTS)
  }, [items, query])

  const activeIndex =
    results.length === 0
      ? 0
      : Math.min(selectedIndex, results.length - 1)

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
    if (!isTauri()) return

    const unlisteners: Array<() => void> = []

    void listen('focus-quick-search', () => {
      setQuery('')
      setSelectedIndex(0)
      focusInput()
    }).then((fn) => {
      unlisteners.push(fn)
    })

    return () => {
      for (const unlisten of unlisteners) {
        unlisten()
      }
    }
  }, [focusInput])

  useEffect(() => {
    const el = itemRefs.current[activeIndex]
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, results.length])

  const activateResult = useCallback(
    async (result: (typeof results)[number], openInMain: boolean) => {
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
      if (results.length === 0) return
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (results.length === 0) return
      setSelectedIndex((i) => Math.max(i - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const selected = results[activeIndex]
      if (!selected) return
      const openInMain = event.metaKey || event.ctrlKey
      void activateResult(selected, openInMain)
    }
  }

  const trimmedQuery = query.trim()

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
        {memoryScan.loading && items.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-remy-muted">
            Loading memories…
          </p>
        )}

        {!memoryScan.loading && results.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-remy-muted">
            {trimmedQuery ? 'No results found' : 'No memories yet'}
          </p>
        )}

        {results.length > 0 && (
          <ul className="space-y-0.5" role="listbox" aria-label="Search results">
            {results.map((result, index) => {
              const { item, snippet } = result
              const selected = index === activeIndex
              const fallbackSnippet =
                snippet ??
                (isClipboardItem(item) && item.content
                  ? item.content.slice(0, 120).replace(/\s+/g, ' ').trim()
                  : item.filePath)

              return (
                <li key={item.id}>
                  <button
                    ref={(el) => {
                      itemRefs.current[index] = el
                    }}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => void activateResult(result, false)}
                    className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? 'bg-remy-accent/15 ring-1 ring-remy-accent/30'
                        : 'hover:bg-remy-elevated/80'
                    }`}
                  >
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
                    {fallbackSnippet && (
                      trimmedQuery && snippet ? (
                        <HighlightedSnippet
                          snippet={fallbackSnippet}
                          query={trimmedQuery}
                          className="truncate text-xs leading-snug"
                        />
                      ) : (
                        <p className="truncate text-xs leading-snug text-remy-muted">
                          {fallbackSnippet}
                        </p>
                      )
                    )}
                  </button>
                </li>
              )
            })}
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
