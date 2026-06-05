import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatTagLabel, normalizeTagName } from '../lib/tagNormalize'
import type { MemoryItem } from '../types/memoryItem'
import { TagPill } from './TagPill'

interface MemoryTagsSectionProps {
  item: MemoryItem
  allTagNames: string[]
  onAddTag: (item: MemoryItem, rawTagName: string) => Promise<string | null>
  onRemoveTag: (item: MemoryItem, tagName: string) => Promise<void>
}

export function MemoryTagsSection({
  item,
  allTagNames,
  onAddTag,
  onRemoveTag,
}: MemoryTagsSectionProps) {
  const [adding, setAdding] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const itemTags = item.tags ?? []

  const suggestions = useMemo(() => {
    const needle = normalizeTagName(input) ?? input.trim().toLowerCase()
    if (!needle) return allTagNames.filter((tag) => !itemTags.includes(tag)).slice(0, 8)
    return allTagNames
      .filter((tag) => !itemTags.includes(tag) && tag.includes(needle))
      .slice(0, 8)
  }, [allTagNames, input, itemTags])

  useEffect(() => {
    if (adding) {
      inputRef.current?.focus()
    }
  }, [adding])

  const submitTag = useCallback(
    async (raw: string) => {
      const normalized = normalizeTagName(raw)
      if (!normalized) {
        setError('Use letters, numbers, hyphens, or underscores')
        return
      }
      if (itemTags.includes(normalized)) {
        setAdding(false)
        setInput('')
        setError(null)
        return
      }

      setError(null)
      const added = await onAddTag(item, normalized)
      if (added) {
        setAdding(false)
        setInput('')
      }
    },
    [item, itemTags, onAddTag],
  )

  return (
    <div className="border-b border-remy-border px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-[11px] font-medium tracking-wide text-remy-muted uppercase">
          Tags
        </dt>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true)
              setError(null)
            }}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-remy-accent transition-colors hover:bg-remy-elevated"
          >
            + Add Tag
          </button>
        )}
      </div>

      <dd className="mt-2">
        {itemTags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {itemTags.map((tagName) => (
              <TagPill
                key={tagName}
                tagName={tagName}
                size="sm"
                onRemove={() => void onRemoveTag(item, tagName)}
              />
            ))}
          </div>
        )}

        {adding && (
          <div className="space-y-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              placeholder="crypto or #crypto"
              onChange={(e) => {
                setInput(e.target.value)
                setError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void submitTag(input)
                }
                if (e.key === 'Escape') {
                  setAdding(false)
                  setInput('')
                  setError(null)
                }
              }}
              className="w-full rounded-md border border-remy-border bg-remy-bg px-2.5 py-1.5 text-sm text-remy-text placeholder:text-remy-muted focus:border-remy-accent/60 focus:outline-none"
            />

            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((tagName) => (
                  <button
                    key={tagName}
                    type="button"
                    onClick={() => void submitTag(tagName)}
                    className="rounded-md bg-remy-elevated px-2 py-0.5 text-[11px] text-remy-subtle ring-1 ring-inset ring-remy-border transition-colors hover:text-remy-text"
                  >
                    {formatTagLabel(tagName)}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void submitTag(input)}
                className="rounded-md bg-remy-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-500"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false)
                  setInput('')
                  setError(null)
                }}
                className="rounded-md px-2.5 py-1 text-xs text-remy-muted hover:text-remy-text"
              >
                Cancel
              </button>
            </div>

            {error && <p className="text-xs text-red-300">{error}</p>}
          </div>
        )}

        {itemTags.length === 0 && !adding && (
          <p className="text-xs text-remy-muted">No tags yet</p>
        )}
      </dd>
    </div>
  )
}
