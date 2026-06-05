# Remy — Project Context

## What Remy is

**Remy** is a local-first desktop application that acts as a **second memory** for your computer. It surfaces files and clipboard history you have touched recently, lets you search across them, and keeps everything on-device.

Tagline (in-app): *Your second memory — files and clipboard.*

## Principles

| Principle | Meaning |
|-----------|---------|
| **Local-first** | Data stays on the user’s machine. No cloud sync or remote database in the current design. |
| **Passive capture** | Remy watches standard folders and the clipboard rather than requiring manual “save to Remy” for every item. |
| **Searchable memory** | File metadata is always available; text inside supported files can be indexed for full-text search. |
| **Desktop-native** | File reveal, open, and clipboard actions use OS integrations via Tauri plugins. |

## Tech stack

| Layer | Stack |
|-------|--------|
| **UI** | React 19, TypeScript, Tailwind CSS 4, Vite 8 |
| **Shell** | Tauri 2 (Rust) — `src-tauri/` — features: `protocol-asset`, `tray-icon` |
| **Plugins** | `tauri-plugin-fs`, `tauri-plugin-opener`, `tauri-plugin-clipboard-manager`, `tauri-plugin-dialog`, `tauri-plugin-notification`, `tauri-plugin-autostart` (macOS launch at login), `tauri-plugin-global-shortcut` (desktop global hotkey) |
| **Rust deps** | `pdf-extract`, `zip` + `quick-xml` (DOCX), `arboard` (clipboard polling) |

## Repository layout

```
Remy/
├── src/                    # React frontend
│   ├── components/         # UI (Sidebar, timeline, Settings, cards, search)
│   ├── hooks/              # useFileScanner, useSettings, useWatchedFolders, useBackgroundIndexing
│   ├── services/           # Tauri/mock adapters, clipboard, indexing, indexingQueue
│   ├── lib/                # Search, formatting, Tauri detection, `imageSrc` (asset URLs)
│   └── types/              # MemoryItem, NavSection, etc.
├── src-tauri/
│   ├── src/
│   │   ├── commands/       # Tauri invoke handlers
│   │   ├── persistence/    # SQLite local store (clipboard + index cache)
│   │   ├── clipboard_monitor.rs
│   │   ├── content_indexer.rs
│   │   ├── background_mode.rs   # hide-on-close, prevent exit, dock reopen
│   │   ├── launch_at_login.rs   # macOS Launch Agent autostart, --background-launch
│   │   ├── global_hotkey.rs     # Cmd+Shift+Space → show window + focus search
│   │   └── tray.rs              # macOS menu bar / system tray icon + menu
│   └── tauri.conf.json     # `assetProtocol` scope for image thumbnails (Downloads/Desktop/Documents)
├── package.json
├── PROJECT_CONTEXT.md      # This file
├── ARCHITECTURE.md         # System design (indexing queue, persistence, data flow)
└── ROADMAP.md
```

## Architecture

```mermaid
flowchart LR
  subgraph UI["React (src/)"]
    App --> useSettings
    App --> useFileScanner
    App --> useBackgroundIndexing
    useSettings --> DB
    useFileScanner --> FileScanner
    useFileScanner --> ClipboardService
    useBackgroundIndexing --> useFileScanner
    FileMemoryTimeline --> ContentSearch
  end

  subgraph Rust["Tauri (src-tauri/)"]
    FS[file_scanner commands]
    CI[content_index commands]
    CB[clipboard commands]
    CM[ClipboardMonitor in-memory]
    DB[(remy.sqlite)]
  end

  FileScanner -->|invoke| FS
  FileScanner -->|invoke| CI
  ClipboardService -->|invoke| CB
  CB --> CM
  CM --> DB
  CI --> DB
```

### Frontend

