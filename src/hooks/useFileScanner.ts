import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyFavoritesToItems } from '../lib/favorites'
import { mergeTimelineItems } from '../lib/contentSearch'
import {
  findFileItemByPath,
  filePathsMatch,
  normalizeFilePath,
} from '../lib/filePaths'
import { OCR_INDEXING_ENABLED } from '../lib/ocrFeature'
import { isTauri } from '../lib/tauri'
import { syncWatchedFolderScopes } from '../services/watchedFolders'
import { parseExtension } from '../services/fileScanner/formatters'
import { getClipboardEntries, pollClipboard } from '../services/clipboard'
import {
  canManuallyIndexFile,
  clearFileIndex as clearFileIndexInvoke,
  indexFileContent,
  ocrIndexTimeoutMs,
  pdfIndexTimeoutMs,
} from '../services/contentIndexer'
import type { BackgroundIndexOutcome } from '../services/indexingQueue'
import {
  emptyIndexMetadata,
  indexMetadataFromContent,
} from '../lib/indexMetadata'
import { applyIndexCache, lookupIndexCache } from '../services/indexCache'
import { mergeScanResults } from '../services/fileScanner/mergeScanResults'
import * as fileScannerService from '../services/fileScanner'
import type { AppSettings } from '../types/settings'
import type { FolderPaths, MemoryItem } from '../types/memoryItem'
import { isClipboardItem, isImageExtension } from '../types/memoryItem'

export interface FileScannerState {
  items: MemoryItem[]
  fileItems: MemoryItem[]
  fileCount: number
  folderPaths: FolderPaths | null
  loading: boolean
  error: string | null
  clipboardError: string | null
  indexNotice: string | null
  isMocked: boolean
  isWatching: boolean
  lastUpdatedAt: Date | null
  refresh: () => Promise<void>
  indexFile: (
    filePath: string,
    options?: {
      force?: boolean
      background?: boolean
      skipWithError?: string
    },
  ) => Promise<BackgroundIndexOutcome>
  clearFileIndex: (filePath: string) => Promise<void>
  clearClipboardItems: () => void
}

function dedupeFilesByPath(items: MemoryItem[]): MemoryItem[] {
  const byPath = new Map<string, MemoryItem>()
  for (const item of items) {
    if (!isClipboardItem(item)) {
      byPath.set(normalizeFilePath(item.filePath), item)
    }
  }
  return [...byPath.values()]
}

function applyIndexResult(
  items: MemoryItem[],
  filePath: string,
  content: string | null,
  error: string | null,
): MemoryItem[] {
  return items.map((item) => {
    if (isClipboardItem(item) || !filePathsMatch(item.filePath, filePath)) {
      return item
    }
    if (error) {
      return {
        ...item,
        indexStatus: 'error',
        indexError: error,
        ...emptyIndexMetadata(),
      }
    }
    const text = content?.trim()
    if (!text) {
      return {
        ...item,
        content: null,
        indexStatus: 'error',
        indexError: 'No extractable text found in file',
        ...emptyIndexMetadata(),
      }
    }
    return {
      ...item,
      content: text,
      indexStatus: 'indexed',
      indexError: null,
      ...indexMetadataFromContent(text),
    }
  })
}

function markIndexing(items: MemoryItem[], filePath: string): MemoryItem[] {
  return items.map((item) =>
    !isClipboardItem(item) && filePathsMatch(item.filePath, filePath)
      ? { ...item, indexStatus: 'loading', indexError: null }
      : item,
  )
}

function clearSingleFileIndex(
  items: MemoryItem[],
  filePath: string,
): MemoryItem[] {
  return items.map((item) => {
    if (isClipboardItem(item) || !filePathsMatch(item.filePath, filePath)) {
      return item
    }
    return {
      ...item,
      content: null,
      indexStatus: 'idle',
      indexError: null,
      ...emptyIndexMetadata(),
    }
  })
}

