import { ipcMain, app } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, mkdirSync, symlinkSync, readFileSync, appendFileSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'

const execFileAsync = promisify(execFile)

const CLI_BIN_DIR = join(homedir(), '.kanban-agent', 'bin')
const CLI_SYMLINK = join(CLI_BIN_DIR, 'kanban-agent')
const PATH_EXPORT_COMMENT = '# Added by Kanban Agent — CLI path'
const PATH_EXPORT_LINE = `export PATH="$HOME/.kanban-agent/bin:$PATH"`

export function registerCliHandlers(): void {
  ipcMain.handle('cli:check-available', async (): Promise<boolean> => {
    try {
      // Use login shell to get the full PATH (including user rc files)
      const shell = process.env.SHELL || '/bin/zsh'
      await execFileAsync(shell, ['-lc', 'which kanban-agent'], {
        timeout: 5000
      })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(
    'cli:install-to-path',
    async (): Promise<{ success: boolean; shell: string; error?: string }> => {
      try {
        // 1. Find the CLI binary
        const cliBin = app.isPackaged
          ? join(process.resourcesPath, 'bin', 'index.mjs')
          : join(resolve(app.getAppPath()), 'dist', 'cli', 'index.mjs')

        if (!existsSync(cliBin)) {
          return {
            success: false,
            shell: '',
            error: 'CLI binary not found. Run "npm run build:cli" first.'
          }
        }

        // 2. Create ~/.kanban-agent/bin/ and symlink
        if (!existsSync(CLI_BIN_DIR)) {
          mkdirSync(CLI_BIN_DIR, { recursive: true })
        }

        // Remove existing symlink if present
        if (existsSync(CLI_SYMLINK)) {
          const { unlinkSync } = await import('fs')
          unlinkSync(CLI_SYMLINK)
        }

        symlinkSync(cliBin, CLI_SYMLINK)

        // 3. Detect shell and update rc file
        const userShell = process.env.SHELL || '/bin/zsh'
        const isZsh = userShell.includes('zsh')
        const rcFile = isZsh
          ? join(homedir(), '.zshrc')
          : join(homedir(), '.bashrc')
        const shellName = isZsh ? 'zsh' : 'bash'

        // Check if PATH export already exists
        let rcContents = ''
        try {
          rcContents = readFileSync(rcFile, 'utf-8')
        } catch {
          // File doesn't exist, that's fine
        }

        if (!rcContents.includes('.kanban-agent/bin')) {
          const addition = `\n${PATH_EXPORT_COMMENT}\n${PATH_EXPORT_LINE}\n`
          appendFileSync(rcFile, addition)
        }

        return { success: true, shell: shellName }
      } catch (err) {
        return {
          success: false,
          shell: '',
          error: (err as Error).message
        }
      }
    }
  )
}