- **`useFileScanner`**: Polls enabled default folders (Downloads, Desktop, Documents) plus user-added custom watch folders every 5s; polls clipboard every 2s when running in Tauri. Merges file + clipboard items into one timeline. After each file scan, asynchronously restores cached index text from disk (non-blocking UI). Exposes `indexFile` for manual and background indexing.
- **`useBackgroundIndexing`**: After initial UI render (~2s), enqueues indexable files with `indexStatus === 'idle'` and processes them **one at a time** via `indexFile`. TXT/DOCX: 5s between jobs, max 10MB. **PDF is off by default** — separate Settings toggle with max size (default 5MB), delay (default 10s), 60s Rust extraction timeout, and panic isolation. Failed PDFs get `indexStatus === 'error'` and are not retried in the same session. Queue status shown in the sidebar and Settings.
- **`FileScanner` + adapters**: `TauriFileSystemAdapter` (production) or `MockFileSystemAdapter` (Vite-only browser dev).
- **`contentSearch`**: Client-side filter by name, path, extension, type, source, and indexed/plain text.
- **Navigation**: `Timeline`, `Favorites`, `Indexed`, and `Settings` are implemented; `Search` is not built yet.
- **Onboarding & empty states**: True first launch (no files, no clipboard entries in SQLite, no favorites, scan/favorites loaded) opens a one-time **modal** (`OnboardingModal`). Dismissal or action (Scan now / Add Folder) sets `localStorage` flag `remy.onboardingCompleted` — never shown again. Timeline stays search + toolbar + content only (no inline welcome card). Section empty states share an `EmptyState` component. Dev: **Preview empty states** (`remy.previewEmptyStates`) and **Reset onboarding** in Settings → Developer.
- **Indexed page**: Filtered view of live items with `indexStatus === 'indexed'` and extracted text (txt/pdf/docx from all scan sources); no source filters.
- **`useFavorites`**: Independent favorites collection in SQLite (`favorites` table: `memory_id` + JSON snapshot per pin); `useFileScanner` marks live items with `isFavorite`; Favorites page uses `resolveFavoriteItems()` to merge live scan data with saved snapshots — no duplicate rows.
- **Memories page**: Database-style browse of all items (list/grid, type filters, sort, search); preferences (view mode, sort) persist in `localStorage`. Timeline remains the chronological activity feed with source filters unchanged.
- **`useSettings`**: Loads/saves app preferences (default folder toggles, custom watch folder paths, poll intervals, clipboard privacy, background indexing, launch at login, run in background when window closed) via SQLite in Tauri or `localStorage` in browser mock. Listens for `settings-changed` events from the tray menu to reload after tray toggles background indexing.

### Backend (Rust)

| Command | Role |
|---------|------|
| `get_allowed_paths` | Resolve Downloads / Desktop / Documents via `dirs` |
| `scan_all_memory_folders` | List supported files in enabled default folders plus `custom_watched_folders` from settings |
| `register_watched_folder_scopes` | Extend asset-protocol scope for thumbnails in watched folders |
| `open_file_path` / `reveal_file_path` | OS open/reveal for any watched path (including custom folders) |
| `index_file_content` | Extract text from `.txt`, `.pdf`, `.docx` (max ~200k chars). PDF runs in a isolated thread with **60s timeout** and **`catch_unwind`** so a bad PDF cannot crash the app. |
| `poll_clipboard` / `get_clipboard_entries` | Track text clipboard (dedupe window 30s, max 500 entries); persisted to SQLite |
| `lookup_file_index_cache` | Batch restore cached index text for scanned paths (startup hydration) |
| `hydrate_clipboard_history` | Reload clipboard rows from disk into memory (optional; also runs at app setup) |
| `get_app_settings` / `save_app_settings` | Read/write user preferences (JSON in `app_settings`, includes `custom_watched_folders`) |
| `get_memory_statistics` | Clipboard count, indexed file count, total indexed characters (SQLite) |
| `clear_file_index` | Remove one file’s cached index (per-file “Clear index”) |
| `get_favorites` / `set_favorite` | Persist pinned memories (`memory_id` + metadata snapshot JSON) |
| `clear_clipboard_history` / `clear_indexed_content` | Privacy / recovery — clear clipboard history or all cached index text |
| `get_global_hotkey_status` | Whether `Cmd + Shift + Space` registered successfully (for Settings warning) |

**Background mode, menu bar & global hotkey:**

