import { describe, it, expect } from 'vitest'
import {
  validateTask,
  validateProjectState,
  isValidTaskStatus,
  isValidPriority
} from '@shared/utils/validators'

describe('isValidTaskStatus', () => {
  it('returns true for valid statuses', () => {
    const validStatuses = ['backlog', 'todo', 'in-progress', 'in-review', 'done', 'cancelled']
    for (const status of validStatuses) {
      expect(isValidTaskStatus(status)).toBe(true)
    }
  })

  it('returns false for invalid statuses', () => {
    expect(isValidTaskStatus('invalid')).toBe(false)
    expect(isValidTaskStatus('')).toBe(false)
    expect(isValidTaskStatus('DONE')).toBe(false)
  })
})

describe('isValidPriority', () => {
  it('returns true for valid priorities', () => {
    const validPriorities = ['urgent', 'high', 'medium', 'low', 'none']
    for (const priority of validPriorities) {
      expect(isValidPriority(priority)).toBe(true)
    }
  })

  it('returns false for invalid priorities', () => {
    expect(isValidPriority('critical')).toBe(false)
    expect(isValidPriority('')).toBe(false)
    expect(isValidPriority('HIGH')).toBe(false)
  })
})

describe('validateTask', () => {
  const validTask = {
    id: 'tsk_abc12345',
    title: 'Test task',
    status: 'todo',
    priority: 'medium',
    labels: ['bug'],
    agentStatus: 'idle',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 0
  }

  it('returns true for a valid task', () => {
    expect(validateTask(validTask)).toBe(true)
  })

  it('returns false for null', () => {
    expect(validateTask(null)).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(validateTask('string')).toBe(false)
    expect(validateTask(42)).toBe(false)
  })

  it('returns false when required fields are missing', () => {
    const { title, ...noTitle } = validTask
    expect(validateTask(noTitle)).toBe(false)
  })

  it('returns false for invalid status', () => {
    expect(validateTask({ ...validTask, status: 'invalid' })).toBe(false)
  })

  it('returns false for invalid priority', () => {
    expect(validateTask({ ...validTask, priority: 'critical' })).toBe(false)
  })

  it('returns false when labels is not an array', () => {
    expect(validateTask({ ...validTask, labels: 'bug' })).toBe(false)
  })

  it('returns false when sortOrder is not a number', () => {
    expect(validateTask({ ...validTask, sortOrder: '0' })).toBe(false)
  })
})

describe('validateProjectState', () => {
  const validState = {
    version: 1,
    projectName: 'Test project',
    tasks: [],
    columnOrder: ['backlog', 'todo', 'done'],
    labels: ['bug', 'feature']
  }

  it('returns true for a valid project state', () => {
    expect(validateProjectState(validState)).toBe(true)
  })

  it('returns false for null', () => {
    expect(validateProjectState(null)).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(validateProjectState('string')).toBe(false)
  })

  it('returns false when version is not a number', () => {
    expect(validateProjectState({ ...validState, version: '1' })).toBe(false)
  })

  it('returns false when tasks is not an array', () => {
    expect(validateProjectState({ ...validState, tasks: {} })).toBe(false)
  })

  it('returns false when columnOrder is not an array', () => {
    expect(validateProjectState({ ...validState, columnOrder: 'backlog' })).toBe(false)
  })

  it('returns false when labels is not an array', () => {
    expect(validateProjectState({ ...validState, labels: 'bug' })).toBe(false)
  })
})
