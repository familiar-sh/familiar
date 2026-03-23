import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ipcMain } from 'electron'
import { registerFileHandlers } from './file-handlers'
import fs from 'fs'
import { cp, rm } from 'fs/promises'
import type { ProjectState, Task } from '../../shared/types'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: vi.fn().mockReturnValue('/tmp') }
}))

vi.mock('fs', () => ({
  default: {
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn()
  },
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn()
}))

vi.mock('fs/promises', () => {
  const mod = {
    writeFile: vi.fn(),
    cp: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined)
  }
  return { ...mod, default: mod }
})

vi.mock('../../shared/utils/id-generator', () => ({
  generateTaskId: vi.fn().mockReturnValue('tsk_new123')
}))

describe('file-handlers task:move-to-worktree', () => {
  let handlers: Record<string, Function>

  const mockDataService = {
    getProjectRoot: vi.fn().mockReturnValue('/projects/source'),
    readProjectState: vi.fn(),
    writeProjectState: vi.fn(),
    createTask: vi.fn(),
    readTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    readTaskDocument: vi.fn(),
    writeTaskDocument: vi.fn(),
    readTaskActivity: vi.fn(),
    appendActivity: vi.fn(),
    saveAttachment: vi.fn(),
    copyTempToAttachment: vi.fn(),
    listTaskFiles: vi.fn(),
    savePastedFile: vi.fn(),
    readPastedFile: vi.fn(),
    deletePastedFile: vi.fn(),
    readSettings: vi.fn(),
    writeSettings: vi.fn(),
    initProject: vi.fn(),
    isInitialized: vi.fn()
  } as any

  const mockFileWatcher = null

  const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'tsk_abc123',
    title: 'Test task',
    status: 'todo',
    priority: 'medium',
    labels: [],
    agentStatus: 'idle',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    sortOrder: 0,
    ...overrides
  })

  const makeState = (tasks: Task[]): ProjectState => ({
    projectName: 'test',
    tasks,
    columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
    labels: []
  })

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    ;(ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })
    registerFileHandlers(mockDataService, () => mockFileWatcher)
  })

  it('registers the task:move-to-worktree handler', () => {
    expect(handlers['task:move-to-worktree']).toBeDefined()
  })

  it('copies a task to target worktree with new ID', async () => {
    const task = makeTask({ id: 'tsk_original' })
    const sourceState = makeState([task])
    const targetState = makeState([])

    ;(fs.readFileSync as any)
      .mockReturnValueOnce(JSON.stringify(sourceState))
      .mockReturnValueOnce(JSON.stringify(targetState))

    const result = await handlers['task:move-to-worktree'](
      {},
      ['tsk_original'],
      '/projects/target',
      'copy'
    )

    expect(result).toEqual({ movedCount: 1 })

    // Should copy the task directory
    expect(cp).toHaveBeenCalledWith(
      '/projects/source/.familiar/tasks/tsk_original',
      '/projects/target/.familiar/tasks/tsk_new123',
      { recursive: true }
    )

    // Should write task.json with new ID
    const writeCalls = (fs.writeFileSync as any).mock.calls
    const taskJsonWrite = writeCalls.find((c: any[]) => c[0].includes('tsk_new123/task.json'))
    expect(taskJsonWrite).toBeTruthy()
    const writtenTask = JSON.parse(taskJsonWrite[1])
    expect(writtenTask.id).toBe('tsk_new123')
    expect(writtenTask.agentStatus).toBe('idle')

    // Source state should NOT be written (copy mode)
    const stateWrites = writeCalls.filter((c: any[]) => c[0].endsWith('state.json'))
    expect(stateWrites).toHaveLength(1) // Only target state
  })

  it('moves a task to target worktree, removing from source', async () => {
    const task = makeTask({ id: 'tsk_move_me' })
    const sourceState = makeState([task])
    const targetState = makeState([])

    ;(fs.readFileSync as any)
      .mockReturnValueOnce(JSON.stringify(sourceState))
      .mockReturnValueOnce(JSON.stringify(targetState))

    const result = await handlers['task:move-to-worktree'](
      {},
      ['tsk_move_me'],
      '/projects/target',
      'move'
    )

    expect(result).toEqual({ movedCount: 1 })

    // Should copy task directory
    expect(cp).toHaveBeenCalledWith(
      '/projects/source/.familiar/tasks/tsk_move_me',
      '/projects/target/.familiar/tasks/tsk_move_me',
      { recursive: true }
    )

    // Should remove source task directory
    expect(rm).toHaveBeenCalledWith(
      '/projects/source/.familiar/tasks/tsk_move_me',
      { recursive: true, force: true }
    )

    // Source state should be written without the moved task
    const writeCalls = (fs.writeFileSync as any).mock.calls
    const sourceStateWrite = writeCalls.find((c: any[]) =>
      c[0] === '/projects/source/.familiar/state.json'
    )
    expect(sourceStateWrite).toBeTruthy()
    const sourceStateWritten: ProjectState = JSON.parse(sourceStateWrite[1])
    expect(sourceStateWritten.tasks).toHaveLength(0)

    // Target state should have the task
    const targetStateWrite = writeCalls.find((c: any[]) =>
      c[0] === '/projects/target/.familiar/state.json'
    )
    expect(targetStateWrite).toBeTruthy()
    const targetStateWritten: ProjectState = JSON.parse(targetStateWrite[1])
    expect(targetStateWritten.tasks).toHaveLength(1)
    expect(targetStateWritten.tasks[0].id).toBe('tsk_move_me')
  })

  it('handles multiple tasks', async () => {
    const task1 = makeTask({ id: 'tsk_1' })
    const task2 = makeTask({ id: 'tsk_2' })
    const sourceState = makeState([task1, task2])
    const targetState = makeState([])

    ;(fs.readFileSync as any)
      .mockReturnValueOnce(JSON.stringify(sourceState))
      .mockReturnValueOnce(JSON.stringify(targetState))

    const result = await handlers['task:move-to-worktree'](
      {},
      ['tsk_1', 'tsk_2'],
      '/projects/target',
      'move'
    )

    expect(result).toEqual({ movedCount: 2 })
    expect(cp).toHaveBeenCalledTimes(2)
    expect(rm).toHaveBeenCalledTimes(2)
  })

  it('skips tasks that do not exist in source state', async () => {
    const task = makeTask({ id: 'tsk_existing' })
    const sourceState = makeState([task])
    const targetState = makeState([])

    ;(fs.readFileSync as any)
      .mockReturnValueOnce(JSON.stringify(sourceState))
      .mockReturnValueOnce(JSON.stringify(targetState))

    const result = await handlers['task:move-to-worktree'](
      {},
      ['tsk_nonexistent'],
      '/projects/target',
      'move'
    )

    expect(result).toEqual({ movedCount: 0 })
    expect(cp).not.toHaveBeenCalled()
  })
})

