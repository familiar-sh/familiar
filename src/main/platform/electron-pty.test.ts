import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock node-pty before importing the module
vi.mock('node-pty', () => ({
  spawn: vi.fn()
}))

// Mock child_process
vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process')
  return {
    ...actual,
    default: actual,
    execFileSync: vi.fn(() => '/usr/local/bin/tmux')
  }
})

// Mock fs for resolveExecutable
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    existsSync: vi.fn(() => true)
  }
})

// Mock claude-session
vi.mock('../services/claude-session', () => ({
  resolveClaudeSessionCommand: vi.fn((cmd: string) => cmd)
}))

import { ElectronPtyManager } from './electron-pty'
import type { DataService } from '../services/data-service'
import type { Task, ProjectState } from '../../shared/types'

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test task',
    status: 'in-progress',
    priority: 'medium',
    labels: [],
    agentStatus: 'running',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sortOrder: 0,
    ...overrides
  }
}

function createMockDataService(tasks: Task[]): DataService {
  const state: ProjectState = {
    tasks,
    version: 1,
    projectName: 'test',
    columnOrder: ['todo', 'in-progress', 'in-review', 'done'],
    labels: []
  }

  return {
    readProjectState: vi.fn().mockResolvedValue(state),
    writeProjectState: vi.fn().mockResolvedValue(undefined),
    readTask: vi.fn().mockImplementation((id: string) => {
      const task = tasks.find((t) => t.id === id)
      if (!task) return Promise.reject(new Error('Not found'))
      return Promise.resolve({ ...task })
    }),
    updateTask: vi.fn().mockResolvedValue(undefined),
    readSettings: vi.fn().mockResolvedValue({})
  } as unknown as DataService
}

function createMockTmux(): ConstructorParameters<typeof ElectronPtyManager>[0] {
  return {
    hasSession: vi.fn().mockResolvedValue(false),
    createSession: vi.fn().mockResolvedValue(undefined),
    sendKeys: vi.fn().mockResolvedValue(undefined)
  } as unknown as ConstructorParameters<typeof ElectronPtyManager>[0]
}

