import * as pty from 'node-pty'
import * as os from 'os'
import * as fs from 'fs'
import { execFileSync } from 'child_process'
import { IPtyManager } from '../../shared/platform/pty'
import { ElectronTmuxManager } from './electron-tmux'
import type { DataService } from '../services/data-service'
import { resolveClaudeSessionCommand, ensureForkSessionCopied } from '../services/claude-session'

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

  // Remove CLAUDECODE so that Claude Code can be launched inside Familiar terminals
  // even when the Familiar app itself was started from a Claude Code session.
  delete env.CLAUDECODE

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

  /** Tracks last terminal output time per task for inactivity detection */
  private _lastActivityTime = new Map<string, number>()
  /** Timer that periodically checks for inactive tasks — stored to allow future cleanup */
  // @ts-expect-error assigned for cleanup reference but not read within class
  private _inactivityTimer: ReturnType<typeof setInterval> | null = null
  /** How long (ms) before a task with no terminal output is reset to idle */
  private static readonly INACTIVITY_TIMEOUT_MS = 60_000
  /** How often (ms) to check for inactive tasks */
  private static readonly INACTIVITY_CHECK_INTERVAL_MS = 15_000

  constructor(private _tmux: ElectronTmuxManager) {
    this._startInactivityChecker()
  }

  setDataService(dataService: DataService): void {
    this._dataService = dataService
  }

  /**
   * Track terminal output time for inactivity detection.
   * Does NOT auto-promote idle→running — agents signal their own status via the CLI.
   */
  private _trackTerminalActivity(taskId: string): void {
    this._lastActivityTime.set(taskId, Date.now())
  }

  /**
   * Periodically check for tasks whose terminals have gone quiet and reset
   * their agentStatus from 'running' back to 'idle'.
   */
  private _startInactivityChecker(): void {
    this._inactivityTimer = setInterval(() => {
      this._checkInactiveAgents()
    }, ElectronPtyManager.INACTIVITY_CHECK_INTERVAL_MS)
  }

  private _checkInactiveAgents(): void {
    if (!this._dataService) return

    const now = Date.now()
    const ds = this._dataService

    ds.readProjectState()
      .then((state) => {
        let changed = false
        const taskUpdates: Promise<void>[] = []

        for (const task of state.tasks) {
          if (task.agentStatus !== 'running') continue
          if (task.status === 'archived') continue

          // Only consider tasks we've actually observed terminal output from.
          // If we've never seen output, the status was set externally (e.g. CLI)
          // and we should not touch it.
          const lastActivity = this._lastActivityTime.get(task.id)
          if (!lastActivity) continue

          if (now - lastActivity > ElectronPtyManager.INACTIVITY_TIMEOUT_MS) {
            task.agentStatus = 'idle'
            task.updatedAt = new Date().toISOString()
            changed = true
            taskUpdates.push(
              ds.readTask(task.id).then((taskData) => {
                taskData.agentStatus = 'idle'
                taskData.updatedAt = task.updatedAt
                return ds.updateTask(taskData)
              }).catch(() => { /* ignore */ })
            )
          }
        }

        if (changed) {
          Promise.all([ds.writeProjectState(state), ...taskUpdates]).catch(() => {
            // ignore write errors
          })
        }
      })
      .catch(() => {
        // ignore read errors
      })
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

  async create(taskId: string, paneId: string, cwd: string, forkedFrom?: string, overrideCommand?: string): Promise<string> {
    const validCwd = getValidCwd(cwd)
    const env = getShellEnv()

    // Inject familiar context so agents know which task they're in
    env.FAMILIAR_TASK_ID = taskId
    env.FAMILIAR_PROJECT_ROOT = cwd
    env.FAMILIAR_SETTINGS_PATH = `${cwd}/.familiar/settings.json`

    // Copy parent's Claude session file for forked tasks (before tmux session creation)
    if (forkedFrom) {
      ensureForkSessionCopied(taskId, forkedFrom, cwd)
    }

    const tmuxPath = this._getTmuxPath()

    let ptyProcess: pty.IPty
    let tmuxSessionName = ''
    let isNewSession = false
    const familiarEnv = {
      FAMILIAR_TASK_ID: taskId,
      FAMILIAR_PROJECT_ROOT: cwd,
      FAMILIAR_SETTINGS_PATH: `${cwd}/.familiar/settings.json`
    }

    if (tmuxPath) {
      // tmux is available — one persistent session per task
      tmuxSessionName = `familiar-${taskId}`
      try {
        const exists = await this._tmux.hasSession(tmuxSessionName)
        if (!exists) {
          await this._tmux.createSession(tmuxSessionName, validCwd, familiarEnv)
          isNewSession = true
        } else {
          // Session already exists (e.g. from previous app run) — re-inject env vars
          await this._tmux.setEnvironment(tmuxSessionName, familiarEnv)
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
      this._trackTerminalActivity(taskId)
    })

    // Warm up newly created sessions: dismiss interactive prompts (Ctrl-C),
    // export env vars into the shell, and run default command.
    // Fire-and-forget so the terminal appears immediately.
    // Only for new sessions — existing sessions (pre-warmed by tmux:warmup) are skipped.
    if (isNewSession && tmuxSessionName) {
      const commandPromise = overrideCommand
        ? Promise.resolve(overrideCommand)
        : this._dataService
          ? this._dataService.readSettings().then((settings) => {
              if (settings.defaultCommand) {
                return resolveClaudeSessionCommand(settings.defaultCommand, taskId, cwd)
              }
              return undefined
            }).catch(() => undefined)
          : Promise.resolve(undefined)

      commandPromise.then((command) => {
        return this._tmux.warmupSession(tmuxSessionName, familiarEnv, command)
      }).catch((err) => {
        console.warn('Failed to warm up tmux session:', err)
      })
    }

    ptyProcess.onExit(() => {
      this._sessions.delete(sessionId)
    })

    return sessionId
  }

  /**
   * Create a plain shell session (no tmux), regardless of tmux availability.
   * Used for onboarding doctor terminal and other contexts where tmux is not wanted.
   */
  async createPlain(taskId: string, paneId: string, cwd: string): Promise<string> {
    const validCwd = getValidCwd(cwd)
    const env = getShellEnv()
    env.FAMILIAR_TASK_ID = taskId
    env.FAMILIAR_PROJECT_ROOT = cwd
    env.FAMILIAR_SETTINGS_PATH = `${cwd}/.familiar/settings.json`
    return this._spawnPlainShell(taskId, paneId, validCwd, env)
  }

  /**
   * Spawn a plain shell (no tmux) as a fallback.
   * Throws with a descriptive error if spawning fails (e.g. EMFILE).
   */
  private _spawnPlainShell(
    taskId: string,
    paneId: string,
    cwd: string,
    env: Record<string, string>
  ): string {
    const shellPath = getShellPath()

    let ptyProcess: pty.IPty
    try {
      ptyProcess = pty.spawn(shellPath, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Failed to spawn plain shell for task ${taskId}: ${msg}`)
      throw new Error(`Cannot create terminal session: ${msg}`)
    }

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
      this._trackTerminalActivity(taskId)
    })

    ptyProcess.onExit(() => {
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
    // Properly close the PTY master fd and then signal the child process.
    // Using destroy() instead of kill() ensures the master file descriptor is
    // closed, preventing PTY fd leaks that exhaust /dev/ptmx.
    // The underlying tmux session survives — only the attach client is killed.
    ;(session.ptyProcess as unknown as { destroy: () => void }).destroy()
    this._sessions.delete(sessionId)
  }

  onData(callback: DataCallback): () => void {
    this._dataListeners.add(callback)
    return () => {
      this._dataListeners.delete(callback)
    }
  }
}
