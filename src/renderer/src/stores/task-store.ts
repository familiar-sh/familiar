import { create } from 'zustand'
import type { ProjectState, Task, TaskStatus, Priority, LabelConfig, ActivityEntry } from '@shared/types'
import { useNotificationStore } from './notification-store'

// Generation counter for loadProjectState(). Only the most recent call
// applies its result. This prevents file-watcher reloads from overwriting
// data loaded during a deliberate project switch.
let loadGeneration = 0

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
  addTask: (title: string, options?: Partial<Task>, skipWarmup?: boolean) => Promise<Task>
  createSubtask: (parentId: string, title: string, options?: { copySession?: boolean; documentContent?: string }) => Promise<Task>
  updateTask: (task: Task) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  deleteTasks: (taskIds: string[]) => Promise<void>
  moveTask: (taskId: string, newStatus: TaskStatus, newSortOrder: number) => Promise<void>
  reorderTask: (taskId: string, newSortOrder: number) => Promise<void>

  // Bulk actions
  moveTasks: (taskIds: string[], newStatus: TaskStatus, startIndex: number) => Promise<void>
  setTasksPriority: (taskIds: string[], priority: Priority) => Promise<void>
  archiveAllDone: () => Promise<void>

  // Labels
  updateProjectLabels: (labels: LabelConfig[]) => Promise<void>

  // Helpers
  getTasksByStatus: (status: TaskStatus) => Task[]
  getTaskById: (taskId: string) => Task | undefined
}

