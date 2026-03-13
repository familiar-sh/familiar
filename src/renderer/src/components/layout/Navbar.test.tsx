import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { Navbar } from './Navbar'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useNotificationStore } from '@renderer/stores/notification-store'

// Mock AgentSwapWidget to avoid its complex dependencies
vi.mock('./AgentSwapWidget', () => ({
  AgentSwapWidget: () => <div data-testid="mock-agent-swap">AgentSwap</div>
}))

// Mock format-time
vi.mock('@renderer/lib/format-time', () => ({
  formatRelativeTime: () => '2m ago'
}))

// Mock window.api
const mockGetProjectRoot = vi.fn()
const mockOpenPath = vi.fn()
const mockListNotifications = vi.fn()
const mockMarkNotificationRead = vi.fn()
const mockMarkNotificationsByTaskRead = vi.fn()
const mockMarkAllNotificationsRead = vi.fn()
const mockClearNotifications = vi.fn()

;(window as any).api = {
  getProjectRoot: mockGetProjectRoot,
  openPath: mockOpenPath,
  listNotifications: mockListNotifications,
  markNotificationRead: mockMarkNotificationRead,
  markNotificationsByTaskRead: mockMarkNotificationsByTaskRead,
  markAllNotificationsRead: mockMarkAllNotificationsRead,
  clearNotifications: mockClearNotifications
}

