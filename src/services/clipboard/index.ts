import { isTauri, tauriInvoke } from '../../lib/tauri'
import type { MemoryItem } from '../../types/memoryItem'
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
    const trimmed = text.trim()
    if (trimmed) {
      const last = mockEntries[0]
      const now = Date.now()
      const isDup =
        last?.text === trimmed && now - last.capturedAtMs < 30_000
      if (!isDup) {
        mockEntries = [
          {
            id: `mock-${now}`,
            text: trimmed,
            capturedAtMs: now,
          },
          ...mockEntries,
        ].slice(0, 100)
      }
    }
  } catch {
    // Clipboard API unavailable in browser without permission
  }

  return clipboardEntriesToMemoryItems(mockEntries)
}