| Module | Role |
|--------|------|
| `background_mode.rs` | On window close (when `run_in_background_when_closed`): `prevent_close`, hide window, one-time system notification; `ExitRequested` without quit code → `prevent_exit`; macOS Dock click → show main window |
| `launch_at_login.rs` | macOS Launch Agent via `tauri-plugin-autostart`; registers login item with `--background-launch` arg; hides main window on autostart launch; syncs login item when `launch_at_login` setting changes |
| `tray.rs` | Menu bar icon (bundled app icon, template on macOS); menu: Open Remy, Scan now, background indexing toggle, stats, Quit; emits `tray-scan-now` and `settings-changed` to the webview |
| `global_hotkey.rs` | Registers `Command+Shift+Space` via `tauri-plugin-global-shortcut`; on press calls `show_main_window` and emits `focus-global-search`; registration errors stored for Settings (no crash) |

**Tauri events (Rust → frontend):**

| Event | Frontend handler | Effect |
|-------|------------------|--------|
| `tray-scan-now` | `App.tsx` | Calls `memoryScan.refresh()` (same as Timeline “Scan now”) |
| `settings-changed` | `useSettings` | Reloads settings from SQLite after tray toggles background indexing |
| `focus-global-search` | `App.tsx` | Focuses and selects the header global search input (after global hotkey or future callers) |

Background capture (file poll, clipboard poll, indexing queue) stays in the React webview. Hiding the window does **not** destroy the webview, so existing `setInterval` loops keep running unchanged.

### Local persistence (Phase 1.2)

| Store | Location | Contents |
|-------|----------|----------|
| **SQLite** (`rusqlite`, bundled) | `{data_local_dir}/com.remy.app/remy.sqlite` | `clipboard_entries`, `file_index_cache`, `favorites`, `app_settings` |

- **Clipboard**: Saved after each successful poll; restored into `ClipboardMonitor` on startup (dedupe state seeded from newest entry).
- **Index cache**: Keyed by `file_path`; validated with `file_mtime_ms` + `file_size` so changed files are re-indexed on demand.
- **Indexed content source of truth** (read this when debugging clear/search/indexed views):
  - **Persistent store (Tauri)**: SQLite table `file_index_cache` — columns `file_path`, `content`, `file_mtime_ms`, `file_size`, `indexed_at_ms`. Written by `index_file_content`; wiped by `clear_indexed_content` or per-file `clear_file_index`. **Not** stored in `localStorage`.
  - **Runtime store (UI)**: React state `fileItems` in `useFileScanner`, merged into `items` (files + clipboard). Each file’s `content`, `indexStatus`, `indexedCharCount`, and `indexedAt` fields are what Timeline, Memories, Search, and Indexed read.
  - **Hydration path**: After each folder scan, `lookup_file_index_cache` loads SQLite rows into `fileItems` via `applyIndexCache`.
  - **Indexed page filter**: `resolveIndexedItems(items)` → `isIndexedFile(item)` requires `indexStatus === 'indexed'` **and** non-empty `content`. Same `items` array powers Timeline/Memories search via `contentSearch.ts`.
  - **Failed indexing**: `indexStatus === 'error'` with `indexError` message on the memory item (UI label: Failed). Background queue skips non-`idle` files; attempted paths are remembered for the session so failures are not retried automatically.
- **Local-first only** — no network, no cloud APIs.
- **Settings**: Single row `app_settings` key `app_settings` stores JSON (`scan_*`, `custom_watched_folders`, poll intervals, `clipboard_enabled`, `background_indexing_enabled`, `background_index_scope`, `background_pdf_indexing_enabled`, `background_pdf_max_size_mb`, `background_pdf_delay_sec`, `launch_at_login`, `run_in_background_when_closed`). Defaults seeded on first DB open. Meta flag `background_close_notification_shown` tracks the one-time hide notification.
- **Startup**: Clipboard hydrate runs in Tauri `setup` (fast SQLite read). Index cache hydrate runs in the frontend after the first folder scan via `lookup_file_index_cache` (async, does not block the initial render). Background indexing queue starts ~200ms after first paint (does not block startup).

