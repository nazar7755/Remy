import { formatTagLabel } from '../lib/tagNormalize'

interface TagPillProps {
  tagName: string
  onRemove?: () => void
  onClick?: () => void
  active?: boolean
  size?: 'sm' | 'md'
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
}

export function TagPill({
  tagName,
  onRemove,
  onClick,
  active = false,
  size = 'md',
}: TagPillProps) {
  const label = formatTagLabel(tagName)
  const interactive = Boolean(onClick)

  const className = [
    'inline-flex max-w-full items-center gap-1 rounded-md font-medium transition-colors',
    sizeClasses[size],
    active
      ? 'bg-violet-500/20 text-violet-200 ring-1 ring-inset ring-violet-500/40'
      : 'bg-remy-elevated text-remy-subtle ring-1 ring-inset ring-remy-border',
    interactive ? 'cursor-pointer hover:bg-remy-elevated/80 hover:text-remy-text' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className} title={label}>
        {label}
      </button>
    )
  }

  return (
    <span className={className}>
      <span className="truncate">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-0.5 text-remy-muted transition-colors hover:bg-remy-surface hover:text-remy-text"
          aria-label={`Remove ${label}`}
        >
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}
