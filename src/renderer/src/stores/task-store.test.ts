import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTaskStore } from '@renderer/stores/task-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import type { ProjectState, Task } from '@shared/types'

// Mock window.api
const mockApi = {
  isInitialized: vi.fn(),
  readProjectState: vi.fn(),
  initProject: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  writeProjectState: vi.fn(),
  warmupTmuxSession: vi.fn(),
  tmuxList: vi.fn().mockResolvedValue([]),
  tmuxKill: vi.fn(),
  openDirectory: vi.fn(),
  setProjectRoot: vi.fn(),
  listNotifications: vi.fn().mockResolvedValue([]),
  markNotificationRead: vi.fn().mockResolvedValue(undefined),
  markNotificationsByTaskRead: vi.fn().mockResolvedValue(undefined),
  markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  clearNotifications: vi.fn().mockResolvedValue(undefined)
}

Object.defineProperty(globalThis, 'window', {
  value: { api: mockApi },
  writable: true
})

function makeProjectState(tasks: Task[] = []): ProjectState {
  return {
    version: 1,
    projectName: 'test',
    tasks,
    columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
    labels: []
  }
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_test01',
    title: 'Test task',
    status: 'todo',
    priority: 'none',
    labels: [],
    agentStatus: 'idle',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 0,
    ...overrides
  }
}

