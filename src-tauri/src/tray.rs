use crate::background_mode;
use crate::persistence::RemyStore;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime};

pub mod ids {
    pub const OPEN: &str = "tray_open";
    pub const SCAN: &str = "tray_scan";
    pub const TOGGLE_INDEXING: &str = "tray_toggle_indexing";
    pub const STATS_INDEXED: &str = "tray_stats_indexed";
    pub const STATS_CLIPBOARD: &str = "tray_stats_clipboard";
    pub const QUIT: &str = "tray_quit";
}

pub struct TrayMenuState<R: Runtime> {
    toggle_indexing: MenuItem<R>,
    stats_indexed: MenuItem<R>,
    stats_clipboard: MenuItem<R>,
}

impl<R: Runtime> TrayMenuState<R> {
    fn refresh(&self, app: &AppHandle<R>) -> Result<(), String> {
        let store = app.state::<RemyStore>();
        let stats = store.memory_statistics()?;
        let settings = store.get_settings()?;

        self.stats_indexed
            .set_text(format!("Indexed: {} files", stats.indexed_files))
            .map_err(|e| e.to_string())?;
        self.stats_clipboard
            .set_text(format!(
                "Clipboard entries: {}",
                stats.clipboard_entries
            ))
            .map_err(|e| e.to_string())?;
        self.toggle_indexing
            .set_text(if settings.background_indexing_enabled {
                "Background indexing: On"
            } else {
                "Background indexing: Off"
            })
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event_id: &str) {
    match event_id {
        ids::OPEN => background_mode::show_main_window(app),
        ids::SCAN => {
            let _ = app.emit("tray-scan-now", ());
        }
        ids::TOGGLE_INDEXING => {
            if let Err(err) = toggle_background_indexing(app) {
                eprintln!("tray: failed to toggle background indexing: {err}");
            }
        }
        ids::QUIT => {
            app.exit(0);
        }
        ids::STATS_INDEXED | ids::STATS_CLIPBOARD => {}
        _ => {}
    }
}

fn toggle_background_indexing<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let store = app.state::<RemyStore>();
    let mut settings = store.get_settings()?;
    settings.background_indexing_enabled = !settings.background_indexing_enabled;
    store.save_settings(&settings)?;

    if let Some(tray_state) = app.try_state::<TrayMenuState<R>>() {
        tray_state.refresh(app)?;
    }

    let _ = app.emit("settings-changed", ());
    Ok(())
}

pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let open = MenuItem::with_id(app, ids::OPEN, "Open Remy", true, None::<&str>)?;
    let scan = MenuItem::with_id(app, ids::SCAN, "Scan now", true, None::<&str>)?;
    let separator_1 = PredefinedMenuItem::separator(app)?;
    let toggle_indexing = MenuItem::with_id(
        app,
        ids::TOGGLE_INDEXING,
        "Background indexing: Off",
        true,
        None::<&str>,
    )?;
    let stats_indexed = MenuItem::with_id(
        app,
        ids::STATS_INDEXED,
        "Indexed: 0 files",
        false,
        None::<&str>,
    )?;
    let stats_clipboard = MenuItem::with_id(
        app,
        ids::STATS_CLIPBOARD,
        "Clipboard entries: 0",
        false,
        None::<&str>,
    )?;
    let separator_2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, ids::QUIT, "Quit Remy", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &open,
            &scan,
            &separator_1,
            &toggle_indexing,
            &stats_indexed,
            &stats_clipboard,
            &separator_2,
            &quit,
        ],
    )?;

    app.manage(TrayMenuState {
        toggle_indexing,
        stats_indexed,
        stats_clipboard,
    });

    if let Some(tray_state) = app.try_state::<TrayMenuState<R>>() {
        tray_state.refresh(app)?;
    }

    let icon = app
        .default_window_icon()
        .ok_or("missing default window icon for tray")?
        .clone();

    let tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Remy")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id.as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button_state: MouseButtonState::Down,
                    ..
                }
            ) {
                let app = tray.app_handle();
                if let Some(tray_state) = app.try_state::<TrayMenuState<R>>() {
                    let _ = tray_state.refresh(app);
                }
            }
        })
        .build(app)?;

    #[cfg(target_os = "macos")]
    {
        let _ = tray.set_icon_as_template(true);
    }

    Ok(())
}
