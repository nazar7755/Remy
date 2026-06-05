import { useEffect, useState } from 'react'
import App from './App.tsx'
import { QuickSearchOverlay } from './components/QuickSearchOverlay.tsx'
import { isQuickSearchWindow } from './lib/quickSearchWindow.ts'

export function Bootstrap() {
  const [quickSearch, setQuickSearch] = useState<boolean | null>(null)

  useEffect(() => {
    void isQuickSearchWindow().then(setQuickSearch)
  }, [])

  if (quickSearch === null) {
    return null
  }

  return quickSearch ? <QuickSearchOverlay /> : <App />
}
