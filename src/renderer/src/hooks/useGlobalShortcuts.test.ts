import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useGlobalShortcuts } from './useGlobalShortcuts'
import type { TaskStatus } from '@shared/types'

// Mock window.api
const mockApi = {
  isInitialized: vi.fn(),
  readProjectState: vi.fn(),
  initProject: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  writeProjectState: vi.fn().mockResolvedValue(undefined)
}

;(window as any).api = mockApi

const COLUMN_ORDER: TaskStatus[] = ['todo', 'in-progress', 'in-review', 'done', 'archived']

function fireKey(key: string, opts: Partial<KeyboardEvent> = {}): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, ...opts })
  window.dispatchEvent(event)
}

function fireMetaKey(key: string): void {
  fireKey(key, { metaKey: true })
}

describe('useGlobalShortcuts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    useUIStore.setState({
      taskDetailOpen: false,
      activeTaskId: null,
      commandPaletteOpen: false,
      settingsOpen: false,
      sidebarOpen: true
    })

    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'test',
        tasks: [],
        columnOrder: COLUMN_ORDER,
        labels: []
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // --- Cmd+K ---

  it('Cmd+K toggles command palette', () => {
    renderHook(() => useGlobalShortcuts())

    act(() => fireMetaKey('k'))
    expect(useUIStore.getState().commandPaletteOpen).toBe(true)

    act(() => fireMetaKey('k'))
    expect(useUIStore.getState().commandPaletteOpen).toBe(false)
  })

  it('Ctrl+K also toggles command palette', () => {
    renderHook(() => useGlobalShortcuts())

    act(() => fireKey('k', { ctrlKey: true }))
    expect(useUIStore.getState().commandPaletteOpen).toBe(true)
  })

  // --- Cmd+F ---

  it('Cmd+F opens command palette when closed', () => {
    renderHook(() => useGlobalShortcuts())

    act(() => fireMetaKey('f'))
    expect(useUIStore.getState().commandPaletteOpen).toBe(true)
  })

  it('Cmd+F does not close command palette if already open', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    renderHook(() => useGlobalShortcuts())

    act(() => fireMetaKey('f'))
    expect(useUIStore.getState().commandPaletteOpen).toBe(true)
  })

  // --- Cmd+N ---

  it('Cmd+N dispatches focus-new-task-input event', () => {
    const handler = vi.fn()
    window.addEventListener('focus-new-task-input', handler)

    renderHook(() => useGlobalShortcuts())

    act(() => fireMetaKey('n'))

    // The event is dispatched via setTimeout(0)
    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(handler).toHaveBeenCalled()
    window.removeEventListener('focus-new-task-input', handler)
  })

  it('Cmd+N opens create task modal when task detail is open', () => {
    useUIStore.setState({ taskDetailOpen: true, activeTaskId: 'tsk_1' })
    renderHook(() => useGlobalShortcuts())

    act(() => fireMetaKey('n'))

    // Should keep task detail open and show modal instead
    expect(useUIStore.getState().taskDetailOpen).toBe(true)
    expect(useUIStore.getState().createTaskModalOpen).toBe(true)
  })

  it('Cmd+N opens create task modal when settings is open', () => {
    useUIStore.setState({ settingsOpen: true })
    renderHook(() => useGlobalShortcuts())

    act(() => fireMetaKey('n'))

    expect(useUIStore.getState().settingsOpen).toBe(true)
    expect(useUIStore.getState().createTaskModalOpen).toBe(true)
  })

  it('Cmd+N closes command palette before opening modal', () => {
    useUIStore.setState({ taskDetailOpen: true, activeTaskId: 'tsk_1', commandPaletteOpen: true })
    renderHook(() => useGlobalShortcuts())

    act(() => fireMetaKey('n'))

    expect(useUIStore.getState().commandPaletteOpen).toBe(false)
    expect(useUIStore.getState().createTaskModalOpen).toBe(true)
  })

  it('Cmd+N does nothing when no project state', () => {
    useTaskStore.setState({ projectState: null })
    const handler = vi.fn()
    window.addEventListener('focus-new-task-input', handler)

    renderHook(() => useGlobalShortcuts())

    act(() => fireMetaKey('n'))
    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(handler).not.toHaveBeenCalled()
    window.removeEventListener('focus-new-task-input', handler)
  })

  // --- Cmd+, ---

  it('Cmd+, opens settings', () => {
    renderHook(() => useGlobalShortcuts())

    act(() => fireMetaKey(','))
    expect(useUIStore.getState().settingsOpen).toBe(true)
  })

  // --- Escape ---

  it('Escape closes command palette when open', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    renderHook(() => useGlobalShortcuts())

    act(() => fireKey('Escape'))
    expect(useUIStore.getState().commandPaletteOpen).toBe(false)
  })

  it('Escape closes settings when open (and palette closed)', () => {
    useUIStore.setState({ settingsOpen: true, commandPaletteOpen: false })
    renderHook(() => useGlobalShortcuts())

    act(() => fireKey('Escape'))
    expect(useUIStore.getState().settingsOpen).toBe(false)
  })

  it('Escape closes task detail when open (and palette/settings closed)', () => {
    useUIStore.setState({ taskDetailOpen: true, activeTaskId: 'tsk_1', commandPaletteOpen: false, settingsOpen: false })
    renderHook(() => useGlobalShortcuts())

    act(() => fireKey('Escape'))
    expect(useUIStore.getState().taskDetailOpen).toBe(false)
    expect(useUIStore.getState().activeTaskId).toBeNull()
  })

  it('Escape does nothing when input is focused (without Shift)', () => {
    useUIStore.setState({ taskDetailOpen: true, activeTaskId: 'tsk_1' })
    renderHook(() => useGlobalShortcuts())

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    act(() => fireKey('Escape'))

    // Should NOT have closed because input is focused
    expect(useUIStore.getState().taskDetailOpen).toBe(true)
    document.body.removeChild(input)
  })

  // --- Shift+Escape ---

  it('Shift+Escape closes task detail even when input is focused', () => {
    useUIStore.setState({ taskDetailOpen: true, activeTaskId: 'tsk_1' })
    renderHook(() => useGlobalShortcuts())

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    act(() => fireKey('Escape', { shiftKey: true }))

    expect(useUIStore.getState().taskDetailOpen).toBe(false)
    document.body.removeChild(input)
  })

  // --- Priority of Escape closures ---

  it('Escape closes command palette before settings', () => {
    useUIStore.setState({ commandPaletteOpen: true, settingsOpen: true })
    renderHook(() => useGlobalShortcuts())

    act(() => fireKey('Escape'))
    expect(useUIStore.getState().commandPaletteOpen).toBe(false)
    // Settings should still be open
    expect(useUIStore.getState().settingsOpen).toBe(true)
  })

  it('Escape closes settings before task detail', () => {
    useUIStore.setState({ settingsOpen: true, taskDetailOpen: true, activeTaskId: 'tsk_1' })
    renderHook(() => useGlobalShortcuts())

    act(() => fireKey('Escape'))
    expect(useUIStore.getState().settingsOpen).toBe(false)
    // Task detail should still be open
    expect(useUIStore.getState().taskDetailOpen).toBe(true)
  })
})
