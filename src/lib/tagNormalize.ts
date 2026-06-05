/** Normalize user input to a canonical tag name (lowercase, no # prefix). */
export function normalizeTagName(raw: string): string | null {
  const trimmed = raw.trim()
  const withoutHash = trimmed.startsWith('#') ? trimmed.slice(1).trim() : trimmed
  if (!withoutHash || withoutHash.length > 64) return null
  const normalized = withoutHash.toLowerCase()
  if (!/^[a-z0-9_-]+$/.test(normalized)) return null
  return normalized
}

/** Display label for a tag pill (e.g. crypto → #crypto). */
export function formatTagLabel(tagName: string): string {
  return `#${tagName}`
}
