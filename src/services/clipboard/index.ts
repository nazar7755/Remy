import { isTauri, tauriInvoke } from '../../lib/tauri'
import type { MemoryItem } from '../../types/memoryItem'
import {
  hasSameNormalizedTextOnDay,
  localDayKey,
  normalizeClipboardText,
} from './clipboardNormalize'
import {
  clipboardEntriesToMemoryItems,
  type ClipboardEntryDto,
} from './clipboardMapper'

const MOCK_CLIPBOARD: ClipboardEntryDto[] = [
  {
    id: 'mock-1',
    text: 'comparison between WhatsApp and Microsoft Teams for async collaboration',
    capturedAtMs: Date.now() - 120_000,
  },
  {
    id: 'mock-2',
    text: 'npm run tauri:dev',
    capturedAtMs: Date.now() - 600_000,
  },
]

let mockEntries = [...MOCK_CLIPBOARD]
let mockLastNormalized: string | null = null

interface TauriClipboardEntryDto {
  id: string
  text: string
  captured_at_ms: number
}

function fromTauriEntry(row: TauriClipboardEntryDto): ClipboardEntryDto {
  return {
    id: row.id,
    text: row.text,
    capturedAtMs: row.captured_at_ms,
  }
}

export async function getClipboardEntries(): Promise<MemoryItem[]> {
  if (isTauri()) {
    const rows = await tauriInvoke<TauriClipboardEntryDto[]>('get_clipboard_entries')
    return clipboardEntriesToMemoryItems(rows.map(fromTauriEntry))
  }
  return clipboardEntriesToMemoryItems(mockEntries)
}

export async function pollClipboard(): Promise<MemoryItem[]> {
  if (isTauri()) {
    const rows = await tauriInvoke<TauriClipboardEntryDto[]>('poll_clipboard')
    return clipboardEntriesToMemoryItems(rows.map(fromTauriEntry))
  }

  try {
    const text = await navigator.clipboard.readText()
    const normalized = normalizeClipboardText(text)
    if (normalized) {
      const now = Date.now()
      const today = localDayKey(now)
      const alreadyToday = hasSameNormalizedTextOnDay(
        mockEntries,
        normalized,
        today,
      )

      if (alreadyToday) {
        if (mockLastNormalized !== normalized) {
          console.info('Clipboard duplicate skipped')
        }
        mockLastNormalized = normalized
      } else {
        mockEntries = [
          {
            id: `mock-${now}`,
            text: normalized,
            capturedAtMs: now,
          },
          ...mockEntries,
        ].slice(0, 100)
        mockLastNormalized = normalized
      }
    }
  } catch {
    // Clipboard API unavailable in browser without permission
  }

  return clipboardEntriesToMemoryItems(mockEntries)
}
