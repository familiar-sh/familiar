import { Notification } from 'electron'
import type { INotificationManager } from '../../shared/platform/notifications'

export class ElectronNotificationManager implements INotificationManager {
  async send(title: string, body: string): Promise<void> {
    new Notification({ title, body }).show()
  }

  isSupported(): boolean {
    return Notification.isSupported()
  }
}
