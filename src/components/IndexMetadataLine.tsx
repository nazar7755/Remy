import { isImageFile, type MemoryItem } from '../types/memoryItem'

interface IndexMetadataLineProps {
  item: MemoryItem
  className?: string
}

export function IndexMetadataLine({ item, className = '' }: IndexMetadataLineProps) {
  if (!item || item.indexStatus !== 'indexed') return null

  const charCount =
    typeof item.indexedCharCount === 'number' ? item.indexedCharCount : null

  return (
    <p className={`text-xs text-remy-subtle ${className}`}>
      {charCount != null && (
        <span>{charCount.toLocaleString()} chars indexed</span>
      )}
      {charCount != null && item.indexedAt && (
        <span className="text-remy-border" aria-hidden>
          {' '}
          ·{' '}
        </span>
      )}
      {item.indexedAt && (
        <span>
          {isImageFile(item) ? 'Indexed (OCR)' : 'Indexed'} {item.indexedAt}
        </span>
      )}
    </p>
  )
}
