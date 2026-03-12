import { describe, it, expect } from 'vitest'
import {
  DEFAULT_COLUMNS,
  COLUMN_LABELS,
  PRIORITY_ORDER,
  PRIORITY_COLORS
} from '@shared/constants'
import type { TaskStatus, Priority } from '@shared/types'

describe('DEFAULT_COLUMNS', () => {
  it('has all 5 statuses', () => {
    expect(DEFAULT_COLUMNS).toHaveLength(5)
  })

  it('contains all expected status values', () => {
    const expected: TaskStatus[] = ['todo', 'in-progress', 'in-review', 'done', 'archived']
    expect(DEFAULT_COLUMNS).toEqual(expected)
  })
})

describe('COLUMN_LABELS', () => {
  it('maps all 5 statuses to labels', () => {
    const statuses: TaskStatus[] = ['todo', 'in-progress', 'in-review', 'done', 'archived']
    for (const status of statuses) {
      expect(COLUMN_LABELS[status]).toBeDefined()
      expect(typeof COLUMN_LABELS[status]).toBe('string')
      expect(COLUMN_LABELS[status].length).toBeGreaterThan(0)
    }
  })

  it('has the expected label values', () => {
    expect(COLUMN_LABELS['todo']).toBe('Todo')
    expect(COLUMN_LABELS['in-progress']).toBe('In Progress')
    expect(COLUMN_LABELS['in-review']).toBe('In Review')
    expect(COLUMN_LABELS['done']).toBe('Done')
    expect(COLUMN_LABELS['archived']).toBe('Archive')
  })
})

describe('PRIORITY_ORDER', () => {
  it('covers all 5 priorities', () => {
    const priorities: Priority[] = ['urgent', 'high', 'medium', 'low', 'none']
    for (const p of priorities) {
      expect(PRIORITY_ORDER[p]).toBeDefined()
      expect(typeof PRIORITY_ORDER[p]).toBe('number')
    }
  })

  it('urgent has lowest order (highest priority)', () => {
    expect(PRIORITY_ORDER['urgent']).toBeLessThan(PRIORITY_ORDER['high'])
    expect(PRIORITY_ORDER['high']).toBeLessThan(PRIORITY_ORDER['medium'])
    expect(PRIORITY_ORDER['medium']).toBeLessThan(PRIORITY_ORDER['low'])
    expect(PRIORITY_ORDER['low']).toBeLessThan(PRIORITY_ORDER['none'])
  })
})

describe('PRIORITY_COLORS', () => {
  it('covers all 5 priorities', () => {
    const priorities: Priority[] = ['urgent', 'high', 'medium', 'low', 'none']
    for (const p of priorities) {
      expect(PRIORITY_COLORS[p]).toBeDefined()
      expect(typeof PRIORITY_COLORS[p]).toBe('string')
      expect(PRIORITY_COLORS[p].length).toBeGreaterThan(0)
    }
  })

  it('returns hex color strings', () => {
    const priorities: Priority[] = ['urgent', 'high', 'medium', 'low', 'none']
    for (const p of priorities) {
      expect(PRIORITY_COLORS[p]).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })
})
