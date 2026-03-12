import { describe, it, expect } from 'vitest'
import { createTask, filterTasks, sortTasks } from '@shared/utils/task-utils'
import { validateTask } from '@shared/utils/validators'
import type { Task } from '@shared/types'

describe('createTask', () => {
  it('creates a task with default values', () => {
    const task = createTask('My task')
    expect(task.title).toBe('My task')
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('none')
    expect(task.labels).toEqual([])
    expect(task.agentStatus).toBe('idle')
    expect(task.sortOrder).toBe(0)
    expect(task.id).toMatch(/^tsk_/)
    expect(task.createdAt).toBeDefined()
    expect(task.updatedAt).toBeDefined()
  })

  it('creates a task that passes validation', () => {
    const task = createTask('Valid task')
    expect(validateTask(task)).toBe(true)
  })

  it('allows overriding defaults via options', () => {
    const task = createTask('Custom task', {
      status: 'todo',
      priority: 'high',
      labels: ['feature'],
      sortOrder: 5
    })
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('high')
    expect(task.labels).toEqual(['feature'])
    expect(task.sortOrder).toBe(5)
  })
})

function makeTasks(): Task[] {
  const base = {
    agentStatus: 'idle' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
  return [
    {
      id: 'tsk_1',
      title: 'Fix login bug',
      status: 'todo',
      priority: 'high',
      labels: ['bug'],
      sortOrder: 2,
      ...base
    },
    {
      id: 'tsk_2',
      title: 'Add dark mode',
      status: 'in-progress',
      priority: 'medium',
      labels: ['feature'],
      sortOrder: 1,
      ...base
    },
    {
      id: 'tsk_3',
      title: 'Write docs',
      status: 'todo',
      priority: 'low',
      labels: ['docs'],
      sortOrder: 3,
      ...base
    }
  ]
}

describe('filterTasks', () => {
  const tasks = makeTasks()

  it('returns all tasks when no filters', () => {
    expect(filterTasks(tasks, {})).toHaveLength(3)
  })

  it('filters by search term (case-insensitive)', () => {
    const result = filterTasks(tasks, { search: 'fix' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tsk_1')
  })

  it('filters by priority', () => {
    const result = filterTasks(tasks, { priority: ['high'] })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tsk_1')
  })

  it('filters by multiple priorities', () => {
    const result = filterTasks(tasks, { priority: ['high', 'low'] })
    expect(result).toHaveLength(2)
  })

  it('filters by labels', () => {
    const result = filterTasks(tasks, { labels: ['bug'] })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tsk_1')
  })

  it('filters by agent status', () => {
    const result = filterTasks(tasks, { agentStatus: ['idle'] })
    expect(result).toHaveLength(3)
  })

  it('combines multiple filters', () => {
    const result = filterTasks(tasks, { search: 'fix', priority: ['high'] })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tsk_1')
  })

  it('returns empty when no match', () => {
    const result = filterTasks(tasks, { search: 'nonexistent' })
    expect(result).toHaveLength(0)
  })
})

describe('sortTasks', () => {
  it('sorts tasks by sortOrder ascending', () => {
    const tasks = makeTasks()
    const sorted = sortTasks(tasks)
    expect(sorted[0].sortOrder).toBe(1)
    expect(sorted[1].sortOrder).toBe(2)
    expect(sorted[2].sortOrder).toBe(3)
  })

  it('does not mutate the original array', () => {
    const tasks = makeTasks()
    const sorted = sortTasks(tasks)
    expect(sorted).not.toBe(tasks)
    expect(tasks[0].sortOrder).toBe(2) // unchanged
  })
})
