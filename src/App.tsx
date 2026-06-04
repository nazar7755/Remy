import { useMemo, useState } from 'react'
import { resolveFavoriteItems } from './lib/favorites'
import { resolveIndexedItems } from './lib/indexedItems'
import { FavoritesPage } from './components/FavoritesPage'
import { IndexedPage } from './components/IndexedPage'
import { FileMemoryTimeline } from './components/FileMemoryTimeline'
import { MemoriesPage } from './components/MemoriesPage'
import { SearchBar } from './components/SearchBar'
import { SettingsPage } from './components/SettingsPage'
import { Sidebar } from './components/Sidebar'
import { useBackgroundIndexing } from './hooks/useBackgroundIndexing'
import { useFavorites } from './hooks/useFavorites'
import { useFileScanner } from './hooks/useFileScanner'
import { useSettings } from './hooks/useSettings'
import { isTauri } from './lib/tauri'
import type { NavSection } from './types/memory'

const SECTION_META: Record<
  NavSection,
  { title: string; subtitle: string; searchPlaceholder: string }
> = {
  Timeline: {
    title: 'Remy',
    subtitle: 'Your second memory — files and clipboard',
    searchPlaceholder: 'Search by name, path, extension, source, or text…',
  },
  Memories: {
    title: 'Memories',
    subtitle: 'Browse everything Remy remembers',
    searchPlaceholder: 'Search memories…',
  },
  Favorites: {
    title: 'Favorites',
    subtitle: 'Pinned files and clipboard snippets',
    searchPlaceholder: 'Search favorites…',
  },
  Indexed: {
    title: 'Indexed',
    subtitle: 'Files with extracted text ready to search',
    searchPlaceholder: 'Search indexed content…',
  },
  Search: {
    title: 'Search',
    subtitle: 'Find anything you have saved',
    searchPlaceholder: 'Search…',
  },
  Settings: {
    title: 'Settings',
    subtitle: 'Configure Remy',
    searchPlaceholder: 'Search settings…',
  },
}

function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('Timeline')
  const [globalQuery, setGlobalQuery] = useState('')
  const [contentQuery, setContentQuery] = useState('')

  const settingsState = useSettings()
  const favorites = useFavorites()
  const scannerEnabled =
    isTauri() ||
    activeSection === 'Timeline' ||
    activeSection === 'Memories' ||
    activeSection === 'Favorites' ||
    activeSection === 'Indexed' ||
    activeSection === 'Settings'
  const memoryScan = useFileScanner(
    scannerEnabled,
    settingsState.settings,
    favorites.favoriteIds,
  )

  const indexingQueue = useBackgroundIndexing(
    memoryScan.fileItems,
    settingsState.settings,
    memoryScan.indexFile,
    scannerEnabled,
  )

  const safeItems = memoryScan.items ?? []

  const meta = SECTION_META[activeSection]
  const timelineQuery = globalQuery.trim() || contentQuery.trim()

  const favoriteItems = useMemo(
    () =>
      resolveFavoriteItems(
        safeItems,
        favorites.records ?? [],
      ),
    [safeItems, favorites.records],
  )

  const indexedItems = useMemo(
    () => resolveIndexedItems(safeItems),
    [safeItems],
  )

  return (
    <div className="flex h-svh overflow-hidden">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        indexingQueue={indexingQueue}
      />

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-remy-border bg-remy-bg/80 px-5 backdrop-blur-md">
          <SearchBar
            value={globalQuery}
            onChange={setGlobalQuery}
            placeholder="Search across all memories…"
            size="sm"
            className="max-w-md flex-1"
          />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-10">
            <header className="mb-8">
              <h1 className="text-3xl font-semibold tracking-tight text-remy-text">
                {meta.title}
              </h1>
              <p className="mt-1 text-base text-remy-subtle">{meta.subtitle}</p>
            </header>

            {activeSection === 'Timeline' && (
              <>
                <SearchBar
                  value={contentQuery}
                  onChange={setContentQuery}
                  placeholder={meta.searchPlaceholder}
                  className="mb-6"
                />
                <FileMemoryTimeline
                  items={safeItems}
                  folderPaths={memoryScan.folderPaths}
                  loading={memoryScan.loading}
                  error={memoryScan.error}
                  isMocked={memoryScan.isMocked}
                  isWatching={memoryScan.isWatching}
                  lastUpdatedAt={memoryScan.lastUpdatedAt}
                  indexNotice={memoryScan.indexNotice}
                  clipboardError={memoryScan.clipboardError}
                  query={timelineQuery}
                  onRefresh={() => void memoryScan.refresh()}
                  onIndexContent={(path) => void memoryScan.indexFile(path)}
                  onReindexContent={(path) =>
                    void memoryScan.indexFile(path, { force: true })
                  }
                  onClearIndex={(path) => void memoryScan.clearFileIndex(path)}
                  onToggleFavorite={(item) => void favorites.toggleFavorite(item)}
                />
              </>
            )}

            {activeSection === 'Memories' && (
              <MemoriesPage
                items={safeItems}
                loading={memoryScan.loading}
                error={memoryScan.error}
                query={globalQuery}
                onIndexContent={(path) => void memoryScan.indexFile(path)}
                onReindexContent={(path) =>
                  void memoryScan.indexFile(path, { force: true })
                }
                onClearIndex={(path) => void memoryScan.clearFileIndex(path)}
                onToggleFavorite={(item) => void favorites.toggleFavorite(item)}
              />
            )}

            {activeSection === 'Favorites' && (
              <FavoritesPage
                favoriteItems={favoriteItems}
                loading={memoryScan.loading || favorites.loading}
                error={memoryScan.error}
                favoritesError={favorites.error}
                query={globalQuery}
                onToggleFavorite={(item) => void favorites.toggleFavorite(item)}
                onIndexContent={(path) => void memoryScan.indexFile(path)}
                onReindexContent={(path) =>
                  void memoryScan.indexFile(path, { force: true })
                }
                onClearIndex={(path) => void memoryScan.clearFileIndex(path)}
              />
            )}

            {activeSection === 'Indexed' && (
              <IndexedPage
                indexedItems={indexedItems}
                loading={memoryScan.loading}
                error={memoryScan.error}
                query={globalQuery}
                onToggleFavorite={(item) => void favorites.toggleFavorite(item)}
                onIndexContent={(path) => void memoryScan.indexFile(path)}
                onReindexContent={(path) =>
                  void memoryScan.indexFile(path, { force: true })
                }
                onClearIndex={(path) => void memoryScan.clearFileIndex(path)}
              />
            )}

            {activeSection === 'Settings' && (
              <SettingsPage
                settingsState={settingsState}
                memoryScan={memoryScan}
                indexingQueue={indexingQueue}
              />
            )}

            {activeSection === 'Search' && (
              <p className="text-sm text-remy-muted">
                This section is not built yet.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
