/** Trim and collapse repeated whitespace/newlines (case preserved). */
export function normalizeClipboardText(text: string): string {
  return text.trim().split(/\s+/).filter(Boolean).join(' ')
}

function localDayKey(ms: number): string {
  const date = new Date(ms)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export { localDayKey }

export function hasSameNormalizedTextOnDay(
  entries: Array<{ text: string; capturedAtMs: number }>,
  normalized: string,
  dayKey: string,
): boolean {
  return entries.some(
    (entry) =>
      localDayKey(entry.capturedAtMs) === dayKey &&
      normalizeClipboardText(entry.text) === normalized,
  )
}
