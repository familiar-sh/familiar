import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KanbanColumn } from './KanbanColumn'
import type { Snippet } from '@shared/types'

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ isOver: false, setNodeRef: vi.fn() })
}))
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {}
}))

// Mock window.api
;(window as any).api = {
  readTaskDocument: vi.fn().mockResolvedValue(''),
  clipboardSaveImage: vi.fn().mockResolvedValue('/tmp/clipboard-123.png')
}

const defaultProps = {
  status: 'todo' as const,
  tasks: [],
  onTaskClick: vi.fn(),
  onMultiSelect: vi.fn(),
  onCreateTask: vi.fn(),
  alwaysShowInput: true
}

const testSnippets: Snippet[] = [
  { title: 'Start', command: '/familiar', pressEnter: true },
  { title: 'Test', command: 'npm test', pressEnter: true }
]

describe('KanbanColumn — snippet toggles', () => {
  it('shows snippet toggles below create input when allSnippets provided', () => {
    render(<KanbanColumn {...defaultProps} allSnippets={testSnippets} />)

    expect(screen.getByText('Auto-run on create:')).toBeInTheDocument()
    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('does not show snippet toggles when allSnippets is empty', () => {
    render(<KanbanColumn {...defaultProps} allSnippets={[]} />)

    expect(screen.queryByText('Auto-run on create:')).not.toBeInTheDocument()
  })

  it('all snippets are enabled by default', () => {
    render(<KanbanColumn {...defaultProps} allSnippets={testSnippets} />)

    const startBtn = screen.getByText('Start').closest('button')!
    const testBtn = screen.getByText('Test').closest('button')!

    // Both should have the check mark (enabled)
    expect(startBtn.textContent).toContain('✓')
    expect(testBtn.textContent).toContain('✓')
  })

  it('clicking a toggle disables the snippet', () => {
    render(<KanbanColumn {...defaultProps} allSnippets={testSnippets} />)

    const startBtn = screen.getByText('Start').closest('button')!
    fireEvent.click(startBtn)

    // After clicking, the check mark should be gone
    expect(startBtn.textContent).not.toContain('✓')
  })

  it('clicking a disabled toggle re-enables it', () => {
    render(<KanbanColumn {...defaultProps} allSnippets={testSnippets} />)

    const startBtn = screen.getByText('Start').closest('button')!
    fireEvent.click(startBtn) // disable
    fireEvent.click(startBtn) // re-enable

    expect(startBtn.textContent).toContain('✓')
  })

  it('passes enabled snippets when creating a task', () => {
    const onCreateTask = vi.fn()
    render(
      <KanbanColumn
        {...defaultProps}
        onCreateTask={onCreateTask}
        allSnippets={testSnippets}
      />
    )

    // Disable the second snippet
    const testBtn = screen.getByText('Test').closest('button')!
    fireEvent.click(testBtn)

    // Type a task title and press Enter
    const textarea = screen.getByPlaceholderText(/Task title/i)
    fireEvent.change(textarea, { target: { value: 'New task' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onCreateTask).toHaveBeenCalledWith(
      'New task',
      undefined,
      [testSnippets[0]], // Only the first snippet (Start) should be enabled
      undefined,
      undefined
    )
  })

  it('passes undefined enabledSnippets when all are disabled', () => {
    const onCreateTask = vi.fn()
    render(
      <KanbanColumn
        {...defaultProps}
        onCreateTask={onCreateTask}
        allSnippets={testSnippets}
      />
    )

    // Disable both snippets
    const startBtn = screen.getByText('Start').closest('button')!
    const testBtn = screen.getByText('Test').closest('button')!
    fireEvent.click(startBtn)
    fireEvent.click(testBtn)

    const textarea = screen.getByPlaceholderText(/Task title/i)
    fireEvent.change(textarea, { target: { value: 'New task' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(onCreateTask).toHaveBeenCalledWith('New task', undefined, undefined, undefined, undefined)
  })
})

describe('KanbanColumn — draft persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists draft text to localStorage as user types', () => {
    render(<KanbanColumn {...defaultProps} />)

    const textarea = screen.getByPlaceholderText(/Task title/i)
    fireEvent.change(textarea, { target: { value: 'My draft' } })

    expect(localStorage.getItem('familiar-draft-todo')).toBe('My draft')
  })

  it('restores draft text from localStorage on mount', () => {
    localStorage.setItem('familiar-draft-todo', 'Saved draft')

    render(<KanbanColumn {...defaultProps} />)

    const textarea = screen.getByPlaceholderText(/Task title/i) as HTMLTextAreaElement
    expect(textarea.value).toBe('Saved draft')
  })

  it('clears draft from localStorage when task is created via Enter', () => {
    localStorage.setItem('familiar-draft-todo', 'Will be cleared')

    render(<KanbanColumn {...defaultProps} />)

    const textarea = screen.getByPlaceholderText(/Task title/i)
    fireEvent.change(textarea, { target: { value: 'New task' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(localStorage.getItem('familiar-draft-todo')).toBeNull()
  })

  it('clears draft from localStorage when Escape is pressed', () => {
    localStorage.setItem('familiar-draft-todo', 'Will be cleared')

    render(<KanbanColumn {...defaultProps} />)

    const textarea = screen.getByPlaceholderText(/Task title/i)
    fireEvent.keyDown(textarea, { key: 'Escape' })

    expect(localStorage.getItem('familiar-draft-todo')).toBeNull()
  })

  it('uses different localStorage keys for different columns', () => {
    render(<KanbanColumn {...defaultProps} status="in-progress" showCreateInput />)

    const textarea = screen.getByPlaceholderText(/Task title/i)
    fireEvent.change(textarea, { target: { value: 'In progress draft' } })

    expect(localStorage.getItem('familiar-draft-in-progress')).toBe('In progress draft')
    expect(localStorage.getItem('familiar-draft-todo')).toBeNull()
  })

  it('removes localStorage key when text is cleared to empty', () => {
    render(<KanbanColumn {...defaultProps} />)

    const textarea = screen.getByPlaceholderText(/Task title/i)
    fireEvent.change(textarea, { target: { value: 'Draft' } })
    expect(localStorage.getItem('familiar-draft-todo')).toBe('Draft')

    fireEvent.change(textarea, { target: { value: '' } })
    expect(localStorage.getItem('familiar-draft-todo')).toBeNull()
  })
})

describe('KanbanColumn — image paste', () => {
  it('shows pending image thumbnail after pasting an image', async () => {
    render(<KanbanColumn {...defaultProps} />)

    const textarea = screen.getByPlaceholderText(/Task title/i)

    // Create a mock image paste event
    const file = new File(['fake-image-data'], 'test.png', { type: 'image/png' })
    const arrayBuffer = await file.arrayBuffer()

    // Mock the clipboard items
    const items = [
      {
        kind: 'file',
        type: 'image/png',
        getAsFile: () => file
      }
    ]

    const pasteEvent = new Event('paste', { bubbles: true }) as any
    pasteEvent.clipboardData = {
      items,
      getData: () => ''
    }

    fireEvent(textarea, pasteEvent)

    // Wait for async paste handler
    await vi.waitFor(() => {
      expect((window as any).api.clipboardSaveImage).toHaveBeenCalled()
    })
  })

  it('shows remove button on pending image thumbnail', async () => {
    render(<KanbanColumn {...defaultProps} />)

    const textarea = screen.getByPlaceholderText(/Task title/i)
    const file = new File(['fake-image-data'], 'test.png', { type: 'image/png' })

    const items = [
      {
        kind: 'file',
        type: 'image/png',
        getAsFile: () => file
      }
    ]

    const pasteEvent = new Event('paste', { bubbles: true }) as any
    pasteEvent.clipboardData = {
      items,
      getData: () => ''
    }

    fireEvent(textarea, pasteEvent)

    await vi.waitFor(() => {
      const removeBtn = screen.queryByLabelText('Remove image')
      expect(removeBtn).toBeInTheDocument()
    })
  })
})
