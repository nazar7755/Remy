interface FavoriteStarButtonProps {
  favorited: boolean
  onToggle: () => void
  className?: string
  size?: 'sm' | 'md'
}

export function FavoriteStarButton({
  favorited,
  onToggle,
  className = '',
  size = 'md',
}: FavoriteStarButtonProps) {
  const sizeClass = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <button
      type="button"
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={favorited}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`inline-flex shrink-0 items-center justify-center rounded-md border border-transparent transition-colors hover:border-remy-border hover:bg-remy-elevated ${
        favorited ? 'text-amber-400' : 'text-remy-muted hover:text-amber-300/90'
      } ${sizeClass} ${className}`}
    >
      <svg
        className={iconClass}
        viewBox="0 0 24 24"
        fill={favorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
        />
      </svg>
    </button>
  )
}