export function useFileScanner(
  enabled: boolean,
  settings: AppSettings,
  favoriteIds: Set<string> = new Set(),
): FileScannerState {
  const [fileItems, setFileItems] = useState<MemoryItem[]>([])
  const [clipboardItems, setClipboardItems] = useState<MemoryItem[]>([])
  const [folderPaths, setFolderPaths] = useState<FolderPaths | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clipboardError, setClipboardError] = useState<string | null>(null)
  const [indexNotice, setIndexNotice] = useState<string | null>(null)
  const [isMocked, setIsMocked] = useState(!isTauri())
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  const enabledRef = useRef(enabled)
  const settingsRef = useRef(settings)
  const scanningRef = useRef(false)
  const indexingPathsRef = useRef(new Set<string>())
  const ocrInFlightRef = useRef(false)
  const fileItemsRef = useRef(fileItems)
  const mergedItemsRef = useRef<MemoryItem[]>([])

  const visibleClipboard = settings.clipboardEnabled ? clipboardItems : []

  const items = useMemo(
    () =>
      applyFavoritesToItems(
        mergeTimelineItems(fileItems, visibleClipboard),
        favoriteIds,
      ),
    [fileItems, visibleClipboard, favoriteIds],
  )

  const fileCount = fileItems.length

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    fileItemsRef.current = fileItems
  }, [fileItems])

  useEffect(() => {
    mergedItemsRef.current = items
  }, [items])

  const clearClipboardItems = useCallback(() => {
    setClipboardItems([])
    setClipboardError(null)
  }, [])

  const indexFile = useCallback(
    async (
      filePath: string,
      options?: {
        force?: boolean
        background?: boolean
        skipWithError?: string
      },
    ): Promise<BackgroundIndexOutcome> => {
      const trimmedPath = filePath.trim()
      const isBackground = options?.background === true

      if (!trimmedPath) {
        if (!isBackground) {
          console.warn('[Remy] Index skipped: empty file path')
        }
        return 'skipped'
      }

      const target =
        findFileItemByPath(fileItemsRef.current, trimmedPath) ??
        findFileItemByPath(mergedItemsRef.current, trimmedPath)

      const extension =
        target?.extension ??
        parseExtension(trimmedPath.split(/[/\\]/).pop() ?? trimmedPath)

      const isPdf = extension === 'pdf'
      const isOcrImage = OCR_INDEXING_ENABLED && isImageExtension(extension)

      if (isImageExtension(extension) && !OCR_INDEXING_ENABLED) {
        return 'skipped'
      }

      if (options?.skipWithError) {
        if (!isBackground) {
          setIndexNotice(options.skipWithError)
          setFileItems((prev) => markIndexing(prev, trimmedPath))
        }
        setFileItems((prev) =>
          applyIndexResult(prev, trimmedPath, null, options.skipWithError ?? 'Skipped'),
        )
        return 'error'
      }

      if (!canManuallyIndexFile(extension)) {
        if (!isBackground) {
          console.warn('[Remy] Index skipped: unsupported extension', {
            filePath: trimmedPath,
            extension,
          })
        }
        return 'skipped'
      }

      if (isOcrImage && ocrInFlightRef.current) {
        if (!isBackground) {
          setIndexNotice('Another image OCR is already in progress')
        }
        return 'skipped'
      }

      if (target && isClipboardItem(target)) {
        if (!isBackground) {
          console.warn('[Remy] Index skipped: clipboard item', trimmedPath)
        }
        return 'skipped'
      }

      if (!target && !isBackground) {
        console.warn(
          '[Remy] Index proceeding without live scan row (path may still exist on disk)',
          trimmedPath,
        )
      }

      if (indexingPathsRef.current.has(trimmedPath)) return 'skipped'

      if (isPdf) {
        console.log('PDF indexing started:', target?.fileName ?? trimmedPath, trimmedPath)
      } else if (isOcrImage && !isBackground) {
        console.log('OCR indexing image:', target?.fileName ?? trimmedPath)
      } else if (!isBackground) {
        console.log('Indexing started for path:', trimmedPath)
      }

      indexingPathsRef.current.add(trimmedPath)
      if (isOcrImage) {
        ocrInFlightRef.current = true
      }

      if (!isBackground) {
        setIndexNotice(null)
        setFileItems((prev) => markIndexing(prev, trimmedPath))
      }

      try {
        const content = await indexFileContent(
          trimmedPath,
          target?.fileName ?? trimmedPath.split(/[/\\]/).pop() ?? trimmedPath,
          {
            force: options?.force,
            timeoutMs: isPdf
              ? pdfIndexTimeoutMs()
              : isOcrImage
                ? ocrIndexTimeoutMs()
                : undefined,
          },
        )
        let outcome: BackgroundIndexOutcome = 'indexed'
        setFileItems((prev) => {
          const next = applyIndexResult(prev, trimmedPath, content, null)
          const updated = findFileItemByPath(next, trimmedPath)
          if (updated?.indexStatus === 'error') {
            outcome = 'error'
          }
          if (!isBackground) {
            if (updated) {
              console.log('Memory item updated after indexing', {
                path: updated.filePath,
                indexStatus: updated.indexStatus,
                indexedCharCount: updated.indexedCharCount,
              })
            } else {
              console.warn(
                '[Remy] Indexed on disk but item is not in the current scan list',
                trimmedPath,
              )
            }
          }
          return next
        })

        if (isPdf) {
          if (outcome === 'indexed') {
            console.log('PDF indexing completed:', target?.fileName ?? trimmedPath)
          } else {
            console.log('PDF indexing failed:', target?.fileName ?? trimmedPath)
          }
        } else if (isOcrImage) {
          if (outcome === 'indexed') {
            console.log('OCR complete:', target?.fileName ?? trimmedPath)
          } else if (outcome === 'error') {
            console.log('OCR failed:', target?.fileName ?? trimmedPath)
          }
        } else if (!isBackground) {
          console.log('Tauri indexing result:', {
            path: trimmedPath,
            chars: content?.length ?? 0,
          })
        }

        return outcome
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Content indexing failed'
        if (isPdf) {
          console.log('PDF indexing failed:', target?.fileName ?? trimmedPath, message)
        } else if (!isBackground) {
          console.error('Tauri indexing result:', { path: trimmedPath, error: message })
          setIndexNotice(message)
        }
        setFileItems((prev) =>
          applyIndexResult(prev, trimmedPath, null, message),
        )
        return 'error'
      } finally {
        indexingPathsRef.current.delete(trimmedPath)
        if (isOcrImage) {
          ocrInFlightRef.current = false
        }
      }
    },
    [],
  )

  const clearFileIndex = useCallback(async (filePath: string) => {
    const target = findFileItemByPath(fileItemsRef.current, filePath)
    if (!target || isClipboardItem(target)) return

    setIndexNotice(null)
    try {
      await clearFileIndexInvoke(filePath)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to clear file index'
      setIndexNotice(message)
      return
    }
    setFileItems((prev) => clearSingleFileIndex(prev, filePath))
  }, [])

  const loadClipboardHistory = useCallback(async () => {
    try {
      const clipboard = await getClipboardEntries()
      setClipboardItems(clipboard)
      setClipboardError(null)
    } catch (err) {
      setClipboardError(
        err instanceof Error ? err.message : 'Clipboard monitoring failed',
      )
    }
  }, [])

  const pollClipboardNow = useCallback(async () => {
    if (!enabledRef.current) return

    const { clipboardEnabled } = settingsRef.current
    if (!clipboardEnabled) {
      setClipboardItems([])
      setClipboardError(null)
      return
    }

    try {
      const clipboard = await pollClipboard()
      setClipboardItems(clipboard)
      setClipboardError(null)
    } catch (err) {
      setClipboardError(
        err instanceof Error ? err.message : 'Clipboard monitoring failed',
      )
    }
  }, [])

  const hydrateIndexCache = useCallback(async (scanned: MemoryItem[]) => {
    try {
      const cacheByPath = await lookupIndexCache(scanned)
      if (cacheByPath.size === 0) return

      setFileItems((prev) => applyIndexCache(prev, cacheByPath))
    } catch (err) {
      console.warn('Failed to restore index cache', err)
    }
  }, [])

  const scanFiles = useCallback(async (silent: boolean) => {
    if (!enabledRef.current || scanningRef.current) return

    scanningRef.current = true
    if (!silent) setLoading(true)

    const scanSources = settingsRef.current

    try {
      const paths = await fileScannerService.getFolderPaths()
      const raw = await fileScannerService.scanAllSources({
        scanDownloads: scanSources.scanDownloads,
        scanDesktop: scanSources.scanDesktop,
        scanDocuments: scanSources.scanDocuments,
        customWatchedFolders: scanSources.customWatchedFolders,
      })
      const scanned = dedupeFilesByPath(raw)

      setFileItems((prev) => mergeScanResults(prev, scanned))
      void hydrateIndexCache(scanned)
      setFolderPaths(paths)
      void syncWatchedFolderScopes(scanSources, paths)
      setIsMocked(!isTauri())
      setLastUpdatedAt(new Date())
      setError(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to scan memory folders'
      setError(message)
      if (!silent) setFileItems([])
    } finally {
      scanningRef.current = false
      if (!silent) setLoading(false)
    }
  }, [hydrateIndexCache])

  const refresh = useCallback(async () => {
    await Promise.all([scanFiles(false), pollClipboardNow()])
  }, [scanFiles, pollClipboardNow])

  useEffect(() => {
    if (!settings.clipboardEnabled) {
      setClipboardItems([])
      return
    }
    void loadClipboardHistory()
  }, [settings.clipboardEnabled, loadClipboardHistory])

  useEffect(() => {
    if (!enabled) return

    void scanFiles(false)
    void pollClipboardNow()

    const fileInterval = window.setInterval(
      () => void scanFiles(true),
      settings.filePollIntervalMs,
    )
    const clipboardInterval = window.setInterval(
      () => void pollClipboardNow(),
      settings.clipboardPollIntervalMs,
    )

    return () => {
      window.clearInterval(fileInterval)
      window.clearInterval(clipboardInterval)
    }
  }, [
    enabled,
    scanFiles,
    pollClipboardNow,
    settings.filePollIntervalMs,
    settings.clipboardPollIntervalMs,
    settings.scanDownloads,
    settings.scanDesktop,
    settings.scanDocuments,
    settings.customWatchedFolders,
  ])

  return {
    items,
    fileItems,
    fileCount,
    folderPaths,
    loading,
    error,
    clipboardError,
    indexNotice,
    isMocked,
    isWatching: enabled,
    lastUpdatedAt,
    refresh,
    indexFile,
    clearFileIndex,
    clearClipboardItems,
  }
}
