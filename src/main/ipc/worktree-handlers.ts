import { ipcMain } from 'electron'
import { WorktreeService } from '../services/worktree-service'
import type { WorktreeInfo } from '../services/worktree-service'
import { DataService } from '../services/data-service'

export function registerWorktreeHandlers(dataService: DataService): void {
  ipcMain.handle('worktree:list', async (_, projectPath?: string): Promise<WorktreeInfo[]> => {
    const projectRoot = projectPath || dataService.getProjectRoot()
    return WorktreeService.listWorktrees(projectRoot)
  })

  ipcMain.handle('worktree:create', async (_, customSlug?: string): Promise<WorktreeInfo> => {
    const projectRoot = dataService.getProjectRoot()
    return WorktreeService.createWorktree(projectRoot, customSlug)
  })

  ipcMain.handle('worktree:rename', async (_, worktreePath: string, newSlug: string): Promise<WorktreeInfo> => {
    const projectRoot = dataService.getProjectRoot()
    return WorktreeService.renameWorktree(projectRoot, worktreePath, newSlug)
  })

  ipcMain.handle('worktree:remove', async (_, worktreePath: string): Promise<void> => {
    const projectRoot = dataService.getProjectRoot()
    WorktreeService.removeWorktree(projectRoot, worktreePath)
  })

  ipcMain.handle('worktree:get-git-root', async (_, projectPath?: string): Promise<string | null> => {
    const projectRoot = projectPath || dataService.getProjectRoot()
    return WorktreeService.getGitRoot(projectRoot)
  })

  ipcMain.handle(
    'worktree:run-post-create-hook',
    async (
      _,
      worktreePath: string,
      envVars: Record<string, string>
    ): Promise<{ ran: boolean; exitCode: number | null; output: string }> => {
      const projectRoot = dataService.getProjectRoot()
      return WorktreeService.runPostCreateHook(projectRoot, worktreePath, envVars)
    }
  )

  ipcMain.handle('worktree:get-hook-path', async (): Promise<string | null> => {
    const projectRoot = dataService.getProjectRoot()
    return WorktreeService.getHookPath(projectRoot)
  })

  ipcMain.handle('worktree:hook-exists', async (): Promise<boolean> => {
    const projectRoot = dataService.getProjectRoot()
    return WorktreeService.hookExists(projectRoot)
  })

  ipcMain.handle(
    'worktree:run-pre-delete-hook',
    async (
      _,
      worktreePath: string,
      envVars: Record<string, string>
    ): Promise<{ ran: boolean; exitCode: number | null; output: string }> => {
      const projectRoot = dataService.getProjectRoot()
      return WorktreeService.runPreDeleteHook(projectRoot, worktreePath, envVars)
    }
  )

  ipcMain.handle('worktree:get-pre-delete-hook-path', async (): Promise<string | null> => {
    const projectRoot = dataService.getProjectRoot()
    return WorktreeService.getPreDeleteHookPath(projectRoot)
  })

  ipcMain.handle('worktree:pre-delete-hook-exists', async (): Promise<boolean> => {
    const projectRoot = dataService.getProjectRoot()
    return WorktreeService.preDeleteHookExists(projectRoot)
  })

  ipcMain.handle('worktree:abort-pre-delete-hook', async (_, worktreePath: string): Promise<boolean> => {
    return WorktreeService.abortPreDeleteHook(worktreePath)
  })
}
