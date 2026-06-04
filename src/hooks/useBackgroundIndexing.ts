import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeFilePath } from '../lib/filePaths'
import { isTauri } from '../lib/tauri'
import {
  collectBackgroundIndexCandidates,
  getPostJobDelayMs,
  INDEX_QUEUE_STARTUP_DELAY_MS,
  type BackgroundIndexOutcome,
} from '../services/indexingQueue'
import type { AppSettings } from '../types/settings'
import type { MemoryItem } from '../types/memoryItem'

export type { BackgroundIndexOutcome } from '../services/indexingQueue'

export type BackgroundQueueStatus = 'disabled' | 'idle' | 'indexing'

export interface BackgroundIndexingState {
  status: BackgroundQueueStatus
  currentFileName: string | null
  queuedCount: number
  indexedCount: number
  indexingPdf: boolean
}

interface QueueUiState {
  status: BackgroundQueueStatus
  currentFileName: string | null
  queuedCount: number
  indexingPdf: boolean
}

const DISABLED_STATE: BackgroundIndexingState = {
  status: 'disabled',
  currentFileName: null,
  queuedCount: 0,
  indexedCount: 0,
  indexingPdf: false,
}

function nextQueueUi(patch: Partial<QueueUiState>): QueueUiState {
  if (patch.status === 'idle' || patch.status === 'disabled') {
    return {
      status: patch.status,
      currentFileName: null,
      queuedCount: patch.queuedCount ?? 0,
      indexingPdf: false,
    }
  }

  if (patch.currentFileName) {
    return {
      status: 'indexing',
      currentFileName: patch.currentFileName,
      queuedCount: patch.queuedCount ?? 0,
      indexingPdf: patch.indexingPdf ?? false,
    }
  }

  return {
    status: 'idle',
    currentFileName: null,
    queuedCount: patch.queuedCount ?? 0,
    indexingPdf: false,
  }
}

