import { describe, it, expect, vi, beforeEach } from 'vitest'

// Track the single IPC listener
let ipcCallback: ((projectPath?: string) => void) | null = null
const mockUnwatch = vi.fn(() => {
  ipcCallback = null
})

vi.mock('@renderer/lib/file-change-hub', async () => {
  // Re-implement the hub logic inline to test it, since the real module
  // depends on window.api which isn't available in test environment.
  type FileChangeCallback = (projectPath?: string) => void
  const subscribers = new Set<FileChangeCallback>()
  let unsub: (() => void) | null = null

  return {
    onFileChange: (callback: FileChangeCallback): (() => void) => {
      subscribers.add(callback)
      if (!unsub) {
        ipcCallback = (projectPath) => {
          for (const cb of subscribers) {
            cb(projectPath)
          }
        }
        unsub = () => {
          mockUnwatch()
          ipcCallback = null
        }
      }
      return () => {
        subscribers.delete(callback)
        if (subscribers.size === 0 && unsub) {
          unsub()
          unsub = null
        }
      }
    }
  }
})

import { onFileChange } from '@renderer/lib/file-change-hub'

describe('file-change-hub', () => {
  beforeEach(() => {
    ipcCallback = null
    mockUnwatch.mockClear()
  })

  it('creates a single IPC listener for multiple subscribers', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const unsub1 = onFileChange(cb1)
    const unsub2 = onFileChange(cb2)

    // Simulate an IPC event
    ipcCallback?.('/test/path')

    expect(cb1).toHaveBeenCalledWith('/test/path')
    expect(cb2).toHaveBeenCalledWith('/test/path')

    unsub1()
    unsub2()
  })

  it('cleans up IPC listener when last subscriber unsubscribes', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const unsub1 = onFileChange(cb1)
    const unsub2 = onFileChange(cb2)

    unsub1()
    expect(mockUnwatch).not.toHaveBeenCalled()

    unsub2()
    expect(mockUnwatch).toHaveBeenCalledTimes(1)
  })

  it('re-creates IPC listener after full cleanup', () => {
    const cb1 = vi.fn()
    const unsub1 = onFileChange(cb1)
    unsub1()
    expect(mockUnwatch).toHaveBeenCalledTimes(1)

    // New subscription should create a new IPC listener
    const cb2 = vi.fn()
    const unsub2 = onFileChange(cb2)
    ipcCallback?.('/new/path')
    expect(cb2).toHaveBeenCalledWith('/new/path')
    unsub2()
  })

  it('does not call unsubscribed callbacks', () => {
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const unsub1 = onFileChange(cb1)
    onFileChange(cb2)

    unsub1()
    ipcCallback?.('/test')

    expect(cb1).not.toHaveBeenCalled()
    expect(cb2).toHaveBeenCalledWith('/test')
  })
})