async function renderNavbarAndWait(): Promise<ReturnType<typeof render>> {
  const result = render(<Navbar />)
  await waitFor(() => {
    expect(screen.getByText(/my-project/)).toBeTruthy()
  })
  return result
}

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Re-set mock implementations after clearAllMocks
    mockGetProjectRoot.mockResolvedValue('/Users/test/my-project')
    mockListNotifications.mockResolvedValue([])
    mockMarkNotificationRead.mockResolvedValue(undefined)
    mockMarkNotificationsByTaskRead.mockResolvedValue(undefined)
    mockMarkAllNotificationsRead.mockResolvedValue(undefined)
    mockClearNotifications.mockResolvedValue(undefined)
    useUIStore.setState({
      taskDetailOpen: false,
      activeTaskId: null,
      settingsOpen: false
    })

    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'Test Project',
        tasks: [],
        columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
        labels: []
      }
    })

    useNotificationStore.setState({
      notifications: [],
      loading: false
    })
  })

  // --- Project name ---

  it('shows project name from folder after loading', async () => {
    await renderNavbarAndWait()
    expect(screen.getByText(/my-project/)).toBeTruthy()
  })

  it('shows projectState name as fallback before project root loads', () => {
    mockGetProjectRoot.mockReturnValue(new Promise(() => {})) // never resolves
    render(<Navbar />)
    expect(screen.getByText(/Test Project/)).toBeTruthy()
  })

  it('shows APP_NAME when no project state', () => {
    useTaskStore.setState({ projectState: null })
    render(<Navbar />)
    expect(screen.getByText(/Familiar/)).toBeTruthy()
  })

  it('shows folder emoji next to project name', async () => {
    await renderNavbarAndWait()
    expect(screen.getByText(/📁/)).toBeTruthy()
  })

  // --- Dashboard button ---

  it('calls closeTaskDetail when dashboard button clicked and task detail is open', async () => {
    useUIStore.setState({ taskDetailOpen: true, activeTaskId: 'tsk_1' })
    await renderNavbarAndWait()

    const dashboardBtn = screen.getByTitle('Dashboard')
    fireEvent.click(dashboardBtn)
    expect(useUIStore.getState().taskDetailOpen).toBe(false)
  })

  it('does not toggle when dashboard button clicked and already on dashboard', async () => {
    useUIStore.setState({ taskDetailOpen: false })
    await renderNavbarAndWait()

    const dashboardBtn = screen.getByTitle('Dashboard')
    fireEvent.click(dashboardBtn)
    expect(useUIStore.getState().taskDetailOpen).toBe(false)
  })

  // --- Open in Finder ---

  it('calls openPath with project root when Finder button clicked', async () => {
    await renderNavbarAndWait()

    const finderBtn = screen.getByTitle('Open in Finder')
    fireEvent.click(finderBtn)
    expect(mockOpenPath).toHaveBeenCalledWith('/Users/test/my-project')
  })

  // --- Settings button ---

  it('opens settings when settings button clicked', async () => {
    await renderNavbarAndWait()

    const settingsBtn = screen.getByTitle('Settings (⌘,)')
    fireEvent.click(settingsBtn)
    expect(useUIStore.getState().settingsOpen).toBe(true)
  })

  it('closes settings when settings button clicked and settings are open', async () => {
    useUIStore.setState({ settingsOpen: true })
    await renderNavbarAndWait()

    const settingsBtn = screen.getByTitle('Settings (⌘,)')
    fireEvent.click(settingsBtn)
    expect(useUIStore.getState().settingsOpen).toBe(false)
  })

  // --- Help menu ---

  it('opens help menu on click', async () => {
    await renderNavbarAndWait()

    const helpBtn = screen.getByTitle('Agent setup prompts')
    fireEvent.click(helpBtn)

    expect(screen.getByText('Run Onboarding')).toBeTruthy()
  })

  it('closes help menu on outside click', async () => {
    await renderNavbarAndWait()

    fireEvent.click(screen.getByTitle('Agent setup prompts'))
    expect(screen.getByText('Run Onboarding')).toBeTruthy()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Run Onboarding')).toBeNull()
  })

  it('opens onboarding when Run Onboarding is clicked', async () => {
    await renderNavbarAndWait()

    fireEvent.click(screen.getByTitle('Agent setup prompts'))
    fireEvent.click(screen.getByText('Run Onboarding'))

    expect(useUIStore.getState().onboardingOpen).toBe(true)
  })

  // --- Notification bell ---

  it('shows no badge when no unread notifications', async () => {
    await renderNavbarAndWait()
    const bellBtn = screen.getByTitle('Notifications')
    // The badge span is conditionally rendered; with 0 unread there should be no span child
    const spans = bellBtn.querySelectorAll('span')
    expect(spans.length).toBe(0)
  })

  it('shows badge with unread count', async () => {
    useNotificationStore.setState({
      notifications: [
        { id: '1', title: 'Test', body: '', read: false, createdAt: '2026-01-01T00:00:00Z' },
        { id: '2', title: 'Test2', body: '', read: true, createdAt: '2026-01-01T00:00:00Z' }
      ]
    })
    await renderNavbarAndWait()
    expect(screen.getByText('1')).toBeTruthy()
  })

  it('shows 99+ for more than 99 unread notifications', async () => {
    const notifications = Array.from({ length: 100 }, (_, i) => ({
      id: `n${i}`,
      title: `Notification ${i}`,
      body: '',
      read: false,
      createdAt: '2026-01-01T00:00:00Z'
    }))
    useNotificationStore.setState({ notifications })
    await renderNavbarAndWait()
    expect(screen.getByText('99+')).toBeTruthy()
  })

  it('opens notification dropdown on bell click', async () => {
    await renderNavbarAndWait()
    fireEvent.click(screen.getByTitle('Notifications'))
    expect(screen.getByText('No notifications')).toBeTruthy()
  })

  it('shows notification items in dropdown', async () => {
    useNotificationStore.setState({
      notifications: [
        { id: '1', title: 'Build failed', body: 'Error in step 3', read: false, createdAt: '2026-01-01T00:00:00Z' }
      ]
    })
    await renderNavbarAndWait()
    fireEvent.click(screen.getByTitle('Notifications'))

    expect(screen.getByText('Build failed')).toBeTruthy()
    expect(screen.getByText('Error in step 3')).toBeTruthy()
    expect(screen.getByText('2m ago')).toBeTruthy()
  })

  it('shows "Mark all read" button when there are unread notifications', async () => {
    useNotificationStore.setState({
      notifications: [
        { id: '1', title: 'Test', body: '', read: false, createdAt: '2026-01-01T00:00:00Z' }
      ]
    })
    await renderNavbarAndWait()
    fireEvent.click(screen.getByTitle('Notifications'))

    expect(screen.getByText('Mark all read')).toBeTruthy()
  })

  it('shows "Clear all" button when there are notifications', async () => {
    useNotificationStore.setState({
      notifications: [
        { id: '1', title: 'Test', body: '', read: true, createdAt: '2026-01-01T00:00:00Z' }
      ]
    })
    await renderNavbarAndWait()
    fireEvent.click(screen.getByTitle('Notifications'))

    expect(screen.getByText('Clear all')).toBeTruthy()
  })

  it('clicking notification with taskId opens task detail', async () => {
    useNotificationStore.setState({
      notifications: [
        { id: '1', title: 'Task updated', body: '', read: false, taskId: 'tsk_abc', createdAt: '2026-01-01T00:00:00Z' }
      ]
    })
    await renderNavbarAndWait()
    fireEvent.click(screen.getByTitle('Notifications'))
    fireEvent.click(screen.getByText('Task updated'))

    expect(useUIStore.getState().activeTaskId).toBe('tsk_abc')
    expect(useUIStore.getState().taskDetailOpen).toBe(true)
  })

  it('closes notification dropdown on outside click', async () => {
    await renderNavbarAndWait()
    fireEvent.click(screen.getByTitle('Notifications'))
    expect(screen.getByText('No notifications')).toBeTruthy()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('No notifications')).toBeNull()
  })

  // --- AgentSwapWidget ---

  it('renders the AgentSwapWidget', async () => {
    await renderNavbarAndWait()
    expect(screen.getByTestId('mock-agent-swap')).toBeTruthy()
  })
})
