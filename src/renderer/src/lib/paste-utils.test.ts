import { describe, it, expect } from 'vitest'
import { isLargePaste, createPastedFileMeta } from './paste-utils'

describe('isLargePaste', () => {
  it('returns false for short text', () => {
    expect(isLargePaste('hello world')).toBe(false)
  })

  it('returns false for text just under line threshold', () => {
    const text = Array(9).fill('line').join('\n') // 9 lines
    expect(isLargePaste(text)).toBe(false)
  })

  it('returns true for text at line threshold', () => {
    const text = Array(10).fill('line').join('\n') // 10 lines
    expect(isLargePaste(text)).toBe(true)
  })

  it('returns true for text above line threshold', () => {
    const text = Array(20).fill('line').join('\n')
    expect(isLargePaste(text)).toBe(true)
  })

  it('returns true for text at char threshold', () => {
    const text = 'a'.repeat(1000)
    expect(isLargePaste(text)).toBe(true)
  })

  it('returns false for text just under char threshold with few lines', () => {
    const text = 'a'.repeat(999)
    expect(isLargePaste(text)).toBe(false)
  })

  it('returns true for long single line above char threshold', () => {
    const text = 'x'.repeat(1500)
    expect(isLargePaste(text)).toBe(true)
  })
})

describe('createPastedFileMeta', () => {
  it('creates metadata with correct filename format', () => {
    const meta = createPastedFileMeta('Hello world\nLine 2')
    expect(meta.filename).toMatch(/^pasted-\d+\.md$/)
    expect(meta.type).toBe('text')
    expect(meta.lineCount).toBe(2)
    expect(meta.label).toBe('Hello world')
    expect(meta.createdAt).toBeTruthy()
  })

  it('truncates long first lines in label', () => {
    const longLine = 'a'.repeat(100)
    const meta = createPastedFileMeta(longLine + '\nLine 2')
    expect(meta.label.length).toBeLessThanOrEqual(60)
    expect(meta.label).toContain('...')
  })

  it('uses fallback label when first line is empty', () => {
    const meta = createPastedFileMeta('\nLine 2\nLine 3')
    expect(meta.label).toBe('Pasted content')
  })

  it('calculates size correctly', () => {
    const content = 'Hello world'
    const meta = createPastedFileMeta(content)
    expect(meta.size).toBe(new Blob([content]).size)
  })

  it('sets lineCount for text type', () => {
    const meta = createPastedFileMeta('L1\nL2\nL3\nL4\nL5')
    expect(meta.lineCount).toBe(5)
  })

  it('does not set lineCount for image type', () => {
    const meta = createPastedFileMeta('data', 'image')
    expect(meta.lineCount).toBeUndefined()
  })
})
