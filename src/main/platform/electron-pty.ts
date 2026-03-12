import * as pty from 'node-pty'
import * as os from 'os'
import * as fs from 'fs'
import { execFileSync } from 'child_process'
import { IPtyManager } from '../../shared/platform/pty'
import { ElectronTmuxManager } from './electron-tmux'
import type { DataService } from '../services/data-service'

interface PtySession {
  id: string
  taskId: string
  paneId: string
  tmuxSessionName: string
  ptyProcess: pty.IPty
}

type DataCallback = (sessionId: string, data: string) => void

/**
 * Resolve the full path to an executable by checking common locations.
 * Electron apps on macOS often don't inherit the user's full PATH,
 * so bare command names like 'tmux' fail with posix_spawnp.
 */
function resolveExecutable(name: string): string | null {
  // Try PATH-based resolution first (works when launched from terminal)
  try {
    const resolved = execFileSync('which', [name], {
      encoding: 'utf-8',
      timeout: 3000,
      env: getShellEnv()
    }).trim()
    if (resolved && fs.existsSync(resolved)) return resolved
  } catch {
    // which failed, try common paths
  }

  // Common installation paths on macOS
  const candidates = [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
    `/bin/${name}`,
    `/opt/local/bin/${name}`
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

/**
 * Build a merged environment that includes common macOS binary paths.
 * Electron launched from Finder/Dock inherits a minimal PATH.
 */
function getShellEnv(): Record<string, string> {
  const env = { ...process.env } as Record<string, string>
  const currentPath = env.PATH ?? ''
  const extraPaths = [
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    '/opt/local/bin'
  ]
  const pathSet = new Set(currentPath.split(':').filter(Boolean))
  for (const p of extraPaths) {
    pathSet.add(p)
  }
  env.PATH = Array.from(pathSet).join(':')
  return env
}

/**
 * Get a valid shell path for the current user.
 */
function getShellPath(): string {
  const candidates = [
    process.env.SHELL,
    '/bin/zsh',
    '/bin/bash',
    '/bin/sh'
  ].filter(Boolean) as string[]

  for (const shell of candidates) {
    if (fs.existsSync(shell)) return shell
  }
  return '/bin/sh'
}

/**
 * Validate and return a usable cwd, falling back to home directory.
 */
function getValidCwd(cwd: string): string {
  try {
    if (cwd && fs.existsSync(cwd) && fs.statSync(cwd).isDirectory()) {
      return cwd
    }
  } catch {
    // cwd doesn't exist or isn't accessible
  }
  return os.homedir()
}

export class ElectronPtyManager implements IPtyManager {
  private _sessions = new Map<string, PtySession>()
  private _dataListeners = new Set<DataCallback>()
  private _nextId = 0
  private _tmuxPath: string | null = null
  private _tmuxChecked = false

  private _dataService: DataService | null = null

  constructor(private _tmux: ElectronTmuxManager) {}

  setDataService(dataService: DataService): void {
    this._dataService = dataService
  }

  /**
   * Lazily resolve and cache the tmux binary path.
   */
  private _getTmuxPath(): string | null {
    if (!this._tmuxChecked) {
      this._tmuxPath = resolveExecutable('tmux')
      this._tmuxChecked = true
    }
    return this._tmuxPath
  }

  async create(taskId: string, paneId: string, cwd: string): Promise<string> {
    const validCwd = getValidCwd(cwd)
    const env = getShellEnv()

    // Inject kanban context so agents know which task they're in
    env.KANBAN_TASK_ID = taskId
    env.KANBAN_PROJECT_ROOT = cwd

    const tmuxPath = this._getTmuxPath()

    let ptyProcess: pty.IPty
    let tmuxSessionName = ''
    let isNewSession = false

    if (tmuxPath) {
      // tmux is available — one persistent session per task
      tmuxSessionName = `kanban-${taskId}`

      // Ensure tmux session exists — create if needed, ignore "duplicate session" errors
      const kanbanEnv = {
        KANBAN_TASK_ID: taskId,
        KANBAN_PROJECT_ROOT: cwd
      }
      try {
        const exists = await this._tmux.hasSession(tmuxSessionName)
        if (!exists) {
          await this._tmux.createSession(tmuxSessionName, validCwd, kanbanEnv)
          isNewSession = true
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        if (errMsg.includes('duplicate session')) {
          // Session already exists — fine, we'll just attach to it
          console.log(`tmux session "${tmuxSessionName}" already exists, attaching`)
        } else {
          console.warn(
            `Failed to create tmux session "${tmuxSessionName}", falling back to plain shell:`,
            err
          )
          return this._spawnPlainShell(taskId, paneId, validCwd, env)
        }
      }

      // Spawn node-pty that attaches to the tmux session using full path
      try {
        ptyProcess = pty.spawn(tmuxPath, ['attach-session', '-t', tmuxSessionName], {
          name: 'xterm-256color',
          cols: 80,
          rows: 24,
          cwd: validCwd,
          env
        })
      } catch (err) {
        console.error('Failed to spawn tmux PTY, falling back to plain shell:', err)
        return this._spawnPlainShell(taskId, paneId, validCwd, env)
      }
    } else {
      // tmux not available — spawn a plain shell
      return this._spawnPlainShell(taskId, paneId, validCwd, env)
    }

    const sessionId = `pty-${this._nextId++}`
    const session: PtySession = {
      id: sessionId,
      taskId,
      paneId,
      tmuxSessionName,
      ptyProcess
    }

    this._sessions.set(sessionId, session)

    // Forward data from this PTY to all registered listeners
    ptyProcess.onData((data: string) => {
      for (const listener of this._dataListeners) {
        listener(sessionId, data)
      }
    })

    // Run default command on newly created sessions via tmux send-keys
    if (isNewSession && tmuxSessionName && this._dataService) {
      this._dataService.readSettings().then((settings) => {
        if (settings.defaultCommand) {
          this._tmux.sendKeys(tmuxSessionName, settings.defaultCommand).catch((err) => {
            console.warn('Failed to send default command:', err)
          })
        }
      }).catch(() => {
        // Settings not available — skip
      })
    }

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`PTY session ${sessionId} exited with code ${exitCode}`)
      this._sessions.delete(sessionId)
    })

    return sessionId
  }

  /**
   * Spawn a plain shell (no tmux) as a fallback.
   */
  private _spawnPlainShell(
    taskId: string,
    paneId: string,
    cwd: string,
    env: Record<string, string>
  ): string {
    const shellPath = getShellPath()

    const ptyProcess = pty.spawn(shellPath, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env
    })

    const sessionId = `pty-${this._nextId++}`
    const session: PtySession = {
      id: sessionId,
      taskId,
      paneId,
      tmuxSessionName: '',
      ptyProcess
    }

    this._sessions.set(sessionId, session)

    ptyProcess.onData((data: string) => {
      for (const listener of this._dataListeners) {
        listener(sessionId, data)
      }
    })

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`PTY session ${sessionId} (plain shell) exited with code ${exitCode}`)
      this._sessions.delete(sessionId)
    })

    return sessionId
  }

  async write(sessionId: string, data: string): Promise<void> {
    const session = this._sessions.get(sessionId)
    if (!session) {
      // Session may have been destroyed by a race (e.g. React strict mode double-mount).
      // Warn instead of throwing to avoid noisy errors in the renderer.
      console.warn(`PTY write: session ${sessionId} not found (already destroyed?)`)
      return
    }
    session.ptyProcess.write(data)
  }

  async resize(sessionId: string, cols: number, rows: number): Promise<void> {
    const session = this._sessions.get(sessionId)
    if (!session) {
      throw new Error(`PTY session not found: ${sessionId}`)
    }
    session.ptyProcess.resize(cols, rows)
  }

  async destroy(sessionId: string): Promise<void> {
    const session = this._sessions.get(sessionId)
    if (!session) {
      return
    }
    // Kill the PTY process but leave the tmux session alive for persistence
    session.ptyProcess.kill()
    this._sessions.delete(sessionId)
  }

  onData(callback: DataCallback): () => void {
    this._dataListeners.add(callback)
    return () => {
      this._dataListeners.delete(callback)
    }
  }
}
