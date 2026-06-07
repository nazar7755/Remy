# Remy — Roadmap

Version target in bundle: **0.1.0** (early prototype). Items are ordered roughly by dependency and user value.

---

## Phase 0 — Foundation ✅

*Shipped in current codebase.*

- [x] Replace Vite starter with Remy shell (sidebar, search, timeline)
- [x] Dark UI with reusable components (`Sidebar`, `SearchBar`, `MemoryItemCard`, `FileMemoryTimeline`)
- [x] Tauri 2 desktop shell
- [x] Scan Downloads, Desktop, Documents for supported file types
- [x] Clipboard text monitoring (in-memory, session-scoped)
- [x] Merge file + clipboard into unified timeline
- [x] Client-side search (metadata + indexed content + **`tag:`** filters)
- [x] On-demand content indexing for txt / pdf / docx (Rust)
- [x] File actions: open, reveal in Finder/Explorer, copy path
- [x] Mock adapter for browser-only `npm run dev`

---

## Phase 1 — Core product completeness

*Make the app feel finished without new capture sources.*

### 1.1 Navigation sections

- [x] **Memories** — grid or list of all items (not only timeline layout); filters and sort by date, type, source
- [x] **Favorites** — independent pinned collection (SQLite + snapshots); dedicated page (all sources); star on cards/details
- [x] **File tags (Phase 1)** — custom tags on memory items (SQLite `tags` + `memory_tags`); details panel add/remove; Timeline tag filter; `tag:` search syntax; Quick Search tag autocomplete (`tag`, `tag:`, `#` triggers + usage counts) and overlay tag filtering; Settings tag statistics
- [x] **Indexed** — dedicated page for files with extracted index text (all sources); search, sort, index metadata on cards
- [ ] **Search** — dedicated search experience (saved queries, result grouping, keyboard focus)
- [x] **Quick Search overlay** — Spotlight-style overlay (`Cmd + Shift + Space`); **context chips** (All / Recent / Clipboard / Favorites / Tags); **tag autocomplete** (`tag`, `tag:`, `tag:name`, `#`, `#name`) with usage counts; All uses live union browse; scoped search per context; `tag:` syntax; ↑↓ navigate; Enter open/copy; **Esc hide overlay**; Cmd+Enter opens in main app
- [x] **Settings** — folder scan toggles (Downloads / Desktop / Documents), poll intervals, clipboard privacy, shortcuts (read-only), startup (launch at login + background when closed), clear history/index, statistics
- [ ] Theme customization (if needed)

### 1.2 Persistence ✅

- [x] Local store for clipboard history across restarts (SQLite, `com.remy.app/remy.sqlite`)
- [x] Cache indexed file text on disk to avoid re-extracting on every launch (mtime + size validation)
- [ ] Optional retention limits (e.g. max clipboard entries by age — count cap of 500 is enforced)

### 1.3 Timeline UX

- [ ] Infinite scroll or pagination for large folders
- [ ] Grouping by day/week in timeline
- [x] Empty states per section (Timeline, Favorites, Indexed) and first-launch welcome onboarding
- [x] Timeline toolbar redesign — Folders row (All / defaults / custom / + Add Folder), type/tag filters, view mode, sort
- [ ] Error states per source
- [x] Background indexing queue (off by default; TXT/DOCX; optional PDF with size/delay limits and crash-safe extraction)
- [x] **Layout stability** — main-page scroll for Timeline + card-style Details panel; split-scroll experiment reverted (Jun 2026)

### 1.4 Content & search

- [x] Content indexing workflow — Index / Reindex / Clear index in details panel; status + char count + timestamp; dedicated Indexed sidebar page; Settings index statistics
- [x] PDF background indexing safety — off by default; isolated Rust extraction with timeout/panic guard; configurable max size and inter-file delay; failures marked `error` without retry in session
- [ ] Index `xlsx` / `csv` text where practical
- [x] Image thumbnails in cards (png/jpg/jpeg/webp; lazy 64×64 via Tauri asset protocol + `convertFileSrc`)
- [ ] **OCR image indexing (Phase 1)** — *postponed* — prototype shipped (`ocrs`, `file_index_cache` integration) but disabled (`OCR_INDEXING_ENABLED = false`) due to UI lag; needs safer worker/background process before re-enable
- [ ] Fuzzy or ranked search (today: substring match in `contentSearch`, including `tag:` syntax)

---

## Phase 2 — Broader capture

*Expand what counts as a “memory” beyond three folders + clipboard.*

- [x] User-configurable watch folders — managed on Timeline (folder pills + Add Folder); default folder toggles remain in Settings
- [ ] Screenshots folder detection or dedicated screenshot capture hook
- [ ] Browser history / saved pages (extension or export import) — *scoped carefully for privacy*
- [ ] “Notes” or quick-capture scratchpad inside Remy
- [ ] File system watcher events instead of (or in addition to) polling

