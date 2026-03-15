import { ipcMain } from 'electron'
import { WorktreeService } from '../services/worktree-service'
import type { WorktreeInfo } from '../services/worktree-service'
import { DataService } from '../services/data-service'

export function registerWorktreeHandlers(dataService: DataService): void {
  ipcMain.handle('worktree:list', async (): Promise<WorktreeInfo[]> => {
    const projectRoot = dataService.getProjectRoot()
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

  ipcMain.handle('worktree:get-git-root', async (): Promise<string | null> => {
    const projectRoot = dataService.getProjectRoot()
    return WorktreeService.getGitRoot(projectRoot)
  })
}