export function useBackgroundIndexing(
  fileItems: MemoryItem[],
  settings: AppSettings,
  indexFile: (
    filePath: string,
    options?: {
      background?: boolean
      skipWithError?: string
    },
  ) => Promise<BackgroundIndexOutcome>,
  scannerEnabled: boolean,
): BackgroundIndexingState {
  const [queueUi, setQueueUi] = useState<QueueUiState>({
    status: 'idle',
    currentFileName: null,
    queuedCount: 0,
    indexingPdf: false,
  })

  const isActive =
    isTauri() &&
    scannerEnabled &&
    settings.backgroundIndexingEnabled

  const queueRef = useRef<string[]>([])
  const attemptedPathsRef = useRef(new Set<string>())
  const inFlightRef = useRef(false)
  const queueReadyRef = useRef(false)
  const knownPathsRef = useRef(new Set<string>())
  const cancelGenerationRef = useRef(0)
  const settingsRef = useRef(settings)
  const fileItemsRef = useRef(fileItems)
  const indexFileRef = useRef(indexFile)

  const indexedCount = useMemo(
    () =>
      fileItems.filter(
        (item) => item.source !== 'Clipboard' && item.indexStatus === 'indexed',
      ).length,
    [fileItems],
  )

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    fileItemsRef.current = fileItems
  }, [fileItems])

  useEffect(() => {
    indexFileRef.current = indexFile
  }, [indexFile])

  const applyQueueUi = useCallback((patch: Partial<QueueUiState>) => {
    setQueueUi(nextQueueUi(patch))
  }, [])

  const scheduleProcessNext = useCallback((generation: number) => {
    window.setTimeout(() => {
      if (generation !== cancelGenerationRef.current) return
      void processNextRef.current()
    }, 0)
  }, [])

  const enqueueCandidates = useCallback(() => {
    if (!settingsRef.current.backgroundIndexingEnabled) {
      queueRef.current = []
      return 0
    }

    for (const item of fileItemsRef.current) {
      if (item.indexStatus === 'idle') {
        attemptedPathsRef.current.delete(normalizeFilePath(item.filePath))
      }
    }

    const skipPaths = new Set(attemptedPathsRef.current)
    for (const path of queueRef.current) {
      skipPaths.add(normalizeFilePath(path))
    }

    const candidates = collectBackgroundIndexCandidates(
      fileItemsRef.current,
      settingsRef.current,
      skipPaths,
    )

    const existing = new Set(queueRef.current.map(normalizeFilePath))
    for (const candidate of candidates) {
      const key = normalizeFilePath(candidate.filePath)
      if (!existing.has(key)) {
        queueRef.current.push(candidate.filePath)
        existing.add(key)
      }
    }

    return queueRef.current.length
  }, [])

  const processNextRef = useRef<() => Promise<void>>(async () => {})

  const processNext = useCallback(async () => {
    if (
      inFlightRef.current ||
      !settingsRef.current.backgroundIndexingEnabled ||
      !queueReadyRef.current
    ) {
      return
    }

    const generation = cancelGenerationRef.current

    enqueueCandidates()

    const nextPath = queueRef.current.shift()
    const remaining = queueRef.current.length

    if (!nextPath) {
      applyQueueUi({ status: 'idle', queuedCount: 0 })
      return
    }

    if (generation !== cancelGenerationRef.current) return

    const normalized = normalizeFilePath(nextPath)
    const item = fileItemsRef.current.find(
      (i) => normalizeFilePath(i.filePath) === normalized,
    )

    if (!item || item.indexStatus !== 'idle') {
      attemptedPathsRef.current.add(normalized)
      applyQueueUi({ status: 'idle', queuedCount: remaining })
      scheduleProcessNext(generation)
      return
    }

    const isPdf = item.extension === 'pdf'
    const activeSettings = settingsRef.current

    inFlightRef.current = true
    applyQueueUi({
      currentFileName: item.fileName,
      queuedCount: remaining,
      indexingPdf: isPdf,
    })

    let outcome: BackgroundIndexOutcome = 'skipped'
    try {
      if (isPdf) {
        const maxBytes = activeSettings.backgroundPdfMaxSizeMb * 1024 * 1024
        if (item.fileSizeBytes > maxBytes) {
          console.log(
            'PDF skipped due to size:',
            item.fileName,
            `${item.fileSizeBytes} bytes (max ${maxBytes})`,
          )
          outcome = await indexFileRef.current(nextPath, {
            background: true,
            skipWithError: `PDF exceeds maximum size (${activeSettings.backgroundPdfMaxSizeMb} MB)`,
          })
        } else {
          console.log('PDF indexing started:', item.fileName, nextPath)
          outcome = await indexFileRef.current(nextPath, { background: true })
          if (outcome === 'indexed') {
            console.log('PDF indexing completed:', item.fileName)
          } else if (outcome === 'error') {
            console.log('PDF indexing failed:', item.fileName)
            console.log('Continuing queue after PDF failure')
          }
        }
      } else {
        outcome = await indexFileRef.current(nextPath, { background: true })
      }

      if (generation !== cancelGenerationRef.current) return
    } catch (err) {
      console.warn('[Remy] Background index failed, continuing queue', err)
      if (isPdf) {
        console.log('PDF indexing failed:', item.fileName, err)
        console.log('Continuing queue after PDF failure')
      }
    } finally {
      attemptedPathsRef.current.add(normalized)
      inFlightRef.current = false
    }

    if (generation !== cancelGenerationRef.current) return

    applyQueueUi({
      status: 'idle',
      queuedCount: queueRef.current.length,
    })

    const delayMs = getPostJobDelayMs(item, activeSettings)
    await new Promise((resolve) => window.setTimeout(resolve, delayMs))
    if (generation !== cancelGenerationRef.current) return
    void processNextRef.current()
  }, [applyQueueUi, enqueueCandidates, scheduleProcessNext])

  useEffect(() => {
    processNextRef.current = processNext
  }, [processNext])

  const kickWorker = useCallback(() => {
    if (
      !settingsRef.current.backgroundIndexingEnabled ||
      !queueReadyRef.current ||
      inFlightRef.current
    ) {
      return
    }

    const pending = enqueueCandidates()
    applyQueueUi({ status: 'idle', queuedCount: pending })

    if (pending > 0) {
      void processNextRef.current()
    }
  }, [applyQueueUi, enqueueCandidates])

  useEffect(() => {
    if (!isActive) {
      cancelGenerationRef.current += 1
      queueReadyRef.current = false
      queueRef.current = []
      attemptedPathsRef.current.clear()
      knownPathsRef.current = new Set()
      applyQueueUi({ status: 'disabled', queuedCount: 0 })
      return
    }

    attemptedPathsRef.current.clear()
    queueRef.current = []
    applyQueueUi({
      status: 'idle',
      currentFileName: null,
      queuedCount: 0,
    })

    const startupTimer = window.setTimeout(() => {
      queueReadyRef.current = true
      knownPathsRef.current = new Set(
        fileItemsRef.current.map((item) => normalizeFilePath(item.filePath)),
      )
      kickWorker()
    }, INDEX_QUEUE_STARTUP_DELAY_MS)

    return () => {
      window.clearTimeout(startupTimer)
      queueReadyRef.current = false
    }
  }, [
    isActive,
    settings.backgroundIndexScope,
    settings.backgroundPdfIndexingEnabled,
    settings.backgroundPdfMaxSizeMb,
    settings.backgroundPdfDelaySec,
    applyQueueUi,
    kickWorker,
  ])

  useEffect(() => {
    if (!isActive || !queueReadyRef.current) return

    const currentPaths = new Set(
      fileItems.map((item) => normalizeFilePath(item.filePath)),
    )
    let hasNewPaths = false
    for (const path of currentPaths) {
      if (!knownPathsRef.current.has(path)) {
        hasNewPaths = true
        break
      }
    }
    knownPathsRef.current = currentPaths

    if (!hasNewPaths) return

    const timer = window.setTimeout(() => kickWorker(), 500)
    return () => window.clearTimeout(timer)
  }, [fileItems, isActive, kickWorker])

  if (!isActive) {
    return {
      ...DISABLED_STATE,
      indexedCount,
      queuedCount: queueUi.queuedCount,
    }
  }

  return {
    status: queueUi.status,
    currentFileName: queueUi.currentFileName,
    queuedCount: queueUi.queuedCount,
    indexedCount,
    indexingPdf: queueUi.indexingPdf,
  }
}
