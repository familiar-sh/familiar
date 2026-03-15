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

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async createSession(sessionName: string, cwd: string, env?: Record<string, string>): Promise<void> {
    // -u forces UTF-8 mode so Unicode characters render correctly even when
    // Electron is launched from Finder with a minimal locale environment.
    await this._exec(['-u', 'new-session', '-d', '-s', sessionName, '-c', cwd])

    // Enable extended keys so Shift+Enter, Ctrl+Enter etc. are forwarded to inner apps.
    // "always" sends unconditionally without the inner app needing to request them.
    await this._execTmux(['set-option', '-t', sessionName, '-s', 'extended-keys', 'always'])

    // Register env vars at the tmux session level (available to new windows/panes)
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        await this._execTmux(['set-environment', '-t', sessionName, key, value])
      }
    }
  }

  /**
   * Dismiss any interactive prompts (e.g. oh-my-zsh update) with Ctrl-C,
   * then export env vars into the running shell and run a command.
   * Designed to be called fire-and-forget after the PTY is already attached.
   */
  async warmupSession(
    sessionName: string,
    env?: Record<string, string>,
    command?: string
  ): Promise<void> {
    // Send Ctrl-C 3 times with 1s intervals to dismiss interactive prompts
    for (let i = 0; i < 3; i++) {
      await this._execTmux(['send-keys', '-t', sessionName, 'C-c'])
      await this._delay(1000)
    }

    // Export env vars into the running shell
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        await this._exec(['send-keys', '-t', sessionName, `export ${key}="${value}"`, 'Enter'])
      }
    }

    // Clear the screen
    await this._exec(['send-keys', '-t', sessionName, 'clear', 'Enter'])

    // Run the initial command if provided
    if (command) {
      await this._exec(['send-keys', '-t', sessionName, command, 'Enter'])
    }
  }

  async setEnvironment(sessionName: string, env: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(env)) {
      await this._execTmux(['set-environment', '-t', sessionName, key, value])
    }
  }

  async attachSession(_sessionName: string): Promise<void> {
    // Internal tracking only — actual attachment is done via node-pty
    // spawning `tmux attach-session -t <name>`
  }

  async detachSession(_sessionName: string): Promise<void> {
    // Internal tracking only — detaching is handled by destroying the PTY
  }

  async sendKeys(sessionName: string, keys: string, pressEnter = true): Promise<void> {
    const args = ['send-keys', '-t', sessionName, keys]
    if (pressEnter) {
      args.push('Enter')
    }
    await this._exec(args)
  }

  async killSession(sessionName: string): Promise<void> {
    await this._exec(['kill-session', '-t', sessionName])
  }

  async hasSession(sessionName: string): Promise<boolean> {
    const result = await this._execTmux(['has-session', '-t', sessionName])
    return result.exitCode === 0
  }

  getSessionName(taskId: string, paneIndex: number): string {
    return `familiar-${taskId}-${paneIndex}`
  }
}
