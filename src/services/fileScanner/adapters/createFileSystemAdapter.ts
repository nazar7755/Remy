import { isTauri } from '../../../lib/tauri'
import type { FileSystemAdapter } from '../types'
import { MockFileSystemAdapter } from './MockFileSystemAdapter'
import { TauriFileSystemAdapter } from './TauriFileSystemAdapter'

export function createFileSystemAdapter(): FileSystemAdapter {
  if (isTauri()) {
    return new TauriFileSystemAdapter()
  }
  return new MockFileSystemAdapter()
}
