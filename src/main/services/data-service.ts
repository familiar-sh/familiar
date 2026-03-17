import { ElectronFileSystem } from '../platform/electron-file-system'
import type { ProjectState, Task, ActivityEntry, ProjectSettings, AppNotification } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/types'
import {
  DATA_DIR,
  STATE_FILE,
  TASKS_DIR,
  TASK_FILE,
  DOCUMENT_FILE,
  ACTIVITY_FILE,
  ATTACHMENTS_DIR,
  SETTINGS_FILE,
  NOTIFICATIONS_FILE,
  DEFAULT_COLUMNS,
  DEFAULT_LABELS,
  DEFAULT_LABEL_COLOR
} from '../../shared/constants'
import path from 'path'
import fs from 'fs'

export class DataService {
  private fs: ElectronFileSystem
  private projectRoot: string

  constructor(projectRoot: string) {
    this.fs = new ElectronFileSystem()
    this.projectRoot = projectRoot
  }

  setProjectRoot(newRoot: string): void {
    this.projectRoot = newRoot
  }

  /**
   * Returns the project root, auto-healing if the stored path no longer exists.
   * This handles the case where the project folder was renamed while the app was running.
   * On macOS, process.cwd() resolves to the new path even after a rename (inode-based).
   */
  getProjectRoot(): string {
    if (fs.existsSync(this.projectRoot)) {
      return this.projectRoot
    }

    // Stored root is stale — try to auto-detect the new location.
    // On macOS, process.cwd() follows the inode, so it returns the new name
    // even if the directory was renamed while the process was running.
    try {
      const cwd = process.cwd()
      const candidateFamiliar = path.join(cwd, DATA_DIR)
      if (fs.existsSync(candidateFamiliar)) {
        console.log(
          `Project root auto-healed: "${this.projectRoot}" → "${cwd}" (folder was renamed)`
        )
        this.projectRoot = cwd
        return this.projectRoot
      }
    } catch {
      // process.cwd() can throw if the directory was deleted entirely
    }

    // Last resort: check if the parent directory still exists and scan for .familiar/
    try {
      const parentDir = path.dirname(this.projectRoot)
      if (fs.existsSync(parentDir)) {
        const siblings = fs.readdirSync(parentDir)
        for (const sibling of siblings) {
          const candidate = path.join(parentDir, sibling)
          const candidateFamiliar = path.join(candidate, DATA_DIR)
          if (fs.existsSync(candidateFamiliar)) {
            // Verify it's the same project by checking state.json exists
            const stateFile = path.join(candidateFamiliar, STATE_FILE)
            if (fs.existsSync(stateFile)) {
              console.log(
                `Project root auto-healed: "${this.projectRoot}" → "${candidate}" (found .familiar/ in sibling)`
              )
              this.projectRoot = candidate
              return this.projectRoot
            }
          }
        }
      }
    } catch {
      // Parent dir scan failed — give up
    }

    // Return the stale root as-is (downstream code handles missing dirs)
    return this.projectRoot
  }

  private getDataPath(...segments: string[]): string {
    return path.join(this.projectRoot, DATA_DIR, ...segments)
  }

  // ─── Project state ────────────────────────────────────────────────

