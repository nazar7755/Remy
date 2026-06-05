import { useCallback, useEffect, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { loadAppSettings, saveAppSettings } from '../services/settings'
import { isTauri } from '../lib/tauri'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
} from '../types/settings'

export interface SettingsState {
  settings: AppSettings
  loading: boolean
  saving: boolean
  error: string | null
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
}

export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reloadSettings = useCallback(async () => {
    try {
      const loaded = await loadAppSettings()
      setSettings(loaded)
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load settings',
      )
    }
  }, [])

  useEffect(() => {
    if (!isTauri()) return

    let unlistenSettings: (() => void) | undefined
    let cancelled = false

    void (async () => {
      unlistenSettings = await listen('settings-changed', () => {
        void reloadSettings()
      })
      if (cancelled) {
        unlistenSettings?.()
      }
    })()

    return () => {
      cancelled = true
      unlistenSettings?.()
    }
  }, [reloadSettings])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const loaded = await loadAppSettings()
        if (!cancelled) {
          setSettings(loaded)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load settings',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const updateSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      setSaving(true)
      setError(null)

      const next = { ...settings, ...patch }
      setSettings(next)

      try {
        const saved = await saveAppSettings(next)
        setSettings(saved)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to save settings',
        )
        const reloaded = await loadAppSettings()
        setSettings(reloaded)
      } finally {
        setSaving(false)
      }
    },
    [settings],
  )

  return { settings, loading, saving, error, updateSettings }
}
