/**
 * Centralized file-change event hub.
 *
 * Multiple React components need to react to 'project:file-changed' IPC events.
 * Each call to `window.api.watchProjectDir()` adds a new listener on ipcRenderer,
 * and with mounted-task patterns keeping components alive, listeners accumulate
 * past the default MaxListeners limit (10).
 *
 * This module maintains a single IPC listener and fans out to in-process subscribers.
 */

type FileChangeCallback = (projectPath?: string) => void

const subscribers = new Set<FileChangeCallback>()
let unsubscribeIpc: (() => void) | null = null

function ensureIpcListener(): void {
  if (unsubscribeIpc) return
  unsubscribeIpc = window.api.watchProjectDir((projectPath) => {
    for (const cb of subscribers) {
      cb(projectPath)
    }
  })
}

/**
 * Subscribe to file-change events. Returns an unsubscribe function.
 * The single IPC listener is created lazily on first subscribe and
 * cleaned up when the last subscriber unsubscribes.
 */
export function onFileChange(callback: FileChangeCallback): () => void {
  subscribers.add(callback)
  ensureIpcListener()
  return () => {
    subscribers.delete(callback)
    if (subscribers.size === 0 && unsubscribeIpc) {
      unsubscribeIpc()
      unsubscribeIpc = null
    }
  }
}
