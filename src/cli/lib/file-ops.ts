import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {
  DATA_DIR,
  STATE_FILE,
  SETTINGS_FILE,
  TASKS_DIR,
  TASK_FILE,
  ACTIVITY_FILE,
  ATTACHMENTS_DIR,
  NOTIFICATIONS_FILE
} from '../../shared/constants'
import type { ProjectState, Task, ActivityEntry, AppNotification } from '../../shared/types'
import type { ProjectSettings } from '../../shared/types/settings'

/**
 * Find the project root by walking up from cwd looking for `.familiar/`.
 * Falls back to cwd if not found.
 */
export function getProjectRoot(): string {
  let dir = process.cwd()
  const root = path.parse(dir).root

  while (dir !== root) {
    const candidate = path.join(dir, DATA_DIR)
    try {
      // Synchronous existence check — acceptable at startup
      require('fs').accessSync(candidate)
      return dir
    } catch {
      dir = path.dirname(dir)
    }
  }

  // Not found — default to cwd
  return process.cwd()
}

export function getDataPath(root: string): string {
  return path.join(root, DATA_DIR)
}

export async function readSettings(root: string): Promise<ProjectSettings> {
  const filePath = path.join(getDataPath(root), SETTINGS_FILE)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as ProjectSettings
  } catch {
    return {}
  }
}

export async function writeSettings(root: string, settings: ProjectSettings): Promise<void> {
  const filePath = path.join(getDataPath(root), SETTINGS_FILE)
  await atomicWriteJson(filePath, settings)
}

function getStatePath(root: string): string {
  return path.join(getDataPath(root), STATE_FILE)
}

function getTaskDir(root: string, taskId: string): string {
  return path.join(getDataPath(root), TASKS_DIR, taskId)
}

function getTaskFilePath(root: string, taskId: string): string {
  return path.join(getTaskDir(root, taskId), TASK_FILE)
}

function getActivityFilePath(root: string, taskId: string): string {
  return path.join(getTaskDir(root, taskId), ACTIVITY_FILE)
}

/**
 * Atomically write JSON to a file: write to a temp file in the same directory,
 * then rename (which is atomic on the same filesystem).
 */
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  const tmpPath = path.join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  await fs.rename(tmpPath, filePath)
}

export async function readProjectState(root: string): Promise<ProjectState> {
  const filePath = getStatePath(root)
  const raw = await fs.readFile(filePath, 'utf-8')
  const state = JSON.parse(raw) as ProjectState

  // Migrate: rename "cancelled" → "archived"
  let migrated = false
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
  if (migrated) {
    await writeProjectState(root, state)
  }

  return state
}

export async function writeProjectState(root: string, state: ProjectState): Promise<void> {
  await atomicWriteJson(getStatePath(root), state)
}

export async function readTask(root: string, taskId: string): Promise<Task> {
  const filePath = getTaskFilePath(root, taskId)
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw) as Task
}

export async function writeTask(root: string, task: Task): Promise<void> {
  await ensureTaskDir(root, task.id)
  await atomicWriteJson(getTaskFilePath(root, task.id), task)
}

export async function readActivity(root: string, taskId: string): Promise<ActivityEntry[]> {
  const filePath = getActivityFilePath(root, taskId)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as ActivityEntry[]
  } catch {
    return []
  }
}

export async function appendActivity(
  root: string,
  taskId: string,
  entry: ActivityEntry
): Promise<void> {
  const existing = await readActivity(root, taskId)
  existing.push(entry)
  await atomicWriteJson(getActivityFilePath(root, taskId), existing)
}

export async function ensureTaskDir(root: string, taskId: string): Promise<void> {
  const dir = getTaskDir(root, taskId)
  await fs.mkdir(dir, { recursive: true })
  await fs.mkdir(path.join(dir, ATTACHMENTS_DIR), { recursive: true })
}

export async function deleteTaskDir(root: string, taskId: string): Promise<void> {
  const dir = getTaskDir(root, taskId)
  await fs.rm(dir, { recursive: true, force: true })
}

// ─── Notifications ─────────────────────────────────────────────────

function getNotificationsPath(root: string): string {
  return path.join(getDataPath(root), NOTIFICATIONS_FILE)
}

export async function readNotifications(root: string): Promise<AppNotification[]> {
  const filePath = getNotificationsPath(root)
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as AppNotification[]
  } catch {
    return []
  }
}

export async function appendNotification(
  root: string,
  notification: AppNotification
): Promise<void> {
  const existing = await readNotifications(root)
  existing.push(notification)
  await atomicWriteJson(getNotificationsPath(root), existing)
}
