import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { OCR_INDEXING_ENABLED } from '../lib/ocrFeature'
import { getOcrPreview } from '../lib/fileContentPreview'
import { formatIndexStatusLabel } from '../lib/indexMetadata'
import { memoryItemTypeStyles } from '../lib/memoryItemStyles.tsx'
import { isTauri } from '../lib/tauri'
import {
  copyPath,
  copyText,
  openFile,
  revealInFileManager,
  revealLabel,
} from '../services/fileActions'
import { FavoriteStarButton } from './FavoriteStarButton'
import { MemoryTagsSection } from './MemoryTagsSection'
import { canManuallyIndexFile } from '../services/contentIndexer'
import { isClipboardItem, isImageFile, type MemoryItem } from '../types/memoryItem'

interface FileDetailsPanelProps {
  item: MemoryItem
  onClose: () => void
  onIndexContent?: (filePath: string) => void
  onReindexContent?: (filePath: string) => void
  onToggleFavorite?: (item: MemoryItem) => void
  allTagNames?: string[]
  onAddTag?: (item: MemoryItem, rawTagName: string) => Promise<string | null>
  onRemoveTag?: (item: MemoryItem, tagName: string) => Promise<void>
}

interface DetailRowProps {
  label: string
  value: string
  mono?: boolean
}

function DetailRow({ label, value, mono = false }: DetailRowProps) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 py-2">
      <dt className="text-[11px] font-medium tracking-wide text-remy-muted uppercase">
        {label}
      </dt>
      <dd
        className={`text-sm text-remy-text ${mono ? 'font-mono text-xs break-all leading-relaxed whitespace-pre-wrap' : ''}`}
      >
        {value}
      </dd>
    </div>
  )
}

const PATH_PREVIEW_MAX_LENGTH = 52

function compactPathPreview(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.length > PATH_PREVIEW_MAX_LENGTH) return null
  if (path.split(/[/\\]/).some((segment) => segment.length > 28)) return null
  return path
}

function LocationRow({
  source,
  filePath,
}: {
  source: string | null | undefined
  filePath: string | null | undefined
}) {
  const preview = compactPathPreview(filePath)
  const locationLabel = source?.trim() || 'Unknown'
  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 py-2">
      <dt className="text-[11px] font-medium tracking-wide text-remy-muted uppercase">
        Location
      </dt>
      <dd>
        <p className="text-sm text-remy-text">{locationLabel}</p>
        {preview && (
          <p
            className="mt-0.5 truncate font-mono text-[10px] text-remy-muted"
            title={filePath ?? undefined}
          >
            {preview}
          </p>
        )}
      </dd>
    </div>
  )
}

const defaultItemStyle = memoryItemTypeStyles.Document

interface ActionButtonProps {
  label: string
  hint?: string
  onClick: () => void
  disabled?: boolean
  icon: ReactNode
}

function ActionButton({
  label,
  hint,
  onClick,
  disabled,
  icon,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-remy-elevated disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-remy-border bg-remy-surface text-remy-subtle transition-colors group-hover:border-zinc-600 group-hover:text-remy-text">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium text-remy-text">
        {label}
      </span>
      {hint && (
        <kbd className="hidden shrink-0 rounded border border-remy-border bg-remy-bg px-1.5 py-0.5 font-mono text-[10px] text-remy-muted sm:inline-block">
          {hint}
        </kbd>
      )}
    </button>
  )
}

const documentIcon = (
  <path
    strokeLinecap="round"
    strokeLinejoin="round"
    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
  />
)