describe('getShellEnv CLAUDECODE removal', () => {
  it('should not pass CLAUDECODE to spawned terminals', async () => {
    // Simulate Familiar being launched from a Claude Code session
    process.env.CLAUDECODE = '1'

    // Re-import to get fresh module with the env set
    // We can verify by creating a manager and checking the env passed to pty.spawn
    const pty = await import('node-pty')
    const mockPty = {
      onData: vi.fn(),
      onExit: vi.fn(),
      write: vi.fn(),
      resize: vi.fn(),
      destroy: vi.fn(),
      pid: 123
    }
    ;(pty.spawn as ReturnType<typeof vi.fn>).mockReturnValue(mockPty)

    const mockTmux = createMockTmux()
    const manager = new ElectronPtyManager(mockTmux)

    await manager.create('test-task', 'pane-0', '/tmp')

    // Check that pty.spawn was called with an env that does NOT include CLAUDECODE
    const spawnCall = (pty.spawn as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(spawnCall).toBeDefined()
    const spawnEnv = spawnCall[2]?.env as Record<string, string> | undefined
    expect(spawnEnv).toBeDefined()
    expect(spawnEnv!.CLAUDECODE).toBeUndefined()

    // Cleanup
    delete process.env.CLAUDECODE
  })
})

describe('ElectronPtyManager inactivity detection', () => {
  let manager: ElectronPtyManager
  let mockTmux: ReturnType<typeof createMockTmux>

  beforeEach(() => {
    vi.useFakeTimers()
    mockTmux = createMockTmux()
    manager = new ElectronPtyManager(mockTmux)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should reset running tasks after inactivity timeout when terminal activity was observed', async () => {
    const task = createMockTask({ id: 'task-1', agentStatus: 'running' })
    const ds = createMockDataService([task])
    manager.setDataService(ds)

    // Simulate that we observed terminal activity for this task
    const mgr = manager as unknown as {
      _trackTerminalActivity: (taskId: string) => void
      _lastActivityTime: Map<string, number>
    }
    mgr._trackTerminalActivity('task-1')

    // Advance past inactivity timeout (60s) + check interval (15s)
    vi.advanceTimersByTime(75_000)

    await vi.waitFor(() => {
      expect(ds.readProjectState).toHaveBeenCalled()
    })

    const writeCall = (ds.writeProjectState as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(writeCall).toBeDefined()
    const updatedState = writeCall[0] as ProjectState
    expect(updatedState.tasks[0].agentStatus).toBe('idle')
  })

  it('should not reset running tasks we have never observed activity from', async () => {
    const task = createMockTask({ id: 'task-1', agentStatus: 'running' })
    const ds = createMockDataService([task])
    manager.setDataService(ds)

    // No _trackTerminalActivity called — status was set externally via CLI
    vi.advanceTimersByTime(75_000)

    await vi.waitFor(() => {
      expect(ds.readProjectState).toHaveBeenCalled()
    })

    // Should NOT reset — we never observed this task's terminal
    expect(ds.writeProjectState).not.toHaveBeenCalled()
  })

  it('should not reset tasks that are not running', async () => {
    const task = createMockTask({ id: 'task-1', agentStatus: 'idle' })
    const ds = createMockDataService([task])
    manager.setDataService(ds)

    vi.advanceTimersByTime(15_000)

    await vi.waitFor(() => {
      expect(ds.readProjectState).toHaveBeenCalled()
    })

    expect(ds.writeProjectState).not.toHaveBeenCalled()
  })

  it('should not reset archived tasks', async () => {
    const task = createMockTask({
      id: 'task-1',
      agentStatus: 'running',
      status: 'archived'
    })
    const ds = createMockDataService([task])
    manager.setDataService(ds)

    vi.advanceTimersByTime(15_000)

    await vi.waitFor(() => {
      expect(ds.readProjectState).toHaveBeenCalled()
    })

    expect(ds.writeProjectState).not.toHaveBeenCalled()
  })

  it('should only reset tasks with observed activity that timed out', async () => {
    const task1 = createMockTask({ id: 'task-1', agentStatus: 'running' })
    const task2 = createMockTask({ id: 'task-2', agentStatus: 'running' })
    const task3 = createMockTask({ id: 'task-3', agentStatus: 'done' })
    const ds = createMockDataService([task1, task2, task3])
    manager.setDataService(ds)

    // Only observe activity from task-1
    const mgr = manager as unknown as {
      _trackTerminalActivity: (taskId: string) => void
    }
    mgr._trackTerminalActivity('task-1')

    // Advance past inactivity timeout
    vi.advanceTimersByTime(75_000)

    await vi.waitFor(() => {
      expect(ds.writeProjectState).toHaveBeenCalled()
    })

    const updatedState = (ds.writeProjectState as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as ProjectState
    // task-1 had observed activity that timed out → idle
    expect(updatedState.tasks[0].agentStatus).toBe('idle')
    // task-2 had no observed activity → stays running (set via CLI)
    expect(updatedState.tasks[1].agentStatus).toBe('running')
    // task-3 was done → stays done
    expect(updatedState.tasks[2].agentStatus).toBe('done')
  })

  it('should do nothing when dataService is not set', () => {
    vi.advanceTimersByTime(15_000)
    // No errors should be thrown
  })

  it('should not auto-promote idle to running on terminal output', () => {
    const ds = createMockDataService([createMockTask({ agentStatus: 'idle' })])
    manager.setDataService(ds)

    // Access private method for testing
    const mgr = manager as unknown as {
      _trackTerminalActivity: (taskId: string) => void
      _lastActivityTime: Map<string, number>
    }

    mgr._trackTerminalActivity('task-1')

    // Should track time but NOT call readTask to auto-promote status
    expect(mgr._lastActivityTime.has('task-1')).toBe(true)
    expect(ds.readTask).not.toHaveBeenCalled()
  })
})
