export interface FirstLaunchInput {
  fileCount: number
  clipboardEntryCount: number
  favoriteCount: number
  loading: boolean
  favoritesLoading: boolean
  onboardingCompleted: boolean
}

/** True only on a pristine install: no files, clipboard, or favorites, and not yet dismissed. */
export function shouldShowOnboarding(input: FirstLaunchInput): boolean {
  if (input.onboardingCompleted) return false
  if (input.loading || input.favoritesLoading) return false
  return (
    input.fileCount === 0 &&
    input.clipboardEntryCount === 0 &&
    input.favoriteCount === 0
  )
}
