import { ipcMain, Notification } from 'electron'
import type { DataService } from '../services/data-service'
import type { AppNotification } from '../../shared/types'

export function registerNotificationHandlers(dataService: DataService): void {
  ipcMain.handle('notification:send', async (_, title: string, body: string) => {
    new Notification({ title, body }).show()
  })

  ipcMain.handle('notification:list', async () => {
    return dataService.readNotifications()
  })

  ipcMain.handle('notification:mark-read', async (_, id: string) => {
    await dataService.markNotificationRead(id)
  })

  ipcMain.handle('notification:mark-read-by-task', async (_, taskId: string) => {
    await dataService.markNotificationsByTaskRead(taskId)
  })

  ipcMain.handle('notification:mark-all-read', async () => {
    await dataService.markAllNotificationsRead()
  })

  ipcMain.handle('notification:clear', async () => {
    await dataService.clearNotifications()
  })

  ipcMain.handle(
    'notification:append',
    async (_, notification: AppNotification) => {
      await dataService.appendNotification(notification)
    }
  )
}
