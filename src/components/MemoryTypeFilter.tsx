import {
  TIMELINE_TYPE_FILTERS,
  type TimelineTypeFilter,
} from '../types/memoriesPage'

interface TypeFilterSelectProps {
  value: TimelineTypeFilter
  onChange: (filter: TimelineTypeFilter) => void
}

const selectClassName =
  'rounded-md border border-remy-border bg-remy-elevated px-2.5 py-1.5 text-xs text-remy-text transition-colors hover:border-zinc-600 focus:border-remy-accent/60 focus:ring-2 focus:ring-remy-accent/20 focus:outline-none'

export function TypeFilterSelect({ value, onChange }: TypeFilterSelectProps) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-xs text-remy-muted">
      <span className="font-medium">Type</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TimelineTypeFilter)}
        className={selectClassName}
        aria-label="Filter by type"
      >
        {TIMELINE_TYPE_FILTERS.map((filter) => (
          <option key={filter} value={filter}>
            {filter}
          </option>
        ))}
      </select>
    </label>
  )
}
