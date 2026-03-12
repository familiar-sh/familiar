import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useBoardStore } from '@renderer/stores/board-store'
import { useKeyboardNavigation } from './useKeyboardNavigation'
import type { Task, TaskStatus } from '@shared/types'

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
;(window as any).confirm = vi.fn().mockReturnValue(true)

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_test01',
    title: 'Test task',
    status: 'todo',
    priority: 'none',
    labels: [],
    agentStatus: 'idle',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    sortOrder: 0,
    ...overrides
  }
}

const COLUMN_ORDER: TaskStatus[] = ['todo', 'in-progress', 'in-review', 'done', 'archived']

function fireKey(key: string): void {
  const event = new KeyboardEvent('keydown', { key, bubbles: true })
  window.dispatchEvent(event)
}

describe('useKeyboardNavigation', () => {
  const task1 = makeTask({ id: 'tsk_a', status: 'todo', sortOrder: 0 })
  const task2 = makeTask({ id: 'tsk_b', status: 'todo', sortOrder: 1 })
  const task3 = makeTask({ id: 'tsk_c', status: 'in-progress', sortOrder: 0 })

  const tasksByStatus: Record<string, Task[]> = {
    todo: [task1, task2],
    'in-progress': [task3],
    'in-review': [],
    done: [],
    archived: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useUIStore.setState({
      focusedColumnIndex: 0,
      focusedTaskIndex: 0,
      taskDetailOpen: false,
      activeTaskId: null
    })
    useBoardStore.setState({ selectedTaskIds: new Set() })
    // Set up project state so updateTask/deleteTask work
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'test',
        tasks: [task1, task2, task3],
        columnOrder: COLUMN_ORDER,
        labels: []
      }
    })
  })

  afterEach(() => {
    // Clean up by unmounting all hooks (done automatically by renderHook cleanup)
  })

  it('j moves focusedTaskIndex down', () => {
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('j'))
    expect(useUIStore.getState().focusedTaskIndex).toBe(1)
  })

  it('j does not exceed column length', () => {
    useUIStore.setState({ focusedTaskIndex: 1 })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('j'))
    expect(useUIStore.getState().focusedTaskIndex).toBe(1)
  })

  it('k moves focusedTaskIndex up', () => {
    useUIStore.setState({ focusedTaskIndex: 1 })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('k'))
    expect(useUIStore.getState().focusedTaskIndex).toBe(0)
  })

  it('k does not go below 0', () => {
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('k'))
    expect(useUIStore.getState().focusedTaskIndex).toBe(0)
  })

  it('l moves to next column', () => {
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('l'))
    expect(useUIStore.getState().focusedColumnIndex).toBe(1)
    // setFocusedColumn resets task index to 0
    expect(useUIStore.getState().focusedTaskIndex).toBe(0)
  })

  it('h moves to previous column', () => {
    useUIStore.setState({ focusedColumnIndex: 2 })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('h'))
    expect(useUIStore.getState().focusedColumnIndex).toBe(1)
  })

  it('h does not go below 0', () => {
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('h'))
    expect(useUIStore.getState().focusedColumnIndex).toBe(0)
  })

  it('Enter opens task detail for focused task', () => {
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('Enter'))
    expect(useUIStore.getState().activeTaskId).toBe('tsk_a')
    expect(useUIStore.getState().taskDetailOpen).toBe(true)
  })

  it('Escape closes task detail', () => {
    useUIStore.setState({ taskDetailOpen: true, activeTaskId: 'tsk_a' })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('Escape'))
    expect(useUIStore.getState().taskDetailOpen).toBe(false)
    expect(useUIStore.getState().activeTaskId).toBeNull()
  })

  it('c triggers onCreateTask callback', () => {
    const onCreateTask = vi.fn()
    renderHook(() =>
      useKeyboardNavigation({
        tasksByStatus,
        columnOrder: COLUMN_ORDER,
        onCreateTask
      })
    )

    act(() => fireKey('c'))
    expect(onCreateTask).toHaveBeenCalledWith(0)
  })

  it('1-4 set priority on focused task', async () => {
    mockApi.updateTask.mockResolvedValue(undefined)
    mockApi.writeProjectState.mockResolvedValue(undefined)

    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('1'))
    // Give the async updateTask a tick to resolve
    await vi.waitFor(() => {
      const stored = useTaskStore.getState().projectState!.tasks.find(
        (t) => t.id === 'tsk_a'
      )
      expect(stored?.priority).toBe('urgent')
    })
  })

  // Arrow key navigation (mirrors vim keys)
  it('ArrowDown moves focusedTaskIndex down', () => {
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('ArrowDown'))
    expect(useUIStore.getState().focusedTaskIndex).toBe(1)
  })

  it('ArrowUp moves focusedTaskIndex up', () => {
    useUIStore.setState({ focusedTaskIndex: 1 })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('ArrowUp'))
    expect(useUIStore.getState().focusedTaskIndex).toBe(0)
  })

  it('ArrowRight moves to next column', () => {
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('ArrowRight'))
    expect(useUIStore.getState().focusedColumnIndex).toBe(1)
    expect(useUIStore.getState().focusedTaskIndex).toBe(0)
  })

  it('ArrowLeft moves to previous column', () => {
    useUIStore.setState({ focusedColumnIndex: 2 })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('ArrowLeft'))
    expect(useUIStore.getState().focusedColumnIndex).toBe(1)
  })

  it('does not process navigation keys when task detail is open', () => {
    useUIStore.setState({ taskDetailOpen: true, activeTaskId: 'tsk_a' })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('j'))
    expect(useUIStore.getState().focusedTaskIndex).toBe(0)

    act(() => fireKey('ArrowDown'))
    expect(useUIStore.getState().focusedTaskIndex).toBe(0)

    act(() => fireKey('l'))
    expect(useUIStore.getState().focusedColumnIndex).toBe(0)

    act(() => fireKey('ArrowRight'))
    expect(useUIStore.getState().focusedColumnIndex).toBe(0)
  })

  it('Escape still works when task detail is open', () => {
    useUIStore.setState({ taskDetailOpen: true, activeTaskId: 'tsk_a' })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('Escape'))
    expect(useUIStore.getState().taskDetailOpen).toBe(false)
  })

  it('does not process create/priority/delete keys when task detail is open', () => {
    const onCreateTask = vi.fn()
    useUIStore.setState({ taskDetailOpen: true, activeTaskId: 'tsk_a' })
    renderHook(() =>
      useKeyboardNavigation({
        tasksByStatus,
        columnOrder: COLUMN_ORDER,
        onCreateTask
      })
    )

    act(() => fireKey('c'))
    expect(onCreateTask).not.toHaveBeenCalled()

    act(() => fireKey('1'))
    // Priority should remain unchanged
    const task = useTaskStore.getState().projectState!.tasks.find(
      (t) => t.id === 'tsk_a'
    )
    expect(task?.priority).toBe('none')
  })

  it('Delete deletes all selected tasks when multi-select is active', async () => {
    useBoardStore.setState({ selectedTaskIds: new Set(['tsk_a', 'tsk_b']) })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('Delete'))
    expect(window.confirm).toHaveBeenCalledWith('Delete 2 selected tasks?')
    await vi.waitFor(() => {
      // deleteTasks calls deleteTask for each id, then updates state once
      expect(mockApi.deleteTask).toHaveBeenCalledWith('tsk_a')
      expect(mockApi.deleteTask).toHaveBeenCalledWith('tsk_b')
      // Both tasks should be removed from state
      const remaining = useTaskStore.getState().projectState!.tasks
      expect(remaining.find((t) => t.id === 'tsk_a')).toBeUndefined()
      expect(remaining.find((t) => t.id === 'tsk_b')).toBeUndefined()
    })
    // Selection should be cleared
    expect(useBoardStore.getState().selectedTaskIds.size).toBe(0)
  })

  it('Delete deletes single selected task with correct message', async () => {
    useBoardStore.setState({ selectedTaskIds: new Set(['tsk_a']) })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('Delete'))
    expect(window.confirm).toHaveBeenCalledWith('Delete 1 selected task?')
    await vi.waitFor(() => {
      expect(mockApi.deleteTask).toHaveBeenCalledWith('tsk_a')
    })
  })

  it('Delete falls back to focused task when no selection', async () => {
    useBoardStore.setState({ selectedTaskIds: new Set() })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('Delete'))
    expect(window.confirm).toHaveBeenCalledWith('Delete task "Test task"?')
    await vi.waitFor(() => {
      expect(mockApi.deleteTask).toHaveBeenCalledWith('tsk_a')
    })
  })

  it('Delete does not delete selected tasks when user cancels confirm', () => {
    ;(window.confirm as any).mockReturnValueOnce(false)
    useBoardStore.setState({ selectedTaskIds: new Set(['tsk_a', 'tsk_b']) })
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    act(() => fireKey('Delete'))
    expect(mockApi.deleteTask).not.toHaveBeenCalled()
    // Selection should remain
    expect(useBoardStore.getState().selectedTaskIds.size).toBe(2)
  })

  it('does not intercept keys when target is an input', () => {
    renderHook(() =>
      useKeyboardNavigation({ tasksByStatus, columnOrder: COLUMN_ORDER })
    )

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    const event = new KeyboardEvent('keydown', { key: 'j', bubbles: true })
    Object.defineProperty(event, 'target', { value: input })
    act(() => window.dispatchEvent(event))

    // Should NOT have changed
    expect(useUIStore.getState().focusedTaskIndex).toBe(0)
    document.body.removeChild(input)
  })
})