describe('file-handlers worktree:migrate-tasks', () => {
  let handlers: Record<string, Function>

  const mockDataService = {
    getProjectRoot: vi.fn().mockReturnValue('/projects/source'),
    readProjectState: vi.fn(),
    writeProjectState: vi.fn(),
    createTask: vi.fn(),
    readTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    readTaskDocument: vi.fn(),
    writeTaskDocument: vi.fn(),
    readTaskActivity: vi.fn(),
    appendActivity: vi.fn(),
    saveAttachment: vi.fn(),
    copyTempToAttachment: vi.fn(),
    listTaskFiles: vi.fn(),
    savePastedFile: vi.fn(),
    readPastedFile: vi.fn(),
    deletePastedFile: vi.fn(),
    readSettings: vi.fn(),
    writeSettings: vi.fn(),
    initProject: vi.fn(),
    isInitialized: vi.fn()
  } as any

  const makeTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'tsk_abc123',
    title: 'Test task',
    status: 'todo',
    priority: 'medium',
    labels: [],
    agentStatus: 'idle',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    sortOrder: 0,
    ...overrides
  })

  const makeState = (tasks: Task[], labels: { name: string; color: string; description?: string }[] = []): ProjectState => ({
    projectName: 'test',
    tasks,
    columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
    labels
  })

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    ;(ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler
    })
    registerFileHandlers(mockDataService, () => null)
  })

  it('registers the worktree:migrate-tasks handler', () => {
    expect(handlers['worktree:migrate-tasks']).toBeDefined()
  })

  it('migrates tasks from worktree to main project with label and archived status', async () => {
    const task = makeTask({ id: 'tsk_wt1', status: 'in-progress', labels: ['feature'] })
    const worktreeState = makeState([task])
    const targetState = makeState([])

    ;(fs.readFileSync as any)
      .mockReturnValueOnce(JSON.stringify(worktreeState))
      .mockReturnValueOnce(JSON.stringify(targetState))

    const result = await handlers['worktree:migrate-tasks'](
      {},
      '/projects/worktree',
      '/projects/main',
      'my-feature'
    )

    expect(result).toEqual({ migratedCount: 1 })

    // Should copy task directory
    expect(cp).toHaveBeenCalledWith(
      '/projects/worktree/.familiar/tasks/tsk_wt1',
      '/projects/main/.familiar/tasks/tsk_wt1',
      { recursive: true }
    )

    // Check the written task.json
    const writeCalls = (fs.writeFileSync as any).mock.calls
    const taskJsonWrite = writeCalls.find((c: any[]) => c[0].includes('tsk_wt1/task.json'))
    expect(taskJsonWrite).toBeTruthy()
    const writtenTask = JSON.parse(taskJsonWrite[1])
    expect(writtenTask.status).toBe('archived')
    expect(writtenTask.agentStatus).toBe('idle')
    expect(writtenTask.labels).toContain('my-feature')
    expect(writtenTask.labels).toContain('feature')

    // Check the written state.json includes the new label
    const stateWrite = writeCalls.find((c: any[]) =>
      c[0] === '/projects/main/.familiar/state.json'
    )
    expect(stateWrite).toBeTruthy()
    const writtenState: ProjectState = JSON.parse(stateWrite[1])
    expect(writtenState.labels.some((l) => l.name === 'my-feature')).toBe(true)
    expect(writtenState.tasks).toHaveLength(1)
    expect(writtenState.tasks[0].status).toBe('archived')
  })

  it('returns 0 when worktree has no .familiar directory', async () => {
    ;(fs.existsSync as any).mockReturnValueOnce(false) // worktree state.json doesn't exist

    const result = await handlers['worktree:migrate-tasks'](
      {},
      '/projects/worktree',
      '/projects/main',
      'my-feature'
    )

    expect(result).toEqual({ migratedCount: 0 })
    expect(cp).not.toHaveBeenCalled()
  })

  it('returns 0 when worktree has no tasks', async () => {
    const worktreeState = makeState([])
    ;(fs.readFileSync as any).mockReturnValueOnce(JSON.stringify(worktreeState))

    const result = await handlers['worktree:migrate-tasks'](
      {},
      '/projects/worktree',
      '/projects/main',
      'my-feature'
    )

    expect(result).toEqual({ migratedCount: 0 })
  })

  it('does not duplicate label if task already has it', async () => {
    const task = makeTask({ id: 'tsk_wt2', labels: ['my-feature'] })
    const worktreeState = makeState([task])
    const targetState = makeState([])

    ;(fs.readFileSync as any)
      .mockReturnValueOnce(JSON.stringify(worktreeState))
      .mockReturnValueOnce(JSON.stringify(targetState))

    await handlers['worktree:migrate-tasks'](
      {},
      '/projects/worktree',
      '/projects/main',
      'my-feature'
    )

    const writeCalls = (fs.writeFileSync as any).mock.calls
    const taskJsonWrite = writeCalls.find((c: any[]) => c[0].includes('tsk_wt2/task.json'))
    const writtenTask = JSON.parse(taskJsonWrite[1])
    // Should have exactly one instance of 'my-feature'
    expect(writtenTask.labels.filter((l: string) => l === 'my-feature')).toHaveLength(1)
  })

  it('does not duplicate label config if it already exists in target', async () => {
    const task = makeTask({ id: 'tsk_wt3' })
    const worktreeState = makeState([task])
    const targetState = makeState([], [{ name: 'my-feature', color: '#ff0000' }])

    ;(fs.readFileSync as any)
      .mockReturnValueOnce(JSON.stringify(worktreeState))
      .mockReturnValueOnce(JSON.stringify(targetState))

    await handlers['worktree:migrate-tasks'](
      {},
      '/projects/worktree',
      '/projects/main',
      'my-feature'
    )

    const writeCalls = (fs.writeFileSync as any).mock.calls
    const stateWrite = writeCalls.find((c: any[]) =>
      c[0] === '/projects/main/.familiar/state.json'
    )
    const writtenState: ProjectState = JSON.parse(stateWrite[1])
    // Should still only have one label with that name
    expect(writtenState.labels.filter((l) => l.name === 'my-feature')).toHaveLength(1)
    // Should keep the original color
    expect(writtenState.labels.find((l) => l.name === 'my-feature')?.color).toBe('#ff0000')
  })

  it('migrates multiple tasks', async () => {
    const task1 = makeTask({ id: 'tsk_a' })
    const task2 = makeTask({ id: 'tsk_b' })
    const worktreeState = makeState([task1, task2])
    const targetState = makeState([])

    ;(fs.readFileSync as any)
      .mockReturnValueOnce(JSON.stringify(worktreeState))
      .mockReturnValueOnce(JSON.stringify(targetState))

    const result = await handlers['worktree:migrate-tasks'](
      {},
      '/projects/worktree',
      '/projects/main',
      'my-feature'
    )

    expect(result).toEqual({ migratedCount: 2 })
    expect(cp).toHaveBeenCalledTimes(2)
  })

  it('places migrated tasks at top of archive list by shifting existing archived tasks down', async () => {
    const existingArchived1 = makeTask({ id: 'tsk_old1', status: 'archived', sortOrder: 0 })
    const existingArchived2 = makeTask({ id: 'tsk_old2', status: 'archived', sortOrder: 1 })
    const existingTodo = makeTask({ id: 'tsk_todo', status: 'todo', sortOrder: 0 })
    const wtTask1 = makeTask({ id: 'tsk_new1', status: 'in-progress' })
    const wtTask2 = makeTask({ id: 'tsk_new2', status: 'done' })

    const worktreeState = makeState([wtTask1, wtTask2])
    const targetState = makeState([existingArchived1, existingArchived2, existingTodo])

    ;(fs.readFileSync as any)
      .mockReturnValueOnce(JSON.stringify(worktreeState))
      .mockReturnValueOnce(JSON.stringify(targetState))
      // Mock reads for existing archived task.json files during sortOrder shift
      .mockReturnValueOnce(JSON.stringify(existingArchived1))
      .mockReturnValueOnce(JSON.stringify(existingArchived2))

    const result = await handlers['worktree:migrate-tasks'](
      {},
      '/projects/worktree',
      '/projects/main',
      'my-feature'
    )

    expect(result).toEqual({ migratedCount: 2 })

    const writeCalls = (fs.writeFileSync as any).mock.calls

    // Check that existing archived tasks were shifted down by 2 (number of migrated tasks)
    const old1Write = writeCalls.find((c: any[]) => c[0].includes('tsk_old1/task.json'))
    expect(old1Write).toBeTruthy()
    expect(JSON.parse(old1Write[1]).sortOrder).toBe(2) // was 0, shifted by 2

    const old2Write = writeCalls.find((c: any[]) => c[0].includes('tsk_old2/task.json'))
    expect(old2Write).toBeTruthy()
    expect(JSON.parse(old2Write[1]).sortOrder).toBe(3) // was 1, shifted by 2

    // Check that migrated tasks got sortOrder 0 and 1 (top of archive)
    const new1Write = writeCalls.find((c: any[]) => c[0].includes('tsk_new1/task.json'))
    expect(new1Write).toBeTruthy()
    expect(JSON.parse(new1Write[1]).sortOrder).toBe(0)

    const new2Write = writeCalls.find((c: any[]) => c[0].includes('tsk_new2/task.json'))
    expect(new2Write).toBeTruthy()
    expect(JSON.parse(new2Write[1]).sortOrder).toBe(1)

    // Non-archived tasks should not be shifted
    const stateWrite = writeCalls.find((c: any[]) =>
      c[0] === '/projects/main/.familiar/state.json'
    )
    const writtenState: ProjectState = JSON.parse(stateWrite[1])
    const todoTask = writtenState.tasks.find((t) => t.id === 'tsk_todo')
    expect(todoTask?.sortOrder).toBe(0) // unchanged
  })
})
