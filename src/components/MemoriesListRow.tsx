import { FavoriteStarButton } from './FavoriteStarButton'
import { IndexMetadataLine } from './IndexMetadataLine'
import { HighlightedSnippet } from './HighlightedSnippet'
import { MemoryItemThumbnail } from './MemoryItemThumbnail'
import { SourceBadge } from './SourceBadge'
import { getMemoryPreview } from '../lib/memoryPreview'
import { memoryItemTypeStyles } from '../lib/memoryItemStyles.tsx'
import { isClipboardItem, type MemoryItem } from '../types/memoryItem'

interface MemoriesListRowProps {
  item: MemoryItem
  isSelected?: boolean
  onSelect?: () => void
  searchQuery?: string
  contentSnippet?: string | null
  onToggleFavorite?: () => void
  showIndexMetadata?: boolean
}

export function MemoriesListRow({
  item,
  isSelected = false,
  onSelect,
  searchQuery = '',
  contentSnippet = null,
  onToggleFavorite,
  showIndexMetadata = false,
}: MemoriesListRowProps) {
  const style = memoryItemTypeStyles[item.type]
  const preview = contentSnippet ?? getMemoryPreview(item)
  const clipboard = isClipboardItem(item)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col gap-2 rounded-lg border bg-remy-surface px-4 py-3 text-left transition-colors hover:border-zinc-600 hover:bg-remy-elevated sm:flex-row sm:items-center sm:gap-4 ${
        isSelected
          ? 'border-remy-accent/50 ring-2 ring-remy-accent/25'
          : 'border-remy-border'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MemoryItemThumbnail
          key={item.id}
          item={item}
          iconClassName="h-3.5 w-3.5"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-remy-text">
            {item.fileName}
          </p>
          <p className="mt-0.5 truncate text-xs text-remy-muted">
            {contentSnippet && searchQuery ? (
              <HighlightedSnippet
                snippet={contentSnippet}
                query={searchQuery}
                className="line-clamp-1"
              />
            ) : (
              preview
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-remy-muted sm:shrink-0">
        {onToggleFavorite && (
          <FavoriteStarButton
            favorited={item.isFavorite ?? false}
            onToggle={onToggleFavorite}
            size="sm"
          />
        )}
        <span
          className={`inline-flex rounded-md px-2 py-0.5 font-medium ring-1 ring-inset ${style.badge}`}
        >
          {item.type}
        </span>
        <SourceBadge source={item.source} />
        {!clipboard && (
          <span className="tabular-nums">{item.fileSize}</span>
        )}
        <time dateTime={item.createdAtIso} className="tabular-nums">
          {item.createdAt}
        </time>
        {showIndexMetadata && (
          <IndexMetadataLine item={item} className="w-full sm:w-auto" />
        )}
      </div>
    </button>
  )
}
