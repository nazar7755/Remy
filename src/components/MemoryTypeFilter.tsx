import { MEMORIES_TYPE_FILTERS, type MemoriesTypeFilter } from '../types/memoriesPage'

interface MemoryTypeFilterProps {
  value: MemoriesTypeFilter
  onChange: (filter: MemoriesTypeFilter) => void
}

export function MemoryTypeFilterBar({
  value,
  onChange,
}: MemoryTypeFilterProps) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      role="tablist"
      aria-label="Filter by type"
    >
      {MEMORIES_TYPE_FILTERS.map((filter) => {
        const active = value === filter
        return (
          <button
            key={filter}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(filter)}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-remy-elevated text-remy-text ring-1 ring-remy-border'
                : 'text-remy-muted hover:bg-remy-elevated/60 hover:text-remy-subtle'
            }`}
          >
            {filter}
          </button>
        )
      })}
    </div>
  )
}
