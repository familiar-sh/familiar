import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { TerminalPanel } from './TerminalPanel'
import type { Task, ProjectState } from '@shared/types'

// Mock the Terminal component since it uses xterm
vi.mock('./Terminal', () => ({
  Terminal: ({ sessionId }: { sessionId: string }) => (
    <div data-testid="mock-terminal">Terminal session: {sessionId}</div>
  )
}))

// Mock the IconPicker's LucideIconByName
vi.mock('./IconPicker', () => ({
  LucideIconByName: ({ name }: { name: string }) => (
    <span data-testid={`icon-${name}`}>{name}</span>
  )
}))

// Mock the Tooltip to just render children (avoids portal complexity)
vi.mock('@renderer/components/common', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

const mockApi = {
  getProjectRoot: vi.fn().mockResolvedValue('/test/project'),
  ptyCreate: vi.fn().mockResolvedValue('session-123'),
  ptyDestroy: vi.fn().mockResolvedValue(undefined),
  ptyWrite: vi.fn().mockResolvedValue(undefined),
  tmuxList: vi.fn().mockResolvedValue([]),
  tmuxKill: vi.fn().mockResolvedValue(undefined),
  readSettings: vi.fn().mockResolvedValue({
    snippets: [
      { title: 'Start', command: '/familiar', pressEnter: true },
      { title: 'Test', command: 'npm test', pressEnter: false, icon: 'play' }
    ]
  }),
  updateTask: vi.fn().mockResolvedValue(undefined),
  writeProjectState: vi.fn().mockResolvedValue(undefined),
  readProjectState: vi.fn().mockResolvedValue(null)
}

;(window as any).api = mockApi

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'tsk_test01',
    title: 'Test task',
    status: 'in-progress',
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

/** Flush microtask queue to let async effects complete */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Render TerminalPanel and wait for the active session to be established */
async function renderActive(taskId = 'tsk_test01'): Promise<ReturnType<typeof render>> {
  let result!: ReturnType<typeof render>
  await act(async () => {
    result = render(<TerminalPanel taskId={taskId} />)
    await flushPromises()
  })
  // Wait for the session to be created and component to update
  await act(async () => {
    await flushPromises()
  })
  return result
}

describe('TerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Restore default mocks
    mockApi.getProjectRoot.mockResolvedValue('/test/project')
    mockApi.ptyCreate.mockResolvedValue('session-123')
    mockApi.readSettings.mockResolvedValue({
      snippets: [
        { title: 'Start', command: '/familiar', pressEnter: true },
        { title: 'Test', command: 'npm test', pressEnter: false, icon: 'play' }
      ]
    })

    const task = makeTask()
    useTaskStore.setState({
      isLoading: false,
      projectState: makeProjectState([task])
    })
    useUIStore.setState({
      settingsOpen: false
    })
  })

  it('shows archived message for archived tasks', async () => {
    const task = makeTask({ status: 'archived' })
    useTaskStore.setState({
      projectState: makeProjectState([task])
    })

    await act(async () => {
      render(<TerminalPanel taskId="tsk_test01" />)
    })

    expect(screen.getByText('Task archived')).toBeInTheDocument()
    expect(
      screen.getByText(/Terminal sessions are stopped for archived tasks/)
    ).toBeInTheDocument()
    expect(mockApi.ptyCreate).not.toHaveBeenCalled()
  })

  it('shows "Connecting..." while session is being created', async () => {
    // Make ptyCreate never resolve to keep in connecting state
    mockApi.ptyCreate.mockReturnValue(new Promise(() => {}))

    await act(async () => {
      render(<TerminalPanel taskId="tsk_test01" />)
    })

    expect(screen.getByText('Connecting...')).toBeInTheDocument()
  })

  it('shows error message when PTY creation fails', async () => {
    mockApi.ptyCreate.mockRejectedValue(new Error('PTY connection failed'))

    await act(async () => {
      render(<TerminalPanel taskId="tsk_test01" />)
      await flushPromises()
    })

    expect(screen.getByText(/Terminal error: PTY connection failed/)).toBeInTheDocument()
  })

  it('renders terminal and snippet bar when session is active', async () => {
    await renderActive()

    expect(screen.getByTestId('mock-terminal')).toBeInTheDocument()
    expect(screen.getByText('Terminal session: session-123')).toBeInTheDocument()
  })

  it('loads and displays snippets from settings', async () => {
    await renderActive()

    expect(screen.getByText('Start')).toBeInTheDocument()
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('writes snippet command to PTY when snippet button is clicked', async () => {
    await renderActive()

    fireEvent.click(screen.getByText('Start'))

    // "Start" snippet has pressEnter: true, so command + '\r'
    expect(mockApi.ptyWrite).toHaveBeenCalledWith('session-123', '/familiar\r')
  })

  it('writes snippet command without enter when pressEnter is false', async () => {
    await renderActive()

    fireEvent.click(screen.getByText('Test'))

    // "Test" snippet has pressEnter: false
    expect(mockApi.ptyWrite).toHaveBeenCalledWith('session-123', 'npm test')
  })

  it('renders settings gear button that opens settings', async () => {
    const openSettingsSpy = vi.fn()
    useUIStore.setState({ openSettings: openSettingsSpy })

    await renderActive()

    const gearButton = screen.getByText('\u2699')
    fireEvent.click(gearButton)

    expect(openSettingsSpy).toHaveBeenCalledOnce()
  })

  it('renders Stop Agent button', async () => {
    await renderActive()

    expect(screen.getByText('Stop Agent')).toBeInTheDocument()
  })

  it('handles Stop Agent flow: kills tmux sessions, destroys PTY, shows stopped state', async () => {
    mockApi.tmuxList.mockResolvedValue(['familiar-tsk_test01-0', 'other-session-0'])

    await renderActive()

    await act(async () => {
      fireEvent.click(screen.getByText('Stop Agent'))
      await flushPromises()
    })

    // Should kill only matching tmux sessions
    expect(mockApi.tmuxKill).toHaveBeenCalledWith('familiar-tsk_test01-0')
    expect(mockApi.tmuxKill).not.toHaveBeenCalledWith('other-session-0')

    // Should destroy PTY
    expect(mockApi.ptyDestroy).toHaveBeenCalledWith('session-123')

    // Should show stopped state
    expect(screen.getByText('Agent stopped')).toBeInTheDocument()
    expect(screen.getByText('New Terminal Session')).toBeInTheDocument()
  })

  it('handles restart session flow from stopped state', async () => {
    mockApi.tmuxList.mockResolvedValue(['familiar-tsk_test01-0'])

    await renderActive()

    // Stop the agent
    await act(async () => {
      fireEvent.click(screen.getByText('Stop Agent'))
      await flushPromises()
    })

    expect(screen.getByText('New Terminal Session')).toBeInTheDocument()

    // Reset ptyCreate for the restart
    mockApi.ptyCreate.mockResolvedValue('session-456')

    // Click restart
    await act(async () => {
      fireEvent.click(screen.getByText('New Terminal Session'))
      await flushPromises()
    })

    expect(screen.getByText('Terminal session: session-456')).toBeInTheDocument()
  })

  it('uses default snippets when readSettings fails', async () => {
    mockApi.readSettings.mockRejectedValue(new Error('Settings unavailable'))

    await renderActive()

    // Default snippet is "Start" with command "/familiar"
    expect(screen.getByText('Start')).toBeInTheDocument()
  })

  it('does not create PTY for archived tasks', async () => {
    const task = makeTask({ status: 'archived' })
    useTaskStore.setState({
      projectState: makeProjectState([task])
    })

    await act(async () => {
      render(<TerminalPanel taskId="tsk_test01" />)
    })

    expect(mockApi.ptyCreate).not.toHaveBeenCalled()
    expect(mockApi.getProjectRoot).not.toHaveBeenCalled()
  })
})
