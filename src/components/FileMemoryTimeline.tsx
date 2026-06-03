import { useEffect, useMemo, useState } from 'react'
import { searchMemoryItems } from '../lib/contentSearch'
import { sourceBadgeStyles } from '../lib/sourceStyles'
import { formatLastUpdated } from '../lib/formatLastUpdated'
import type { FolderPaths, MemoryItem, SourceFilter } from '../types/memoryItem'
import { FileDetailsPanel } from './FileDetailsPanel'
import { MemoryItemCard } from './MemoryItemCard'
import { SourceFilterBar } from './SourceFilter'

interface FileMemoryTimelineProps {
  items: MemoryItem[]
  folderPaths: FolderPaths | null
  loading: boolean
  error: string | null
  isMocked: boolean
  isWatching: boolean
  lastUpdatedAt: Date | null
  indexNotice: string | null
  clipboardError: string | null
  query: string
  onRefresh: () => void
  onIndexContent: (filePath: string) => void
  onReindexContent: (filePath: string) => void
  onClearIndex: (filePath: string) => void
  onToggleFavorite: (item: MemoryItem) => void
}

export function FileMemoryTimeline({
  items,
  folderPaths,
  loading,
  error,
  isMocked,
  isWatching,
  lastUpdatedAt,
  indexNotice,
  clipboardError,
  query,
  onRefresh,
  onIndexContent,
  onReindexContent,
  onClearIndex,
  onToggleFavorite,
}: FileMemoryTimelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('All')
  const q = query.trim()
  const searchResults = useMemo(
    () => searchMemoryItems(items, q, sourceFilter),
    [items, q, sourceFilter],
  )

  const selected =
    searchResults.find((r) => r.item.id === selectedId)?.item ??
    items.find((item) => item.id === selectedId) ??
    null

  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId(null)
    }
  }, [items, selectedId])

  useEffect(() => {
    setSelectedId(null)
  }, [query, sourceFilter])

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium tracking-wider text-remy-muted uppercase">
            Memory timeline
          </h2>
          {folderPaths && (
            <div className="mt-2 space-y-0.5 font-mono text-[10px] text-remy-muted">
              <p>Downloads · {folderPaths.downloads}</p>
              <p>Desktop · {folderPaths.desktop}</p>
              <p>Documents · {folderPaths.documents}</p>
            </div>
          )}
          {isWatching && (
            <div className="mt-2 space-y-0.5 text-xs text-remy-muted">
              <p className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]"
                  aria-hidden
                />
                Watching Downloads, Desktop, Documents, and clipboard
              </p>
              <p>
                Last updated:{' '}
                {lastUpdatedAt
                  ? formatLastUpdated(lastUpdatedAt)
                  : loading
                    ? '…'
                    : '—'}
              </p>
              <p className="text-remy-subtle">
                Index txt, pdf, and docx from the details panel to search inside files
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isMocked ? (
            <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-200">
              Mock data · run npm run tauri:dev for real files
            </span>
          ) : (
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-200">
              Live filesystem
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-md border border-remy-border bg-remy-elevated px-2.5 py-1.5 text-xs text-remy-subtle transition-colors hover:border-zinc-600 hover:text-remy-text disabled:opacity-50"
          >
            {loading ? 'Scanning…' : 'Rescan'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SourceFilterBar value={sourceFilter} onChange={setSourceFilter} />
      </div>

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
          {loading && items.length === 0 ? (
            <p className="text-sm text-remy-muted">Scanning memory folders…</p>
          ) : searchResults.length === 0 ? (
            <p className="text-sm text-remy-muted">
              {q || sourceFilter !== 'All'
                ? 'No files match your filters.'
                : 'No supported files found.'}
            </p>
          ) : (
            <div className="relative space-y-3">
              <div
                className="absolute top-2 bottom-2 left-[17px] w-px bg-gradient-to-b from-remy-border via-remy-border/50 to-transparent"
                aria-hidden
              />
              {searchResults.map(({ item, snippet }) => {
                const dotStyle = sourceBadgeStyles[item.source].dot
                return (
                  <div key={item.id} className="relative pl-10">
                    <div
                      className={`absolute top-5 left-[13px] h-2 w-2 rounded-full border-2 border-remy-bg ${dotStyle} ${
                        selectedId === item.id ? 'ring-2 ring-remy-accent/40' : ''
                      }`}
                      aria-hidden
                    />
                    <MemoryItemCard
                      item={item}
                      isSelected={selectedId === item.id}
                      searchQuery={q}
                      contentSnippet={snippet}
                      onToggleFavorite={() => onToggleFavorite(item)}
                      onSelect={() =>
                        setSelectedId((id) => (id === item.id ? null : item.id))
                      }
                    />
                  </div>
                )
              })}
            </div>
          )}

          <p className="mt-6 text-xs text-remy-muted">
            {searchResults.length} of {items.length} file
            {items.length === 1 ? '' : 's'}
            {sourceFilter !== 'All' ? ` · ${sourceFilter}` : ''}
            {' · '}
            pdf, png, jpg, jpeg, webp, txt, docx, xlsx, csv, zip
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
