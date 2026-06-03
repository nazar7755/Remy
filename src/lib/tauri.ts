import { invoke, isTauri as apiIsTauri } from '@tauri-apps/api/core'

/** True when running inside the Tauri desktop shell (not Vite-only browser dev). */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (apiIsTauri()) return true
  } catch {
    // fall through
  }
  return '__TAURI_INTERNALS__' in window
}

export async function tauriInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke<T>(command, args)
}
