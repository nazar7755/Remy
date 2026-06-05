import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  description: string
  children?: ReactNode
}

export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-remy-border bg-remy-surface/60 px-5 py-8 text-center">
      <p className="text-sm font-medium text-remy-text">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-xs text-remy-muted">{description}</p>
      {children && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      )}
    </div>
  )
}
