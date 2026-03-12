import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useBoardStore } from '@renderer/stores/board-store'
import { KanbanBoard } from './KanbanBoard'
import type { ProjectState, Task } from '@shared/types'

// Mock window.api
const mockApi = {
  isInitialized: vi.fn(),
  readProjectState: vi.fn(),
  initProject: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  writeProjectState: vi.fn().mockResolvedValue(undefined),
  readTaskDocument: vi.fn().mockResolvedValue(''),
  cliCheckAvailable: vi.fn().mockResolvedValue(true),
  cliInstallToPath: vi.fn().mockResolvedValue({ success: true, shell: 'zsh' }),
  readSettings: vi.fn().mockResolvedValue({ codingAgent: 'claude-code' }),
  writeSettings: vi.fn().mockResolvedValue(undefined)
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

function makeProjectState(tasks: Task[] = []): ProjectState {
  return {
    version: 1,
    projectName: 'test',
    tasks,
    columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
    labels: []
  }
}

describe('KanbanBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUIStore.setState({
      filters: { search: '', priority: [], labels: [], agentStatus: [] },
      activeTaskId: null,
      taskDetailOpen: false,
      focusedColumnIndex: 0,
      focusedTaskIndex: 0
    })
    useBoardStore.setState({
      draggedTaskId: null,
      dragOverColumn: null
    })
  })

  it('renders loading state', () => {
    useTaskStore.setState({ isLoading: true, projectState: null })
    render(<KanbanBoard />)
    expect(screen.getByText('Loading project...')).toBeInTheDocument()
  })

  it('renders onboarding screen when no project state', () => {
    useTaskStore.setState({ isLoading: false, projectState: null })
    render(<KanbanBoard />)
    expect(screen.getByText('Welcome to Familiar')).toBeInTheDocument()
    expect(screen.getByText('Open Folder')).toBeInTheDocument()
  })

  it('renders all 5 columns', () => {
    const state = makeProjectState()
    useTaskStore.setState({ isLoading: false, projectState: state })
    render(<KanbanBoard />)

    expect(screen.getByText('Todo')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('In Review')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
    expect(screen.getByText('Archive')).toBeInTheDocument()
  })

  it('renders tasks in correct columns', () => {
    const tasks = [
      makeTask({ id: 'tsk_a', title: 'Todo task 1', status: 'todo' }),
      makeTask({ id: 'tsk_b', title: 'In Progress task', status: 'in-progress' }),
      makeTask({ id: 'tsk_c', title: 'Done task', status: 'done' })
    ]
    const state = makeProjectState(tasks)
    useTaskStore.setState({ isLoading: false, projectState: state })
    render(<KanbanBoard />)

    expect(screen.getByText('Todo task 1')).toBeInTheDocument()
    expect(screen.getByText('In Progress task')).toBeInTheDocument()
    expect(screen.getByText('Done task')).toBeInTheDocument()
  })

  it('filters tasks by search', () => {
    const tasks = [
      makeTask({ id: 'tsk_a', title: 'Fix authentication bug', status: 'todo' }),
      makeTask({ id: 'tsk_b', title: 'Add new feature', status: 'todo' })
    ]
    const state = makeProjectState(tasks)
    useTaskStore.setState({ isLoading: false, projectState: state })
    useUIStore.setState({
      filters: { search: 'authentication', priority: [], labels: [], agentStatus: [] }
    })

    render(<KanbanBoard />)

    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    expect(screen.queryByText('Add new feature')).not.toBeInTheDocument()
  })

  it('filters tasks by priority', () => {
    const tasks = [
      makeTask({ id: 'tsk_a', title: 'Urgent fix', status: 'todo', priority: 'urgent' }),
      makeTask({ id: 'tsk_b', title: 'Low priority', status: 'todo', priority: 'low' })
    ]
    const state = makeProjectState(tasks)
    useTaskStore.setState({ isLoading: false, projectState: state })
    useUIStore.setState({
      filters: { search: '', priority: ['urgent'], labels: [], agentStatus: [] }
    })

    render(<KanbanBoard />)

    expect(screen.getByText('Urgent fix')).toBeInTheDocument()
    expect(screen.queryByText('Low priority')).not.toBeInTheDocument()
  })

  it('filters tasks by agent status', () => {
    const tasks = [
      makeTask({ id: 'tsk_a', title: 'Running task', status: 'todo', agentStatus: 'running' }),
      makeTask({ id: 'tsk_b', title: 'Idle task', status: 'todo', agentStatus: 'idle' })
    ]
    const state = makeProjectState(tasks)
    useTaskStore.setState({ isLoading: false, projectState: state })
    useUIStore.setState({
      filters: { search: '', priority: [], labels: [], agentStatus: ['running'] }
    })

    render(<KanbanBoard />)

    expect(screen.getByText('Running task')).toBeInTheDocument()
    expect(screen.queryByText('Idle task')).not.toBeInTheDocument()
  })

  it('shows all tasks when no filters active', () => {
    const tasks = [
      makeTask({ id: 'tsk_a', title: 'Task A', status: 'todo' }),
      makeTask({ id: 'tsk_b', title: 'Task B', status: 'todo' })
    ]
    const state = makeProjectState(tasks)
    useTaskStore.setState({ isLoading: false, projectState: state })

    render(<KanbanBoard />)

    expect(screen.getByText('Task A')).toBeInTheDocument()
    expect(screen.getByText('Task B')).toBeInTheDocument()
  })

  it('does not dispatch focus-new-task-input when a card is keyboard-focused', async () => {
    vi.useFakeTimers()
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const state = makeProjectState([makeTask()])
    useTaskStore.setState({ isLoading: false, projectState: state })

    // Simulate returning from task detail with a card still focused
    useUIStore.setState({
      taskDetailOpen: true,
      activeTaskId: 'tsk_test01',
      focusedColumnIndex: 0,
      focusedTaskIndex: 0
    })

    render(<KanbanBoard />)
    dispatchSpy.mockClear()

    // Close task detail (simulates Shift+Esc)
    act(() => {
      useUIStore.setState({ taskDetailOpen: false, activeTaskId: null })
    })

    // Advance past the 50ms timer
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    // Should NOT have dispatched focus-new-task-input since a card is focused
    const focusEvents = dispatchSpy.mock.calls.filter(
      ([event]) => (event as Event).type === 'focus-new-task-input'
    )
    expect(focusEvents).toHaveLength(0)

    dispatchSpy.mockRestore()
    vi.useRealTimers()
  })

  it('clears drag state when task detail opens', () => {
    const state = makeProjectState([
      makeTask({ id: 'tsk_a', title: 'Task A', status: 'todo' })
    ])
    useTaskStore.setState({ isLoading: false, projectState: state })
    useBoardStore.setState({
      draggedTaskId: 'tsk_a',
      dragOverColumn: 'in-progress'
    })

    render(<KanbanBoard />)

    // Simulate task detail opening (e.g., after a card click)
    act(() => {
      useUIStore.setState({ taskDetailOpen: true, activeTaskId: 'tsk_a' })
    })

    // Drag state in board store should be cleared
    expect(useBoardStore.getState().draggedTaskId).toBeNull()
    expect(useBoardStore.getState().dragOverColumn).toBeNull()
  })

  it('dispatches focus-new-task-input when no card is keyboard-focused', async () => {
    vi.useFakeTimers()
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const state = makeProjectState([makeTask()])
    useTaskStore.setState({ isLoading: false, projectState: state })

    // No card focused (e.g., app just loaded or user clicked elsewhere)
    useUIStore.setState({
      taskDetailOpen: false,
      focusedColumnIndex: -1,
      focusedTaskIndex: -1
    })

    render(<KanbanBoard />)

    // Advance past the 50ms timer
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    const focusEvents = dispatchSpy.mock.calls.filter(
      ([event]) => (event as Event).type === 'focus-new-task-input'
    )
    expect(focusEvents.length).toBeGreaterThanOrEqual(1)

    dispatchSpy.mockRestore()
    vi.useRealTimers()
  })
})
