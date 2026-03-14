import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommandPalette } from './CommandPalette'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import type { ProjectState } from '@shared/types'

// cmdk uses ResizeObserver and scrollIntoView which are not available in jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
  }
  if (typeof Element.prototype.scrollIntoView === 'undefined') {
    Element.prototype.scrollIntoView = function () {}
  }
})

function resetStores(): void {
  useUIStore.setState({
    commandPaletteOpen: false,
    taskDetailOpen: false,
    activeTaskId: null,
    focusedColumnIndex: 0,
    focusedTaskIndex: 0,
    sidebarOpen: true,
    editorPanelWidth: 50,
    filters: {
      search: '',
      priority: [],
      labels: [],
      agentStatus: []
    }
  })

  const mockState: ProjectState = {
    version: 1,
    projectName: 'Test Project',
    tasks: [
      {
        id: 'tsk_test01',
        title: 'Fix authentication bug',
        status: 'in-progress',
        priority: 'high',
        labels: ['bug'],
        agentStatus: 'running',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        sortOrder: 0
      },
      {
        id: 'tsk_test02',
        title: 'Add unit tests',
        status: 'todo',
        priority: 'medium',
        labels: ['testing'],
        agentStatus: 'idle',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        sortOrder: 0
      }
    ],
    columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
    labels: [{ name: 'bug', color: '#ef4444' }, { name: 'testing', color: '#6b7280' }]
  }

  useTaskStore.setState({
    projectState: mockState,
    isLoading: false,
    error: null
  })
}

describe('CommandPalette', () => {
  beforeEach(() => {
    resetStores()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<CommandPalette />)
    expect(container.innerHTML).toBe('')
  })

  it('renders palette when open', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument()
  })

  it('shows task list in palette', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    expect(screen.getByText('Fix authentication bug')).toBeInTheDocument()
    expect(screen.getByText('Add unit tests')).toBeInTheDocument()
  })

  it('shows action items', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    expect(screen.getByText('Create Task')).toBeInTheDocument()
    expect(screen.getByText('Toggle Sidebar')).toBeInTheDocument()
  })

  it('shows navigation items for all columns', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    expect(screen.getByText('Go to Todo')).toBeInTheDocument()
    expect(screen.getByText('Go to In Progress')).toBeInTheDocument()
    expect(screen.getByText('Go to Done')).toBeInTheDocument()
  })

  it('has an input field that accepts text', () => {
    useUIStore.setState({ commandPaletteOpen: true })
    render(<CommandPalette />)
    const input = screen.getByPlaceholderText('Type a command or search...')
    fireEvent.change(input, { target: { value: 'Fix' } })
    expect((input as HTMLInputElement).value).toBe('Fix')
  })

  it('does not show Run Doctor when no active task', () => {
    useUIStore.setState({ commandPaletteOpen: true, activeTaskId: null })
    render(<CommandPalette />)
    expect(screen.queryByText('Run Doctor')).not.toBeInTheDocument()
    expect(screen.queryByText('Run Doctor (Auto-fix)')).not.toBeInTheDocument()
  })

  it('shows Run Doctor commands when a task is active', () => {
    // Mock window.api.readSettings
    window.api = {
      readSettings: vi.fn().mockResolvedValue({ codingAgent: 'claude-code' })
    } as unknown as typeof window.api

    useUIStore.setState({ commandPaletteOpen: true, activeTaskId: 'tsk_test01' })
    render(<CommandPalette />)
    expect(screen.getByText('Run Doctor')).toBeInTheDocument()
    expect(screen.getByText('Run Doctor (Auto-fix)')).toBeInTheDocument()
  })

  it('dispatches run-doctor event on Run Doctor select', () => {
    window.api = {
      readSettings: vi.fn().mockResolvedValue({ codingAgent: 'other' })
    } as unknown as typeof window.api

    useUIStore.setState({ commandPaletteOpen: true, activeTaskId: 'tsk_test01' })
    render(<CommandPalette />)

    const listener = vi.fn()
    window.addEventListener('run-doctor', listener)

    const item = screen.getByText('Run Doctor')
    fireEvent.click(item)

    expect(listener).toHaveBeenCalledTimes(1)
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail
    expect(detail.taskId).toBe('tsk_test01')
    expect(detail.command).toBe('familiar doctor')

    window.removeEventListener('run-doctor', listener)
  })

  it('dispatches run-doctor event with claude flags for claude-code agent', async () => {
    let resolveSettings: (value: unknown) => void
    const settingsPromise = new Promise((resolve) => { resolveSettings = resolve })
    window.api = {
      readSettings: vi.fn().mockReturnValue(settingsPromise)
    } as unknown as typeof window.api

    useUIStore.setState({ commandPaletteOpen: true, activeTaskId: 'tsk_test01' })
    const { unmount } = render(<CommandPalette />)

    // Resolve settings and wait for state update
    resolveSettings!({ codingAgent: 'claude-code' })
    await vi.waitFor(() => {
      // Settings promise resolved, state should be updated after re-render
    })
    // Allow React to process the state update
    await new Promise((r) => setTimeout(r, 0))

    const listener = vi.fn()
    window.addEventListener('run-doctor', listener)

    const item = screen.getByText('Run Doctor (Auto-fix)')
    fireEvent.click(item)

    expect(listener).toHaveBeenCalledTimes(1)
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail
    expect(detail.taskId).toBe('tsk_test01')
    expect(detail.command).toContain('familiar doctor --auto-fix')
    expect(detail.command).toContain('claude')

    window.removeEventListener('run-doctor', listener)
    unmount()
  })
})
