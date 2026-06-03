import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  clearClipboardHistory,
  clearIndexedContent,
  fetchPersistedStatistics,
} from '../services/settings'
import { isTauri } from '../lib/tauri'
import type { FileScannerState } from '../hooks/useFileScanner'
import type { SettingsState } from '../hooks/useSettings'
import {
  CLIPBOARD_POLL_MAX_MS,
  CLIPBOARD_POLL_MIN_MS,
  FILE_POLL_MAX_MS,
  FILE_POLL_MIN_MS,
  type AppSettings,
  type MemoryStatistics,
} from '../types/settings'

interface SettingsPageProps {
  settingsState: SettingsState
  memoryScan: FileScannerState
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-remy-border bg-remy-surface">
      <div className="border-b border-remy-border px-5 py-4">
        <h2 className="text-sm font-semibold text-remy-text">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-remy-muted">{description}</p>
        )}
      </div>
      <div className="divide-y divide-remy-border px-5">{children}</div>
    </section>
  )
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-remy-text">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-remy-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        checked ? 'bg-remy-accent' : 'bg-remy-border'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function IntervalInput({
  valueMs,
  minMs,
  maxMs,
  disabled,
  onChange,
}: {
  valueMs: number
  minMs: number
  maxMs: number
  disabled?: boolean
  onChange: (ms: number) => void
}) {
  const seconds = Math.round(valueMs / 1000)

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={minMs / 1000}
        max={maxMs / 1000}
        step={1}
        value={seconds}
        disabled={disabled}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10)
          if (Number.isNaN(parsed)) return
          onChange(parsed * 1000)
        }}
        className="w-16 rounded-md border border-remy-border bg-remy-elevated px-2 py-1.5 text-right text-sm text-remy-text focus:border-remy-accent focus:outline-none disabled:opacity-50"
      />
      <span className="text-xs text-remy-muted">sec</span>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-remy-border bg-remy-elevated/50 px-4 py-3">
      <p className="text-[11px] font-medium tracking-wide text-remy-muted uppercase">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-remy-text">
        {value}
      </p>
    </div>
  )
}

