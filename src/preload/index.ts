import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { ProjectState, Task, ActivityEntry, ProjectSettings, AppNotification, Workspace, WorkspaceConfig } from '../shared/types'

// Custom APIs for renderer
const api = {
  // Project
  getProjectRoot: (): Promise<string> => ipcRenderer.invoke('project:get-root'),
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
  copyTempToAttachment: (taskId: string, tempPath: string, fileName: string): Promise<string> =>
    ipcRenderer.invoke('task:copy-temp-to-attachment', taskId, tempPath, fileName),

  // Task file listing
  listTaskFiles: (taskId: string): Promise<{ name: string; size: number; isDir: boolean; path: string }[]> =>
    ipcRenderer.invoke('task:list-files', taskId),

  // Pasted files
  savePastedFile: (taskId: string, filename: string, content: string): Promise<void> =>
    ipcRenderer.invoke('task:save-pasted-file', taskId, filename, content),
  readPastedFile: (taskId: string, filename: string): Promise<string> =>
    ipcRenderer.invoke('task:read-pasted-file', taskId, filename),
  deletePastedFile: (taskId: string, filename: string): Promise<void> =>
    ipcRenderer.invoke('task:delete-pasted-file', taskId, filename),

  // Clipboard
  clipboardSaveImage: (arrayBuffer: ArrayBuffer, mimeType: string): Promise<string> =>
    ipcRenderer.invoke('clipboard:save-image', arrayBuffer, mimeType),

  // PTY operations
  ptyCreate: (taskId: string, paneId: string, cwd: string, forkedFrom?: string, overrideCommand?: string): Promise<string> =>
    ipcRenderer.invoke('pty:create', taskId, paneId, cwd, forkedFrom, overrideCommand),
  ptyCreatePlain: (taskId: string, paneId: string, cwd: string): Promise<string> =>
    ipcRenderer.invoke('pty:create-plain', taskId, paneId, cwd),
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
  tmuxKill: (name: string): Promise<void> => ipcRenderer.invoke('tmux:kill', name),
  tmuxHas: (name: string): Promise<boolean> => ipcRenderer.invoke('tmux:has', name),
  tmuxSendKeys: (sessionName: string, keys: string, pressEnter: boolean): Promise<void> =>
    ipcRenderer.invoke('tmux:send-keys', sessionName, keys, pressEnter),
  warmupTmuxSession: (taskId: string, forkedFrom?: string): Promise<void> =>
    ipcRenderer.invoke('tmux:warmup', taskId, forkedFrom),

  // Notifications
  sendNotification: (title: string, body: string): Promise<void> =>
    ipcRenderer.invoke('notification:send', title, body),
  listNotifications: (): Promise<AppNotification[]> =>
    ipcRenderer.invoke('notification:list'),
  listAllNotifications: (): Promise<(AppNotification & { projectPath: string })[]> =>
    ipcRenderer.invoke('notification:list-all'),
  markNotificationRead: (id: string): Promise<void> =>
    ipcRenderer.invoke('notification:mark-read', id),
  markNotificationsByTaskRead: (taskId: string): Promise<void> =>
    ipcRenderer.invoke('notification:mark-read-by-task', taskId),
  markNotificationsByTaskIds: (taskIds: string[]): Promise<void> =>
    ipcRenderer.invoke('notification:mark-read-by-tasks', taskIds),
  markAllNotificationsRead: (): Promise<void> =>
    ipcRenderer.invoke('notification:mark-all-read'),
  clearNotifications: (): Promise<void> =>
    ipcRenderer.invoke('notification:clear'),
  appendNotification: (notification: AppNotification): Promise<void> =>
    ipcRenderer.invoke('notification:append', notification),

  // Window
  openDirectory: (): Promise<string | null> => ipcRenderer.invoke('window:open-directory'),
  setProjectRoot: (path: string): Promise<boolean> => ipcRenderer.invoke('project:set-root', path),
  onExternalTaskOpen: (callback: (taskId: string) => void): (() => void) => {
    ipcRenderer.on('task:open-external', (_, taskId: string) => callback(taskId))
    return () => {
      ipcRenderer.removeAllListeners('task:open-external')
    }
  },
  onMenuOpenWorkspace: (callback: () => void): (() => void) => {
    ipcRenderer.on('menu:open-workspace', () => callback())
    return () => {
      ipcRenderer.removeAllListeners('menu:open-workspace')
    }
  },
  onMenuRunOnboarding: (callback: () => void): (() => void) => {
    ipcRenderer.on('menu:run-onboarding', () => callback())
    return () => {
      ipcRenderer.removeAllListeners('menu:run-onboarding')
    }
  },
  onMenuAddProject: (callback: () => void): (() => void) => {
    ipcRenderer.on('menu:add-project', () => callback())
    return () => {
      ipcRenderer.removeAllListeners('menu:add-project')
    }
  },
  onMenuShowWorkspacePicker: (callback: () => void): (() => void) => {
    ipcRenderer.on('menu:show-workspace-picker', () => callback())
    return () => {
      ipcRenderer.removeAllListeners('menu:show-workspace-picker')
    }
  },

  // File watching
  watchProjectDir: (callback: (projectPath?: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, projectPath?: string): void =>
      callback(projectPath)
    ipcRenderer.on('project:file-changed', handler)
    return () => {
      ipcRenderer.removeListener('project:file-changed', handler)
    }
  },
  unwatchProjectDir: (): void => {
    ipcRenderer.send('project:unwatch')
  },

  // Settings
  readSettings: (): Promise<ProjectSettings> => ipcRenderer.invoke('settings:read'),
  writeSettings: (settings: ProjectSettings): Promise<void> =>
    ipcRenderer.invoke('settings:write', settings),

  // CLI
  cliCheckAvailable: (): Promise<boolean> => ipcRenderer.invoke('cli:check-available'),
  cliInstallToPath: (): Promise<{ success: boolean; shell: string; error?: string }> =>
    ipcRenderer.invoke('cli:install-to-path'),
  claudeCheckAvailable: (): Promise<{ available: boolean; path: string | null; version: string | null }> =>
    ipcRenderer.invoke('claude:check-available'),

  // Health checks
  healthCheck: (overrideAgent?: string): Promise<{
    issues: { id: string; severity: 'error' | 'warning'; title: string; description: string; fixable: boolean }[]
    cliAvailable: boolean
    agentHarnessConfigured: boolean
    claudeAvailable: boolean | null
    hooksConfigured: boolean | null
    skillInstalled: boolean | null
  }> => ipcRenderer.invoke('health:check', overrideAgent),
  healthFix: (issueId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('health:fix', issueId),
  healthFixAll: (): Promise<{ fixed: string[]; failed: string[] }> =>
    ipcRenderer.invoke('health:fix-all'),
  healthCheckHooks: (projectRoot: string): Promise<boolean> =>
    ipcRenderer.invoke('health:check-hooks', projectRoot),
  healthCheckSkill: (projectRoot: string): Promise<boolean> =>
    ipcRenderer.invoke('health:check-skill', projectRoot),
  healthFixForProject: (projectRoot: string, issueId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('health:fix-for-project', projectRoot, issueId),

  // Shell
  openPath: (path: string): Promise<string> => ipcRenderer.invoke('shell:open-path', path),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),

  // Workspace
  workspaceList: (): Promise<Workspace[]> => ipcRenderer.invoke('workspace:list'),
  workspaceCreate: (name: string, projectPaths: string[]): Promise<Workspace> =>
    ipcRenderer.invoke('workspace:create', name, projectPaths),
  workspaceUpdate: (id: string, updates: Partial<Workspace>): Promise<Workspace> =>
    ipcRenderer.invoke('workspace:update', id, updates),
  workspaceDelete: (id: string): Promise<void> => ipcRenderer.invoke('workspace:delete', id),
  workspaceOpen: (workspaceId: string): Promise<void> =>
    ipcRenderer.invoke('workspace:open', workspaceId),
  workspaceOpenSingle: (path: string): Promise<void> =>
    ipcRenderer.invoke('workspace:open-single', path),
  workspaceAddProject: (path: string): Promise<void> =>
    ipcRenderer.invoke('workspace:add-project', path),
  workspaceRemoveProject: (path: string): Promise<void> =>
    ipcRenderer.invoke('workspace:remove-project', path),
  workspaceGetConfig: (): Promise<WorkspaceConfig> =>
    ipcRenderer.invoke('workspace:get-config'),
  workspaceGetOpenProjects: (): Promise<string[]> =>
    ipcRenderer.invoke('workspace:get-open-projects'),
  workspaceGetActiveProject: (): Promise<string | null> =>
    ipcRenderer.invoke('workspace:get-active-project'),
  workspaceSetActiveProject: (path: string): Promise<void> =>
    ipcRenderer.invoke('workspace:set-active-project', path),
  workspaceSetActiveWorkspaceId: (workspaceId: string): Promise<void> =>
    ipcRenderer.invoke('workspace:set-active-workspace-id', workspaceId),
  workspaceListAllTasks: (): Promise<(Task & { projectPath: string })[]> =>
    ipcRenderer.invoke('workspace:list-all-tasks'),

  // Worktree
  worktreeList: (): Promise<{ path: string; branch: string; slug: string; isMain: boolean }[]> =>
    ipcRenderer.invoke('worktree:list'),
  worktreeCreate: (customSlug?: string): Promise<{ path: string; branch: string; slug: string; isMain: boolean }> =>
    ipcRenderer.invoke('worktree:create', customSlug),
  worktreeRename: (worktreePath: string, newSlug: string): Promise<{ path: string; branch: string; slug: string; isMain: boolean }> =>
    ipcRenderer.invoke('worktree:rename', worktreePath, newSlug),
  worktreeRemove: (worktreePath: string): Promise<void> =>
    ipcRenderer.invoke('worktree:remove', worktreePath),
  worktreeGetGitRoot: (): Promise<string | null> =>
    ipcRenderer.invoke('worktree:get-git-root'),

  // App info
  getVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),

  // Updates
  checkForUpdates: (): Promise<{
    currentVersion: string
    latestVersion: string
    releaseUrl: string
    releaseNotes: string
    publishedAt: string
  } | null> => ipcRenderer.invoke('update:check'),
  dismissUpdate: (version: string): Promise<void> =>
    ipcRenderer.invoke('update:dismiss', version),
  downloadUpdate: (releaseUrl: string): Promise<void> =>
    ipcRenderer.invoke('update:download', releaseUrl),
  onUpdateAvailable: (
    callback: (info: {
      currentVersion: string
      latestVersion: string
      releaseUrl: string
      releaseNotes: string
      publishedAt: string
    }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      info: {
        currentVersion: string
        latestVersion: string
        releaseUrl: string
        releaseNotes: string
        publishedAt: string
      }
    ): void => {
      callback(info)
    }
    ipcRenderer.on('update:available', handler)
    return () => {
      ipcRenderer.removeListener('update:available', handler)
    }
  }
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
