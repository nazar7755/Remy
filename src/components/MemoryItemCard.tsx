import { FavoriteStarButton } from './FavoriteStarButton'
import { IndexMetadataLine } from './IndexMetadataLine'
import { HighlightedSnippet } from './HighlightedSnippet'
import { MemoryItemThumbnail } from './MemoryItemThumbnail'
import { SourceBadge } from './SourceBadge'
import { memoryItemTypeStyles } from '../lib/memoryItemStyles.tsx'
import { isClipboardItem, type MemoryItem } from '../types/memoryItem'

interface MemoryItemCardProps {
  item: MemoryItem
  isSelected?: boolean
  onSelect?: () => void
  searchQuery?: string
  contentSnippet?: string | null
  onToggleFavorite?: () => void
  showIndexMetadata?: boolean
}

export function MemoryItemCard({
  item,
  isSelected = false,
  onSelect,
  searchQuery = '',
  contentSnippet = null,
  onToggleFavorite,
  showIndexMetadata = false,
}: MemoryItemCardProps) {
  const style = memoryItemTypeStyles[item.type]

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.()
        }
      }}
      className={`group relative cursor-pointer rounded-xl border bg-remy-surface p-4 transition-all duration-200 hover:border-zinc-600 hover:bg-remy-elevated hover:shadow-lg hover:shadow-black/20 ${
        isSelected
          ? 'border-remy-accent/50 ring-2 ring-remy-accent/25'
          : 'border-remy-border'
      }`}
    >
      {onToggleFavorite && (
        <div className="absolute top-3 right-3 z-10">
          <FavoriteStarButton
            favorited={item.isFavorite ?? false}
            onToggle={onToggleFavorite}
            size="sm"
          />
        </div>
      )}
      <div className="flex items-start gap-3">
        <MemoryItemThumbnail key={item.id} item={item} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-remy-text">
              {item.fileName}
            </h3>
            <SourceBadge source={item.source} />
            <span
              className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style.badge}`}
            >
              {item.type}
            </span>
            {!isClipboardItem(item) && (
              <span className="inline-flex shrink-0 rounded-md bg-remy-elevated px-1.5 py-0.5 font-mono text-[10px] text-remy-muted uppercase">
                .{item.extension}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-remy-muted">
            <time dateTime={item.createdAtIso}>{item.createdAt}</time>
            <span className="text-remy-border" aria-hidden>
              ·
            </span>
            <span>{item.fileSize}</span>
          </div>
          {showIndexMetadata && (
            <IndexMetadataLine item={item} className="mt-2" />
          )}
          {contentSnippet && searchQuery ? (
            <HighlightedSnippet
              snippet={contentSnippet}
              query={searchQuery}
              className="mt-2 line-clamp-2"
            />
          ) : isClipboardItem(item) && item.content ? (
            <p className="mt-2 line-clamp-2 text-sm text-remy-subtle">
              {item.content}
            </p>
          ) : (
            <p
              className="mt-2 truncate font-mono text-xs text-remy-subtle"
              title={item.filePath}
            >
              {item.filePath}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