## Data model

### `MemoryItem`

Unified shape for files and clipboard snippets:

- **Sources**: `Downloads`, `Desktop`, `Documents`, `Clipboard`, plus custom folder display names (folder basename, e.g. `Projects`)
- **Types**: `PDF`, `Image`, `Text`, `Document`, `Spreadsheet`, `Archive`, `Clipboard`
- **Supported file extensions**: `pdf`, `png`, `jpg`, `jpeg`, `webp`, `txt`, `docx`, `xlsx`, `csv`, `zip`
- **Indexable for search**: `txt`, `pdf`, `docx` (`indexStatus`: `idle` | `loading` | `indexed` | `error`; UI labels: Not indexed / Indexed / Failed)
- **Index metadata** (files): `indexedCharCount`, `indexedAt` — persisted in `file_index_cache.indexed_at_ms` with extracted text
- **Favorites**: `isFavorite` on live items; persisted collection keyed by stable `MemoryItem.id` (file path or `clipboard://…`) with snapshot JSON for display when not in the current scan
- **Image thumbnails**: `png`, `jpg`, `jpeg`, `webp` use `MemoryItem.filePath` via Tauri `convertFileSrc` (asset protocol); 64×64 lazy previews on Timeline, Memories, Favorites, and Indexed cards (browser dev shows type icons only)

### UI sections (`NavSection`)

`Timeline` · `Memories` · `Favorites` · `Indexed` · `Search` · `Settings`

## Current capabilities (implemented)

- Dark, Linear-inspired layout: sidebar, global search bar, timeline browse view
- **First-launch onboarding**: one-time modal on pristine install (Scan now / Add Folder); Timeline layout unchanged after dismiss
- **Empty states**: Shared `EmptyState` on Timeline (“No memories yet” + Add Folder / Scan now), Favorites, and Indexed; item-count footers hidden when lists are empty. Timeline layout is search → toolbar → content only (no inline onboarding card).
- Real folder scanning on macOS/Windows/Linux (via Tauri)
- Clipboard text capture with deduplication (persisted across restarts)
- Indexed file text cache on disk (skip re-extraction when file unchanged)
- **Timeline**: **Folders** row (All / default folders / custom folders / + Add Folder) filters the feed; type, view, and sort controls below; image files show 64×64 thumbnails when running in Tauri
- **`useWatchedFolders`**: Add/remove custom watch folders from Timeline (native folder picker in Tauri); persists via `useSettings`
- **Memories**: type filter (All / Files / Clipboard / PDF / DOCX / TXT / Images), list or grid, six sort orders, detail panel on select
- **Favorites** sidebar: dedicated page listing all pinned items from every source (no source filters); star toggle on Timeline/Memories cards and details panel
- **Indexed** sidebar: dedicated page for files with cached extracted text (Downloads, Desktop, Documents); search, sort, index metadata on cards
- Timeline search with highlighted snippets
- Detail panel: Index Content / Reindex / Clear index for txt·pdf·docx; index status (Not indexed / Indexed / Failed), character count, timestamp; open / reveal / copy path
- **Background indexing**: off by default; optional queue for TXT/DOCX (configurable scope); session limits; queue status in sidebar and Settings
- **Indexing recovery** (Settings → Background indexing): **Clear all indexed content** (SQLite + in-memory reset) and **Reset indexing queue** (stop pending jobs, keep indexed files)
- Settings statistics: indexed file count and total indexed characters
- **Background mode (Phase 1)**: closing the window hides Remy instead of quitting (setting on by default); one-time system notification on first hide; file/clipboard/indexing polling continues in the hidden webview
- **Launch at login (macOS)**: optional setting (off by default); registers a Launch Agent login item via `tauri-plugin-autostart`; autostart passes `--background-launch` so the main window stays hidden (menu bar tray only)
- **Menu bar tray (macOS)**: Remy icon in the menu bar when running; menu with Open Remy, Scan now, background indexing toggle, live stats (indexed files + clipboard entries), and Quit Remy
- **Global hotkey (macOS/desktop)**: `Cmd + Shift + Space` shows and focuses Remy from anywhere while the app is running (hidden, menu-bar-only, or in background); focuses the header search bar. Settings → Shortcuts displays the binding; warns if registration failed (e.g. shortcut taken by another app)
- Mock timeline when running `npm run dev` without Tauri
- **Settings** page: default folder scan toggles, poll intervals, clipboard privacy, shortcuts (read-only display), startup (launch at login + run in background when closed), background indexing (enable + file-type scope + recovery actions), clear clipboard history, live statistics and queue status — custom folders are managed on **Timeline**

