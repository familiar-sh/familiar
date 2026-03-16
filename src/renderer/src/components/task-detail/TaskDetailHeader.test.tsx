import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { TaskDetailHeader } from './TaskDetailHeader'
import type { Task } from '@shared/types'

// Mock child components
vi.mock('./StatusSelect', () => ({
  StatusSelect: ({ value, onChange }: any) => (
    <button data-testid="status-select" onClick={() => onChange('in-progress')}>
      Status: {value}
    </button>
  )
}))

vi.mock('./PrioritySelect', () => ({
  PrioritySelect: ({ value, onChange }: any) => (
    <button data-testid="priority-select" onClick={() => onChange('high')}>
      Priority: {value}
    </button>
  )
}))

vi.mock('./LabelSelect', () => ({
  LabelSelect: ({ taskLabels, onToggle }: any) => (
    <button data-testid="label-select" onClick={() => onToggle('bug')}>
      Labels: {taskLabels.join(', ')}
    </button>
  )
}))

vi.mock('@renderer/components/common', () => ({
  Tooltip: ({ children }: any) => <>{children}</>
}))

const mockApi = {
  getProjectRoot: vi.fn().mockResolvedValue('/tmp/project'),
  openPath: vi.fn().mockResolvedValue(undefined),
  readSettings: vi.fn().mockResolvedValue({ labels: [
    { name: 'bug', color: '#ef4444' },
    { name: 'feature', color: '#3b82f6' },
    { name: 'chore', color: '#6b7280' }
  ] }),
  watchProjectDir: vi.fn().mockReturnValue(vi.fn())
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_test01',
    title: 'Test task title',
    status: 'todo',
    priority: 'none',
    labels: [],
    agentStatus: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sortOrder: 0,
    ...overrides
  }
}

