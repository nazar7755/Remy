export function defaultNameFromQuery(query: string): string {
  const trimmed = query.trim()
  if (!trimmed) return ''

  const words = trimmed.split(/\s+/).slice(0, 3).join(' ')
  return words.length > 32 ? `${words.slice(0, 29)}…` : words
}
