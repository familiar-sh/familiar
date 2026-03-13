import { ipcMain, BrowserWindow, shell } from 'electron'
import { UpdateService } from '../services/update-service'

export function registerUpdateHandlers(
  mainWindow: BrowserWindow,
  updateService: UpdateService
): void {
  // Check for updates (manual trigger from renderer)
  ipcMain.handle('update:check', async () => {
    return updateService.checkForUpdates(true)
  })

  // Dismiss the current update notification
  ipcMain.handle('update:dismiss', async (_, version: string) => {
    updateService.dismissUpdate(version)
  })

  // Open the release page in the default browser
  ipcMain.handle('update:download', async (_, releaseUrl: string) => {
    await shell.openExternal(releaseUrl)
  })

  // Start periodic background checks — notify renderer when update found
  updateService.startPeriodicCheck((info) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update:available', info)
    }
  })
}
