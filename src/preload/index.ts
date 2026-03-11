import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ProjectState, Task, ActivityEntry } from '../shared/types'

// Custom APIs for renderer
const api = {
  // Project
  readProjectState: (): Promise<ProjectState> => ipcRenderer.invoke('project:read-state'),
  writeProjectState: (state: ProjectState): Promise<void> =>
    ipcRenderer.invoke('project:write-state', state),
  initProject: (name: string): Promise<ProjectState> =>
    ipcRenderer.invoke('project:init', name),
  isInitialized: (): Promise<boolean> => ipcRenderer.invoke('project:is-initialized'),

  // Task CRUD
  createTask: (task: Task): Promise<void> => ipcRenderer.invoke('task:create', task),
  readTask: (taskId: string): Promise<Task> => ipcRenderer.invoke('task:read', taskId),
  updateTask: (task: Task): Promise<void> => ipcRenderer.invoke('task:update', task),
  deleteTask: (taskId: string): Promise<void> => ipcRenderer.invoke('task:delete', taskId),

  // Document
  readTaskDocument: (taskId: string): Promise<string> =>
    ipcRenderer.invoke('task:read-document', taskId),
  writeTaskDocument: (taskId: string, content: string): Promise<void> =>
    ipcRenderer.invoke('task:write-document', taskId, content),

  // Activity
  readTaskActivity: (taskId: string): Promise<ActivityEntry[]> =>
    ipcRenderer.invoke('task:read-activity', taskId),
  appendActivity: (taskId: string, entry: ActivityEntry): Promise<void> =>
    ipcRenderer.invoke('task:append-activity', taskId, entry),

  // Attachments
  saveAttachment: (taskId: string, fileName: string, data: ArrayBuffer): Promise<string> =>
    ipcRenderer.invoke('task:save-attachment', taskId, fileName, data),

  // PTY operations
  ptyCreate: (taskId: string, paneId: string, cwd: string): Promise<string> =>
    ipcRenderer.invoke('pty:create', taskId, paneId, cwd),
  ptyWrite: (sessionId: string, data: string): Promise<void> =>
    ipcRenderer.invoke('pty:write', sessionId, data),
  ptyResize: (sessionId: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke('pty:resize', sessionId, cols, rows),
  ptyDestroy: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('pty:destroy', sessionId),
  onPtyData: (callback: (sessionId: string, data: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, sessionId: string, data: string): void => {
      callback(sessionId, data)
    }
    ipcRenderer.on('pty:data', handler)
    return () => {
      ipcRenderer.removeListener('pty:data', handler)
    }
  },

  // Tmux operations
  tmuxList: (): Promise<string[]> => ipcRenderer.invoke('tmux:list'),
  tmuxAttach: (name: string): Promise<void> => ipcRenderer.invoke('tmux:attach', name),
  tmuxDetach: (name: string): Promise<void> => ipcRenderer.invoke('tmux:detach', name),

  // Notifications
  sendNotification: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke('notification:send', title, body),

  // Window
  openDirectory: (): Promise<string | null> => ipcRenderer.invoke('window:open-directory'),
  onExternalTaskOpen: (callback: (taskId: string) => void): (() => void) => {
    ipcRenderer.on('task:open-external', (_, taskId: string) => callback(taskId))
    return () => {
      ipcRenderer.removeAllListeners('task:open-external')
    }
  },

  // File watching
  watchProjectDir: (callback: () => void): (() => void) => {
    ipcRenderer.on('project:file-changed', () => callback())
    return () => {
      ipcRenderer.removeAllListeners('project:file-changed')
    }
  },
  unwatchProjectDir: (): void => {
    ipcRenderer.send('project:unwatch')
  },

  // App info
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
