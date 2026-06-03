import { escapeRegExp } from '../lib/contentSearch'

interface HighlightedSnippetProps {
  snippet: string
  query: string
  className?: string
}

export function HighlightedSnippet({
  snippet,
  query,
  className = '',
}: HighlightedSnippetProps) {
  const term = query.trim()
  if (!term) {
    return <p className={className}>{snippet}</p>
  }

  const parts = snippet.split(
    new RegExp(`(${escapeRegExp(term)})`, 'gi'),
  )

  return (
    <p className={`text-sm leading-relaxed text-remy-subtle ${className}`}>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark
            key={i}
            className="rounded-sm bg-remy-accent/25 px-0.5 font-medium text-remy-text"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  )
}