async function killTmuxSessionsForTask(taskId: string): Promise<void> {
  try {
    const sessions = await window.api.tmuxList()
    const taskSessions = sessions.filter((s) => s.startsWith(`familiar-${taskId}`))
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
    const { projectState: existing } = get()
    // Only show loading spinner on initial load — not when refreshing
    // existing data (e.g. file-watcher reload). Flashing isLoading unmounts
    // the board columns and destroys any in-progress input state.
    if (!existing) {
      set({ isLoading: true, error: null })
    }
    // Capture a generation token so overlapping calls (e.g. file-watcher
    // reload racing against a project switch) don't overwrite newer data.
    const gen = ++loadGeneration
    try {
      const initialized = await window.api.isInitialized()
      if (gen !== loadGeneration) return // superseded by a newer call
      if (!initialized) {
        set({ projectState: null, isLoading: false })
        return
      }
      const state = await window.api.readProjectState()
      if (gen !== loadGeneration) return // superseded by a newer call
      set({ projectState: state, isLoading: false })
    } catch (err) {
      if (gen !== loadGeneration) return // superseded by a newer call
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

      // Check if the folder already has .familiar/
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
  addTask: async (title: string, options?: Partial<Task>, skipWarmup?: boolean): Promise<Task> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const now = new Date().toISOString()
    const targetStatus = options?.status ?? 'todo'

    // Shift existing tasks in the target column down to make room at the top
    const shiftedTasks = projectState.tasks.map((t: Task) =>
      t.status === targetStatus ? { ...t, sortOrder: t.sortOrder + 1 } : t
    )

    const task: Task = {
      id: generateTaskId(),
      title,
      status: 'todo',
      priority: 'none',
      labels: [],
      agentStatus: 'idle',
      createdAt: now,
      updatedAt: now,
      statusChangedAt: now,
      sortOrder: 0,
      ...options
    }

    // Persist task files
    await window.api.createTask(task)

    // Update project state
    const newState: ProjectState = {
      ...projectState,
      tasks: [...shiftedTasks, task]
    }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })

    // Warm up tmux session for non-archived tasks (fire-and-forget).
    // skipWarmup is used by createSubtask when copySession=true — it needs to
    // copy the Claude session file before the tmux session is created.
    if (task.status !== 'archived' && !skipWarmup) {
      window.api.warmupTmuxSession(task.id).catch(() => {
        // Warmup failure is non-critical — terminal will create session on open
      })
    }

    return task
  },

  createSubtask: async (parentId: string, title: string, options?: { copySession?: boolean; documentContent?: string }): Promise<Task> => {
    const { projectState, addTask, updateTask: storeUpdateTask } = get()
    if (!projectState) throw new Error('Project not initialized')

    const parent = projectState.tasks.find((t: Task) => t.id === parentId)
    if (!parent) throw new Error(`Parent task not found: ${parentId}`)

    // Create the child task with parentTaskId set.
    // Skip warmup if we need to copy the session first (session file must exist before tmux starts).
    const child = await addTask(title, { parentTaskId: parentId }, !!options?.copySession)

    // Write document content if provided
    if (options?.documentContent) {
      await window.api.writeTaskDocument(child.id, options.documentContent)
    }

    // Warm up tmux — with session copy if requested.
    // This must happen after addTask (so we know the child ID) but the warmup
    // handler copies the session file before creating the tmux session.
    if (child.status !== 'archived') {
      window.api.warmupTmuxSession(child.id, options?.copySession ? parentId : undefined).catch(() => {})
    }

    // Update parent's subtaskIds array
    const freshParent = get().projectState?.tasks.find((t: Task) => t.id === parentId)
    if (freshParent) {
      const updatedParent = {
        ...freshParent,
        subtaskIds: [...(freshParent.subtaskIds ?? []), child.id]
      }
      await storeUpdateTask(updatedParent)
    }

    // Log activity on both tasks
    const now = new Date().toISOString()
    const parentActivity: ActivityEntry = {
      id: `act_${Date.now()}_p`,
      timestamp: now,
      type: 'status_change',
      message: `Created subtask ${child.id}`
    }
    const childActivity: ActivityEntry = {
      id: `act_${Date.now()}_c`,
      timestamp: now,
      type: 'status_change',
      message: `Subtask created from ${parentId}`
    }
    await window.api.appendActivity(parentId, parentActivity)
    await window.api.appendActivity(child.id, childActivity)

    return child
  },

  updateTask: async (task: Task): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const now = new Date().toISOString()
    const updatedTask = { ...task, updatedAt: now }

    // Kill tmux sessions and reset agent status when archiving
    if (updatedTask.status === 'archived') {
      await killTmuxSessionsForTask(updatedTask.id)
      updatedTask.agentStatus = 'idle'
    }

    // Auto-set agent status to done when moving to in-review or done
    if (updatedTask.status === 'in-review' || updatedTask.status === 'done') {
      if (updatedTask.agentStatus === 'running') {
        updatedTask.agentStatus = 'done'
      }
    }

    // Detect status change — move task to top of new column
    const oldTask = projectState.tasks.find((t: Task) => t.id === updatedTask.id)
    const statusChanged = oldTask && oldTask.status !== updatedTask.status

    if (statusChanged) {
      updatedTask.statusChangedAt = now
    }

    let newTasks: Task[]
    if (statusChanged) {
      // Place task at top of new column (sortOrder 0), shift others down
      updatedTask.sortOrder = 0
      newTasks = projectState.tasks.map((t: Task) => {
        if (t.id === updatedTask.id) return updatedTask
        // Shift existing tasks in the new column down
        if (t.status === updatedTask.status) {
          return { ...t, sortOrder: t.sortOrder + 1, updatedAt: now }
        }
        return t
      })

      // Re-index the old column to close the gap
      const oldColumnTasks = newTasks
        .filter((t: Task) => t.status === oldTask.status && t.id !== updatedTask.id)
        .sort((a: Task, b: Task) => a.sortOrder - b.sortOrder)
      for (let i = 0; i < oldColumnTasks.length; i++) {
        const t = newTasks.find((nt: Task) => nt.id === oldColumnTasks[i].id)!
        if (t.sortOrder !== i) {
          Object.assign(t, { sortOrder: i, updatedAt: now })
        }
      }
    } else {
      newTasks = projectState.tasks.map((t: Task) => (t.id === updatedTask.id ? updatedTask : t))
    }

    // Persist task file
    await window.api.updateTask(updatedTask)

    // Update project state
    const newState: ProjectState = { ...projectState, tasks: newTasks }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  deleteTask: async (taskId: string): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    // Kill tmux sessions before deleting
    await killTmuxSessionsForTask(taskId)

    const deletedTask = projectState.tasks.find((t: Task) => t.id === taskId)

    // If this is a subtask, remove it from the parent's subtaskIds array
    if (deletedTask?.parentTaskId) {
      const parent = projectState.tasks.find((t: Task) => t.id === deletedTask.parentTaskId)
      if (parent && parent.subtaskIds) {
        const updatedParent = { ...parent, subtaskIds: parent.subtaskIds.filter((id) => id !== taskId) }
        await window.api.updateTask(updatedParent)
        const idx = projectState.tasks.indexOf(parent)
        if (idx !== -1) projectState.tasks[idx] = updatedParent
      }
    }

    // If this is a parent task, orphan all subtasks (clear their parentTaskId)
    if (deletedTask?.subtaskIds && deletedTask.subtaskIds.length > 0) {
      for (const subtaskId of deletedTask.subtaskIds) {
        const subtask = projectState.tasks.find((t: Task) => t.id === subtaskId)
        if (subtask) {
          const orphaned = { ...subtask, parentTaskId: undefined }
          await window.api.updateTask(orphaned)
          const idx = projectState.tasks.indexOf(subtask)
          if (idx !== -1) projectState.tasks[idx] = orphaned
        }
      }
    }

    // Delete task files
    await window.api.deleteTask(taskId)

    // Update project state
    const newTasks = projectState.tasks.filter((t: Task) => t.id !== taskId)
    const newState: ProjectState = { ...projectState, tasks: newTasks }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  deleteTasks: async (taskIds: string[]): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const idSet = new Set(taskIds)

    // Clean up parent subtaskIds arrays for subtasks being deleted
    for (const taskId of taskIds) {
      const deletedTask = projectState.tasks.find((t: Task) => t.id === taskId)
      if (deletedTask?.parentTaskId && !idSet.has(deletedTask.parentTaskId)) {
        const parent = projectState.tasks.find((t: Task) => t.id === deletedTask.parentTaskId)
        if (parent && parent.subtaskIds) {
          const updatedParent = { ...parent, subtaskIds: parent.subtaskIds.filter((id) => !idSet.has(id)) }
          await window.api.updateTask(updatedParent)
          const idx = projectState.tasks.indexOf(parent)
          if (idx !== -1) projectState.tasks[idx] = updatedParent
        }
      }
    }

    // Orphan subtasks of parent tasks being deleted
    for (const taskId of taskIds) {
      const deletedTask = projectState.tasks.find((t: Task) => t.id === taskId)
      if (deletedTask?.subtaskIds) {
        for (const subtaskId of deletedTask.subtaskIds) {
          if (!idSet.has(subtaskId)) {
            const subtask = projectState.tasks.find((t: Task) => t.id === subtaskId)
            if (subtask) {
              const orphaned = { ...subtask, parentTaskId: undefined }
              await window.api.updateTask(orphaned)
              const idx = projectState.tasks.indexOf(subtask)
              if (idx !== -1) projectState.tasks[idx] = orphaned
            }
          }
        }
      }
    }

    // Kill tmux sessions and delete task files for each
    for (const taskId of taskIds) {
      await killTmuxSessionsForTask(taskId)
      await window.api.deleteTask(taskId)
    }

    // Update project state once with all tasks removed
    const newTasks = projectState.tasks.filter((t: Task) => !idSet.has(t.id))
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
        const update: Partial<Task> = { status: newStatus, sortOrder: clampedIndex, updatedAt: now }
        if (t.status !== newStatus) update.statusChangedAt = now
        return { ...t, ...update }
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
      useNotificationStore.getState().markReadByTaskId(taskId)
    }

    const newState: ProjectState = { ...projectState, tasks: updatedTasks }
    const movedTask = updatedTasks.find((t: Task) => t.id === taskId)!
    if (newStatus === 'archived') {
      movedTask.agentStatus = 'idle'
    }

    // Auto-set agent status to done when moving to in-review or done
    if (newStatus === 'in-review' || newStatus === 'done') {
      if (movedTask.agentStatus === 'running') {
        movedTask.agentStatus = 'done'
      }
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
        const update: Partial<Task> = { status: newStatus, sortOrder: newSort ?? 0, updatedAt: now }
        if (t.status !== newStatus) update.statusChangedAt = now
        return { ...t, ...update }
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
        useNotificationStore.getState().markReadByTaskId(id)
      }
    }

    const newState: ProjectState = { ...projectState, tasks: updatedTasks }

    // Persist each moved task (reset agentStatus if archiving, set done if in-review/done)
    for (const id of taskIds) {
      const updated = updatedTasks.find((t: Task) => t.id === id)
      if (updated) {
        if (newStatus === 'archived') {
          updated.agentStatus = 'idle'
        } else if (newStatus === 'in-review' || newStatus === 'done') {
          if (updated.agentStatus === 'running') {
            updated.agentStatus = 'done'
          }
        }
        await window.api.updateTask(updated)
      }
    }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  setTasksPriority: async (taskIds: string[], priority: Priority): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const idSet = new Set(taskIds)
    const now = new Date().toISOString()

    const updatedTasks = projectState.tasks.map((t: Task) => {
      if (idSet.has(t.id)) {
        return { ...t, priority, updatedAt: now }
      }
      return t
    })

    // Persist each updated task
    for (const id of taskIds) {
      const updated = updatedTasks.find((t: Task) => t.id === id)
      if (updated) {
        await window.api.updateTask(updated)
      }
    }

    const newState: ProjectState = { ...projectState, tasks: updatedTasks }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  archiveAllDone: async (): Promise<void> => {
    const { projectState } = get()
    if (!projectState) throw new Error('Project not initialized')

    const doneTasks = projectState.tasks.filter((t: Task) => t.status === 'done')
    if (doneTasks.length === 0) return

    // Kill tmux sessions and mark notifications as read for all tasks being archived
    for (const task of doneTasks) {
      await killTmuxSessionsForTask(task.id)
      useNotificationStore.getState().markReadByTaskId(task.id)
    }

    const doneIds = new Set(doneTasks.map((t) => t.id))
    const now = new Date().toISOString()

    // Shift existing archived tasks down to make room at the top
    const updatedTasks = projectState.tasks.map((t: Task) => {
      if (doneIds.has(t.id)) {
        return { ...t, status: 'archived' as TaskStatus, agentStatus: 'idle' as const, updatedAt: now, statusChangedAt: now }
      }
      if (t.status === 'archived') {
        return { ...t, sortOrder: t.sortOrder + doneTasks.length, updatedAt: now }
      }
      return t
    })

    // Assign sortOrder 0..n to the newly archived tasks (preserve their relative order)
    const newlyArchived = updatedTasks
      .filter((t: Task) => doneIds.has(t.id))
      .sort((a: Task, b: Task) => a.sortOrder - b.sortOrder)
    for (let i = 0; i < newlyArchived.length; i++) {
      newlyArchived[i].sortOrder = i
    }

    // Re-index the done column (should be empty, but just in case)
    const remainingDone = updatedTasks
      .filter((t: Task) => t.status === 'done' && !doneIds.has(t.id))
      .sort((a: Task, b: Task) => a.sortOrder - b.sortOrder)
    for (let i = 0; i < remainingDone.length; i++) {
      remainingDone[i].sortOrder = i
    }

    const newState: ProjectState = { ...projectState, tasks: updatedTasks }

    // Persist each moved task
    for (const task of updatedTasks) {
      if (task.status === 'archived' && doneIds.has(task.id)) {
        await window.api.updateTask(task)
      }
    }
    await window.api.writeProjectState(newState)
    set({ projectState: newState })
  },

  // Labels
  updateProjectLabels: async (labels: LabelConfig[]): Promise<void> => {
    const { projectState } = get()
    if (!projectState) return
    const newState: ProjectState = { ...projectState, labels }
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
