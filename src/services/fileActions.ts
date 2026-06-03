import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener'
import { isTauri } from '../lib/tauri'

function requireDesktop(): void {
  if (!isTauri()) {
    throw new Error('File actions are only available in the Remy desktop app.')
  }
}

export function revealLabel(): string {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform)) {
    return 'Reveal in Finder'
  }
  if (typeof navigator !== 'undefined' && /Win/i.test(navigator.platform)) {
    return 'Show in Explorer'
  }
  return 'Show in Folder'
}

export async function openFile(path: string): Promise<void> {
  requireDesktop()
  await openPath(path)
}

export async function revealInFileManager(path: string): Promise<void> {
  requireDesktop()
  await revealItemInDir(path)
}

export async function copyPath(path: string): Promise<void> {
  requireDesktop()
  await writeText(path)
}

export async function copyText(text: string): Promise<void> {
  if (isTauri()) {
    await writeText(text)
    return
  }
  await navigator.clipboard.writeText(text)
}