export function SettingsPage({ settingsState, memoryScan }: SettingsPageProps) {
  const { settings, loading, saving, error, updateSettings } = settingsState
  const [stats, setStats] = useState<MemoryStatistics>({
    filesTracked: 0,
    clipboardEntries: 0,
    indexedFiles: 0,
    totalIndexedCharacters: 0,
  })
  const [clearing, setClearing] = useState<'clipboard' | 'index' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const refreshStats = useCallback(async () => {
    const persisted = await fetchPersistedStatistics()
    const inMemoryChars = memoryScan.items.reduce((sum, item) => {
      if (item.indexStatus === 'indexed' && item.indexedCharCount != null) {
        return sum + item.indexedCharCount
      }
      return sum
    }, 0)
    setStats({
      filesTracked: memoryScan.fileCount,
      clipboardEntries: persisted.clipboardEntries,
      indexedFiles: persisted.indexedFiles,
      totalIndexedCharacters: isTauri()
        ? persisted.totalIndexedCharacters
        : inMemoryChars,
    })
  }, [memoryScan.fileCount, memoryScan.items])

  useEffect(() => {
    void refreshStats()
  }, [refreshStats])

  const patch = useCallback(
    (partial: Partial<AppSettings>) => {
      void updateSettings(partial)
    },
    [updateSettings],
  )

  const handleClearClipboard = async () => {
    if (!isTauri()) return
    if (!window.confirm('Delete all saved clipboard history? This cannot be undone.')) {
      return
    }

    setClearing('clipboard')
    setActionError(null)
    try {
      await clearClipboardHistory()
      memoryScan.clearClipboardItems()
      await refreshStats()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to clear clipboard history',
      )
    } finally {
      setClearing(null)
    }
  }

  const handleClearIndex = async () => {
    if (!isTauri()) return
    if (
      !window.confirm(
        'Delete all indexed file content from disk? You can re-index files later.',
      )
    ) {
      return
    }

    setClearing('index')
    setActionError(null)
    try {
      await clearIndexedContent()
      memoryScan.clearIndexedContentInMemory()
      await refreshStats()
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to clear indexed content',
      )
    } finally {
      setClearing(null)
    }
  }

  const disabled = loading || saving
  const noFoldersEnabled =
    !settings.scanDownloads &&
    !settings.scanDesktop &&
    !settings.scanDocuments

  if (loading) {
    return (
      <p className="text-sm text-remy-muted">Loading settings…</p>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {(error || actionError) && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error ?? actionError}
        </p>
      )}

      {saving && (
        <p className="text-xs text-remy-muted">Saving…</p>
      )}

      <SettingsSection
        title="Scanning"
        description="Choose which standard folders Remy watches for files."
      >
        <SettingsRow label="Downloads" hint="Monitor your Downloads folder">
          <Toggle
            label="Scan Downloads"
            checked={settings.scanDownloads}
            disabled={disabled}
            onChange={(scanDownloads) => patch({ scanDownloads })}
          />
        </SettingsRow>
        <SettingsRow label="Desktop" hint="Monitor your Desktop folder">
          <Toggle
            label="Scan Desktop"
            checked={settings.scanDesktop}
            disabled={disabled}
            onChange={(scanDesktop) => patch({ scanDesktop })}
          />
        </SettingsRow>
        <SettingsRow label="Documents" hint="Monitor your Documents folder">
          <Toggle
            label="Scan Documents"
            checked={settings.scanDocuments}
            disabled={disabled}
            onChange={(scanDocuments) => patch({ scanDocuments })}
          />
        </SettingsRow>
        {noFoldersEnabled && (
          <p className="pb-4 text-xs text-amber-400/90">
            All folder scans are off — Remy will not track files until you enable
            at least one source.
          </p>
        )}
      </SettingsSection>

      <SettingsSection
        title="Polling"
        description="How often Remy checks for new files and clipboard changes."
      >
        <SettingsRow
          label="File scan interval"
          hint={`${FILE_POLL_MIN_MS / 1000}–${FILE_POLL_MAX_MS / 1000} seconds`}
        >
          <IntervalInput
            valueMs={settings.filePollIntervalMs}
            minMs={FILE_POLL_MIN_MS}
            maxMs={FILE_POLL_MAX_MS}
            disabled={disabled}
            onChange={(filePollIntervalMs) => patch({ filePollIntervalMs })}
          />
        </SettingsRow>
        <SettingsRow
          label="Clipboard scan interval"
          hint={`${CLIPBOARD_POLL_MIN_MS / 1000}–${CLIPBOARD_POLL_MAX_MS / 1000} seconds`}
        >
          <IntervalInput
            valueMs={settings.clipboardPollIntervalMs}
            minMs={CLIPBOARD_POLL_MIN_MS}
            maxMs={CLIPBOARD_POLL_MAX_MS}
            disabled={disabled || !settings.clipboardEnabled}
            onChange={(clipboardPollIntervalMs) =>
              patch({ clipboardPollIntervalMs })
            }
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Privacy"
        description="Control clipboard capture and remove stored data."
      >
        <SettingsRow
          label="Clipboard memory"
          hint="When off, Remy stops capturing and hides clipboard items"
        >
          <Toggle
            label="Clipboard memory"
            checked={settings.clipboardEnabled}
            disabled={disabled}
            onChange={(clipboardEnabled) => patch({ clipboardEnabled })}
          />
        </SettingsRow>
        <SettingsRow
          label="Clear clipboard history"
          hint="Removes all saved clipboard entries from this device"
        >
          <button
            type="button"
            disabled={!isTauri() || clearing !== null}
            onClick={() => void handleClearClipboard()}
            className="rounded-md border border-remy-border bg-remy-elevated px-3 py-1.5 text-xs font-medium text-remy-text transition-colors hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {clearing === 'clipboard' ? 'Clearing…' : 'Clear history'}
          </button>
        </SettingsRow>
        <SettingsRow
          label="Clear indexed content"
          hint="Removes extracted text cached for search"
        >
          <button
            type="button"
            disabled={!isTauri() || clearing !== null}
            onClick={() => void handleClearIndex()}
            className="rounded-md border border-remy-border bg-remy-elevated px-3 py-1.5 text-xs font-medium text-remy-text transition-colors hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {clearing === 'index' ? 'Clearing…' : 'Clear index cache'}
          </button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Statistics"
        description="Counts from your local Remy store and content index."
      >
        <div className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-2">
          <StatCard label="Files tracked" value={stats.filesTracked} />
          <StatCard label="Clipboard entries" value={stats.clipboardEntries} />
          <StatCard label="Indexed files" value={stats.indexedFiles} />
          <StatCard
            label="Indexed characters"
            value={stats.totalIndexedCharacters.toLocaleString()}
          />
        </div>
      </SettingsSection>

      {!isTauri() && (
        <p className="text-xs text-remy-muted">
          Running in browser preview — settings persist in localStorage. Clear-data
          actions and live statistics require the desktop app.
        </p>
      )}
    </div>
  )
}
