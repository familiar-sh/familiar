import { ipcMain, BrowserWindow, dialog, app, shell } from 'electron'
import { DataService } from '../services/data-service'
import { FileWatcher } from '../services/file-watcher'

export function registerWindowHandlers(
  mainWindow: BrowserWindow,
  dataService: DataService,
  getFileWatcher: () => FileWatcher | null,
  setFileWatcher: (fw: FileWatcher | null) => void
): void {
  ipcMain.handle('window:open-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.filePaths[0] || null
  })

  ipcMain.handle('project:set-root', async (_, newRoot: string) => {
    // Update DataService project root
    dataService.setProjectRoot(newRoot)

    // Restart file watcher with new root
    const oldWatcher = getFileWatcher()
    if (oldWatcher) {
      oldWatcher.stop()
    }
    const newWatcher = new FileWatcher(newRoot, mainWindow)
    newWatcher.start()
    setFileWatcher(newWatcher)

    return true
  })

  ipcMain.handle('app:version', async () => {
    return app.getVersion()
  })

  ipcMain.handle('shell:show-in-folder', (_, path: string) => {
    shell.showItemInFolder(path)
  })
}
