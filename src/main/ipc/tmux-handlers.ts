import { ipcMain } from 'electron'
import { ElectronTmuxManager } from '../platform/electron-tmux'
import type { DataService } from '../services/data-service'
import { resolveClaudeSessionCommand, ensureForkSessionCopied } from '../services/claude-session'

export function registerTmuxHandlers(tmuxManager: ElectronTmuxManager, dataService: DataService): void {
  ipcMain.handle('tmux:list', async () => {
    return tmuxManager.listSessions()
  })

  ipcMain.handle('tmux:attach', async (_event, name: string) => {
    await tmuxManager.attachSession(name)
  })

  ipcMain.handle('tmux:detach', async (_event, name: string) => {
    await tmuxManager.detachSession(name)
  })

  ipcMain.handle('tmux:kill', async (_event, name: string) => {
    try {
      await tmuxManager.killSession(name)
    } catch {
      // Session may already be dead — that's fine
    }
  })

  ipcMain.handle('tmux:has', async (_event, name: string) => {
    return tmuxManager.hasSession(name)
  })

  ipcMain.handle(
    'tmux:send-keys',
    async (_event, sessionName: string, keys: string, pressEnter: boolean) => {
      await tmuxManager.sendKeys(sessionName, keys, pressEnter)
    }
  )

  ipcMain.handle('tmux:warmup', async (_event, taskId: string, forkedFrom?: string) => {
    const sessionName = `familiar-${taskId}`
    const exists = await tmuxManager.hasSession(sessionName)
    if (exists) return

    const projectRoot = dataService.getProjectRoot()
    const env = {
      FAMILIAR_TASK_ID: taskId,
      FAMILIAR_PROJECT_ROOT: projectRoot,
      FAMILIAR_SETTINGS_PATH: `${projectRoot}/.familiar/settings.json`
    }

    // Copy parent's Claude session file before creating the tmux session
    if (forkedFrom) {
      ensureForkSessionCopied(taskId, forkedFrom, projectRoot)
    }

    await tmuxManager.createSession(sessionName, projectRoot, env)

    // Resolve default command, then warm up (Ctrl-C + export + command)
    let command: string | undefined
    try {
      const settings = await dataService.readSettings()
      if (settings.defaultCommand) {
        command = resolveClaudeSessionCommand(settings.defaultCommand, taskId, projectRoot)
      }
    } catch {
      // Settings not available — skip default command
    }

    // Fire-and-forget: warmup runs in the background
    tmuxManager.warmupSession(sessionName, env, command).catch((err) => {
      console.warn('Failed to warm up tmux session:', err)
    })
  })
}
