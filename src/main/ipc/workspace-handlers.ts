import { ipcMain } from 'electron'
import { WorkspaceManager } from '../services/workspace-manager'
import { DataService } from '../services/data-service'
import { ElectronPtyManager } from '../platform/electron-pty'
import type { Workspace, Task, GlobalSettings } from '../../shared/types'

export function registerWorkspaceHandlers(
  workspaceManager: WorkspaceManager,
  dataService: DataService,
  ptyManager: ElectronPtyManager
): void {
  /**
   * Sync the shared (legacy) dataService and ptyManager references to match
   * the workspace manager's current active project.  Without this, IPC
   * handlers registered with the captured `dataService` would continue to
   * read/write against the previous project's `.familiar/` directory.
   *
   * IMPORTANT: We use the active path directly rather than reading from
   * the DataService object, because the shared `dataService` IS the same
   * object reference as the workspace manager's map entry for the initial
   * project. Calling ds.getProjectRoot() on a corrupted entry would
   * return the wrong path.
   */
  function syncLegacyRefs(): void {
    const activePath = workspaceManager.getActiveProjectPath()
    if (!activePath) return
    dataService.setProjectRoot(activePath)
    const ds = workspaceManager.getDataService(activePath)
    ptyManager.setDataService(ds)
  }

  ipcMain.handle('workspace:list', async (): Promise<Workspace[]> => {
    return workspaceManager.listWorkspaces()
  })

  ipcMain.handle(
    'workspace:create',
    async (_, name: string, projectPaths: string[]): Promise<Workspace> => {
      return workspaceManager.createWorkspace(name, projectPaths)
    }
  )

  ipcMain.handle(
    'workspace:update',
    async (_, id: string, updates: Partial<Workspace>): Promise<Workspace> => {
      return workspaceManager.updateWorkspace(id, updates)
    }
  )

  ipcMain.handle('workspace:delete', async (_, id: string): Promise<void> => {
    workspaceManager.deleteWorkspace(id)
  })

  ipcMain.handle('workspace:open', async (_, workspaceId: string): Promise<void> => {
    workspaceManager.openWorkspace(workspaceId)
    syncLegacyRefs()
  })

  ipcMain.handle('workspace:open-single', async (_, projectPath: string): Promise<void> => {
    workspaceManager.openSingleProject(projectPath)
    syncLegacyRefs()
  })

  ipcMain.handle('workspace:add-project', async (_, projectPath: string): Promise<void> => {
    workspaceManager.addProjectToWorkspace(projectPath)
  })

  ipcMain.handle('workspace:remove-project', async (_, projectPath: string): Promise<void> => {
    workspaceManager.removeProjectFromWorkspace(projectPath)
    // If the removed project was active, the workspace manager selects
    // another — sync the shared refs to match.
    syncLegacyRefs()
  })

  ipcMain.handle('workspace:get-config', async () => {
    return workspaceManager.loadWorkspaceConfig()
  })

  ipcMain.handle('workspace:get-open-projects', async (): Promise<string[]> => {
    return workspaceManager.getOpenProjectPaths()
  })

  ipcMain.handle('workspace:get-active-project', async (): Promise<string | null> => {
    return workspaceManager.getActiveProjectPath()
  })

  ipcMain.handle('workspace:set-active-project', async (_, projectPath: string): Promise<void> => {
    workspaceManager.setActiveProjectPath(projectPath)
    syncLegacyRefs()
  })

  ipcMain.handle('workspace:set-active-workspace-id', async (_, workspaceId: string): Promise<void> => {
    workspaceManager.setActiveWorkspaceId(workspaceId)
  })

  // ─── Global Settings (stored in ~/.familiar/settings.json) ──────

  ipcMain.handle('global-settings:read', async (): Promise<GlobalSettings> => {
    return workspaceManager.readGlobalSettings()
  })

  ipcMain.handle('global-settings:write', async (_, settings: GlobalSettings): Promise<void> => {
    workspaceManager.writeGlobalSettings(settings)
  })

  // Return active agent tasks from ALL open projects so the AgentSwapWidget
  // can show cross-project agent activity.
  ipcMain.handle('workspace:list-all-tasks', async (): Promise<(Task & { projectPath: string })[]> => {
    const allServices = workspaceManager.getActiveDataServices()
    const result: (Task & { projectPath: string })[] = []
    for (const [projectPath, ds] of allServices) {
      try {
        const initialized = await ds.isInitialized()
        if (!initialized) continue
        const state = await ds.readProjectState()
        for (const task of state.tasks) {
          result.push({ ...task, projectPath })
        }
      } catch {
        // Project may not be initialized — skip
      }
    }
    return result
  })
}
