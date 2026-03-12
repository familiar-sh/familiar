import { ipcMain, app } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { DataService } from '../services/data-service'
import type { FileWatcher } from '../services/file-watcher'

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

  ipcMain.handle('settings:read', async () => dataService.readSettings())
  ipcMain.handle('settings:write', async (_, settings) =>
    withSelfTriggered(getFileWatcher, () => dataService.writeSettings(settings))
  )
}