export function FileDetailsPanel({
  item,
  onClose,
  onIndexContent,
  onReindexContent,
  onToggleFavorite,
  allTagNames = [],
  onAddTag,
  onRemoveTag,
}: FileDetailsPanelProps) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const fileName = item?.fileName?.trim() || 'Untitled'
  const filePath = item?.filePath ?? ''
  const source = item?.source ?? 'Unknown'
  const extension = item?.extension ?? ''
  const fileSize = item?.fileSize ?? '—'
  const createdAt = item?.createdAt ?? '—'
  const indexStatus = item?.indexStatus ?? 'idle'
  const indexedAt = item?.indexedAt ?? null

  const desktop = isTauri()
  const clipboard = item ? isClipboardItem(item) : false
  const imageFile = item ? isImageFile(item) : false
  const ocrPreview = item ? getOcrPreview(item) : null
  const style =
    item?.type != null
      ? (memoryItemTypeStyles[item.type] ?? defaultItemStyle)
      : defaultItemStyle
  const indexable =
    !!item &&
    !clipboard &&
    !!extension &&
    canManuallyIndexFile(extension) &&
    !!onIndexContent
  const isLoading = indexStatus === 'loading'
  const isIndexed = indexStatus === 'indexed'
  const isFailed = indexStatus === 'error'
  const showIndexButton =
    indexable && !isLoading && (indexStatus === 'idle' || isFailed)
  const showReindexButton =
    indexable && !isLoading && !!onReindexContent && isIndexed

  const runAction = useCallback(async (action: () => Promise<void>) => {
    setActionError(null)
    setCopied(false)
    try {
      await action()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed')
    }
  }, [])

  const handleCopy = useCallback(async () => {
    await runAction(async () => {
      if (clipboard && item?.content) {
        await copyText(item.content)
      } else if (filePath) {
        await copyPath(filePath)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    })
  }, [clipboard, item?.content, filePath, runAction])

  useEffect(() => {
    if (!item?.id) {
      onClose()
    }
  }, [item, onClose])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  if (!item?.id) {
    return null
  }

  const indexStatusValue =
    isFailed && item.indexError
      ? `${formatIndexStatusLabel(indexStatus, { ocr: imageFile })} — ${item.indexError}`
      : formatIndexStatusLabel(indexStatus, { ocr: imageFile })

  return (
    <aside
      className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border border-remy-border bg-remy-surface/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
      aria-label="File details"
    >
      <div className="flex items-center justify-between border-b border-remy-border px-4 py-3">
        <span className="text-[11px] font-medium tracking-wider text-remy-muted uppercase">
          Details
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-remy-muted transition-colors hover:bg-remy-elevated hover:text-remy-text"
          aria-label="Close panel"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="border-b border-remy-border px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-remy-border bg-remy-elevated text-remy-subtle">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              {style.icon}
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-remy-text">
                {fileName}
              </h3>
              {onToggleFavorite && (
                <FavoriteStarButton
                  favorited={item.isFavorite}
                  onToggle={() => onToggleFavorite(item)}
                />
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span
                className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style.badge}`}
              >
                {item.type ?? 'Document'}
              </span>
              {!clipboard && extension && (
                <span className="inline-flex rounded-md bg-remy-elevated px-1.5 py-0.5 font-mono text-[10px] text-remy-muted uppercase">
                  .{extension}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {onAddTag && onRemoveTag && (
        <MemoryTagsSection
          item={item}
          allTagNames={allTagNames}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
        />
      )}

      <dl className="max-h-[280px] divide-y divide-remy-border/60 overflow-y-auto px-4">
        {clipboard ? (
          <DetailRow label="Source" value={source} />
        ) : (
          <LocationRow source={source} filePath={filePath} />
        )}
        {clipboard ? (
          <DetailRow
            label="Copied text"
            value={item.content ?? ''}
            mono
          />
        ) : (
          <>
            <DetailRow label="Filename" value={fileName} />
            {extension && (
              <DetailRow label="Extension" value={`.${extension}`} mono />
            )}
            <DetailRow label="Size" value={fileSize} />
          </>
        )}
        <DetailRow label="Created" value={createdAt} />
        {indexable && (
          <>
            <DetailRow label="Index status" value={indexStatusValue} />
            {isIndexed && item.indexedCharCount != null && (
              <DetailRow
                label="Indexed chars"
                value={item.indexedCharCount.toLocaleString()}
              />
            )}
            {isIndexed && indexedAt && (
              <DetailRow label="Indexed at" value={indexedAt} />
            )}
          </>
        )}
        {imageFile && OCR_INDEXING_ENABLED && (
          <div className="py-2">
            <dt className="text-[11px] font-medium tracking-wide text-remy-muted uppercase">
              OCR Preview
            </dt>
            <dd className="mt-1 text-sm whitespace-pre-wrap text-remy-text">
              {ocrPreview ??
                (isLoading
                  ? 'Running OCR…'
                  : 'Image not indexed yet.')}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-auto border-t border-remy-border p-2">
        {!desktop && !clipboard && (
          <p className="mb-2 px-3 py-2 text-xs text-amber-200/90">
            File actions require the desktop app (`npm run tauri:dev`).
          </p>
        )}
        {actionError && (
          <p className="mb-2 px-3 text-xs text-red-300">{actionError}</p>
        )}
        {copied && (
          <p className="mb-2 px-3 text-xs text-emerald-300">
            {clipboard ? 'Text copied.' : 'Path copied.'}
          </p>
        )}
        <div className="space-y-0.5">
          {showIndexButton && (
            <ActionButton
              label="Index Content"
              disabled={!desktop}
              onClick={() => {
                if (filePath) onIndexContent!(filePath)
              }}
              icon={
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  {documentIcon}
                </svg>
              }
            />
          )}
          {showReindexButton && (
            <ActionButton
              label="Reindex"
              disabled={!desktop}
              onClick={() => {
                if (filePath) onReindexContent!(filePath)
              }}
              icon={
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              }
            />
          )}
          {indexable && isLoading && (
            <p className="px-3 py-2 text-xs text-remy-subtle">Indexing content…</p>
          )}
          {!clipboard && (
            <>
              <ActionButton
                label="Open File"
                hint="↵"
                disabled={!desktop}
                onClick={() => {
                  if (filePath) void runAction(() => openFile(filePath))
                }}
                icon={
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 6H5.25A2.25 2.25 0 003 7.25v10.5A2.25 2.25 0 005.25 20h13.5A2.25 2.25 0 0021 18.75V10.5m-10.5 0V6h6v4.5m-10.5 0h10.5"
                    />
                  </svg>
                }
              />
              <ActionButton
                label={revealLabel()}
                disabled={!desktop}
                onClick={() => {
                  if (filePath) {
                    void runAction(() => revealInFileManager(filePath))
                  }
                }}
                icon={
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                    />
                  </svg>
                }
              />
            </>
          )}
          <ActionButton
            label={copied ? 'Copied' : clipboard ? 'Copy Text' : 'Copy Path'}
            hint="⌘C"
            disabled={clipboard ? !item.content : !desktop || !filePath}
            onClick={() => void handleCopy()}
            icon={
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 011.927-.184"
                />
              </svg>
            }
          />
        </div>
      </div>
    </aside>
  )
}