---

## Phase 3 — Power user & quality

- [x] Global shortcut to open Remy (Raycast-style launcher) — `Cmd + Shift + Space` opens compact Quick Search overlay with **context chips** (All, Recent, Clipboard, Favorites, Tags), **tag autocomplete** (`tag` / `tag:` / `#` + prefix filter + memory counts), live All browse; scoped search; ↑↓ navigate, Enter open/copy, Esc hide, Cmd+Enter open in full app; fallback to main window; read-only display in Settings → Shortcuts
- [x] **Background mode** — hide window on close (default on); keep file/clipboard/indexing alive; one-time notification; Settings toggle
- [x] **Launch at login (macOS)** — optional Launch Agent login item; autostart with hidden window (`--background-launch`); Settings toggle (default off)
- [x] Menu bar / system tray presence (macOS menu bar icon with Open, Scan now, indexing toggle, stats, Quit)
- [ ] Export memories (JSON/Markdown archive)
- [ ] Exclude lists (paths, apps, sensitive patterns)
- [x] First-launch welcome onboarding (one-time modal; Scan now / Add Folder)
- [ ] OCR image indexing — re-enable after dedicated worker process (code retained, flag-gated)
- [ ] macOS sandbox / permission onboarding flow
- [ ] Windows & Linux parity testing and installers
- [ ] Automated tests: Rust indexer unit tests, frontend mapper/search tests

---

## Phase 4 — Intelligence (optional, later)

*Only after local storage and capture are solid. Still local-first by default.*

- [ ] Embeddings + semantic search over indexed content (on-device model or user-provided API key)
- [ ] Summaries / “what was I working on?” views
- [ ] Explicit opt-in for any network call

---

## Backlog / ideas

| Idea | Notes |
|------|--------|
| Tags or collections | ~~User-organized groups~~ — **Phase 1 tags shipped** (Favorites covers pinning) |
| Duplicate detection | Same file path or content hash |
| PDF page previews | Richer detail panel |
| Mobile companion | Out of scope until desktop is stable |
| Sync | Conflicts with local-first unless user-owned (e.g. iCloud folder) |

---

## How to use this roadmap

1. Pick the next unchecked item in the earliest incomplete phase.
2. Update checkboxes when merging work (or strike through with PR link).
3. If scope changes, edit **Principles** in `PROJECT_CONTEXT.md` first, then adjust phases here.

**Current focus recommendation:** Phase 1.1 (Search dedicated view) — Quick Search overlay with context chips, tag autocomplete, global hotkey, file tags, onboarding, empty states, Settings, persistence, custom watch folders, tray/background mode, and launch at login are in place. OCR postponed until a dedicated worker exists. Timeline layout uses stable main-page scroll (no nested scroll containers).

---

## Session log — tag autocomplete

Commit: `feat: add tag autocomplete and overlay tag search`

| Deliverable | Notes |
|-------------|--------|
| Tag suggestion list | `buildTagAutocompleteRows` in `quickSearchContext.ts` |
| Trigger prefixes | `tag`, `tag:`, `tag:name`, `#`, `#name` via `parseQuickSearchTagAutocomplete` |
| Usage counts | `#edu · 3 memories` from `tagUsageFromAssignments` |
| Selection | Fills `tag:name`, shows tagged memories in overlay |
| Tag search | Completed `tag:name` uses `contentSearch` tag filter; `#name` normalized to `tag:name` |
| Overlay UI | `TagSuggestionRowContent` in `QuickSearchOverlay.tsx`; ↑↓ Enter click unchanged |

---

## Session log — 2026-06-05

Consolidated milestone commit message: `feat: overlay contexts, tags, tray mode and stability improvements`

| Deliverable | Notes |
|-------------|--------|
| Custom folders on Timeline | `useWatchedFolders`, folder pills, Add/Remove |
| Timeline toolbar | Folders, types, tags, view, sort |
| Empty states + onboarding | `EmptyState`, `OnboardingModal` |
| Background mode + tray | `background_mode.rs`, `tray.rs` |
| Launch at login | `launch_at_login.rs`, autostart plugin |
| Global hotkey + overlay | `global_hotkey.rs`, `quick_search.rs`, `QuickSearchOverlay.tsx` |
| Recent Activity + context chips | `quickSearchRecentActivity.ts`, `quickSearchContext.ts` |
| Tags | SQLite, `useTags`, `tag:` search, Timeline filter |
| OCR rollback | Flag-gated off in frontend + Rust |
| Stability | Scroll layout experiment reverted; `indexingOcr` queue state fix |
