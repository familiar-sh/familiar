import { execFile, execFileSync } from 'child_process'
import * as fs from 'fs'
import { ITmuxManager } from '../../shared/platform/tmux'

/**
 * Resolve the full path to the tmux binary.
 * Electron apps launched from Finder/Dock often have a minimal PATH
 * that doesn't include Homebrew or other user-installed binaries.
 */
function findTmuxPath(): string {
  // Try which first
  try {
    const resolved = execFileSync('which', ['tmux'], {
      encoding: 'utf-8',
      timeout: 3000
    }).trim()
    if (resolved && fs.existsSync(resolved)) return resolved
  } catch {
    // fall through
  }

  // Check common macOS paths
  const candidates = [
    '/opt/homebrew/bin/tmux',
    '/usr/local/bin/tmux',
    '/usr/bin/tmux',
    '/opt/local/bin/tmux'
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  // Last resort: bare name (will rely on PATH)
  return 'tmux'
}

export class ElectronTmuxManager implements ITmuxManager {
  private _tmuxPath: string

  constructor() {
    this._tmuxPath = findTmuxPath()
  }

  private _execTmux(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve) => {
      execFile(this._tmuxPath, args, (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          exitCode: error ? 1 : 0
        })
      })
    })
  }

  private _exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(this._tmuxPath, args, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`tmux ${args.join(' ')} failed: ${stderr || error.message}`))
          return
        }
        resolve(stdout.trim())
      })
    })
  }

  async listSessions(): Promise<string[]> {
    try {
      const output = await this._exec(['list-sessions', '-F', '#{session_name}'])
      if (!output) return []
      return output.split('\n').filter((s) => s.length > 0)
    } catch {
      // tmux returns error when no server is running / no sessions exist
      return []
    }
  }

  async createSession(sessionName: string, cwd: string, env?: Record<string, string>): Promise<void> {
    await this._exec(['new-session', '-d', '-s', sessionName, '-c', cwd])

    // Inject environment variables into the running shell and the session
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        // set-environment makes it available to new windows/panes
        await this._execTmux(['set-environment', '-t', sessionName, key, value])
        // send-keys exports it into the already-running shell
        await this._exec(['send-keys', '-t', sessionName, `export ${key}="${value}"`, 'Enter'])
      }
      // Clear the screen so the export commands aren't visible
      await this._exec(['send-keys', '-t', sessionName, 'clear', 'Enter'])
    }
  }

  async attachSession(_sessionName: string): Promise<void> {
    // Internal tracking only — actual attachment is done via node-pty
    // spawning `tmux attach-session -t <name>`
  }

  async detachSession(_sessionName: string): Promise<void> {
    // Internal tracking only — detaching is handled by destroying the PTY
  }

  async sendKeys(sessionName: string, keys: string): Promise<void> {
    await this._exec(['send-keys', '-t', sessionName, keys, 'Enter'])
  }

  async killSession(sessionName: string): Promise<void> {
    await this._exec(['kill-session', '-t', sessionName])
  }

  async hasSession(sessionName: string): Promise<boolean> {
    const result = await this._execTmux(['has-session', '-t', sessionName])
    return result.exitCode === 0
  }

  getSessionName(taskId: string, paneIndex: number): string {
    return `kanban-${taskId}-${paneIndex}`
  }
}
