import type { MemoryTagAssignment } from '../types/tag'
import type { MemoryItem } from '../types/memoryItem'

export function memoryTagsMapFromAssignments(
  assignments: MemoryTagAssignment[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const { memoryId, tagName } of assignments) {
    const existing = map.get(memoryId)
    if (existing) {
      if (!existing.includes(tagName)) existing.push(tagName)
    } else {
      map.set(memoryId, [tagName])
    }
  }
  for (const tags of map.values()) {
    tags.sort((a, b) => a.localeCompare(b))
  }
  return map
}

export function tagUsageFromAssignments(
  assignments: MemoryTagAssignment[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { tagName } of assignments) {
    counts.set(tagName, (counts.get(tagName) ?? 0) + 1)
  }
  return counts
}

export function sortedTagNames(usage: Map<string, number>): string[] {
  return [...usage.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name)
}

/** Attach persisted tags to live memory items (keyed by stable memory id). */
export function applyTagsToItems(
  items: MemoryItem[] | undefined,
  memoryTags: Map<string, string[]> | undefined,
): MemoryItem[] {
  const list = items ?? []
  const tagsById = memoryTags ?? new Map<string, string[]>()
  if (tagsById.size === 0) {
    return list.map((item) => ({ ...item, tags: item.tags ?? [] }))
  }
  return list.map((item) => ({
    ...item,
    tags: tagsById.get(item.id) ?? [],
  }))
}

export function itemHasTag(item: MemoryItem, tagName: string): boolean {
  return (item.tags ?? []).includes(tagName)
}

export function itemHasAllTags(item: MemoryItem, tagNames: string[]): boolean {
  if (tagNames.length === 0) return true
  const itemTags = item.tags ?? []
  return tagNames.every((tag) => itemTags.includes(tag))
}
