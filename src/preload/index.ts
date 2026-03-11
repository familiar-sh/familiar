import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // File operations (to be implemented)
  // readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  // writeFile: (path: string, data: string) => ipcRenderer.invoke('file:write', path, data),

  // PTY operations (to be implemented)
  // ptyCreate: (options: object) => ipcRenderer.invoke('pty:create', options),
  // ptyWrite: (id: string, data: string) => ipcRenderer.invoke('pty:write', id, data),
  // ptyResize: (id: string, cols: number, rows: number) => ipcRenderer.invoke('pty:resize', id, cols, rows),
  // ptyKill: (id: string) => ipcRenderer.invoke('pty:kill', id),
  // onPtyData: (callback: (id: string, data: string) => void) => {
  //   ipcRenderer.on('pty:data', (_, id, data) => callback(id, data))
  // },

  // Notification operations (to be implemented)
  // notify: (title: string, body: string) => ipcRenderer.invoke('notification:send', title, body),

  // Placeholder version info
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
