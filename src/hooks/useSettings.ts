import { useCallback, useEffect, useState } from 'react'
import { loadAppSettings, saveAppSettings } from '../services/settings'
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