describe('TaskDetailHeader', () => {
  const onUpdate = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as any).api = { ...((window as any).api ?? {}), ...mockApi }
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'test',
        tasks: [],
        columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
        labels: [
          { name: 'bug', color: '#ef4444' },
          { name: 'feature', color: '#3b82f6' }
        ]
      }
    })
  })

  it('renders the task title in a textarea', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('renders timestamps', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    expect(screen.getByText(/Created/)).toBeInTheDocument()
    expect(screen.getByText(/Updated/)).toBeInTheDocument()
  })

  it('renders Status, Priority, and Labels sections', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)

    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Priority')).toBeInTheDocument()
    expect(screen.getByText('Labels')).toBeInTheDocument()
  })

  it('renders StatusSelect with correct value', () => {
    render(
      <TaskDetailHeader
        task={makeTask({ status: 'in-progress' })}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    )
    expect(screen.getByText('Status: in-progress')).toBeInTheDocument()
  })

  it('renders PrioritySelect with correct value', () => {
    render(
      <TaskDetailHeader
        task={makeTask({ priority: 'high' })}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    )
    expect(screen.getByText('Priority: high')).toBeInTheDocument()
  })

  it('calls onUpdate with new status when StatusSelect changes', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('status-select'))
    expect(onUpdate).toHaveBeenCalledWith({ status: 'in-progress' })
  })

  it('calls onUpdate with new priority when PrioritySelect changes', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('priority-select'))
    expect(onUpdate).toHaveBeenCalledWith({ priority: 'high' })
  })

  it('calls onUpdate with toggled label when LabelSelect toggles', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('label-select'))
    expect(onUpdate).toHaveBeenCalledWith({ labels: ['bug'] })
  })

  it('removes label when toggling an existing label', () => {
    render(
      <TaskDetailHeader
        task={makeTask({ labels: ['bug', 'feature'] })}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByTestId('label-select'))
    // 'bug' is already in labels, so toggle removes it
    expect(onUpdate).toHaveBeenCalledWith({ labels: ['feature'] })
  })

  it('updates title on blur', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.change(textarea, { target: { value: 'New title' } })
    fireEvent.blur(textarea)
    expect(onUpdate).toHaveBeenCalledWith({ title: 'New title' })
  })

  it('does not update title if unchanged', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.blur(textarea)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('updates title on Enter key', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.change(textarea, { target: { value: 'Updated via Enter' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onUpdate).toHaveBeenCalledWith({ title: 'Updated via Enter' })
  })

  it('reverts title on Escape key', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.change(textarea, { target: { value: 'Changed title' } })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    // The value should be reverted
    expect(textarea).toHaveValue('Test task title')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('renders close button (x) that calls onClose', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)

    // The close button renders the x character
    const buttons = screen.getAllByRole('button')
    const closeButton = buttons.find((b) => b.textContent?.includes('\u2715'))
    expect(closeButton).toBeTruthy()
    fireEvent.click(closeButton!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders existing labels with remove buttons', () => {
    render(
      <TaskDetailHeader
        task={makeTask({ labels: ['bug', 'feature'] })}
        onUpdate={onUpdate}
        onClose={onClose}
      />
    )

    expect(screen.getByText('bug')).toBeInTheDocument()
    expect(screen.getByText('feature')).toBeInTheDocument()
  })

  it('opens task folder when folder button is clicked', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)

    // Find the folder button by its SVG path content (folder icon)
    const buttons = screen.getAllByRole('button')
    const folderBtn = buttons.find(
      (b) => b.querySelector('svg path[d*="folder" i], svg path[d*="H12.5"]') !== null
    )
    expect(folderBtn).toBeTruthy()
    fireEvent.click(folderBtn!)

    expect(mockApi.getProjectRoot).toHaveBeenCalled()
  })

  it('renders task ID badge with copy button', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)

    expect(screen.getByText('tsk_test01')).toBeInTheDocument()
  })

  it('copies task ID to clipboard when badge is clicked', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)

    const badge = screen.getByText('tsk_test01').closest('button')
    expect(badge).toBeTruthy()
    fireEvent.click(badge!)

    expect(writeText).toHaveBeenCalledWith('tsk_test01')
  })

  it('trims whitespace from title before updating', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.change(textarea, { target: { value: '  Trimmed title  ' } })
    fireEvent.blur(textarea)
    expect(onUpdate).toHaveBeenCalledWith({ title: 'Trimmed title' })
  })

  it('does not update with empty title', () => {
    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)
    const textarea = screen.getByDisplayValue('Test task title')
    fireEvent.change(textarea, { target: { value: '' } })
    fireEvent.blur(textarea)
    // Should revert to original, not call update with empty
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('syncs title when task prop changes externally', () => {
    const task = makeTask({ title: 'Original title' })
    const { rerender } = render(
      <TaskDetailHeader task={task} onUpdate={onUpdate} onClose={onClose} />
    )
    expect(screen.getByDisplayValue('Original title')).toBeInTheDocument()

    // Simulate external update (e.g. file watcher reloads state)
    const updatedTask = makeTask({ title: 'Externally updated title' })
    rerender(
      <TaskDetailHeader task={updatedTask} onUpdate={onUpdate} onClose={onClose} />
    )
    expect(screen.getByDisplayValue('Externally updated title')).toBeInTheDocument()
  })

  describe('pendingDetailFocus title consumption', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('focuses title textarea when pendingDetailFocus is title and activeTaskId matches', async () => {
      const task = makeTask()
      useUIStore.setState({
        activeTaskId: 'tsk_test01',
        taskDetailOpen: true,
        pendingDetailFocus: 'title'
      })

      render(<TaskDetailHeader task={task} onUpdate={onUpdate} onClose={onClose} />)

      // Advance timers to let rAF + setTimeout fire
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      const textarea = screen.getByDisplayValue('Test task title')
      expect(document.activeElement).toBe(textarea)
      expect(useUIStore.getState().pendingDetailFocus).toBeNull()
    })

    it('does NOT focus title when pendingDetailFocus is terminal', async () => {
      const task = makeTask()
      useUIStore.setState({
        activeTaskId: 'tsk_test01',
        taskDetailOpen: true,
        pendingDetailFocus: 'terminal'
      })

      render(<TaskDetailHeader task={task} onUpdate={onUpdate} onClose={onClose} />)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      const textarea = screen.getByDisplayValue('Test task title')
      expect(document.activeElement).not.toBe(textarea)
      // Should NOT consume the terminal focus
      expect(useUIStore.getState().pendingDetailFocus).toBe('terminal')
    })

    it('does NOT focus title when activeTaskId does not match', async () => {
      const task = makeTask()
      useUIStore.setState({
        activeTaskId: 'tsk_other',
        taskDetailOpen: true,
        pendingDetailFocus: 'title'
      })

      render(<TaskDetailHeader task={task} onUpdate={onUpdate} onClose={onClose} />)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100)
      })

      const textarea = screen.getByDisplayValue('Test task title')
      expect(document.activeElement).not.toBe(textarea)
    })

    it('focuses title when pendingDetailFocus is set after mount (re-open)', async () => {
      const task = makeTask()
      useUIStore.setState({
        activeTaskId: 'tsk_test01',
        taskDetailOpen: true,
        pendingDetailFocus: null
      })

      render(<TaskDetailHeader task={task} onUpdate={onUpdate} onClose={onClose} />)

      // Simulate re-opening: set pendingDetailFocus after mount
      await act(async () => {
        useUIStore.setState({ pendingDetailFocus: 'title' })
        await vi.advanceTimersByTimeAsync(100)
      })

      const textarea = screen.getByDisplayValue('Test task title')
      expect(document.activeElement).toBe(textarea)
      expect(useUIStore.getState().pendingDetailFocus).toBeNull()
    })

    it('still responds to task-detail-focus events (e.g. from Cmd+Enter)', () => {
      const task = makeTask()
      render(<TaskDetailHeader task={task} onUpdate={onUpdate} onClose={onClose} />)

      window.dispatchEvent(new CustomEvent('task-detail-focus', { detail: 'title' }))

      const textarea = screen.getByDisplayValue('Test task title')
      expect(document.activeElement).toBe(textarea)
    })
  })

  it('copies document markdown to clipboard when copy document button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const readTaskDocument = vi.fn().mockResolvedValue('# Hello\n\nSome **markdown** content')
    ;(window as any).api = { ...((window as any).api ?? {}), ...mockApi, readTaskDocument }

    render(<TaskDetailHeader task={makeTask()} onUpdate={onUpdate} onClose={onClose} />)

    // Find the copy document button — it's right after the task ID badge
    const buttons = screen.getAllByRole('button')
    // The copy document button has an SVG with a rect at x=5.5, y=5.5 (copy icon)
    const copyDocBtn = buttons.find(
      (b) => b !== screen.getByText('tsk_test01').closest('button') &&
        b.querySelector('svg rect[x="5.5"][y="5.5"]') !== null
    )
    expect(copyDocBtn).toBeTruthy()

    await act(async () => {
      fireEvent.click(copyDocBtn!)
    })

    expect(readTaskDocument).toHaveBeenCalledWith('tsk_test01')
    expect(writeText).toHaveBeenCalledWith('# Hello\n\nSome **markdown** content')
  })

  it('does not overwrite local edits when task prop changes during editing', () => {
    const task = makeTask({ title: 'Original title' })
    const { rerender } = render(
      <TaskDetailHeader task={task} onUpdate={onUpdate} onClose={onClose} />
    )
    const textarea = screen.getByDisplayValue('Original title')

    // User starts editing
    fireEvent.focus(textarea)
    fireEvent.change(textarea, { target: { value: 'User typing...' } })

    // External update arrives while user is editing
    const updatedTask = makeTask({ title: 'External change' })
    rerender(
      <TaskDetailHeader task={updatedTask} onUpdate={onUpdate} onClose={onClose} />
    )

    // Local edit should be preserved, not overwritten
    expect(textarea).toHaveValue('User typing...')
  })
})
