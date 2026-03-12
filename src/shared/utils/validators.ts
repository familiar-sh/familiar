import type { Task, TaskStatus, Priority } from '../types'
import type { ProjectState } from '../types'

const VALID_STATUSES: TaskStatus[] = [
  'todo',
  'in-progress',
  'in-review',
  'done',
  'archived'
]

const VALID_PRIORITIES: Priority[] = ['urgent', 'high', 'medium', 'low', 'none']

export function isValidTaskStatus(status: string): status is TaskStatus {
  return VALID_STATUSES.includes(status as TaskStatus)
}

export function isValidPriority(priority: string): priority is Priority {
  return VALID_PRIORITIES.includes(priority as Priority)
}

export function validateTask(task: unknown): task is Task {
  if (typeof task !== 'object' || task === null) return false
  const t = task as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.status === 'string' &&
    isValidTaskStatus(t.status) &&
    typeof t.priority === 'string' &&
    isValidPriority(t.priority) &&
    Array.isArray(t.labels) &&
    typeof t.createdAt === 'string' &&
    typeof t.updatedAt === 'string' &&
    typeof t.sortOrder === 'number'
  )
}

export function validateProjectState(state: unknown): state is ProjectState {
  if (typeof state !== 'object' || state === null) return false
  const s = state as Record<string, unknown>
  return (
    typeof s.version === 'number' &&
    typeof s.projectName === 'string' &&
    Array.isArray(s.tasks) &&
    Array.isArray(s.columnOrder) &&
    Array.isArray(s.labels)
  )
}
