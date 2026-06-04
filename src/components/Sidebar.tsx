import type { ReactNode } from 'react'
import type { NavSection } from '../types/memory'
import { IndexingQueueStatus } from './IndexingQueueStatus'
import type { BackgroundIndexingState } from '../hooks/useBackgroundIndexing'
import { isTauri } from '../lib/tauri'

const navItems: { id: NavSection; icon: ReactNode }[] = [
  {
    id: 'Timeline',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    ),
  },
  {
    id: 'Favorites',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    ),
  },
  {
    id: 'Indexed',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    ),
  },
  {
    id: 'Settings',
    icon: (
      <>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .008c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.008c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </>
    ),
  },
]

interface SidebarProps {
  activeSection: NavSection
  onSectionChange: (section: NavSection) => void
  indexingQueue?: BackgroundIndexingState
}

export function Sidebar({
  activeSection,
  onSectionChange,
  indexingQueue,
}: SidebarProps) {
  return (
    <aside className="flex h-svh w-[220px] shrink-0 flex-col overflow-hidden border-r border-remy-border bg-remy-surface">
      <div className="flex h-14 items-center gap-2.5 border-b border-remy-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-remy-accent to-violet-400 shadow-lg shadow-violet-500/25">
          <span className="text-xs font-bold text-white">R</span>
        </div>
        <span className="text-sm font-semibold tracking-tight">Remy</span>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Main">
        {navItems.map((item) => {
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSectionChange(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-remy-elevated font-medium text-remy-text'
                  : 'text-remy-subtle hover:bg-remy-elevated/60 hover:text-remy-text'
              }`}
            >
              <svg
                className={`h-4 w-4 shrink-0 ${isActive ? 'text-remy-accent' : 'text-remy-muted'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden
              >
                {item.icon}
              </svg>
              {item.id}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-remy-border p-3 space-y-2">
        {isTauri() && indexingQueue && (
          <IndexingQueueStatus {...indexingQueue} compact />
        )}
        <div className="rounded-lg border border-remy-border bg-remy-elevated/50 px-3 py-2.5">
          <p className="text-[11px] font-medium text-remy-subtle">Local-first</p>
          <p className="mt-0.5 text-[10px] leading-snug text-remy-muted">
            All memories stay on this device.
          </p>
        </div>
      </div>
    </aside>
  )
}
