import { ipcMain, BrowserWindow } from 'electron'
import { ElectronPtyManager } from '../platform/electron-pty'

export function registerPtyHandlers(
  ptyManager: ElectronPtyManager,
  mainWindow: BrowserWindow
): void {
  ipcMain.handle('pty:create', async (_event, taskId: string, paneId: string, cwd: string) => {
    try {
      return await ptyManager.create(taskId, paneId, cwd)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('pty:create failed:', message)
      throw new Error(`Failed to create terminal session: ${message}`)
    }
  })

  ipcMain.handle('pty:write', async (_event, sessionId: string, data: string) => {
    try {
      await ptyManager.write(sessionId, data)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`pty:write failed for ${sessionId}:`, message)
    }
  })

  ipcMain.handle('pty:resize', async (_event, sessionId: string, cols: number, rows: number) => {
    try {
      await ptyManager.resize(sessionId, cols, rows)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`pty:resize failed for ${sessionId}:`, message)
    }
  })

  ipcMain.handle('pty:destroy', async (_event, sessionId: string) => {
    try {
      await ptyManager.destroy(sessionId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`pty:destroy failed for ${sessionId}:`, message)
    }
  })

  // Forward PTY data to the renderer process
  ptyManager.onData((sessionId: string, data: string) => {
    mainWindow.webContents.send('pty:data', sessionId, data)
  })
}
