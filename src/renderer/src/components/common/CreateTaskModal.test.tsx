import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { CreateTaskModal } from './CreateTaskModal'
import type { TaskStatus } from '@shared/types'

const COLUMN_ORDER: TaskStatus[] = ['todo', 'in-progress', 'in-review', 'done', 'archived']

const mockApi = {
  isInitialized: vi.fn(),
  readProjectState: vi.fn(),
  initProject: vi.fn(),
  createTask: vi.fn().mockResolvedValue(undefined),
  updateTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  writeProjectState: vi.fn().mockResolvedValue(undefined),
  writeTaskDocument: vi.fn().mockResolvedValue(undefined),
  warmupTmuxSession: vi.fn().mockResolvedValue(undefined),
  readSettings: vi.fn().mockResolvedValue({ snippets: [] }),
  tmuxHas: vi.fn().mockResolvedValue(false),
  tmuxSendKeys: vi.fn().mockResolvedValue(undefined),
  copyTempToAttachment: vi.fn().mockResolvedValue('file.png'),
  savePastedFile: vi.fn().mockResolvedValue(undefined)
}

;(window as any).api = mockApi

describe('CreateTaskModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useUIStore.setState({
      createTaskModalOpen: false,
      taskDetailOpen: false,
      activeTaskId: null
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

  it('does not render when closed', () => {
    const { container } = render(<CreateTaskModal />)
    expect(container.innerHTML).toBe('')
  })

  it('renders when open', () => {
    useUIStore.setState({ createTaskModalOpen: true })
    render(<CreateTaskModal />)
    expect(screen.getByPlaceholderText('Task title... (Shift+Enter for notes, paste images)')).toBeDefined()
    expect(screen.getByPlaceholderText(/Task title/)).toBeDefined()
  })

  it('closes on Escape key', () => {
    useUIStore.setState({ createTaskModalOpen: true })
    render(<CreateTaskModal />)

    const textarea = screen.getByPlaceholderText(/Task title/)
    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(useUIStore.getState().createTaskModalOpen).toBe(false)
  })

  it('closes on overlay click', () => {
    useUIStore.setState({ createTaskModalOpen: true })
    const { container } = render(<CreateTaskModal />)

    // Click the overlay (first child of container)
    const overlay = container.firstElementChild as HTMLElement
    fireEvent.click(overlay)

    expect(useUIStore.getState().createTaskModalOpen).toBe(false)
  })

  it('does not close when clicking inside wrapper', () => {
    useUIStore.setState({ createTaskModalOpen: true })
    render(<CreateTaskModal />)

    const input = screen.getByPlaceholderText('Task title... (Shift+Enter for notes, paste images)')
    fireEvent.click(input)

    expect(useUIStore.getState().createTaskModalOpen).toBe(true)
  })

  it('creates task on Enter and closes modal', async () => {
    useUIStore.setState({ createTaskModalOpen: true })
    mockApi.createTask.mockResolvedValue(undefined)

    render(<CreateTaskModal />)

    const textarea = screen.getByPlaceholderText(/Task title/)
    fireEvent.change(textarea, { target: { value: 'My new task' } })

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' })
    })

    expect(mockApi.createTask).toHaveBeenCalled()
    expect(useUIStore.getState().createTaskModalOpen).toBe(false)
  })

  it('does not create task when title is empty', async () => {
    useUIStore.setState({ createTaskModalOpen: true })
    render(<CreateTaskModal />)

    const textarea = screen.getByPlaceholderText(/Task title/)

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' })
    })

    expect(mockApi.createTask).not.toHaveBeenCalled()
    expect(useUIStore.getState().createTaskModalOpen).toBe(true)
  })

  it('writes document content when multi-line input is provided', async () => {
    useUIStore.setState({ createTaskModalOpen: true })
    mockApi.createTask.mockResolvedValue(undefined)

    render(<CreateTaskModal />)

    const textarea = screen.getByPlaceholderText(/Task title/)
    fireEvent.change(textarea, { target: { value: 'Task title\nSome notes here' } })

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter' })
    })

    expect(mockApi.createTask).toHaveBeenCalled()
    expect(mockApi.writeTaskDocument).toHaveBeenCalledWith(
      expect.any(String),
      'Some notes here'
    )
  })

  it('allows newline with Shift+Enter', () => {
    useUIStore.setState({ createTaskModalOpen: true })
    render(<CreateTaskModal />)

    const textarea = screen.getByPlaceholderText(/Task title/)
    fireEvent.change(textarea, { target: { value: 'Line 1' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })

    // Should not close or create — modal should still be open
    expect(useUIStore.getState().createTaskModalOpen).toBe(true)
    expect(mockApi.createTask).not.toHaveBeenCalled()
  })

  it('clears input when reopened', () => {
    useUIStore.setState({ createTaskModalOpen: true })
    const { rerender } = render(<CreateTaskModal />)

    const textarea = screen.getByPlaceholderText(/Task title/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Some text' } })
    expect(textarea.value).toBe('Some text')

    // Close and reopen
    act(() => useUIStore.setState({ createTaskModalOpen: false }))
    rerender(<CreateTaskModal />)
    act(() => useUIStore.setState({ createTaskModalOpen: true }))
    rerender(<CreateTaskModal />)

    const newTextarea = screen.getByPlaceholderText(/Task title/) as HTMLTextAreaElement
    expect(newTextarea.value).toBe('')
  })
})
