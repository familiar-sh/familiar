/// <reference types="vite/client" />

import type { ProjectState, Task, ActivityEntry } from '../../shared/types'

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

    // PTY operations
    ptyCreate(taskId: string, paneId: string, cwd: string): Promise<string>
    ptyWrite(sessionId: string, data: string): Promise<void>
    ptyResize(sessionId: string, cols: number, rows: number): Promise<void>
    ptyDestroy(sessionId: string): Promise<void>
    onPtyData(callback: (sessionId: string, data: string) => void): () => void

    // Tmux operations
    tmuxList(): Promise<string[]>
    tmuxAttach(name: string): Promise<void>
    tmuxDetach(name: string): Promise<void>

    // Notifications
    sendNotification(title: string, body: string): Promise<void>

    // Window
    openDirectory(): Promise<string | null>
    onExternalTaskOpen(callback: (taskId: string) => void): () => void

    // File watching
    watchProjectDir(callback: () => void): () => void
    unwatchProjectDir(): void

    // App info
    getVersion(): Promise<string>
  }
}
