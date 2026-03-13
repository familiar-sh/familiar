/// <reference types="vite/client" />

import type { ProjectState, Task, ActivityEntry, ProjectSettings, AppNotification } from '../../shared/types'

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send(channel: string, ...args: unknown[]): void
        on(channel: string, func: (...args: unknown[]) => void): void
        invoke(channel: string, ...args: unknown[]): Promise<unknown>
      }
    }
    api: {
      // Project
      getProjectRoot(): Promise<string>
      readProjectState(): Promise<ProjectState>
      writeProjectState(state: ProjectState): Promise<void>
      initProject(name: string): Promise<ProjectState>
      isInitialized(): Promise<boolean>

      // Task CRUD
      createTask(task: Task): Promise<void>
      readTask(taskId: string): Promise<Task>
      updateTask(task: Task): Promise<void>
      deleteTask(taskId: string): Promise<void>

      // Document
      readTaskDocument(taskId: string): Promise<string>
      writeTaskDocument(taskId: string, content: string): Promise<void>

      // Activity
      readTaskActivity(taskId: string): Promise<ActivityEntry[]>
      appendActivity(taskId: string, entry: ActivityEntry): Promise<void>

      // Attachments
      saveAttachment(taskId: string, fileName: string, data: ArrayBuffer): Promise<string>
      copyTempToAttachment(taskId: string, tempPath: string, fileName: string): Promise<string>

      // Task file listing
      listTaskFiles(taskId: string): Promise<{ name: string; size: number; isDir: boolean; path: string }[]>

      // Pasted files
      savePastedFile(taskId: string, filename: string, content: string): Promise<void>
      readPastedFile(taskId: string, filename: string): Promise<string>
      deletePastedFile(taskId: string, filename: string): Promise<void>

      // Clipboard
      clipboardSaveImage(arrayBuffer: ArrayBuffer, mimeType: string): Promise<string>

      // PTY operations
      ptyCreate(taskId: string, paneId: string, cwd: string): Promise<string>
      ptyCreatePlain(taskId: string, paneId: string, cwd: string): Promise<string>
      ptyWrite(sessionId: string, data: string): Promise<void>
      ptyResize(sessionId: string, cols: number, rows: number): Promise<void>
      ptyDestroy(sessionId: string): Promise<void>
      onPtyData(callback: (sessionId: string, data: string) => void): () => void

      // Tmux operations
      tmuxList(): Promise<string[]>
      tmuxAttach(name: string): Promise<void>
      tmuxDetach(name: string): Promise<void>
      tmuxKill(name: string): Promise<void>
      tmuxHas(name: string): Promise<boolean>
      tmuxSendKeys(sessionName: string, keys: string, pressEnter: boolean): Promise<void>
      warmupTmuxSession(taskId: string): Promise<void>

      // Notifications
      sendNotification(title: string, body: string): Promise<void>
      listNotifications(): Promise<AppNotification[]>
      markNotificationRead(id: string): Promise<void>
      markNotificationsByTaskRead(taskId: string): Promise<void>
      markAllNotificationsRead(): Promise<void>
      clearNotifications(): Promise<void>
      appendNotification(notification: AppNotification): Promise<void>

      // Window
      openDirectory(): Promise<string | null>
      setProjectRoot(path: string): Promise<boolean>
      onExternalTaskOpen(callback: (taskId: string) => void): () => void
      onMenuOpenWorkspace(callback: () => void): () => void
      onMenuRunOnboarding(callback: () => void): () => void

      // File watching
      watchProjectDir(callback: () => void): () => void
      unwatchProjectDir(): void

      // Settings
      readSettings(): Promise<ProjectSettings>
      writeSettings(settings: ProjectSettings): Promise<void>

      // CLI
      cliCheckAvailable(): Promise<boolean>
      cliInstallToPath(): Promise<{ success: boolean; shell: string; error?: string }>
      claudeCheckAvailable(): Promise<{ available: boolean; path: string | null; version: string | null }>

      // Shell
      openPath(path: string): Promise<string>
      openExternal(url: string): Promise<void>

      // App info
      getVersion(): Promise<string>

      // Updates
      checkForUpdates(): Promise<{
        currentVersion: string
        latestVersion: string
        releaseUrl: string
        releaseNotes: string
        publishedAt: string
      } | null>
      dismissUpdate(version: string): Promise<void>
      downloadUpdate(releaseUrl: string): Promise<void>
      onUpdateAvailable(
        callback: (info: {
          currentVersion: string
          latestVersion: string
          releaseUrl: string
          releaseNotes: string
          publishedAt: string
        }) => void
      ): () => void
    }
  }
}

export {}
