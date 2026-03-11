import { ipcMain, BrowserWindow, dialog, app } from 'electron'

export function registerWindowHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('window:open-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.filePaths[0] || null
  })

  ipcMain.handle('app:version', async () => {
    return app.getVersion()
  })
}
