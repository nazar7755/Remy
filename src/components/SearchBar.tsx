interface SearchBarProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
}

export function SearchBar({
  value = '',
  onChange,
  placeholder = 'Search memories…',
  className = '',
  size = 'md',
}: SearchBarProps) {
  const sizeClasses =
    size === 'sm'
      ? 'h-8 text-xs'
      : 'h-10 text-sm'

  return (
    <div className={`relative ${className}`}>
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
        type="search"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-remy-border bg-remy-elevated pr-16 pl-9 text-remy-text shadow-sm transition-colors placeholder:text-remy-muted hover:border-zinc-600 focus:border-remy-accent/60 focus:ring-2 focus:ring-remy-accent/20 focus:outline-none ${sizeClasses}`}
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-remy-border bg-remy-surface px-1.5 py-0.5 font-mono text-[10px] text-remy-muted sm:inline-flex">
        <span>⌘</span>
        <span>K</span>
      </kbd>
    </div>
  )
}
