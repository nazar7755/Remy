const STORAGE_KEY = 'remy.onboardingCompleted'

export function readOnboardingCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeOnboardingCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
    window.dispatchEvent(new CustomEvent('remy:onboarding-completed'))
  } catch {
    // ignore quota / private mode
  }
}

/** Dev-only — clears the dismissed flag so the modal can appear again. */
export function resetOnboardingCompleted(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new CustomEvent('remy:onboarding-completed'))
  } catch {
    // ignore
  }
}
