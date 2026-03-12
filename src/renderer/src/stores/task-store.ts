import { create } from 'zustand'
import type { ProjectState, Task, TaskStatus } from '@shared/types'

interface TaskStore {
  // State
  projectState: ProjectState | null
  isLoading: boolean
  error: string | null

  // Actions
  loadProjectState: () => Promise<void>
  initProject: (name: string) => Promise<void>
  openWorkspace: () => Promise<boolean>

  // Task CRUD
  addTask: (title: string, options?: Partial<Task>) => Promise<Task>
  updateTask: (task: Task) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  moveTask: (taskId: string, newStatus: TaskStatus, newSortOrder: number) => Promise<void>
  reorderTask: (taskId: string, newSortOrder: number) => Promise<void>

  // Bulk actions
  moveTasks: (taskIds: string[], newStatus: TaskStatus, startIndex: number) => Promise<void>
  archiveAllDone: () => Promise<void>

  // Helpers
  getTasksByStatus: (status: TaskStatus) => Task[]
  getTaskById: (taskId: string) => Task | undefined
}

async function killTmuxSessionsForTask(taskId: string): Promise<void> {
  try {
    const sessions = await window.api.tmuxList()
    const taskSessions = sessions.filter((s) => s.startsWith(`kanban-${taskId}`))
    for (const session of taskSessions) {
      await window.api.tmuxKill(session).catch(() => {})
    }
  } catch {
    // tmux may not be available — ignore
  }
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

  openWorkspace: async (): Promise<boolean> => {
    try {
      const selectedPath = await window.api.openDirectory()
      if (!selectedPath) return false

      // Set the new project root in the main process
      await window.api.setProjectRoot(selectedPath)

      // Check if the folder already has .kanban-agent/
      const initialized = await window.api.isInitialized()
      if (initialized) {
        // Load existing project
        set({ isLoading: true, error: null })
        const state = await window.api.readProjectState()
        set({ projectState: state, isLoading: false })
      } else {
        // Initialize a new project using the folder name
        const folderName = selectedPath.split('/').pop() || 'Untitled'
        set({ isLoading: true, error: null })
        const state = await window.api.initProject(folderName)
        set({ projectState: state, isLoading: false })
      }
      return true
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false })
      return false
    }
  },

  // Task CRUD
  addTask: async (title: string, options?: Partial<Task>): Promise<Task> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const now = new Date().toISOString()
    const existingTasks = projectState.tasks.filter(
      (t: Task) => t.status === (options?.status ?? 'todo')
    )
    const maxSort = existingTasks.reduce((max: number, t: Task) => Math.max(max, t.sortOrder), -1)

    const task: Task = {
      id: generateTaskId(),
      title,
      status: 'todo',
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

    // Kill tmux sessions and reset agent status when archiving
    if (updatedTask.status === 'archived') {
      await killTmuxSessionsForTask(updatedTask.id)
      updatedTask.agentStatus = 'idle'
    }

    // Persist task file
    await window.api.updateTask(updatedTask)

    // Update project state
    const newTasks = projectState.tasks.map((t: Task) => (t.id === updatedTask.id ? updatedTask : t))
    const newState: ProjectState = { ...projectState, tasks: newTasks }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  deleteTask: async (taskId: string): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    // Kill tmux sessions before deleting
    await killTmuxSessionsForTask(taskId)

    // Delete task files
    await window.api.deleteTask(taskId)

    // Update project state
    const newTasks = projectState.tasks.filter((t: Task) => t.id !== taskId)
    const newState: ProjectState = { ...projectState, tasks: newTasks }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  moveTask: async (
    taskId: string,
    newStatus: TaskStatus,
    newIndex: number
  ): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const task = projectState.tasks.find((t: Task) => t.id === taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)

    // Get sorted tasks in the target column (excluding the moved task)
    const targetColumnTasks = projectState.tasks
      .filter((t: Task) => t.status === newStatus && t.id !== taskId)
      .sort((a: Task, b: Task) => a.sortOrder - b.sortOrder)

    // Insert the moved task at the target index
    const clampedIndex = Math.min(newIndex, targetColumnTasks.length)
    targetColumnTasks.splice(clampedIndex, 0, task)

    // Build a map of new sort orders for the target column
    const sortUpdates = new Map<string, number>()
    for (let i = 0; i < targetColumnTasks.length; i++) {
      sortUpdates.set(targetColumnTasks[i].id, i)
    }

    // Also re-index the source column (the moved task is leaving it)
    if (task.status !== newStatus) {
      const sourceColumnTasks = projectState.tasks
        .filter((t: Task) => t.status === task.status && t.id !== taskId)
        .sort((a: Task, b: Task) => a.sortOrder - b.sortOrder)
      for (let i = 0; i < sourceColumnTasks.length; i++) {
        sortUpdates.set(sourceColumnTasks[i].id, i)
      }
    }

    const now = new Date().toISOString()
    const updatedTasks = projectState.tasks.map((t: Task) => {
      if (t.id === taskId) {
        return { ...t, status: newStatus, sortOrder: clampedIndex, updatedAt: now }
      }
      const newSort = sortUpdates.get(t.id)
      if (newSort !== undefined && newSort !== t.sortOrder) {
        return { ...t, sortOrder: newSort, updatedAt: now }
      }
      return t
    })

    // Kill tmux sessions and reset agent status when archiving
    if (newStatus === 'archived') {
      await killTmuxSessionsForTask(taskId)
    }

    const newState: ProjectState = { ...projectState, tasks: updatedTasks }
    const movedTask = updatedTasks.find((t: Task) => t.id === taskId)!
    if (newStatus === 'archived') {
      movedTask.agentStatus = 'idle'
    }
    await window.api.updateTask(movedTask)
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  reorderTask: async (taskId: string, newIndex: number): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const task = projectState.tasks.find((t: Task) => t.id === taskId)
    if (!task) throw new Error(`Task ${taskId} not found`)

    // Get sorted tasks in the same column, remove the task, reinsert at new position
    const columnTasks = projectState.tasks
      .filter((t: Task) => t.status === task.status)
      .sort((a: Task, b: Task) => a.sortOrder - b.sortOrder)

    const filtered = columnTasks.filter((t) => t.id !== taskId)
    const clampedIndex = Math.min(newIndex, filtered.length)
    filtered.splice(clampedIndex, 0, task)

    // Build a map of new sort orders
    const sortUpdates = new Map<string, number>()
    for (let i = 0; i < filtered.length; i++) {
      sortUpdates.set(filtered[i].id, i)
    }

    const now = new Date().toISOString()
    const updatedTasks = projectState.tasks.map((t: Task) => {
      const newSort = sortUpdates.get(t.id)
      if (newSort !== undefined && newSort !== t.sortOrder) {
        return { ...t, sortOrder: newSort, updatedAt: now }
      }
      return t
    })

    const newState: ProjectState = { ...projectState, tasks: updatedTasks }
    const reorderedTask = updatedTasks.find((t: Task) => t.id === taskId)!
    await window.api.updateTask(reorderedTask)
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  // Bulk actions
  moveTasks: async (
    taskIds: string[],
    newStatus: TaskStatus,
    startIndex: number
  ): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const taskIdSet = new Set(taskIds)

    // Get target column tasks excluding the ones being moved
    const targetColumnTasks = projectState.tasks
      .filter((t: Task) => t.status === newStatus && !taskIdSet.has(t.id))
      .sort((a: Task, b: Task) => a.sortOrder - b.sortOrder)

    // Insert moved tasks at the target index
    const clampedIndex = Math.min(startIndex, targetColumnTasks.length)
    const movedTasks = taskIds
      .map((id) => projectState.tasks.find((t: Task) => t.id === id))
      .filter((t): t is Task => t !== undefined)
    targetColumnTasks.splice(clampedIndex, 0, ...movedTasks)

    // Build sort updates for the target column
    const sortUpdates = new Map<string, number>()
    for (let i = 0; i < targetColumnTasks.length; i++) {
      sortUpdates.set(targetColumnTasks[i].id, i)
    }

    // Re-index source columns (each moved task may come from a different column)
    const sourceStatuses = new Set(movedTasks.map((t) => t.status))
    for (const srcStatus of sourceStatuses) {
      if (srcStatus === newStatus) continue
      const srcTasks = projectState.tasks
        .filter((t: Task) => t.status === srcStatus && !taskIdSet.has(t.id))
        .sort((a: Task, b: Task) => a.sortOrder - b.sortOrder)
      for (let i = 0; i < srcTasks.length; i++) {
        sortUpdates.set(srcTasks[i].id, i)
      }
    }

    const now = new Date().toISOString()
    const updatedTasks = projectState.tasks.map((t: Task) => {
      if (taskIdSet.has(t.id)) {
        const newSort = sortUpdates.get(t.id)
        return { ...t, status: newStatus, sortOrder: newSort ?? 0, updatedAt: now }
      }
      const newSort = sortUpdates.get(t.id)
      if (newSort !== undefined && newSort !== t.sortOrder) {
        return { ...t, sortOrder: newSort, updatedAt: now }
      }
      return t
    })

    // Kill tmux sessions and reset agent status when archiving
    if (newStatus === 'archived') {
      for (const id of taskIds) {
        await killTmuxSessionsForTask(id)
      }
    }

    const newState: ProjectState = { ...projectState, tasks: updatedTasks }

    // Persist each moved task (reset agentStatus if archiving)
    for (const id of taskIds) {
      const updated = updatedTasks.find((t: Task) => t.id === id)
      if (updated) {
        if (newStatus === 'archived') {
          updated.agentStatus = 'idle'
        }
        await window.api.updateTask(updated)
      }
    }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  archiveAllDone: async (): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const doneTasks = projectState.tasks.filter((t: Task) => t.status === 'done')
    if (doneTasks.length === 0) return

    // Kill tmux sessions for all tasks being archived
    for (const task of doneTasks) {
      await killTmuxSessionsForTask(task.id)
    }

    const now = new Date().toISOString()
    const updatedTasks = projectState.tasks.map((t: Task) => {
      if (t.status === 'done') {
        return { ...t, status: 'archived' as TaskStatus, agentStatus: 'idle' as const, updatedAt: now }
      }
      return t
    })

    const newState: ProjectState = { ...projectState, tasks: updatedTasks }

    // Persist each moved task
    for (const task of updatedTasks) {
      if (task.status === 'archived' && doneTasks.some((d) => d.id === task.id)) {
        await window.api.updateTask(task)
      }
    }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  // Helpers
  getTasksByStatus: (status: TaskStatus): Task[] => {
    const { projectState } = get()
    if (!projectState) return []
    return projectState.tasks
      .filter((t: Task) => t.status === status)
      .sort((a: Task, b: Task) => a.sortOrder - b.sortOrder)
  },

  getTaskById: (taskId: string): Task | undefined => {
    const { projectState } = get()
    if (!projectState) return undefined
    return projectState.tasks.find((t: Task) => t.id === taskId)
  }
}))
