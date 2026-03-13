import { describe, it, expect } from 'vitest'
import { compareSemver } from './update-service'

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
  })

  it('returns 1 when first is greater (major)', () => {
    expect(compareSemver('2.0.0', '1.0.0')).toBe(1)
  })

  it('returns -1 when first is less (major)', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1)
  })

  it('compares minor versions', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBe(1)
    expect(compareSemver('1.1.0', '1.2.0')).toBe(-1)
  })

  it('compares patch versions', () => {
    expect(compareSemver('1.0.2', '1.0.1')).toBe(1)
    expect(compareSemver('1.0.1', '1.0.2')).toBe(-1)
  })

  it('strips v prefix', () => {
    expect(compareSemver('v1.2.0', '1.2.0')).toBe(0)
    expect(compareSemver('v2.0.0', 'v1.0.0')).toBe(1)
  })

  it('handles missing patch version', () => {
    expect(compareSemver('1.0', '1.0.0')).toBe(0)
    expect(compareSemver('1.1', '1.0.1')).toBe(1)
  })
})
