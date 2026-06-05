import { normalizeTagName } from '../lib/tagNormalize'
import { isTauri, tauriInvoke } from '../lib/tauri'
import type {
  MemoryTagAssignment,
  TagStatistics,
  TagUsage,
} from '../types/tag'

const MOCK_STORAGE_KEY = 'remy-memory-tags'

interface TauriMemoryTagAssignmentDto {
  memory_id: string
  tag_name: string
  tagged_at_ms: number
}

interface TauriTagUsageDto {
  name: string
  usage_count: number
}

interface TauriTagStatisticsDto {
  tag_count: number
  most_used: TauriTagUsageDto[]
}

function fromTauriAssignment(dto: TauriMemoryTagAssignmentDto): MemoryTagAssignment {
  return {
    memoryId: dto.memory_id,
    tagName: dto.tag_name,
    taggedAtMs: dto.tagged_at_ms,
  }
}

function fromTauriStatistics(dto: TauriTagStatisticsDto): TagStatistics {
  return {
    tagCount: dto.tag_count,
    mostUsed: dto.most_used.map(
      (row): TagUsage => ({
        name: row.name,
        usageCount: row.usage_count,
      }),
    ),
  }
}

function loadMockAssignments(): MemoryTagAssignment[] {
  try {
    const raw = localStorage.getItem(MOCK_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as MemoryTagAssignment[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveMockAssignments(assignments: MemoryTagAssignment[]): void {
  localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(assignments))
}

export async function loadMemoryTagAssignments(): Promise<MemoryTagAssignment[]> {
  if (!isTauri()) return loadMockAssignments()
  const rows = await tauriInvoke<TauriMemoryTagAssignmentDto[]>(
    'get_memory_tag_assignments',
  )
  return rows.map(fromTauriAssignment)
}

export async function persistAddMemoryTag(
  memoryId: string,
  rawTagName: string,
): Promise<string> {
  const tagName = normalizeTagName(rawTagName)
  if (!tagName) {
    throw new Error('Invalid tag name')
  }

  if (!isTauri()) {
    const assignments = loadMockAssignments()
    const exists = assignments.some(
      (row) => row.memoryId === memoryId && row.tagName === tagName,
    )
    if (!exists) {
      saveMockAssignments([
        {
          memoryId,
          tagName,
          taggedAtMs: Date.now(),
        },
        ...assignments,
      ])
    }
    return tagName
  }

  await tauriInvoke('add_memory_tag', { memoryId, tagName })
  return tagName
}

export async function persistRemoveMemoryTag(
  memoryId: string,
  tagName: string,
): Promise<void> {
  if (!isTauri()) {
    saveMockAssignments(
      loadMockAssignments().filter(
        (row) => !(row.memoryId === memoryId && row.tagName === tagName),
      ),
    )
    return
  }

  await tauriInvoke('remove_memory_tag', { memoryId, tagName })
}

export async function fetchTagStatistics(): Promise<TagStatistics> {
  if (!isTauri()) {
    const assignments = loadMockAssignments()
    const usage = new Map<string, number>()
    for (const { tagName } of assignments) {
      usage.set(tagName, (usage.get(tagName) ?? 0) + 1)
    }
    const mostUsed = [...usage.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([name, usageCount]) => ({ name, usageCount }))
    return { tagCount: usage.size, mostUsed }
  }

  const dto = await tauriInvoke<TauriTagStatisticsDto>('get_tag_statistics')
  return fromTauriStatistics(dto)
}
