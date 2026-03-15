import { ipcMain, app } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync, lstatSync, mkdirSync, symlinkSync, unlinkSync, readFileSync, appendFileSync } from 'fs'
import { join, resolve } from 'path'
import { homedir } from 'os'

const execFileAsync = promisify(execFile)

const CLI_BIN_DIR = join(homedir(), '.familiar', 'bin')
const CLI_SYMLINK = join(CLI_BIN_DIR, 'familiar')
const PATH_EXPORT_COMMENT = '# Added by Familiar — CLI path'
const PATH_EXPORT_LINE = `export PATH="$HOME/.familiar/bin:$PATH"`

// Common locations where Claude Code binary may be installed
const CLAUDE_SEARCH_PATHS = [
  join(homedir(), '.local', 'bin', 'claude'),
  join(homedir(), '.claude', 'local', 'claude'),
  '/usr/local/bin/claude',
  join(homedir(), '.npm-global', 'bin', 'claude'),
  join(homedir(), '.volta', 'bin', 'claude')
]

export function registerCliHandlers(): void {
  ipcMain.handle('cli:check-available', async (): Promise<boolean> => {
    try {
      // Use login shell to get the full PATH (including user rc files)
      const shell = process.env.SHELL || '/bin/zsh'
      await execFileAsync(shell, ['-lc', 'which familiar'], {
        timeout: 5000
      })
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(
    'claude:check-available',
    async (): Promise<{ available: boolean; path: string | null; version: string | null }> => {
      const shell = process.env.SHELL || '/bin/zsh'

      // 1. Check if 'claude' is in PATH via login shell
      try {
        const { stdout: whichOut } = await execFileAsync(shell, ['-lc', 'which claude'], {
          timeout: 5000
        })
        const claudePath = whichOut.trim()
        if (claudePath) {
          // Try to get the version
          try {
            const { stdout: versionOut } = await execFileAsync(
              shell,
              ['-lc', 'claude --version'],
              { timeout: 10000 }
            )
            return { available: true, path: claudePath, version: versionOut.trim() }
          } catch {
            return { available: true, path: claudePath, version: null }
          }
        }
      } catch {
        // Not in PATH — fall through to manual search
      }

      // 2. Check common installation paths
      for (const searchPath of CLAUDE_SEARCH_PATHS) {
        if (existsSync(searchPath)) {
          try {
            const { stdout: versionOut } = await execFileAsync(searchPath, ['--version'], {
              timeout: 10000
            })
            return { available: true, path: searchPath, version: versionOut.trim() }
          } catch {
            // Binary exists but can't execute — still report it
            return { available: true, path: searchPath, version: null }
          }
        }
      }

      // 3. Check node version manager paths (nvm, fnm) via glob-like search
      const nvmDir = join(homedir(), '.nvm', 'versions', 'node')
      const fnmDir = join(homedir(), '.local', 'share', 'fnm', 'node-versions')
      for (const baseDir of [nvmDir, fnmDir]) {
        try {
          const { readdirSync } = await import('fs')
          const versions = readdirSync(baseDir)
          for (const ver of versions) {
            const binPath =
              baseDir === fnmDir
                ? join(baseDir, ver, 'installation', 'bin', 'claude')
                : join(baseDir, ver, 'bin', 'claude')
            if (existsSync(binPath)) {
              return { available: true, path: binPath, version: null }
            }
          }
        } catch {
          // Directory doesn't exist
        }
      }

      return { available: false, path: null, version: null }
    }
  )

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

        // 2. Create ~/.familiar/bin/ and symlink
        if (!existsSync(CLI_BIN_DIR)) {
          mkdirSync(CLI_BIN_DIR, { recursive: true })
        }

        // Remove existing symlink if present (lstatSync detects broken symlinks too)
        try {
          lstatSync(CLI_SYMLINK)
          unlinkSync(CLI_SYMLINK)
        } catch {
          // Symlink doesn't exist at all — nothing to remove
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

        if (!rcContents.includes('.familiar/bin')) {
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
