import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTaskStore } from '@renderer/stores/task-store'
import type { ProjectState, Task } from '@shared/types'

// Mock window.api
const mockApi = {
  isInitialized: vi.fn(),
  readProjectState: vi.fn(),
  initProject: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  writeProjectState: vi.fn()
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

    it('calculates sort order based on existing tasks in column', async () => {
      const existing = makeTask({ status: 'todo', sortOrder: 5 })
      const state = makeProjectState([existing])
      useTaskStore.setState({ projectState: state })
      mockApi.createTask.mockResolvedValue(undefined)
      mockApi.writeProjectState.mockResolvedValue(undefined)

      const task = await useTaskStore.getState().addTask('Another task')
      expect(task.sortOrder).toBe(6)
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
})
