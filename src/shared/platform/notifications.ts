/**
 * Platform abstraction for native notification support.
 * Electron implementation lives in src/main/platform/.
 */
export interface INotificationManager {
  send(title: string, body: string): Promise<void>
  isSupported(): boolean
}
