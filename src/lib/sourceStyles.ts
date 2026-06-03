import type { MemorySource } from '../types/memoryItem'

export const sourceBadgeStyles: Record<
  MemorySource,
  { badge: string; dot: string }
> = {
  Downloads: {
    badge: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/25',
    dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.45)]',
  },
  Desktop: {
    badge: 'bg-sky-500/10 text-sky-300 ring-sky-500/25',
    dot: 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.45)]',
  },
  Documents: {
    badge: 'bg-amber-500/10 text-amber-300 ring-amber-500/25',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.45)]',
  },
  Clipboard: {
    badge: 'bg-violet-500/10 text-violet-300 ring-violet-500/25',
    dot: 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.45)]',
  },
}
