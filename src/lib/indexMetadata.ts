export function formatIndexedDate(indexedAtMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(indexedAtMs))
}

export function indexMetadataFromContent(
  content: string,
  indexedAtMs = Date.now(),
): {
  indexedCharCount: number
  indexedAt: string
  indexedAtIso: string
} {
  return {
    indexedCharCount: content.length,
    indexedAt: formatIndexedDate(indexedAtMs),
    indexedAtIso: new Date(indexedAtMs).toISOString(),
  }
}

export function emptyIndexMetadata(): {
  indexedCharCount: null
  indexedAt: null
  indexedAtIso: null
} {
  return {
    indexedCharCount: null,
    indexedAt: null,
    indexedAtIso: null,
  }
}

export function formatIndexStatusLabel(
  status: 'idle' | 'loading' | 'indexed' | 'error',
  options?: { ocr?: boolean },
): string {
  switch (status) {
    case 'loading':
      return 'Indexing…'
    case 'indexed':
      return options?.ocr ? 'Indexed (OCR)' : 'Indexed'
    case 'error':
      return 'Failed'
    default:
      return 'Not indexed'
  }
}
