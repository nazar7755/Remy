import type { BackgroundQueueStatus } from '../hooks/useBackgroundIndexing'

interface IndexingQueueStatusProps {
  status: BackgroundQueueStatus
  currentFileName: string | null
  queuedCount: number
  indexedCount: number
  indexingPdf?: boolean
  compact?: boolean
}

function statusLabel(status: BackgroundQueueStatus, indexingPdf: boolean): string {
  switch (status) {
    case 'disabled':
      return 'Disabled'
    case 'indexing':
      return indexingPdf ? 'Indexing PDF' : 'Indexing'
    default:
      return 'Idle'
  }
}

function statusTone(status: BackgroundQueueStatus): string {
  switch (status) {
    case 'indexing':
      return 'text-emerald-400/90'
    case 'disabled':
      return 'text-remy-muted'
    default:
      return 'text-remy-subtle'
  }
}

export function IndexingQueueStatus({
  status,
  currentFileName,
  queuedCount,
  indexedCount,
  indexingPdf = false,
  compact = false,
}: IndexingQueueStatusProps) {
  const label = statusLabel(status, indexingPdf)

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-remy-subtle">Background indexing</p>
          <span className={`text-[10px] font-medium ${statusTone(status)}`}>{label}</span>
        </div>
        {currentFileName && status === 'indexing' && (
          <p className="truncate text-[10px] text-remy-muted" title={currentFileName}>
            {currentFileName}
          </p>
        )}
        {status !== 'disabled' && (
          <p className="text-[10px] text-remy-muted">
            {queuedCount} queued · {indexedCount} indexed
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 py-2 sm:grid-cols-4">
      <div className="rounded-lg border border-remy-border bg-remy-elevated/50 px-3 py-2.5">
        <p className="text-[11px] font-medium tracking-wide text-remy-muted uppercase">
          Queue status
        </p>
        <p className={`mt-1 text-sm font-semibold ${statusTone(status)}`}>{label}</p>
      </div>
      <div className="rounded-lg border border-remy-border bg-remy-elevated/50 px-3 py-2.5">
        <p className="text-[11px] font-medium tracking-wide text-remy-muted uppercase">
          Queued
        </p>
        <p className="mt-1 text-sm font-semibold tabular-nums text-remy-text">
          {status === 'disabled' ? '—' : queuedCount}
        </p>
      </div>
      <div className="rounded-lg border border-remy-border bg-remy-elevated/50 px-3 py-2.5">
        <p className="text-[11px] font-medium tracking-wide text-remy-muted uppercase">
          Indexed
        </p>
        <p className="mt-1 text-sm font-semibold tabular-nums text-remy-text">
          {indexedCount}
        </p>
      </div>
      <div className="col-span-2 rounded-lg border border-remy-border bg-remy-elevated/50 px-3 py-2.5 sm:col-span-1">
        <p className="text-[11px] font-medium tracking-wide text-remy-muted uppercase">
          Current file
        </p>
        <p
          className="mt-1 truncate text-sm font-medium text-remy-text"
          title={currentFileName ?? undefined}
        >
          {currentFileName ?? '—'}
        </p>
      </div>
    </div>
  )
}
