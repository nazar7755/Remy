import { useCallback, useEffect, useState } from 'react'
import {
  isPreviewEmptyStatesAvailable,
  readPreviewEmptyStates,
  writePreviewEmptyStates,
} from '../lib/previewEmptyStates'

export function usePreviewEmptyStates() {
  const [enabled, setEnabled] = useState(readPreviewEmptyStates)

  useEffect(() => {
    const sync = () => setEnabled(readPreviewEmptyStates())
    window.addEventListener('remy:preview-empty-states', sync)
    return () => window.removeEventListener('remy:preview-empty-states', sync)
  }, [])

  const setPreviewEmptyStates = useCallback((next: boolean) => {
    writePreviewEmptyStates(next)
    setEnabled(next)
  }, [])

  return {
    available: isPreviewEmptyStatesAvailable(),
    enabled,
    setEnabled: setPreviewEmptyStates,
  }
}
