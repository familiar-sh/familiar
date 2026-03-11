import { ipcMain } from 'electron'
import { DataService } from '../services/data-service'

export function registerFileHandlers(dataService: DataService): void {
  ipcMain.handle('project:read-state', async () => dataService.readProjectState())
  ipcMain.handle('project:write-state', async (_, state) => dataService.writeProjectState(state))
  ipcMain.handle('project:init', async (_, name) => dataService.initProject(name))
  ipcMain.handle('project:is-initialized', async () => dataService.isInitialized())

  ipcMain.handle('task:create', async (_, task) => dataService.createTask(task))
  ipcMain.handle('task:read', async (_, taskId) => dataService.readTask(taskId))
  ipcMain.handle('task:update', async (_, task) => dataService.updateTask(task))
  ipcMain.handle('task:delete', async (_, taskId) => dataService.deleteTask(taskId))

  ipcMain.handle('task:read-document', async (_, taskId) => dataService.readTaskDocument(taskId))
  ipcMain.handle(
    'task:write-document',
    async (_, taskId, content) => dataService.writeTaskDocument(taskId, content)
  )

  ipcMain.handle('task:read-activity', async (_, taskId) => dataService.readTaskActivity(taskId))
  ipcMain.handle(
    'task:append-activity',
    async (_, taskId, entry) => dataService.appendActivity(taskId, entry)
  )

  ipcMain.handle(
    'task:save-attachment',
    async (_, taskId, fileName, data) => dataService.saveAttachment(taskId, fileName, data)
  )
}
