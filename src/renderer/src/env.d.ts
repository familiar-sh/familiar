/// <reference types="vite/client" />

interface Window {
  electron: {
    ipcRenderer: {
      send(channel: string, ...args: unknown[]): void
      on(channel: string, func: (...args: unknown[]) => void): void
      invoke(channel: string, ...args: unknown[]): Promise<unknown>
    }
  }
  api: {
    getVersion(): Promise<string>
  }
}