  async readProjectState(): Promise<ProjectState> {
    const filePath = this.getDataPath(STATE_FILE)
    const raw = await this.fs.readFile(filePath)
    const state = JSON.parse(raw) as ProjectState

    let migrated = false

    // Migrate: rename "cancelled" → "archived"
    const colIdx = state.columnOrder.indexOf('cancelled' as any)
    if (colIdx !== -1) {
      state.columnOrder[colIdx] = 'archived'
      migrated = true
    }
    for (const task of state.tasks) {
      if ((task.status as string) === 'cancelled') {
        task.status = 'archived'
        migrated = true
      }
    }

    // Migrate & sanitize project labels
    // Handles: plain strings, corrupted nested objects ({name: {name, color}}), and mixed arrays
    if (state.labels.length > 0) {
      const sanitized = state.labels.map((entry: any) => {
        if (typeof entry === 'string') {
          const defaultLabel = DEFAULT_LABELS.find((d) => d.name === entry)
          return { name: entry, color: defaultLabel?.color ?? DEFAULT_LABEL_COLOR }
        }
        // Fix corrupted entries where name is an object instead of a string
        if (entry && typeof entry.name === 'object' && entry.name !== null) {
          const realName = typeof entry.name.name === 'string' ? entry.name.name : String(entry.name)
          return { name: realName, color: entry.name.color ?? entry.color ?? DEFAULT_LABEL_COLOR }
        }
        // Already valid LabelConfig
        if (entry && typeof entry.name === 'string' && typeof entry.color === 'string') {
          return entry
        }
        return null
      }).filter(Boolean)

      // Deduplicate by name
      const seen = new Set<string>()
      const deduped = sanitized.filter((l: any) => {
        if (seen.has(l.name)) return false
        seen.add(l.name)
        return true
      })

      if (JSON.stringify(deduped) !== JSON.stringify(state.labels)) {
        state.labels = deduped
        migrated = true
      }
    }

    // Migrate: convert absolute attachment paths to relative filenames
    for (const task of state.tasks) {
      if (task.attachments && task.attachments.some((a) => path.isAbsolute(a))) {
        task.attachments = task.attachments.map((a) =>
          path.isAbsolute(a) ? path.basename(a) : a
        )
        migrated = true
      }
    }

    if (migrated) {
      await this.writeProjectState(state)
    }

    return state
  }

  async writeProjectState(state: ProjectState): Promise<void> {
    // Migrate: ensure "cancelled" is never written back
    const colIdx = state.columnOrder.indexOf('cancelled' as any)
    if (colIdx !== -1) {
      state.columnOrder[colIdx] = 'archived'
    }
    for (const task of state.tasks) {
      if ((task.status as string) === 'cancelled') {
        task.status = 'archived'
      }
    }

    // Sanitize labels on write: ensure all names are strings, deduplicate
    if (state.labels.length > 0) {
      const seen = new Set<string>()
      state.labels = state.labels.filter((l: any) => {
        if (!l || typeof l.name !== 'string') return false
        if (seen.has(l.name)) return false
        seen.add(l.name)
        return true
      })
    }

    const filePath = this.getDataPath(STATE_FILE)
    await this.fs.writeFileAtomic(filePath, JSON.stringify(state, null, 2))
  }

  // ─── Task CRUD ────────────────────────────────────────────────────

  async createTask(task: Task): Promise<void> {
    const taskDir = this.getDataPath(TASKS_DIR, task.id)
    await this.fs.mkdir(taskDir, true)

    // task.json
    await this.fs.writeFile(
      path.join(taskDir, TASK_FILE),
      JSON.stringify(task, null, 2)
    )

    // empty document.md
    await this.fs.writeFile(path.join(taskDir, DOCUMENT_FILE), '')

    // empty activity.json
    await this.fs.writeFile(
      path.join(taskDir, ACTIVITY_FILE),
      JSON.stringify([], null, 2)
    )
  }

