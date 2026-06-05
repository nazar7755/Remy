import { useEffect } from 'react'
import {
  primaryButtonClassName,
  secondaryButtonClassName,
} from '../lib/uiButtons'

interface OnboardingModalProps {
  open: boolean
  scanning?: boolean
  addingFolder?: boolean
  onScanNow: () => void
  onAddFolder: () => void
  onDismiss: () => void
}

const FEATURES = [
  'Remembers files from watched folders',
  'Remembers clipboard text',
  'Indexes documents for search',
  'Everything stays local',
] as const

export function OnboardingModal({
  open,
  scanning = false,
  addingFolder = false,
  onScanNow,
  onAddFolder,
  onDismiss,
}: OnboardingModalProps) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onDismiss])

  if (!open) return null

  const handleScanNow = () => {
    onScanNow()
    onDismiss()
  }

  const handleAddFolder = () => {
    onAddFolder()
    onDismiss()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Dismiss onboarding"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-modal-title"
        className="relative w-full max-w-md rounded-xl border border-remy-border bg-remy-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onDismiss}
          className="absolute top-3.5 right-3.5 rounded-md p-1 text-remy-muted transition-colors hover:bg-remy-elevated hover:text-remy-subtle"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
          >
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <h2
          id="onboarding-modal-title"
          className="pr-8 text-base font-semibold text-remy-text"
        >
          Welcome to Remy
        </h2>
        <p className="mt-1 text-xs text-remy-subtle">
          Your second memory for files and clipboard — private and local.
        </p>

        <ul className="mt-4 space-y-2">
          {FEATURES.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-xs text-remy-subtle"
            >
              <span
                className="h-1 w-1 shrink-0 rounded-full bg-remy-accent"
                aria-hidden
              />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleScanNow}
            disabled={scanning}
            className={primaryButtonClassName}
          >
            {scanning ? 'Scanning…' : 'Scan now'}
          </button>
          <button
            type="button"
            onClick={handleAddFolder}
            disabled={addingFolder}
            className={secondaryButtonClassName}
          >
            {addingFolder ? 'Opening…' : 'Add Folder'}
          </button>
        </div>
      </div>
    </div>
  )
}
