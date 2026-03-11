import type { Task, TaskStatus, Priority, AgentStatus } from '../types'
import { generateTaskId } from './id-generator'

export interface TaskFilters {
  search?: string
  priority?: Priority[]
  labels?: string[]
  agentStatus?: AgentStatus[]
}

export function createTask(title: string, options?: Partial<Task>): Task {
  const now = new Date().toISOString()
  return {
    id: generateTaskId(),
    title,
    status: 'backlog' as TaskStatus,
    priority: 'none' as Priority,
    labels: [],
    agentStatus: 'idle' as AgentStatus,
    createdAt: now,
    updatedAt: now,
    sortOrder: 0,
    ...options
  }
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function filterTasks(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter((task) => {
    if (filters.search) {
      const search = filters.search.toLowerCase()
      if (!task.title.toLowerCase().includes(search)) {
        return false
      }
    }

    if (filters.priority?.length && !filters.priority.includes(task.priority)) {
      return false
    }

    if (filters.labels?.length && !filters.labels.some((l) => task.labels.includes(l))) {
      return false
    }

    if (filters.agentStatus?.length && !filters.agentStatus.includes(task.agentStatus)) {
      return false
    }

    return true
  })
}
