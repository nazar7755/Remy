export interface MemoryTagAssignment {
  memoryId: string
  tagName: string
  taggedAtMs: number
}

export interface TagUsage {
  name: string
  usageCount: number
}

export interface TagStatistics {
  tagCount: number
  mostUsed: TagUsage[]
}
