import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
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
})
