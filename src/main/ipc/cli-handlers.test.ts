import { describe, it, expect } from 'vitest'
import { existsSync, lstatSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { mkdirSync, symlinkSync, unlinkSync, writeFileSync, rmSync } from 'fs'

/**
 * These tests verify the broken symlink detection logic used in cli-handlers.ts.
 *
 * The bug: existsSync() returns false for broken symlinks (it follows the link),
 * so the old code couldn't detect and remove dangling symlinks before creating
 * a new one. The fix uses lstatSync() which detects the symlink entry itself.
 */
describe('broken symlink detection', () => {
  const testDir = join(tmpdir(), 'familiar-cli-test-' + Date.now())

  // Setup test directory
  beforeAll(() => {
    mkdirSync(testDir, { recursive: true })
  })

  afterAll(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('existsSync returns false for broken symlinks', () => {
    const target = join(testDir, 'nonexistent-target')
    const link = join(testDir, 'broken-link')

    // Create a symlink to a non-existent target
    symlinkSync(target, link)

    // existsSync follows the symlink — returns false because target doesn't exist
    expect(existsSync(link)).toBe(false)

    // lstatSync checks the symlink itself — does NOT throw
    expect(() => lstatSync(link)).not.toThrow()
    expect(lstatSync(link).isSymbolicLink()).toBe(true)

    // Cleanup
    unlinkSync(link)
  })

  it('existsSync returns true for valid symlinks', () => {
    const target = join(testDir, 'real-target')
    const link = join(testDir, 'valid-link')

    writeFileSync(target, 'hello')
    symlinkSync(target, link)

    expect(existsSync(link)).toBe(true)
    expect(lstatSync(link).isSymbolicLink()).toBe(true)

    // Cleanup
    unlinkSync(link)
    unlinkSync(target)
  })

  it('lstatSync throws for non-existent paths', () => {
    const noSuchPath = join(testDir, 'does-not-exist')
    expect(() => lstatSync(noSuchPath)).toThrow()
  })

  it('demonstrates the fix pattern: try lstatSync, then unlinkSync', () => {
    const target = join(testDir, 'gone-target')
    const link = join(testDir, 'stale-link')

    // Create broken symlink
    symlinkSync(target, link)
    expect(existsSync(link)).toBe(false) // Old code would skip removal here

    // New pattern: try lstatSync to detect any symlink (broken or valid)
    let removed = false
    try {
      lstatSync(link)
      unlinkSync(link)
      removed = true
    } catch {
      // Path doesn't exist at all
    }

    expect(removed).toBe(true)
    // Now we can safely create a new symlink
    expect(() => lstatSync(link)).toThrow()
  })
})
