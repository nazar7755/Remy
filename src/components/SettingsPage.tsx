import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  clearClipboardHistory,
  fetchPersistedStatistics,
  fetchGlobalHotkeyStatus,
  type GlobalHotkeyStatus,
} from '../services/settings'
import { OCR_INDEXING_ENABLED } from '../lib/ocrFeature'
import { isTauri } from '../lib/tauri'
import { countWatchedFolders } from '../lib/watchedFolders'
import { sortedTagNames, tagUsageFromAssignments } from '../lib/tags'
import type { FileScannerState } from '../hooks/useFileScanner'
import type { BackgroundIndexingState } from '../hooks/useBackgroundIndexing'
import type { usePreviewEmptyStates } from '../hooks/usePreviewEmptyStates'
import type { TagsState } from '../hooks/useTags'
import { resetOnboardingCompleted } from '../lib/onboardingStorage'
import type { SettingsState } from '../hooks/useSettings'
import { IndexingQueueStatus } from './IndexingQueueStatus'
import {
  CLIPBOARD_POLL_MAX_MS,
  CLIPBOARD_POLL_MIN_MS,
  FILE_POLL_MAX_MS,
  FILE_POLL_MIN_MS,
  BACKGROUND_PDF_MIN_SIZE_MB,
  BACKGROUND_PDF_MAX_SIZE_MB,
  BACKGROUND_PDF_MIN_DELAY_SEC,
  BACKGROUND_PDF_MAX_DELAY_SEC,
  type AppSettings,
  type BackgroundIndexScope,
  type MemoryStatistics,
} from '../types/settings'
interface SettingsPageProps {
  settingsState: SettingsState
  memoryScan: FileScannerState
  indexingQueue: BackgroundIndexingState
  previewEmptyStates: ReturnType<typeof usePreviewEmptyStates>
  tagsState: TagsState
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

function ScopeSelect({
  value,
  disabled,
  onChange,
}: {
  value: BackgroundIndexScope
  disabled?: boolean
  onChange: (scope: BackgroundIndexScope) => void
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as BackgroundIndexScope)}
      className="rounded-md border border-remy-border bg-remy-elevated px-2 py-1.5 text-xs text-remy-text focus:border-remy-accent focus:outline-none disabled:opacity-50"
    >
      <option value="txt">TXT only</option>
      <option value="txt_docx">TXT + DOCX</option>
    </select>
  )
}

