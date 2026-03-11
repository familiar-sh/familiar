import { create } from 'zustand'
import type { ProjectState, Task, TaskStatus, ActivityEntry } from '@shared/types'

interface TaskStore {
  // State
  projectState: ProjectState | null
  isLoading: boolean
  error: string | null

  // Actions
  loadProjectState: () => Promise<void>
  initProject: (name: string) => Promise<void>

  // Task CRUD
  addTask: (title: string, options?: Partial<Task>) => Promise<Task>
  updateTask: (task: Task) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  moveTask: (taskId: string, newStatus: TaskStatus, newSortOrder: number) => Promise<void>
  reorderTask: (taskId: string, newSortOrder: number) => Promise<void>

  // Helpers
  getTasksByStatus: (status: TaskStatus) => Task[]
  getTaskById: (taskId: string) => Task | undefined
}

function generateTaskId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'tsk_'
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  // State
  projectState: null,
  isLoading: false,
  error: null,

  // Actions
  loadProjectState: async (): Promise<void> => {
    set({ isLoading: true, error: null })
    try {
      const initialized = await window.api.isInitialized()
      if (!initialized) {
        set({ projectState: null, isLoading: false })
        return
      }
      const state = await window.api.readProjectState()
      set({ projectState: state, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  initProject: async (name: string): Promise<void> => {
    set({ isLoading: true, error: null })
    try {
      const state = await window.api.initProject(name)
      set({ projectState: state, isLoading: false })
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
    }
  },

  // Task CRUD
  addTask: async (title: string, options?: Partial<Task>): Promise<Task> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const now = new Date().toISOString()
    const existingTasks = projectState.tasks.filter(
      (t) => t.status === (options?.status ?? 'backlog')
    )
    const maxSort = existingTasks.reduce((max, t) => Math.max(max, t.sortOrder), -1)

    const task: Task = {
      id: generateTaskId(),
      title,
      status: 'backlog',
      priority: 'none',
      labels: [],
      agentStatus: 'idle',
      createdAt: now,
      updatedAt: now,
      sortOrder: maxSort + 1,
      ...options
    }

    // Persist task files
    await window.api.createTask(task)

    // Update project state
    const newState: ProjectState = {
      ...projectState,
      tasks: [...projectState.tasks, task]
    }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })

    return task
  },

  updateTask: async (task: Task): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const updatedTask = { ...task, updatedAt: new Date().toISOString() }

    // Persist task file
    await window.api.updateTask(updatedTask)

    // Update project state
    const newTasks = projectState.tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    const newState: ProjectState = { ...projectState, tasks: newTasks }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  deleteTask: async (taskId: string): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    // Delete task files
    await window.api.deleteTask(taskId)

    // Update project state
    const newTasks = projectState.tasks.filter((t) => t.id !== taskId)
    const newState: ProjectState = { ...projectState, tasks: newTasks }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  moveTask: async (
    taskId: string,
    newStatus: TaskStatus,
    newSortOrder: number
  ): Promise<void> => {
    const { projectState, updateTask } = get()
    if (!projectState) throw new Error('Project not initialized')

    const task = projectState.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)

    await updateTask({
      ...task,
      status: newStatus,
      sortOrder: newSortOrder
    })
  },

  reorderTask: async (taskId: string, newSortOrder: number): Promise<void> => {
    const { projectState, updateTask } = get()
    if (!projectState) throw new Error('Project not initialized')

    const task = projectState.tasks.find((t) => t.id === taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)

    await updateTask({
      ...task,
      sortOrder: newSortOrder
    })
  },

  // Helpers
  getTasksByStatus: (status: TaskStatus): Task[] => {
    const { projectState } = get()
    if (!projectState) return []
    return projectState.tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  },

  getTaskById: (taskId: string): Task | undefined => {
    const { projectState } = get()
    if (!projectState) return undefined
    return projectState.tasks.find((t) => t.id === taskId)
  }
}))