## Development

```bash
# Web UI only (mock data)
npm run dev

# Full desktop app
npm run tauri:dev

# Production build
npm run tauri:build
```

Lint: `npm run lint`

### Testing onboarding and empty states safely

In **dev** (`npm run dev` or `npm run tauri:dev`):

- **Preview empty states** — pretends Timeline, Favorites, and Indexed are empty (no data deleted).
- **Reset onboarding** — clears `remy.onboardingCompleted` so the welcome modal can show again when the store is empty (no files, clipboard entries, or favorites).

Production builds omit the Developer section.

### Testing background mode and menu bar (Tauri only)

1. **Background hide** — Close the window (red X). App stays in Dock; tray icon remains. First close shows notification: *“Remy is still running in the background.”*
2. **Monitoring while hidden** — Copy text or add a file to a watched folder; wait for poll interval; tray → **Open Remy** or Dock click — new items appear.
3. **Tray menu** — **Scan now** triggers immediate rescan; **Background indexing** toggles setting (verify in Settings); stats lines match SQLite counts; **Quit Remy** exits fully.
4. **Setting off** — Settings → Startup → disable *Run Remy in background when window is closed*; close window → app quits.
5. **Explicit quit** — Cmd+Q quits even when background mode is on (tray **Quit Remy** also calls `app.exit(0)`).

### Testing launch at login (macOS Tauri only)

1. **Enable** — Settings → Startup → turn on *Launch Remy at login*. Verify **System Settings → General → Login Items** lists Remy.
2. **Autostart behavior** — Log out and back in (or reboot). Remy should start without showing the main window; menu bar icon appears; file/clipboard polling continues.
3. **Open from tray** — Tray → **Open Remy** (or Dock click) shows the main window.
4. **Disable** — Settings → Startup → turn off *Launch Remy at login*. Remy is removed from Login Items; next login does not start Remy automatically.
5. **Manual simulate** — Quit Remy, then from Terminal run the built app with `--background-launch` (same flag the login item uses); window should stay hidden.

### Testing global hotkey (macOS Tauri only)

1. **While hidden** — Close the main window (background mode on). Press **Cmd + Shift + Space**. Remy window should appear, come to front, and the header search input should be focused with its text selected.
2. **Menu bar only** — Quit and relaunch with `--background-launch` (or log in with launch-at-login). Press **Cmd + Shift + Space** — same behavior without clicking the tray first.
3. **While visible** — With Remy already open, press **Cmd + Shift + Space** — window stays visible; search input receives focus.
4. **Settings** — Settings → Shortcuts shows *Open Remy Search: Cmd + Shift + Space*. If another app owns the shortcut, an amber warning appears (app keeps running).
5. **Conflict check** — If registration fails, verify no crash; tray, polling, and indexing still work.

## Explicit non-goals (for now)

- Cloud sync or multi-device accounts
- LLM / semantic search / “AI memory” (see ROADMAP for future consideration)
- Browser history or screenshot capture pipelines (not wired up yet)

## Conventions for contributors

- Match existing patterns: service adapters for Tauri vs mock, snake_case DTOs from Rust, camelCase in TypeScript mappers.
- Keep invoke surface small; add Rust commands under `src-tauri/src/commands/`.
- Prefer extending `MemoryItem` and `searchMemoryItems` over one-off filters in components.
- UI copy and styling use Tailwind tokens (`remy-*` in `index.css`).

When starting a new chat or agent session, read this file, `ARCHITECTURE.md`, and `ROADMAP.md` for scope and priorities.
