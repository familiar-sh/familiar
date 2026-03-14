import { describe, it, expect } from 'vitest'
import { formatRelativeTime, formatDuration } from './format-time'

describe('formatRelativeTime', () => {
  const now = new Date('2026-03-11T12:00:00.000Z')

  it('returns "just now" for timestamps less than a minute ago', () => {
    expect(formatRelativeTime('2026-03-11T11:59:30.000Z', now)).toBe('just now')
  })

  it('returns "just now" for future timestamps', () => {
    expect(formatRelativeTime('2026-03-11T12:05:00.000Z', now)).toBe('just now')
  })

  it('returns minutes ago for recent timestamps', () => {
    expect(formatRelativeTime('2026-03-11T11:55:00.000Z', now)).toBe('5m ago')
  })

  it('returns hours ago', () => {
    expect(formatRelativeTime('2026-03-11T10:00:00.000Z', now)).toBe('2h ago')
  })

  it('returns "yesterday" for one day ago', () => {
    expect(formatRelativeTime('2026-03-10T12:00:00.000Z', now)).toBe('yesterday')
  })

  it('returns days ago for 2-6 days', () => {
    expect(formatRelativeTime('2026-03-08T12:00:00.000Z', now)).toBe('3d ago')
  })

  it('returns short date for older same-year timestamps', () => {
    const result = formatRelativeTime('2026-01-15T12:00:00.000Z', now)
    expect(result).toBe('Jan 15')
  })

  it('returns date with year for different year', () => {
    const result = formatRelativeTime('2025-06-20T12:00:00.000Z', now)
    expect(result).toBe('Jun 20, 2025')
  })

  it('handles edge case at exactly 60 seconds', () => {
    expect(formatRelativeTime('2026-03-11T11:59:00.000Z', now)).toBe('1m ago')
  })

  it('handles edge case at exactly 24 hours', () => {
    expect(formatRelativeTime('2026-03-10T12:00:00.000Z', now)).toBe('yesterday')
  })
})

describe('formatDuration', () => {
  const now = new Date('2026-03-11T12:00:00.000Z')

  it('returns "<1m" for less than a minute', () => {
    expect(formatDuration('2026-03-11T11:59:30.000Z', now)).toBe('<1m')
  })

  it('returns "0m" for future timestamps', () => {
    expect(formatDuration('2026-03-11T12:05:00.000Z', now)).toBe('0m')
  })

  it('returns minutes for less than an hour', () => {
    expect(formatDuration('2026-03-11T11:15:00.000Z', now)).toBe('45m')
  })

  it('returns hours for less than a day', () => {
    expect(formatDuration('2026-03-11T10:00:00.000Z', now)).toBe('2h')
  })

  it('returns days only when no remaining hours', () => {
    expect(formatDuration('2026-03-09T12:00:00.000Z', now)).toBe('2d')
  })

  it('returns days and hours', () => {
    expect(formatDuration('2026-03-10T08:00:00.000Z', now)).toBe('1d 4h')
  })

  it('returns 1m at exactly 60 seconds', () => {
    expect(formatDuration('2026-03-11T11:59:00.000Z', now)).toBe('1m')
  })
})
