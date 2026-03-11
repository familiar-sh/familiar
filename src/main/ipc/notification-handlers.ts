import { ipcMain, Notification } from 'electron'

export function registerNotificationHandlers(): void {
  ipcMain.handle('notification:send', async (_, title: string, body: string) => {
    new Notification({ title, body }).show()
  })
}