function MbInput({
  valueMb,
  minMb,
  maxMb,
  disabled,
  onChange,
}: {
  valueMb: number
  minMb: number
  maxMb: number
  disabled?: boolean
  onChange: (mb: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={minMb}
        max={maxMb}
        step={1}
        value={valueMb}
        disabled={disabled}
        onChange={(e) => {
          const parsed = Number.parseInt(e.target.value, 10)
          if (Number.isNaN(parsed)) return
          onChange(parsed)
        }}
        className="w-16 rounded-md border border-remy-border bg-remy-elevated px-2 py-1.5 text-right text-sm text-remy-text focus:border-remy-accent focus:outline-none disabled:opacity-50"
      />
      <span className="text-xs text-remy-muted">MB</span>
    </div>
  )
}

export function SettingsPage({
  settingsState,
  memoryScan,
  indexingQueue,
  previewEmptyStates,
  tagsState,
}: SettingsPageProps) {
  const { settings, loading, saving, error, updateSettings } = settingsState
  const [stats, setStats] = useState<MemoryStatistics>({
    filesTracked: 0,
    clipboardEntries: 0,
    indexedFiles: 0,
    totalIndexedCharacters: 0,
  })
  const [clearing, setClearing] = useState<'clipboard' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const tagStats = useMemo(() => {
    const usage = tagUsageFromAssignments(tagsState.assignments)
    return {
      tagCount: usage.size,
      mostUsed: sortedTagNames(usage)
        .slice(0, 10)
        .map((name) => ({ name, usageCount: usage.get(name) ?? 0 })),
    }
  }, [tagsState.assignments])

  const [hotkeyStatus, setHotkeyStatus] = useState<GlobalHotkeyStatus | null>(null)

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

  useEffect(() => {
    void fetchGlobalHotkeyStatus().then(setHotkeyStatus)
  }, [])

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
    setActionSuccess(null)
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

  const disabled = loading || saving
  const noFoldersEnabled = countWatchedFolders(settings) === 0

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

      {actionSuccess && (
        <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
          {actionSuccess}
        </p>
      )}

      {saving && (
        <p className="text-xs text-remy-muted">Saving…</p>
      )}

      <SettingsSection
        title="Default folders"
        description="Turn standard folder scanning on or off. Add custom folders from Timeline."
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
            No folders are being watched — enable a default folder or add one
            from Timeline.
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
      </SettingsSection>

      <SettingsSection
        title="Shortcuts"
        description="Global keyboard shortcuts while Remy is running."
      >
        <SettingsRow
          label="Quick Search"
          hint="Open the compact search overlay from anywhere on macOS"
        >
          <kbd className="inline-flex items-center gap-1 rounded border border-remy-border bg-remy-elevated px-2 py-1 font-mono text-xs text-remy-text">
            <span>⌘</span>
            <span>⇧</span>
            <span>Space</span>
          </kbd>
        </SettingsRow>
        {hotkeyStatus && !hotkeyStatus.registered && hotkeyStatus.error && (
          <p className="pb-4 text-xs text-amber-400/90">
            Could not register {hotkeyStatus.shortcut}. Another app may already
            be using this shortcut.
          </p>
        )}
      </SettingsSection>

      <SettingsSection
        title="Startup"
        description="Control how Remy starts and runs on your Mac."
      >
        <SettingsRow
          label="Launch Remy at login"
          hint="Starts Remy when you log in, hidden in the background (macOS only)"
        >
          <Toggle
            label="Launch Remy at login"
            checked={settings.launchAtLogin}
            disabled={disabled || !isTauri()}
            onChange={(launchAtLogin) => patch({ launchAtLogin })}
          />
        </SettingsRow>
        <SettingsRow
          label="Run Remy in background when window is closed"
          hint="Remy hides instead of quitting and keeps watching files, clipboard, and indexing"
        >
          <Toggle
            label="Run Remy in background when window is closed"
            checked={settings.runInBackgroundWhenClosed}
            disabled={disabled || !isTauri()}
            onChange={(runInBackgroundWhenClosed) =>
              patch({ runInBackgroundWhenClosed })
            }
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Background indexing"
        description="Off by default. TXT/DOCX: max 10MB, one every 5 seconds. PDF is separate and off by default."
      >
        <SettingsRow
          label="Enable background indexing"
          hint="Default off — turn on only when you want automatic indexing"
        >
          <Toggle
            label="Enable background indexing"
            checked={settings.backgroundIndexingEnabled}
            disabled={disabled}
            onChange={(backgroundIndexingEnabled) =>
              patch({ backgroundIndexingEnabled })
            }
          />
        </SettingsRow>
        <SettingsRow
          label="File types to index"
          hint="TXT + DOCX by default. PDF uses the controls below."
        >
          <ScopeSelect
            value={settings.backgroundIndexScope}
            disabled={disabled || !settings.backgroundIndexingEnabled}
            onChange={(backgroundIndexScope) => patch({ backgroundIndexScope })}
          />
        </SettingsRow>
        {!OCR_INDEXING_ENABLED && (
          <p className="pb-4 text-xs text-remy-muted">
            OCR image indexing is postponed — it will return in a safer background
            worker later. Image thumbnails and document indexing are unchanged.
          </p>
        )}
        <SettingsRow
          label="Enable PDF background indexing"
          hint="Off by default — heavy PDFs are processed slowly with extra safety limits"
        >
          <Toggle
            label="Enable PDF background indexing"
            checked={settings.backgroundPdfIndexingEnabled}
            disabled={disabled || !settings.backgroundIndexingEnabled}
            onChange={(backgroundPdfIndexingEnabled) =>
              patch({ backgroundPdfIndexingEnabled })
            }
          />
        </SettingsRow>
        <SettingsRow
          label="Max PDF file size"
          hint={`${BACKGROUND_PDF_MIN_SIZE_MB}–${BACKGROUND_PDF_MAX_SIZE_MB} MB — larger PDFs are skipped and marked failed`}
        >
          <MbInput
            valueMb={settings.backgroundPdfMaxSizeMb}
            minMb={BACKGROUND_PDF_MIN_SIZE_MB}
            maxMb={BACKGROUND_PDF_MAX_SIZE_MB}
            disabled={
              disabled ||
              !settings.backgroundIndexingEnabled ||
              !settings.backgroundPdfIndexingEnabled
            }
            onChange={(backgroundPdfMaxSizeMb) => patch({ backgroundPdfMaxSizeMb })}
          />
        </SettingsRow>
        <SettingsRow
          label="Delay between PDF files"
          hint={`${BACKGROUND_PDF_MIN_DELAY_SEC}–${BACKGROUND_PDF_MAX_DELAY_SEC} seconds after each PDF`}
        >
          <IntervalInput
            valueMs={settings.backgroundPdfDelaySec * 1000}
            minMs={BACKGROUND_PDF_MIN_DELAY_SEC * 1000}
            maxMs={BACKGROUND_PDF_MAX_DELAY_SEC * 1000}
            disabled={
              disabled ||
              !settings.backgroundIndexingEnabled ||
              !settings.backgroundPdfIndexingEnabled
            }
            onChange={(ms) => patch({ backgroundPdfDelaySec: Math.round(ms / 1000) })}
          />
        </SettingsRow>
        {isTauri() && (
          <div className="pb-4">
            <IndexingQueueStatus {...indexingQueue} />
          </div>
        )}
      </SettingsSection>

      {previewEmptyStates.available && (
        <SettingsSection
          title="Developer"
          description="Dev-only tools for previewing UI without changing your data."
        >
          <SettingsRow
            label="Preview empty states"
            hint="Hides memories in Timeline, Favorites, and Indexed for UI testing. Does not clear SQLite, clipboard, or indexed files."
          >
            <Toggle
              label="Preview empty states"
              checked={previewEmptyStates.enabled}
              onChange={(enabled) => previewEmptyStates.setEnabled(enabled)}
            />
          </SettingsRow>
          <SettingsRow
            label="Reset onboarding"
            hint="Clears the first-launch flag so the welcome modal can appear again on next empty load."
          >
            <button
              type="button"
              onClick={() => resetOnboardingCompleted()}
              className="rounded-md border border-remy-border bg-remy-elevated px-3 py-1.5 text-xs font-medium text-remy-subtle transition-colors hover:border-zinc-600 hover:text-remy-text"
            >
              Reset
            </button>
          </SettingsRow>
        </SettingsSection>
      )}

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
          <StatCard label="Tag count" value={tagStats.tagCount} />
        </div>
        {tagStats.mostUsed.length > 0 && (
          <div className="pb-4">
            <p className="text-[11px] font-medium tracking-wide text-remy-muted uppercase">
              Most used tags
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tagStats.mostUsed.map((tag) => (
                <span
                  key={tag.name}
                  className="inline-flex items-center gap-1.5 rounded-md bg-remy-elevated px-2.5 py-1 text-xs text-remy-subtle ring-1 ring-inset ring-remy-border"
                >
                  #{tag.name}
                  <span className="tabular-nums text-remy-muted">{tag.usageCount}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {tagsState.error && (
          <p className="pb-4 text-xs text-red-300">{tagsState.error}</p>
        )}
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