describe('useTaskStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Provide default resolutions for mocks used across tests
    mockApi.tmuxList.mockResolvedValue([])
    mockApi.warmupTmuxSession.mockResolvedValue(undefined)
    // Reset store state
    useTaskStore.setState({
      projectState: null,
      isLoading: false,
      error: null
    })
  })

  describe('loadProjectState', () => {
    it('loads state when project is initialized', async () => {
      const state = makeProjectState()
      mockApi.isInitialized.mockResolvedValue(true)
      mockApi.readProjectState.mockResolvedValue(state)

      await useTaskStore.getState().loadProjectState()

      expect(useTaskStore.getState().projectState).toEqual(state)
      expect(useTaskStore.getState().isLoading).toBe(false)
      expect(useTaskStore.getState().error).toBeNull()
    })

    it('sets projectState to null when not initialized', async () => {
      mockApi.isInitialized.mockResolvedValue(false)

      await useTaskStore.getState().loadProjectState()

      expect(useTaskStore.getState().projectState).toBeNull()
      expect(useTaskStore.getState().isLoading).toBe(false)
    })

    it('sets error when API fails', async () => {
      mockApi.isInitialized.mockRejectedValue(new Error('API error'))

      await useTaskStore.getState().loadProjectState()

      expect(useTaskStore.getState().error).toBe('API error')
      expect(useTaskStore.getState().isLoading).toBe(false)
    })
  })

  describe('addTask', () => {
    it('creates a task and persists it', async () => {
      const state = makeProjectState()
      useTaskStore.setState({ projectState: state })
      mockApi.createTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      const task = await useTaskStore.getState().addTask('New task')

      expect(task.title).toBe('New task')
      expect(task.id).toMatch(/^tsk_/)
      expect(task.status).toBe('todo')
      expect(mockApi.createTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'New task' }))
      expect(mockApi.writeProjectState).toHaveBeenCalled()
      expect(useTaskStore.getState().projectState!.tasks).toHaveLength(1)
    })

    it('throws when project not initialized', async () => {
      await expect(useTaskStore.getState().addTask('Task')).rejects.toThrow('Project not initialized')
    })

    it('adds new task to the top of the column (sortOrder 0) and shifts existing tasks down', async () => {
      const existing = makeTask({ status: 'todo', sortOrder: 5 })
      const state = makeProjectState([existing])
      useTaskStore.setState({ projectState: state })
      mockApi.createTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      const task = await useTaskStore.getState().addTask('Another task')
      expect(task.sortOrder).toBe(0)

      // Existing task should have been shifted down
      const tasks = useTaskStore.getState().projectState!.tasks
      const existingUpdated = tasks.find((t) => t.id === existing.id)!
      expect(existingUpdated.sortOrder).toBe(6) // was 5, shifted to 6
    })

    it('calls warmupTmuxSession after creating a non-archived task', async () => {
      const state = makeProjectState()
      useTaskStore.setState({ projectState: state })
      mockApi.createTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)
      mockApi.warmupTmuxSession.mockResolvedValue(undefined)

      const task = await useTaskStore.getState().addTask('Test warmup')
      expect(mockApi.warmupTmuxSession).toHaveBeenCalledWith(task.id)
    })

    it('does not call warmupTmuxSession when creating an archived task', async () => {
      const state = makeProjectState()
      useTaskStore.setState({ projectState: state })
      mockApi.createTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)
      mockApi.warmupTmuxSession.mockResolvedValue(undefined)

      await useTaskStore.getState().addTask('Archived task', { status: 'archived' })
      expect(mockApi.warmupTmuxSession).not.toHaveBeenCalled()
    })
  })

  describe('updateTask', () => {
    it('modifies task and persists', async () => {
      const task = makeTask()
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      const updated = { ...task, title: 'Updated title' }
      await useTaskStore.getState().updateTask(updated)

      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.title).toBe('Updated title')
      expect(mockApi.updateTask).toHaveBeenCalled()
      expect(mockApi.writeProjectState).toHaveBeenCalled()
    })

    it('throws when project not initialized', async () => {
      const task = makeTask()
      await expect(useTaskStore.getState().updateTask(task)).rejects.toThrow('Project not initialized')
    })
  })

  describe('deleteTask', () => {
    it('removes task and persists', async () => {
      const task = makeTask()
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.deleteTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().deleteTask(task.id)

      expect(useTaskStore.getState().projectState!.tasks).toHaveLength(0)
      expect(mockApi.deleteTask).toHaveBeenCalledWith(task.id)
      expect(mockApi.writeProjectState).toHaveBeenCalled()
    })

    it('throws when project not initialized', async () => {
      await expect(useTaskStore.getState().deleteTask('tsk_x')).rejects.toThrow('Project not initialized')
    })
  })

  describe('deleteTasks', () => {
    it('removes multiple tasks atomically', async () => {
      const task1 = makeTask({ id: 'tsk_del1' })
      const task2 = makeTask({ id: 'tsk_del2' })
      const task3 = makeTask({ id: 'tsk_keep' })
      const state = makeProjectState([task1, task2, task3])
      useTaskStore.setState({ projectState: state })
      mockApi.deleteTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().deleteTasks(['tsk_del1', 'tsk_del2'])

      const remaining = useTaskStore.getState().projectState!.tasks
      expect(remaining).toHaveLength(1)
      expect(remaining[0].id).toBe('tsk_keep')
      expect(mockApi.deleteTask).toHaveBeenCalledWith('tsk_del1')
      expect(mockApi.deleteTask).toHaveBeenCalledWith('tsk_del2')
      // writeProjectState should be called only once (atomic)
      expect(mockApi.writeProjectState).toHaveBeenCalledTimes(1)
    })

    it('throws when project not initialized', async () => {
      await expect(useTaskStore.getState().deleteTasks(['tsk_x'])).rejects.toThrow('Project not initialized')
    })
  })

  describe('moveTask', () => {
    it('changes status and sort order', async () => {
      const task = makeTask({ status: 'todo', sortOrder: 0 })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().moveTask(task.id, 'in-progress', 0)

      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.status).toBe('in-progress')
      expect(stored.sortOrder).toBe(0)
    })

    it('inserts at correct position among existing tasks', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 0 })
      const t2 = makeTask({ id: 'tsk_b', status: 'in-progress', sortOrder: 0 })
      const t3 = makeTask({ id: 'tsk_c', status: 'in-progress', sortOrder: 1 })
      const state = makeProjectState([t1, t2, t3])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      // Move t1 from todo to in-progress at index 1 (between t2 and t3)
      await useTaskStore.getState().moveTask('tsk_a', 'in-progress', 1)

      const tasks = useTaskStore.getState().projectState!.tasks
      const movedTask = tasks.find((t) => t.id === 'tsk_a')!
      expect(movedTask.status).toBe('in-progress')
      expect(movedTask.sortOrder).toBe(1)

      // t2 stays at 0, t3 shifts to 2
      const taskB = tasks.find((t) => t.id === 'tsk_b')!
      const taskC = tasks.find((t) => t.id === 'tsk_c')!
      expect(taskB.sortOrder).toBe(0)
      expect(taskC.sortOrder).toBe(2)
    })

    it('throws when task not found', async () => {
      const state = makeProjectState([])
      useTaskStore.setState({ projectState: state })

      await expect(
        useTaskStore.getState().moveTask('tsk_nonexistent', 'done', 0)
      ).rejects.toThrow('Task tsk_nonexistent not found')
    })
  })

  describe('getTasksByStatus', () => {
    it('filters tasks by status and sorts by sortOrder', () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 2 })
      const t2 = makeTask({ id: 'tsk_b', status: 'todo', sortOrder: 1 })
      const t3 = makeTask({ id: 'tsk_c', status: 'done', sortOrder: 0 })
      const state = makeProjectState([t1, t2, t3])
      useTaskStore.setState({ projectState: state })

      const todos = useTaskStore.getState().getTasksByStatus('todo')
      expect(todos).toHaveLength(2)
      expect(todos[0].id).toBe('tsk_b') // sortOrder 1 first
      expect(todos[1].id).toBe('tsk_a') // sortOrder 2 second
    })

    it('returns empty array when no project state', () => {
      expect(useTaskStore.getState().getTasksByStatus('todo')).toEqual([])
    })
  })

  describe('getTaskById', () => {
    it('returns the correct task', () => {
      const task = makeTask({ id: 'tsk_find' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })

      expect(useTaskStore.getState().getTaskById('tsk_find')).toEqual(task)
    })

    it('returns undefined for non-existent task', () => {
      const state = makeProjectState([])
      useTaskStore.setState({ projectState: state })

      expect(useTaskStore.getState().getTaskById('tsk_nope')).toBeUndefined()
    })

    it('returns undefined when no project state', () => {
      expect(useTaskStore.getState().getTaskById('tsk_x')).toBeUndefined()
    })
  })

  describe('addTask - additional coverage', () => {
    it('generates an id starting with tsk_ and 6 alphanumeric chars', async () => {
      const state = makeProjectState()
      useTaskStore.setState({ projectState: state })
      mockApi.createTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      const task = await useTaskStore.getState().addTask('ID test')
      expect(task.id).toMatch(/^tsk_[a-z0-9]{6}$/)
    })

    it('applies partial options to the created task', async () => {
      const state = makeProjectState()
      useTaskStore.setState({ projectState: state })
      mockApi.createTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      const task = await useTaskStore.getState().addTask('Custom task', {
        priority: 'high',
        labels: ['bug'],
        status: 'in-progress'
      })

      expect(task.priority).toBe('high')
      expect(task.labels).toEqual(['bug'])
      expect(task.status).toBe('in-progress')
    })

    it('sets default values for new tasks', async () => {
      const state = makeProjectState()
      useTaskStore.setState({ projectState: state })
      mockApi.createTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      const task = await useTaskStore.getState().addTask('Defaults test')

      expect(task.status).toBe('todo')
      expect(task.priority).toBe('none')
      expect(task.labels).toEqual([])
      expect(task.agentStatus).toBe('idle')
      expect(task.createdAt).toBeDefined()
      expect(task.updatedAt).toBeDefined()
    })

    it('handles warmup failure gracefully', async () => {
      const state = makeProjectState()
      useTaskStore.setState({ projectState: state })
      mockApi.createTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)
      mockApi.warmupTmuxSession.mockRejectedValue(new Error('tmux not found'))

      // Should not throw even if warmup fails
      const task = await useTaskStore.getState().addTask('Warmup fail test')
      expect(task.title).toBe('Warmup fail test')
    })
  })

  describe('updateTask - additional coverage', () => {
    it('updates the updatedAt timestamp', async () => {
      const task = makeTask({ updatedAt: '2020-01-01T00:00:00.000Z' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().updateTask({ ...task, title: 'Changed' })

      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
    })

    it('kills tmux sessions when archiving a task', async () => {
      const task = makeTask({ id: 'tsk_arch', status: 'done' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.tmuxList.mockResolvedValue(['familiar-tsk_arch-0', 'familiar-tsk_arch-1'])
      mockApi.tmuxKill.mockResolvedValue(undefined)
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().updateTask({ ...task, status: 'archived' })

      expect(mockApi.tmuxList).toHaveBeenCalled()
      expect(mockApi.tmuxKill).toHaveBeenCalledWith('familiar-tsk_arch-0')
      expect(mockApi.tmuxKill).toHaveBeenCalledWith('familiar-tsk_arch-1')
    })

    it('resets agentStatus to idle when archiving', async () => {
      const task = makeTask({ id: 'tsk_agent', status: 'done', agentStatus: 'running' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().updateTask({ ...task, status: 'archived' })

      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.agentStatus).toBe('idle')
    })

    it('sets agentStatus to done when status changes to in-review and agent is running', async () => {
      const task = makeTask({ id: 'tsk_rev', status: 'in-progress', agentStatus: 'running' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().updateTask({ ...task, status: 'in-review' })

      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.agentStatus).toBe('done')
    })

    it('sets agentStatus to done when status changes to done and agent is running', async () => {
      const task = makeTask({ id: 'tsk_dn', status: 'in-progress', agentStatus: 'running' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().updateTask({ ...task, status: 'done' })

      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.agentStatus).toBe('done')
    })

    it('does not change agentStatus when moving to in-review if agent is idle', async () => {
      const task = makeTask({ id: 'tsk_idle', status: 'in-progress', agentStatus: 'idle' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().updateTask({ ...task, status: 'in-review' })

      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.agentStatus).toBe('idle')
    })

    it('does not kill tmux sessions for non-archive updates', async () => {
      const task = makeTask({ status: 'todo' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().updateTask({ ...task, title: 'Renamed' })

      expect(mockApi.tmuxList).not.toHaveBeenCalled()
    })
  })

  describe('deleteTask - additional coverage', () => {
    it('kills tmux sessions before deleting', async () => {
      const task = makeTask({ id: 'tsk_del' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.tmuxList.mockResolvedValue(['familiar-tsk_del-0'])
      mockApi.tmuxKill.mockResolvedValue(undefined)
      mockApi.deleteTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().deleteTask('tsk_del')

      expect(mockApi.tmuxList).toHaveBeenCalled()
      expect(mockApi.tmuxKill).toHaveBeenCalledWith('familiar-tsk_del-0')
      expect(mockApi.deleteTask).toHaveBeenCalledWith('tsk_del')
    })

    it('handles tmux list failure gracefully during delete', async () => {
      const task = makeTask({ id: 'tsk_del2' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.tmuxList.mockRejectedValue(new Error('tmux not available'))
      mockApi.deleteTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().deleteTask('tsk_del2')

      expect(useTaskStore.getState().projectState!.tasks).toHaveLength(0)
    })
  })

  describe('moveTask - additional coverage', () => {
    it('kills tmux sessions when moving to archived', async () => {
      const task = makeTask({ id: 'tsk_mv', status: 'done', sortOrder: 0 })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.tmuxList.mockResolvedValue(['familiar-tsk_mv-0'])
      mockApi.tmuxKill.mockResolvedValue(undefined)
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().moveTask('tsk_mv', 'archived', 0)

      expect(mockApi.tmuxKill).toHaveBeenCalledWith('familiar-tsk_mv-0')
      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.status).toBe('archived')
      expect(stored.agentStatus).toBe('idle')
    })

    it('re-indexes source column when moving to a different column', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 0 })
      const t2 = makeTask({ id: 'tsk_b', status: 'todo', sortOrder: 1 })
      const t3 = makeTask({ id: 'tsk_c', status: 'todo', sortOrder: 2 })
      const state = makeProjectState([t1, t2, t3])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      // Move first task to in-progress
      await useTaskStore.getState().moveTask('tsk_a', 'in-progress', 0)

      const tasks = useTaskStore.getState().projectState!.tasks
      // Source column re-indexed: tsk_b=0, tsk_c=1
      expect(tasks.find((t) => t.id === 'tsk_b')!.sortOrder).toBe(0)
      expect(tasks.find((t) => t.id === 'tsk_c')!.sortOrder).toBe(1)
    })

    it('clamps index to column length when index exceeds it', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 0 })
      const t2 = makeTask({ id: 'tsk_b', status: 'in-progress', sortOrder: 0 })
      const state = makeProjectState([t1, t2])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      // Move to in-progress at index 999 (should clamp to 1)
      await useTaskStore.getState().moveTask('tsk_a', 'in-progress', 999)

      const moved = useTaskStore.getState().projectState!.tasks.find((t) => t.id === 'tsk_a')!
      expect(moved.status).toBe('in-progress')
      expect(moved.sortOrder).toBe(1)
    })

    it('sets agentStatus to done when moving to in-review and agent is running', async () => {
      const task = makeTask({ id: 'tsk_mvr', status: 'in-progress', sortOrder: 0, agentStatus: 'running' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().moveTask('tsk_mvr', 'in-review', 0)

      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.agentStatus).toBe('done')
    })

    it('sets agentStatus to done when moving to done and agent is running', async () => {
      const task = makeTask({ id: 'tsk_mvd', status: 'in-progress', sortOrder: 0, agentStatus: 'running' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().moveTask('tsk_mvd', 'done', 0)

      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.agentStatus).toBe('done')
    })

    it('does not change agentStatus when moving to done if agent is idle', async () => {
      const task = makeTask({ id: 'tsk_mvi', status: 'in-progress', sortOrder: 0, agentStatus: 'idle' })
      const state = makeProjectState([task])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().moveTask('tsk_mvi', 'done', 0)

      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.agentStatus).toBe('idle')
    })

    it('throws when project not initialized', async () => {
      await expect(
        useTaskStore.getState().moveTask('tsk_x', 'done', 0)
      ).rejects.toThrow('Project not initialized')
    })
  })

  describe('moveTasks (bulk)', () => {
    it('moves multiple tasks to a new status', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 0 })
      const t2 = makeTask({ id: 'tsk_b', status: 'todo', sortOrder: 1 })
      const t3 = makeTask({ id: 'tsk_c', status: 'in-progress', sortOrder: 0 })
      const state = makeProjectState([t1, t2, t3])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().moveTasks(['tsk_a', 'tsk_b'], 'in-progress', 0)

      const tasks = useTaskStore.getState().projectState!.tasks
      expect(tasks.find((t) => t.id === 'tsk_a')!.status).toBe('in-progress')
      expect(tasks.find((t) => t.id === 'tsk_b')!.status).toBe('in-progress')
      expect(tasks.find((t) => t.id === 'tsk_a')!.sortOrder).toBe(0)
      expect(tasks.find((t) => t.id === 'tsk_b')!.sortOrder).toBe(1)
    })

    it('kills tmux sessions when bulk moving to archived', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'done', sortOrder: 0 })
      const t2 = makeTask({ id: 'tsk_b', status: 'done', sortOrder: 1 })
      const state = makeProjectState([t1, t2])
      useTaskStore.setState({ projectState: state })
      mockApi.tmuxList.mockResolvedValue(['familiar-tsk_a-0', 'familiar-tsk_b-0'])
      mockApi.tmuxKill.mockResolvedValue(undefined)
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().moveTasks(['tsk_a', 'tsk_b'], 'archived', 0)

      expect(mockApi.tmuxKill).toHaveBeenCalledWith('familiar-tsk_a-0')
      expect(mockApi.tmuxKill).toHaveBeenCalledWith('familiar-tsk_b-0')
    })

    it('sets agentStatus to done when bulk moving to in-review with running agents', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'in-progress', sortOrder: 0, agentStatus: 'running' })
      const t2 = makeTask({ id: 'tsk_b', status: 'in-progress', sortOrder: 1, agentStatus: 'idle' })
      const state = makeProjectState([t1, t2])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().moveTasks(['tsk_a', 'tsk_b'], 'in-review', 0)

      const tasks = useTaskStore.getState().projectState!.tasks
      expect(tasks.find((t) => t.id === 'tsk_a')!.agentStatus).toBe('done')
      expect(tasks.find((t) => t.id === 'tsk_b')!.agentStatus).toBe('idle') // was idle, stays idle
    })

    it('throws when project not initialized', async () => {
      await expect(
        useTaskStore.getState().moveTasks(['tsk_x'], 'done', 0)
      ).rejects.toThrow('Project not initialized')
    })

    it('ignores non-existent task ids', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 0 })
      const state = makeProjectState([t1])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().moveTasks(['tsk_a', 'tsk_nonexistent'], 'done', 0)

      const tasks = useTaskStore.getState().projectState!.tasks
      expect(tasks.find((t) => t.id === 'tsk_a')!.status).toBe('done')
    })
  })

  describe('setTasksPriority', () => {
    it('sets priority for multiple tasks at once', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 0, priority: 'none' })
      const t2 = makeTask({ id: 'tsk_b', status: 'todo', sortOrder: 1, priority: 'low' })
      const t3 = makeTask({ id: 'tsk_c', status: 'in-progress', sortOrder: 0, priority: 'none' })
      const state = makeProjectState([t1, t2, t3])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().setTasksPriority(['tsk_a', 'tsk_b'], 'high')

      const tasks = useTaskStore.getState().projectState!.tasks
      expect(tasks.find((t) => t.id === 'tsk_a')!.priority).toBe('high')
      expect(tasks.find((t) => t.id === 'tsk_b')!.priority).toBe('high')
      expect(tasks.find((t) => t.id === 'tsk_c')!.priority).toBe('none') // untouched
    })

    it('persists each updated task via API', async () => {
      const t1 = makeTask({ id: 'tsk_a', priority: 'none' })
      const t2 = makeTask({ id: 'tsk_b', priority: 'none' })
      const state = makeProjectState([t1, t2])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().setTasksPriority(['tsk_a', 'tsk_b'], 'urgent')

      expect(mockApi.updateTask).toHaveBeenCalledTimes(2)
      expect(mockApi.writeProjectState).toHaveBeenCalledTimes(1)
    })

    it('updates the updatedAt timestamp on affected tasks', async () => {
      const t1 = makeTask({ id: 'tsk_a', updatedAt: '2020-01-01T00:00:00.000Z' })
      const state = makeProjectState([t1])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().setTasksPriority(['tsk_a'], 'medium')

      const stored = useTaskStore.getState().projectState!.tasks[0]
      expect(stored.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
    })

    it('throws when project not initialized', async () => {
      await expect(
        useTaskStore.getState().setTasksPriority(['tsk_x'], 'high')
      ).rejects.toThrow('Project not initialized')
    })
  })

  describe('archiveAllDone', () => {
    it('archives all done tasks', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'done', sortOrder: 0, agentStatus: 'running' })
      const t2 = makeTask({ id: 'tsk_b', status: 'done', sortOrder: 1 })
      const t3 = makeTask({ id: 'tsk_c', status: 'todo', sortOrder: 0 })
      const state = makeProjectState([t1, t2, t3])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().archiveAllDone()

      const tasks = useTaskStore.getState().projectState!.tasks
      expect(tasks.find((t) => t.id === 'tsk_a')!.status).toBe('archived')
      expect(tasks.find((t) => t.id === 'tsk_a')!.agentStatus).toBe('idle')
      expect(tasks.find((t) => t.id === 'tsk_b')!.status).toBe('archived')
      expect(tasks.find((t) => t.id === 'tsk_c')!.status).toBe('todo')
    })

    it('does nothing when no done tasks exist', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 0 })
      const state = makeProjectState([t1])
      useTaskStore.setState({ projectState: state })

      await useTaskStore.getState().archiveAllDone()

      expect(mockApi.writeProjectState).not.toHaveBeenCalled()
    })

    it('throws when project not initialized', async () => {
      await expect(
        useTaskStore.getState().archiveAllDone()
      ).rejects.toThrow('Project not initialized')
    })

    it('kills tmux sessions for all done tasks', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'done', sortOrder: 0 })
      const state = makeProjectState([t1])
      useTaskStore.setState({ projectState: state })
      mockApi.tmuxList.mockResolvedValue(['familiar-tsk_a-0'])
      mockApi.tmuxKill.mockResolvedValue(undefined)
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().archiveAllDone()

      expect(mockApi.tmuxKill).toHaveBeenCalledWith('familiar-tsk_a-0')
    })
  })

  describe('reorderTask', () => {
    it('reorders a task within the same column', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 0 })
      const t2 = makeTask({ id: 'tsk_b', status: 'todo', sortOrder: 1 })
      const t3 = makeTask({ id: 'tsk_c', status: 'todo', sortOrder: 2 })
      const state = makeProjectState([t1, t2, t3])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      // Move tsk_a from index 0 to index 2
      await useTaskStore.getState().reorderTask('tsk_a', 2)

      const tasks = useTaskStore.getState().projectState!.tasks
      expect(tasks.find((t) => t.id === 'tsk_b')!.sortOrder).toBe(0)
      expect(tasks.find((t) => t.id === 'tsk_c')!.sortOrder).toBe(1)
      expect(tasks.find((t) => t.id === 'tsk_a')!.sortOrder).toBe(2)
    })

    it('clamps to end of column when index exceeds length', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 0 })
      const t2 = makeTask({ id: 'tsk_b', status: 'todo', sortOrder: 1 })
      const state = makeProjectState([t1, t2])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      await useTaskStore.getState().reorderTask('tsk_a', 999)

      const tasks = useTaskStore.getState().projectState!.tasks
      expect(tasks.find((t) => t.id === 'tsk_a')!.sortOrder).toBe(1)
      expect(tasks.find((t) => t.id === 'tsk_b')!.sortOrder).toBe(0)
    })

    it('throws when task not found', async () => {
      const state = makeProjectState([])
      useTaskStore.setState({ projectState: state })

      await expect(
        useTaskStore.getState().reorderTask('tsk_nonexistent', 0)
      ).rejects.toThrow('Task tsk_nonexistent not found')
    })

    it('throws when project not initialized', async () => {
      await expect(
        useTaskStore.getState().reorderTask('tsk_x', 0)
      ).rejects.toThrow('Project not initialized')
    })

    it('keeps card in place when reordered to its current position', async () => {
      const t1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 0 })
      const t2 = makeTask({ id: 'tsk_b', status: 'todo', sortOrder: 1 })
      const t3 = makeTask({ id: 'tsk_c', status: 'todo', sortOrder: 2 })
      const state = makeProjectState([t1, t2, t3])
      useTaskStore.setState({ projectState: state })
      mockApi.updateTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      // Reorder tsk_b to index 1 (its current position in the filtered list)
      await useTaskStore.getState().reorderTask('tsk_b', 1)

      const tasks = useTaskStore.getState().projectState!.tasks
      expect(tasks.find((t) => t.id === 'tsk_a')!.sortOrder).toBe(0)
      expect(tasks.find((t) => t.id === 'tsk_b')!.sortOrder).toBe(1)
      expect(tasks.find((t) => t.id === 'tsk_c')!.sortOrder).toBe(2)
    })
  })

  describe('updateProjectLabels', () => {
    it('updates labels in project state', async () => {
      const state = makeProjectState()
      useTaskStore.setState({ projectState: state })
      mockApi.writeProjectState.mockResolvedValue(undefined)

      const labels = [
        { name: 'bug', color: '#ff0000' },
        { name: 'feature', color: '#00ff00' }
      ]
      await useTaskStore.getState().updateProjectLabels(labels)

      expect(useTaskStore.getState().projectState!.labels).toEqual(labels)
      expect(mockApi.writeProjectState).toHaveBeenCalled()
    })

    it('does nothing when project not initialized', async () => {
      await useTaskStore.getState().updateProjectLabels([{ name: 'test', color: '#000' }])
      expect(mockApi.writeProjectState).not.toHaveBeenCalled()
    })
  })

  describe('initProject', () => {
    it('initializes a project and sets state', async () => {
      const newState = makeProjectState()
      mockApi.initProject.mockResolvedValue(newState)

      await useTaskStore.getState().initProject('My Project')

      expect(mockApi.initProject).toHaveBeenCalledWith('My Project')
      expect(useTaskStore.getState().projectState).toEqual(newState)
      expect(useTaskStore.getState().isLoading).toBe(false)
    })

    it('sets error when initProject fails', async () => {
      mockApi.initProject.mockRejectedValue(new Error('Init failed'))

      await useTaskStore.getState().initProject('Fail')

      expect(useTaskStore.getState().error).toBe('Init failed')
      expect(useTaskStore.getState().isLoading).toBe(false)
    })
  })

  describe('openWorkspace', () => {
    it('returns false when user cancels directory selection', async () => {
      mockApi.openDirectory.mockResolvedValue(null)

      const result = await useTaskStore.getState().openWorkspace()

      expect(result).toBe(false)
    })

    it('loads existing project when .familiar/ exists', async () => {
      const existingState = makeProjectState()
      mockApi.openDirectory.mockResolvedValue('/path/to/project')
      mockApi.setProjectRoot.mockResolvedValue(undefined)
      mockApi.isInitialized.mockResolvedValue(true)
      mockApi.readProjectState.mockResolvedValue(existingState)

      const result = await useTaskStore.getState().openWorkspace()

      expect(result).toBe(true)
      expect(mockApi.setProjectRoot).toHaveBeenCalledWith('/path/to/project')
      expect(useTaskStore.getState().projectState).toEqual(existingState)
    })

    it('initializes new project when .familiar/ does not exist', async () => {
      const newState = makeProjectState()
      mockApi.openDirectory.mockResolvedValue('/path/to/my-project')
      mockApi.setProjectRoot.mockResolvedValue(undefined)
      mockApi.isInitialized.mockResolvedValue(false)
      mockApi.initProject.mockResolvedValue(newState)

      const result = await useTaskStore.getState().openWorkspace()

      expect(result).toBe(true)
      expect(mockApi.initProject).toHaveBeenCalledWith('my-project')
      expect(useTaskStore.getState().projectState).toEqual(newState)
    })

    it('sets error and returns false on failure', async () => {
      mockApi.openDirectory.mockRejectedValue(new Error('Permission denied'))

      const result = await useTaskStore.getState().openWorkspace()

      expect(result).toBe(false)
      expect(useTaskStore.getState().error).toBe('Permission denied')
    })
  })

  describe('loadProjectState - additional coverage', () => {
    it('does not show loading spinner on refresh when state already exists', async () => {
      const existing = makeProjectState()
      useTaskStore.setState({ projectState: existing })
      mockApi.isInitialized.mockResolvedValue(true)
      const newState = makeProjectState([makeTask()])
      mockApi.readProjectState.mockResolvedValue(newState)

      // We cannot easily observe transient isLoading=true in a sync test,
      // but we can verify it stays false when existing state is present
      await useTaskStore.getState().loadProjectState()

      expect(useTaskStore.getState().projectState).toEqual(newState)
      expect(useTaskStore.getState().isLoading).toBe(false)
    })
  })
})
