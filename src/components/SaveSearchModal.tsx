import { useEffect, useRef, useState } from 'react'
import { defaultNameFromQuery } from '../lib/savedSearch'
import {
  primaryButtonClassName,
  secondaryButtonClassName,
} from '../lib/uiButtons'

interface SaveSearchModalProps {
  open: boolean
  query: string
  saving?: boolean
  onCancel: () => void
  onSave: (name: string, query: string) => void
}

interface SaveSearchModalContentProps {
  query: string
  saving: boolean
  onCancel: () => void
  onSave: (name: string, query: string) => void
}

function SaveSearchModalContent({
  query,
  saving,
  onCancel,
  onSave,
}: SaveSearchModalContentProps) {
  const [name, setName] = useState(() => defaultNameFromQuery(query))
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  const trimmedName = name.trim()
  const trimmedQuery = query.trim()
  const canSave = trimmedName.length > 0 && trimmedQuery.length > 0 && !saving

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSave) return
    onSave(trimmedName, trimmedQuery)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Cancel"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-search-modal-title"
        className="relative w-full max-w-sm rounded-xl border border-remy-border bg-remy-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="save-search-modal-title"
          className="text-base font-semibold text-remy-text"
        >
          Save Search
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-remy-subtle">
              Name
            </span>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              className="w-full rounded-md border border-remy-border bg-remy-elevated px-3 py-2 text-sm text-remy-text placeholder:text-remy-muted focus:border-remy-accent/60 focus:ring-2 focus:ring-remy-accent/20 focus:outline-none"
              placeholder="Education"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-remy-subtle">
              Query
            </span>
            <input
              type="text"
              readOnly
              value={trimmedQuery}
              className="w-full rounded-md border border-remy-border bg-remy-bg/80 px-3 py-2 text-sm text-remy-muted"
            />
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className={secondaryButtonClassName}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className={primaryButtonClassName}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SaveSearchModal({
  open,
  query,
  saving = false,
  onCancel,
  onSave,
}: SaveSearchModalProps) {
  if (!open) return null

  return (
    <SaveSearchModalContent
      key={query}
      query={query}
      saving={saving}
      onCancel={onCancel}
      onSave={onSave}
    />
  )
}
