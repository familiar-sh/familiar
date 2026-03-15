import { ipcMain, app, clipboard } from 'electron'
import { writeFile, cp, rm } from 'fs/promises'
import { join } from 'path'
import { DataService } from '../services/data-service'
import type { FileWatcher } from '../services/file-watcher'
import { generateTaskId } from '../../shared/utils/id-generator'
import { DATA_DIR, TASKS_DIR, STATE_FILE } from '../../shared/constants'
import type { ProjectState, Task } from '../../shared/types'
import fs from 'fs'

/**
 * Wrap a write operation so the file watcher ignores self-triggered changes.
 */
function withSelfTriggered<T>(
  getFileWatcher: () => FileWatcher | null,
  fn: () => Promise<T>
): Promise<T> {
  const watcher = getFileWatcher()
  watcher?.markSelfTriggered()
  return fn().finally(() => {
    watcher?.clearSelfTriggered()
  })
}

export function registerFileHandlers(
  dataService: DataService,
  getFileWatcher: () => FileWatcher | null
): void {
  // Save raw image bytes from clipboard to a temp file, return the path
  ipcMain.handle(
    'clipboard:save-image',
    async (_, arrayBuffer: ArrayBuffer, mimeType: string): Promise<string> => {
      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/jpeg' ? 'jpg' : 'png'
      const fileName = `clipboard-${Date.now()}.${ext}`
      const filePath = join(app.getPath('temp'), fileName)
      await writeFile(filePath, Buffer.from(arrayBuffer))
      return filePath
    }
  )
  // Read image directly from the native clipboard (fallback when paste event lacks image items)
  ipcMain.handle('clipboard:read-native-image', async (): Promise<string | null> => {
    const image = clipboard.readImage()
    if (image.isEmpty()) return null
    const buffer = image.toPNG()
    const fileName = `clipboard-${Date.now()}.png`
    const filePath = join(app.getPath('temp'), fileName)
    await writeFile(filePath, buffer)
    return filePath
  })

  ipcMain.handle('project:get-root', async () => dataService.getProjectRoot())
  ipcMain.handle('project:read-state', async () => dataService.readProjectState())
  ipcMain.handle('project:write-state', async (_, state) =>
    withSelfTriggered(getFileWatcher, () => dataService.writeProjectState(state))
  )
  ipcMain.handle('project:init', async (_, name) =>
    withSelfTriggered(getFileWatcher, () => dataService.initProject(name))
  )
  ipcMain.handle('project:is-initialized', async () => dataService.isInitialized())

  ipcMain.handle('task:create', async (_, task) =>
    withSelfTriggered(getFileWatcher, () => dataService.createTask(task))
  )
  ipcMain.handle('task:read', async (_, taskId) => dataService.readTask(taskId))
  ipcMain.handle('task:update', async (_, task) =>
    withSelfTriggered(getFileWatcher, () => dataService.updateTask(task))
  )
  ipcMain.handle('task:delete', async (_, taskId) =>
    withSelfTriggered(getFileWatcher, () => dataService.deleteTask(taskId))
  )

  ipcMain.handle('task:read-document', async (_, taskId) => dataService.readTaskDocument(taskId))
  ipcMain.handle('task:write-document', async (_, taskId, content) =>
    withSelfTriggered(getFileWatcher, () => dataService.writeTaskDocument(taskId, content))
  )

  ipcMain.handle('task:read-activity', async (_, taskId) => dataService.readTaskActivity(taskId))
  ipcMain.handle('task:append-activity', async (_, taskId, entry) =>
    withSelfTriggered(getFileWatcher, () => dataService.appendActivity(taskId, entry))
  )

  ipcMain.handle('task:save-attachment', async (_, taskId, fileName, data) =>
    withSelfTriggered(getFileWatcher, () => dataService.saveAttachment(taskId, fileName, data))
  )

  ipcMain.handle(
    'task:copy-temp-to-attachment',
    async (_, taskId: string, tempPath: string, fileName: string): Promise<string> =>
      withSelfTriggered(getFileWatcher, () =>
        dataService.copyTempToAttachment(taskId, tempPath, fileName)
      )
  )

  // Task files listing
  ipcMain.handle('task:list-files', async (_, taskId: string) =>
    dataService.listTaskFiles(taskId)
  )

  // Pasted files
  ipcMain.handle('task:save-pasted-file', async (_, taskId: string, filename: string, content: string) =>
    withSelfTriggered(getFileWatcher, () => dataService.savePastedFile(taskId, filename, content))
  )
  ipcMain.handle('task:read-pasted-file', async (_, taskId: string, filename: string) =>
    dataService.readPastedFile(taskId, filename)
  )
  ipcMain.handle('task:delete-pasted-file', async (_, taskId: string, filename: string) =>
    withSelfTriggered(getFileWatcher, () => dataService.deletePastedFile(taskId, filename))
  )

  ipcMain.handle('settings:read', async () => dataService.readSettings())
  ipcMain.handle('settings:write', async (_, settings) =>
    withSelfTriggered(getFileWatcher, () => dataService.writeSettings(settings))
  )

  // Move or copy a task to another worktree
  ipcMain.handle(
    'task:move-to-worktree',
    async (
      _,
      taskIds: string[],
      targetProjectPath: string,
      mode: 'copy' | 'move'
    ): Promise<{ movedCount: number }> => {
      const sourceRoot = dataService.getProjectRoot()
      const sourceDataDir = join(sourceRoot, DATA_DIR)
      const targetDataDir = join(targetProjectPath, DATA_DIR)

      // Read source and target state
      const sourceStateRaw = fs.readFileSync(join(sourceDataDir, STATE_FILE), 'utf-8')
      const sourceState: ProjectState = JSON.parse(sourceStateRaw)

      const targetStatePath = join(targetDataDir, STATE_FILE)
      const targetStateRaw = fs.readFileSync(targetStatePath, 'utf-8')
      const targetState: ProjectState = JSON.parse(targetStateRaw)

      // Ensure target tasks dir exists
      const targetTasksDir = join(targetDataDir, TASKS_DIR)
      if (!fs.existsSync(targetTasksDir)) {
        fs.mkdirSync(targetTasksDir, { recursive: true })
      }

      let movedCount = 0

      for (const taskId of taskIds) {
        const sourceTask = sourceState.tasks.find((t) => t.id === taskId)
        if (!sourceTask) continue

        const sourceTaskDir = join(sourceDataDir, TASKS_DIR, taskId)
        if (!fs.existsSync(sourceTaskDir)) continue

        if (mode === 'copy') {
          // Generate new ID for the copy
          const newId = generateTaskId()
          const targetTaskDir = join(targetTasksDir, newId)

          // Copy task directory
          await cp(sourceTaskDir, targetTaskDir, { recursive: true })

          // Update task.json in the target with new ID
          const newTask: Task = {
            ...sourceTask,
            id: newId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            agentStatus: 'idle',
            sortOrder: 0
          }
          fs.writeFileSync(
            join(targetTaskDir, 'task.json'),
            JSON.stringify(newTask, null, 2)
          )

          // Add to target state
          targetState.tasks.push(newTask)
        } else {
          // Move: copy directory then remove from source
          const targetTaskDir = join(targetTasksDir, taskId)
          await cp(sourceTaskDir, targetTaskDir, { recursive: true })

          // Reset agent status in target
          const movedTask: Task = {
            ...sourceTask,
            agentStatus: 'idle',
            updatedAt: new Date().toISOString(),
            sortOrder: 0
          }
          fs.writeFileSync(
            join(targetTaskDir, 'task.json'),
            JSON.stringify(movedTask, null, 2)
          )

          // Add to target state
          targetState.tasks.push(movedTask)

          // Remove from source state
          sourceState.tasks = sourceState.tasks.filter((t) => t.id !== taskId)

          // Remove source task directory
          await rm(sourceTaskDir, { recursive: true, force: true })
        }

        movedCount++
      }

      // Write updated states
      if (mode === 'move') {
        fs.writeFileSync(
          join(sourceDataDir, STATE_FILE),
          JSON.stringify(sourceState, null, 2)
        )
      }
      fs.writeFileSync(targetStatePath, JSON.stringify(targetState, null, 2))

      return { movedCount }
    }
  )
}
