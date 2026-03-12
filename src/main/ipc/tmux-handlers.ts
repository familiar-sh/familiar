import { ipcMain } from 'electron'
import { ElectronTmuxManager } from '../platform/electron-tmux'

export function registerTmuxHandlers(tmuxManager: ElectronTmuxManager): void {
  ipcMain.handle('tmux:list', async () => {
    return tmuxManager.listSessions()
  })

  ipcMain.handle('tmux:attach', async (_event, name: string) => {
    await tmuxManager.attachSession(name)
  })

  ipcMain.handle('tmux:detach', async (_event, name: string) => {
    await tmuxManager.detachSession(name)
  })

  ipcMain.handle('tmux:kill', async (_event, name: string) => {
    try {
      await tmuxManager.killSession(name)
    } catch {
      // Session may already be dead — that's fine
    }
  })

  ipcMain.handle('tmux:has', async (_event, name: string) => {
    return tmuxManager.hasSession(name)
  })
}