  async readTask(taskId: string): Promise<Task> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, TASK_FILE)
    const raw = await this.fs.readFile(filePath)
    const task = JSON.parse(raw) as Task

    // Migrate absolute attachment paths to relative filenames
    if (task.attachments && task.attachments.some((a) => path.isAbsolute(a))) {
      task.attachments = task.attachments.map((a) =>
        path.isAbsolute(a) ? path.basename(a) : a
      )
      await this.updateTask(task)
    }

    return task
  }

  async updateTask(task: Task): Promise<void> {
    const filePath = this.getDataPath(TASKS_DIR, task.id, TASK_FILE)
    await this.fs.writeFileAtomic(filePath, JSON.stringify(task, null, 2))
  }

  async deleteTask(taskId: string): Promise<void> {
    const taskDir = this.getDataPath(TASKS_DIR, taskId)
    await this.fs.remove(taskDir)
  }

  // ─── Document ─────────────────────────────────────────────────────

  async readTaskDocument(taskId: string): Promise<string> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, DOCUMENT_FILE)
    return this.fs.readFile(filePath)
  }

  async writeTaskDocument(taskId: string, content: string): Promise<void> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, DOCUMENT_FILE)
    await this.fs.writeFile(filePath, content)
  }

  // ─── Activity ─────────────────────────────────────────────────────

  async readTaskActivity(taskId: string): Promise<ActivityEntry[]> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, ACTIVITY_FILE)
    try {
      const raw = await this.fs.readFile(filePath)
      return JSON.parse(raw) as ActivityEntry[]
    } catch {
      return []
    }
  }

  async appendActivity(taskId: string, entry: ActivityEntry): Promise<void> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, ACTIVITY_FILE)
    const entries = await this.readTaskActivity(taskId)
    entries.push(entry)
    await this.fs.writeFile(filePath, JSON.stringify(entries, null, 2))
  }

  // ─── Attachments ──────────────────────────────────────────────────

  async saveAttachment(
    taskId: string,
    fileName: string,
    data: ArrayBuffer
  ): Promise<string> {
    const attachDir = this.getDataPath(TASKS_DIR, taskId, ATTACHMENTS_DIR)
    await this.fs.mkdir(attachDir, true)
    const filePath = path.join(attachDir, fileName)
    const { writeFile } = await import('fs/promises')
    await writeFile(filePath, Buffer.from(data))
    // Return just the filename — stored paths should be relative for portability
    return fileName
  }

  async copyTempToAttachment(
    taskId: string,
    tempPath: string,
    fileName: string
  ): Promise<string> {
    const attachDir = this.getDataPath(TASKS_DIR, taskId, ATTACHMENTS_DIR)
    await this.fs.mkdir(attachDir, true)
    const destPath = path.join(attachDir, fileName)
    const { copyFile } = await import('fs/promises')
    await copyFile(tempPath, destPath)
    // Return just the filename — stored paths should be relative for portability
    return fileName
  }

  /**
   * Resolve an attachment reference (filename or legacy absolute path) to an absolute path.
   */
  resolveAttachmentPath(taskId: string, attachment: string): string {
    // If it's already an absolute path (legacy), return as-is
    if (path.isAbsolute(attachment)) {
      return attachment
    }
    // Otherwise resolve relative to the task's attachments folder
    return this.getDataPath(TASKS_DIR, taskId, ATTACHMENTS_DIR, attachment)
  }

  async listTaskFiles(taskId: string): Promise<{ name: string; size: number; isDir: boolean; path: string }[]> {
    const taskDir = this.getDataPath(TASKS_DIR, taskId)
    const { stat } = await import('fs/promises')

    const SKIP = new Set([TASK_FILE, ACTIVITY_FILE])

    const listDir = async (dir: string, prefix: string): Promise<{ name: string; size: number; isDir: boolean; path: string }[]> => {
      try {
        const entries = await this.fs.readDir(dir)
        const results: { name: string; size: number; isDir: boolean; path: string }[] = []
        for (const entry of entries) {
          if (entry.startsWith('.')) continue // skip hidden files
          if (!prefix && SKIP.has(entry)) continue // skip metadata at root level
          const fullPath = path.join(dir, entry)
          try {
            const s = await stat(fullPath)
            const displayName = prefix ? `${prefix}/${entry}` : entry
            if (s.isDirectory()) {
              // Recurse into subdirectories (e.g. attachments/)
              const children = await listDir(fullPath, displayName)
              results.push(...children)
            } else {
              results.push({
                name: displayName,
                size: s.size,
                isDir: false,
                path: fullPath
              })
            }
          } catch {
            // File may have been deleted between readdir and stat
          }
        }
        return results
      } catch {
        return []
      }
    }

    return listDir(taskDir, '')
  }

  // ─── Pasted Files ────────────────────────────────────────────────

  async savePastedFile(
    taskId: string,
    filename: string,
    content: string
  ): Promise<void> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, filename)
    await this.fs.writeFile(filePath, content)
  }

  async readPastedFile(taskId: string, filename: string): Promise<string> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, filename)
    return this.fs.readFile(filePath)
  }

  async deletePastedFile(taskId: string, filename: string): Promise<void> {
    const filePath = this.getDataPath(TASKS_DIR, taskId, filename)
    const { unlink } = await import('fs/promises')
    await unlink(filePath)
  }

  // ─── Init ─────────────────────────────────────────────────────────

  async initProject(projectName: string): Promise<ProjectState> {
    const dataDir = this.getDataPath()
    await this.fs.mkdir(dataDir, true)
    await this.fs.mkdir(this.getDataPath(TASKS_DIR), true)

    const state: ProjectState = {
      version: 1,
      projectName,
      tasks: [],
      columnOrder: [...DEFAULT_COLUMNS],
      labels: [...DEFAULT_LABELS]
    }

    await this.writeProjectState(state)

    // Write default settings
    await this.writeSettings(DEFAULT_SETTINGS)

    // Create .gitignore to keep task data out of version control
    const gitignorePath = this.getDataPath('.gitignore')
    const gitignoreContent = `# Ignore everything in .familiar/ except project config\n*\n!.gitignore\n!settings.json\n`
    await this.fs.writeFileAtomic(gitignorePath, gitignoreContent)

    return state
  }

  async isInitialized(): Promise<boolean> {
    const stateFile = this.getDataPath(STATE_FILE)
    return this.fs.exists(stateFile)
  }

  // ─── Settings ──────────────────────────────────────────────────────

  async readSettings(): Promise<ProjectSettings> {
    const filePath = this.getDataPath(SETTINGS_FILE)
    let settings: ProjectSettings
    try {
      const raw = await this.fs.readFile(filePath)
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as ProjectSettings
    } catch {
      settings = { ...DEFAULT_SETTINGS }
    }

    // Migrate: if settings has no labels, pull from projectState (or use defaults)
    if (!settings.labels) {
      try {
        const state = await this.readProjectState()
        if (state.labels && state.labels.length > 0) {
          settings.labels = state.labels
        } else {
          settings.labels = [...DEFAULT_LABELS]
        }
      } catch {
        settings.labels = [...DEFAULT_LABELS]
      }
      await this.writeSettings(settings)
    }

    return settings
  }

  async writeSettings(settings: ProjectSettings): Promise<void> {
    const filePath = this.getDataPath(SETTINGS_FILE)
    await this.fs.writeFileAtomic(filePath, JSON.stringify(settings, null, 2))
  }

  // ─── Notifications ───────────────────────────────────────────────

  async readNotifications(): Promise<AppNotification[]> {
    const filePath = this.getDataPath(NOTIFICATIONS_FILE)
    try {
      const raw = await this.fs.readFile(filePath)
      return JSON.parse(raw) as AppNotification[]
    } catch {
      return []
    }
  }

  async writeNotifications(notifications: AppNotification[]): Promise<void> {
    const filePath = this.getDataPath(NOTIFICATIONS_FILE)
    await this.fs.writeFileAtomic(filePath, JSON.stringify(notifications, null, 2))
  }

  async appendNotification(notification: AppNotification): Promise<void> {
    const notifications = await this.readNotifications()
    notifications.push(notification)
    await this.writeNotifications(notifications)
  }

  async markNotificationRead(id: string): Promise<void> {
    const notifications = await this.readNotifications()
    const notification = notifications.find((n) => n.id === id)
    if (notification) {
      notification.read = true
      await this.writeNotifications(notifications)
    }
  }

  async markNotificationsByTaskRead(taskId: string): Promise<void> {
    const notifications = await this.readNotifications()
    let changed = false
    for (const n of notifications) {
      if (n.taskId === taskId && !n.read) {
        n.read = true
        changed = true
      }
    }
    if (changed) {
      await this.writeNotifications(notifications)
    }
  }

  async markNotificationsByTaskIds(taskIds: string[]): Promise<void> {
    const notifications = await this.readNotifications()
    const idSet = new Set(taskIds)
    let changed = false
    for (const n of notifications) {
      if (n.taskId && idSet.has(n.taskId) && !n.read) {
        n.read = true
        changed = true
      }
    }
    if (changed) {
      await this.writeNotifications(notifications)
    }
  }

  async markAllNotificationsRead(): Promise<void> {
    const notifications = await this.readNotifications()
    for (const n of notifications) {
      n.read = true
    }
    await this.writeNotifications(notifications)
  }

  async clearNotifications(): Promise<void> {
    await this.writeNotifications([])
  }
}
