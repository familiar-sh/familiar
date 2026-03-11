import chokidar from 'chokidar'
import type { BrowserWindow } from 'electron'
import path from 'path'
import { DATA_DIR } from '../../shared/constants'

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null
  private projectRoot: string
  private mainWindow: BrowserWindow
  private debounceTimer: NodeJS.Timeout | null = null
  private selfTriggered = false

  constructor(projectRoot: string, mainWindow: BrowserWindow) {
    this.projectRoot = projectRoot
    this.mainWindow = mainWindow
  }

  start(): void {
    const watchPath = path.join(this.projectRoot, DATA_DIR)
    this.watcher = chokidar.watch(watchPath, {
      ignoreInitial: true,
      persistent: true,
      depth: 3,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
    })

    this.watcher.on('all', () => {
      if (this.selfTriggered) return
      // Debounce: only emit after 500ms of no changes
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        this.mainWindow.webContents.send('project:file-changed')
      }, 500)
    })
  }

  stop(): void {
    this.watcher?.close()
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
  }

  // Call this before/after self-writes to suppress watcher
  markSelfTriggered(): void {
    this.selfTriggered = true
  }

  clearSelfTriggered(): void {
    setTimeout(() => {
      this.selfTriggered = false
    }, 1000)
  }
}
