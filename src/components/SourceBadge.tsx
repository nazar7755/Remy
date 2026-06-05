import { getSourceBadgeStyle } from '../lib/sourceStyles'
import type { MemorySource } from '../types/memoryItem'

interface SourceBadgeProps {
  source: MemorySource
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const style = getSourceBadgeStyle(source)
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style.badge}`}
    >
      {source}
    </span>
  )
}
