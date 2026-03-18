import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TaskCard } from './TaskCard'
import type { Task } from '@shared/types'

// Mock dnd-kit
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false
  })
}))

// Mock stores
const mockNotifications: any[] = []
vi.mock('@renderer/stores/notification-store', () => ({
  useNotificationStore: (selector: any) => {
    const state = {
      notifications: mockNotifications,
      markReadByTaskId: vi.fn()
    }
    return selector(state)
  }
}))

vi.mock('@renderer/stores/task-store', () => ({
  useTaskStore: () => ({
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    deleteTasks: vi.fn(),
    moveTasks: vi.fn(),
    setTasksPriority: vi.fn()
  })
}))

vi.mock('@renderer/stores/board-store', () => ({
  useBoardStore: (selector: any) => {
    const state = {
      selectedTaskIds: new Set<string>(),
      clearSelection: vi.fn()
    }
    return selector(state)
  }
}))

// Mock file-change-hub
vi.mock('@renderer/lib/file-change-hub', () => ({
  onFileChange: vi.fn().mockReturnValue(() => {})
}))

// Mock window.api
;(window as any).api = {
  readTaskDocument: vi.fn().mockResolvedValue(''),
  readTaskActivity: vi.fn().mockResolvedValue([]),
  readProjectState: vi.fn().mockResolvedValue({ labels: [] }),
  watchProjectDir: vi.fn().mockReturnValue(vi.fn()),
  tmuxHas: vi.fn().mockResolvedValue(false),
  tmuxSendKeys: vi.fn().mockResolvedValue(undefined),
  warmupTmuxSession: vi.fn().mockResolvedValue(undefined)
}

// CSS module mock returns class names matching the key
vi.mock('./TaskCard.module.css', () => ({
  default: {
    card: 'card',
    cardSelected: 'cardSelected',
    cardMultiSelected: 'cardMultiSelected',
    cardDragging: 'cardDragging',
    cardFocused: 'cardFocused',
    cardNotified: 'cardNotified',
    topRow: 'topRow',
    agentDot: 'agentDot',
    agentRunning: 'agentRunning',
    title: 'title',
    titleInput: 'titleInput',
    bottomRow: 'bottomRow',
    label: 'label',
    notificationDot: 'notificationDot',
    priorityBtn: 'priorityBtn',
    priorityDropdown: 'priorityDropdown',
    priorityOption: 'priorityOption',
    priorityOptionActive: 'priorityOptionActive',
    attachmentThumbs: 'attachmentThumbs',
    attachmentThumb: 'attachmentThumb',
    attachmentMore: 'attachmentMore',
    pastedFileIndicators: 'pastedFileIndicators',
    pastedFileChip: 'pastedFileChip',
    footer: 'footer',
    footerSpacer: 'footerSpacer',
    snippetBtn: 'snippetBtn',
    snippetBtnPrimary: 'snippetBtnPrimary',
    snippetBtnIcon: 'snippetBtnIcon',
    snippetBtnSent: 'snippetBtnSent',
    overlayWrapper: 'overlayWrapper',
    selectionBadge: 'selectionBadge',
    stackedCard: 'stackedCard',
    activityPreview: 'activityPreview',
    activityMessage: 'activityMessage',
    activityTime: 'activityTime'
  }
}))

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'tsk_test1',
  title: 'Test task',
  status: 'todo',
  priority: 'none',
  labels: [],
  agentStatus: 'idle',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  sortOrder: 0,
  ...overrides
})

describe('TaskCard — priority icon visibility', () => {
  beforeEach(() => {
    mockNotifications.length = 0
  })

  it('hides priority icon when priority is none', () => {
    const { container } = render(
      <TaskCard task={makeTask({ priority: 'none' })} onClick={vi.fn()} />
    )
    expect(container.querySelector('.priorityBtn')).toBeNull()
  })

  it('shows priority icon when priority is set', () => {
    const { container } = render(
      <TaskCard task={makeTask({ priority: 'high' })} onClick={vi.fn()} />
    )
    expect(container.querySelector('.priorityBtn')).not.toBeNull()
  })
})

describe('TaskCard — outline class precedence', () => {
  beforeEach(() => {
    mockNotifications.length = 0
  })

  it('applies cardSelected class when selected', () => {
    const { container } = render(
      <TaskCard task={makeTask()} onClick={vi.fn()} isSelected />
    )
    const card = container.firstElementChild!
    expect(card.className).toContain('cardSelected')
  })

  it('applies cardNotified class when task has unread notifications', () => {
    mockNotifications.push({ id: 'n1', taskId: 'tsk_test1', read: false })
    const { container } = render(
      <TaskCard task={makeTask()} onClick={vi.fn()} />
    )
    const card = container.firstElementChild!
    expect(card.className).toContain('cardNotified')
  })

  it('applies both cardSelected and cardNotified when selected with unread notifications', () => {
    mockNotifications.push({ id: 'n1', taskId: 'tsk_test1', read: false })
    const { container } = render(
      <TaskCard task={makeTask()} onClick={vi.fn()} isSelected />
    )
    const card = container.firstElementChild!
    expect(card.className).toContain('cardSelected')
    expect(card.className).toContain('cardNotified')
  })

  it('applies both cardMultiSelected and cardNotified when multi-selected with unread notifications', () => {
    mockNotifications.push({ id: 'n1', taskId: 'tsk_test1', read: false })
    const { container } = render(
      <TaskCard task={makeTask()} onClick={vi.fn()} isMultiSelected />
    )
    const card = container.firstElementChild!
    expect(card.className).toContain('cardMultiSelected')
    expect(card.className).toContain('cardNotified')
  })

  it('applies both cardFocused and cardNotified when focused with unread notifications', () => {
    mockNotifications.push({ id: 'n1', taskId: 'tsk_test1', read: false })
    const { container } = render(
      <TaskCard task={makeTask()} onClick={vi.fn()} isFocused />
    )
    const card = container.firstElementChild!
    expect(card.className).toContain('cardFocused')
    expect(card.className).toContain('cardNotified')
  })

  it('does not apply cardNotified when no unread notifications exist', () => {
    const { container } = render(
      <TaskCard task={makeTask()} onClick={vi.fn()} />
    )
    const card = container.firstElementChild!
    expect(card.className).not.toContain('cardNotified')
  })

  it('does not apply cardNotified when notifications are read', () => {
    mockNotifications.push({ id: 'n1', taskId: 'tsk_test1', read: true })
    const { container } = render(
      <TaskCard task={makeTask()} onClick={vi.fn()} />
    )
    const card = container.firstElementChild!
    expect(card.className).not.toContain('cardNotified')
  })
})

