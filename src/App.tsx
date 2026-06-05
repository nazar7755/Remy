import { useEffect, useMemo, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { resolveFavoriteItems } from './lib/favorites'
import { resolveIndexedItems } from './lib/indexedItems'
import { FavoritesPage } from './components/FavoritesPage'
import { IndexedPage } from './components/IndexedPage'
import { FileMemoryTimeline } from './components/FileMemoryTimeline'
import { OnboardingModal } from './components/OnboardingModal'
import { SearchBar } from './components/SearchBar'
import { SettingsPage } from './components/SettingsPage'
import { Sidebar } from './components/Sidebar'
import { useBackgroundIndexing } from './hooks/useBackgroundIndexing'
import { useFavorites } from './hooks/useFavorites'
import { useTags } from './hooks/useTags'
import { useFileScanner } from './hooks/useFileScanner'
import { useOnboarding } from './hooks/useOnboarding'
import { usePreviewEmptyStates } from './hooks/usePreviewEmptyStates'
import { useSettings } from './hooks/useSettings'
import { useWatchedFolders } from './hooks/useWatchedFolders'
import { isTauri } from './lib/tauri'
import type { NavSection } from './types/memory'

const SECTION_META: Record<
  NavSection,
  { title: string; subtitle: string; searchPlaceholder: string }
> = {
  Timeline: {
    title: 'Remy',
    subtitle: 'Browse and search everything Remy remembers',
    searchPlaceholder: 'Search by name, path, tag:crypto, or text…',
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
  const globalSearchRef = useRef<HTMLInputElement>(null)

  const settingsState = useSettings()
  const previewEmptyStates = usePreviewEmptyStates()
  const favorites = useFavorites()
  const tags = useTags()
  const scannerEnabled =
    isTauri() ||
    activeSection === 'Timeline' ||
    activeSection === 'Favorites' ||
    activeSection === 'Indexed' ||
    activeSection === 'Settings'
  const memoryScan = useFileScanner(
    scannerEnabled,
    settingsState.settings,
    favorites.favoriteIds,
    tags.memoryTags,
  )

  const indexingQueue = useBackgroundIndexing(
    memoryScan.fileItems,
    settingsState.settings,
    memoryScan.indexFile,
    scannerEnabled,
  )

  const refreshScan = memoryScan.refresh

  useEffect(() => {
    if (!isTauri()) return

    const unlisteners: Array<() => void> = []

    void listen('tray-scan-now', () => {
      void refreshScan()
    }).then((fn) => {
      unlisteners.push(fn)
    })

    void listen('focus-global-search', () => {
      requestAnimationFrame(() => {
        const input = globalSearchRef.current
        if (!input) return
        input.focus()
        input.select()
      })
    }).then((fn) => {
      unlisteners.push(fn)
    })

    void listen<{ id: string; fileName: string }>('open-memory-in-main', (event) => {
      setActiveSection('Timeline')
      setGlobalQuery(event.payload.fileName)
      requestAnimationFrame(() => {
        const input = globalSearchRef.current
        if (!input) return
        input.focus()
        input.select()
      })
    }).then((fn) => {
      unlisteners.push(fn)
    })

    return () => {
      for (const unlisten of unlisteners) {
        unlisten()
      }
    }
  }, [refreshScan])

  const safeItems = memoryScan.items ?? []

  const meta = SECTION_META[activeSection]
  const timelineQuery = globalQuery.trim() || contentQuery.trim()

  const favoriteItems = useMemo(
    () =>
      resolveFavoriteItems(
        safeItems,
        favorites.records ?? [],
        tags.memoryTags,
      ),
    [safeItems, favorites.records, tags.memoryTags],
  )

  const indexedItems = useMemo(
    () => resolveIndexedItems(safeItems),
    [safeItems],
  )

  const watchedFolders = useWatchedFolders({
    settings: settingsState.settings,
    folderPaths: memoryScan.folderPaths,
    updateSettings: settingsState.updateSettings,
  })

  const previewEmpty = previewEmptyStates.enabled

  const onboarding = useOnboarding({ memoryScan, favorites })

  return (
    <div className="flex h-svh overflow-hidden">
      <OnboardingModal
        open={onboarding.open}
        scanning={memoryScan.loading}
        addingFolder={watchedFolders.addingFolder}
        onScanNow={() => void memoryScan.refresh()}
        onAddFolder={() => void watchedFolders.addFolder()}
        onDismiss={onboarding.complete}
      />

      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        indexingQueue={indexingQueue}
      />

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center border-b border-remy-border bg-remy-bg/80 px-5 backdrop-blur-md">
          <SearchBar
            ref={globalSearchRef}
            value={globalQuery}
            onChange={setGlobalQuery}
            placeholder="Search across all memories… (try tag:crypto)"
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
                  className="mb-3"
                />
                <FileMemoryTimeline
                  items={safeItems}
                  loading={memoryScan.loading}
                  error={memoryScan.error}
                  isMocked={memoryScan.isMocked}
                  isWatching={memoryScan.isWatching}
                  lastUpdatedAt={memoryScan.lastUpdatedAt}
                  indexNotice={memoryScan.indexNotice}
                  clipboardError={memoryScan.clipboardError}
                  query={timelineQuery}
                  customWatchedFolders={watchedFolders.customWatchedFolders}
                  addingFolder={watchedFolders.addingFolder}
                  foldersDisabled={settingsState.loading || settingsState.saving}
                  folderError={watchedFolders.folderError}
                  previewEmpty={previewEmpty}
                  onAddFolder={() => void watchedFolders.addFolder()}
                  onRemoveCustomFolder={(path) => void watchedFolders.removeFolder(path)}
                  onRefresh={() => void memoryScan.refresh()}
                  onIndexContent={(path) => void memoryScan.indexFile(path)}
                  onReindexContent={(path) =>
                    void memoryScan.indexFile(path, { force: true })
                  }
                  onToggleFavorite={(item) => void favorites.toggleFavorite(item)}
                  availableTags={tags.allTagNames.slice(0, 12)}
                  allTagNames={tags.allTagNames}
                  onAddTag={tags.addTag}
                  onRemoveTag={tags.removeTag}
                />
              </>
            )}

            {activeSection === 'Favorites' && (
              <FavoritesPage
                favoriteItems={favoriteItems}
                loading={memoryScan.loading || favorites.loading}
                error={memoryScan.error}
                favoritesError={favorites.error}
                query={globalQuery}
                previewEmpty={previewEmpty}
                onToggleFavorite={(item) => void favorites.toggleFavorite(item)}
                allTagNames={tags.allTagNames}
                onAddTag={tags.addTag}
                onRemoveTag={tags.removeTag}
                onIndexContent={(path) => void memoryScan.indexFile(path)}
                onReindexContent={(path) =>
                  void memoryScan.indexFile(path, { force: true })
                }
              />
            )}

            {activeSection === 'Indexed' && (
              <IndexedPage
                indexedItems={indexedItems}
                loading={memoryScan.loading}
                error={memoryScan.error}
                query={globalQuery}
                previewEmpty={previewEmpty}
                onToggleFavorite={(item) => void favorites.toggleFavorite(item)}
                allTagNames={tags.allTagNames}
                onAddTag={tags.addTag}
                onRemoveTag={tags.removeTag}
                onIndexContent={(path) => void memoryScan.indexFile(path)}
                onReindexContent={(path) =>
                  void memoryScan.indexFile(path, { force: true })
                }
              />
            )}

            {activeSection === 'Settings' && (
              <SettingsPage
                settingsState={settingsState}
                memoryScan={memoryScan}
                indexingQueue={indexingQueue}
                previewEmptyStates={previewEmptyStates}
                tagsState={tags}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