const mockApi = (window as any).api

describe('TaskCard — activity preview', () => {
  beforeEach(() => {
    mockNotifications.length = 0
    mockApi.readTaskActivity.mockResolvedValue([])
  })

  it('shows last activity note for in-progress tasks', async () => {
    mockApi.readTaskActivity.mockResolvedValue([
      { id: '1', timestamp: '2026-03-14T20:00:00Z', type: 'status_change', message: 'Status changed' },
      { id: '2', timestamp: '2026-03-14T20:01:00Z', type: 'note', message: 'Reading codebase' },
      { id: '3', timestamp: '2026-03-14T20:05:00Z', type: 'note', message: 'Writing tests' }
    ])

    render(
      <TaskCard task={makeTask({ status: 'in-progress' })} onClick={vi.fn()} />
    )

    // Wait for async activity load
    const activityMessage = await screen.findByText('Writing tests')
    expect(activityMessage).toBeDefined()
  })

  it('does not show activity preview for todo tasks', async () => {
    mockApi.readTaskActivity.mockResolvedValue([
      { id: '1', timestamp: '2026-03-14T20:01:00Z', type: 'note', message: 'Some note' }
    ])

    const { container } = render(
      <TaskCard task={makeTask({ status: 'todo' })} onClick={vi.fn()} />
    )

    // Give time for any async operations
    await vi.waitFor(() => {
      expect(container.querySelector('.activityPreview')).toBeNull()
    })
  })

  it('does not show activity preview when no notes exist', async () => {
    mockApi.readTaskActivity.mockResolvedValue([
      { id: '1', timestamp: '2026-03-14T20:00:00Z', type: 'status_change', message: 'Status changed' }
    ])

    const { container } = render(
      <TaskCard task={makeTask({ status: 'in-progress' })} onClick={vi.fn()} />
    )

    // Give time for async load, then verify no activity preview
    await vi.waitFor(() => {
      expect(container.querySelector('.activityPreview')).toBeNull()
    })
  })
})

describe('TaskCard — dashboard snippet warmup', () => {
  beforeEach(() => {
    mockNotifications.length = 0
    mockApi.readTaskActivity.mockResolvedValue([])
    mockApi.tmuxHas.mockReset()
    mockApi.tmuxSendKeys.mockReset()
    mockApi.warmupTmuxSession.mockReset()
    mockApi.tmuxSendKeys.mockResolvedValue(undefined)
    mockApi.warmupTmuxSession.mockResolvedValue(undefined)
  })

  it('sends snippet directly when tmux session already exists', async () => {
    mockApi.tmuxHas.mockResolvedValue(true)

    const snippet = { title: 'Start', command: '/familiar-agent', pressEnter: true, showInDashboard: true }
    render(
      <TaskCard
        task={makeTask()}
        onClick={vi.fn()}
        dashboardSnippets={[snippet]}
      />
    )

    const btn = screen.getByText('Start')
    fireEvent.click(btn)

    await waitFor(() => {
      expect(mockApi.tmuxHas).toHaveBeenCalledWith('familiar-tsk_test1')
      expect(mockApi.warmupTmuxSession).not.toHaveBeenCalled()
      expect(mockApi.tmuxSendKeys).toHaveBeenCalledWith(
        'familiar-tsk_test1',
        '/familiar-agent',
        true
      )
    })
  })

  it('warms up tmux session before sending snippet when session does not exist', async () => {
    vi.useFakeTimers()
    mockApi.tmuxHas.mockResolvedValue(false)

    const snippet = { title: 'Start', command: '/familiar-agent', pressEnter: true, showInDashboard: true }
    render(
      <TaskCard
        task={makeTask()}
        onClick={vi.fn()}
        dashboardSnippets={[snippet]}
      />
    )

    const btn = screen.getByText('Start')
    fireEvent.click(btn)

    // Let tmuxHas and warmupTmuxSession promises resolve
    await vi.advanceTimersByTimeAsync(100)
    // Advance past the 3-second delay after warmup
    await vi.advanceTimersByTimeAsync(3100)

    expect(mockApi.tmuxHas).toHaveBeenCalledWith('familiar-tsk_test1')
    expect(mockApi.warmupTmuxSession).toHaveBeenCalledWith('tsk_test1')
    expect(mockApi.tmuxSendKeys).toHaveBeenCalledWith(
      'familiar-tsk_test1',
      '/familiar-agent',
      true
    )

    vi.useRealTimers()
  })
})
