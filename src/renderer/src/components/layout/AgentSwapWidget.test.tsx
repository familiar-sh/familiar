import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AgentSwapWidget } from './AgentSwapWidget'
import { useTaskStore } from '@renderer/stores/task-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useUIStore } from '@renderer/stores/ui-store'
import type { Task } from '@shared/types'

// Mock CSS modules
vi.mock('./AgentSwapWidget.module.css', () => ({
  default: new Proxy(
    {},
    { get: (_target, name) => (typeof name === 'string' ? name : '') }
  )
}))

// Mock format-time
vi.mock('@renderer/lib/format-time', () => ({
  formatRelativeTime: () => '2m ago'
}))

// Mock window.api
const mockWorkspaceListAllTasks = vi.fn()
const mockReadTaskActivity = vi.fn()
const mockWorkspaceSetActiveProject = vi.fn()
const mockMarkNotificationRead = vi.fn()
const mockReadProjectState = vi.fn()
const mockListNotifications = vi.fn()
const mockListAllNotifications = vi.fn()

;(window as any).api = {
  workspaceListAllTasks: mockWorkspaceListAllTasks,
  readTaskActivity: mockReadTaskActivity,
  workspaceSetActiveProject: mockWorkspaceSetActiveProject,
  markNotificationRead: mockMarkNotificationRead,
  readProjectState: mockReadProjectState,
  listNotifications: mockListNotifications,
  listAllNotifications: mockListAllNotifications
}

function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: 'Test Task',
    status: 'in-progress',
    priority: 'medium',
    labels: [],
    agentStatus: 'running',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    sortOrder: 0,
    ...overrides
  }
}

describe('AgentSwapWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceListAllTasks.mockResolvedValue([])
    mockReadTaskActivity.mockResolvedValue([])
    mockWorkspaceSetActiveProject.mockResolvedValue(undefined)
    mockMarkNotificationRead.mockResolvedValue(undefined)
    mockReadProjectState.mockResolvedValue({
      version: 1,
      projectName: 'Test',
      tasks: [],
      columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
      labels: []
    })
    mockListNotifications.mockResolvedValue([])
    mockListAllNotifications.mockResolvedValue([])

    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'Test',
        tasks: [],
        columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
        labels: []
      }
    })

    useNotificationStore.setState({
      notifications: [],
      workspaceNotifications: [],
      loading: false
    })

    useWorkspaceStore.setState({
      activeProjectPath: '/project-a',
      openProjects: [],
      sidebarVisible: false
    })

    useUIStore.setState({
      taskDetailOpen: false,
      activeTaskId: null
    })
  })

  it('returns null when no active agents and no notifications', () => {
    const { container } = render(<AgentSwapWidget />)
    expect(container.innerHTML).toBe('')
  })

  it('renders dots for running agents', () => {
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'Test',
        tasks: [makeTask({ id: 'tsk_1', title: 'Running task', agentStatus: 'running' })],
        columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
        labels: []
      }
    })

    render(<AgentSwapWidget />)
    expect(screen.getByLabelText('Running task')).toBeTruthy()
  })

  it('opens task detail on agent dot click (same project)', () => {
    useTaskStore.setState({
      projectState: {
        version: 1,
        projectName: 'Test',
        tasks: [makeTask({ id: 'tsk_1', title: 'My Task', agentStatus: 'running' })],
        columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
        labels: []
      }
    })

    render(<AgentSwapWidget />)
    fireEvent.click(screen.getByLabelText('My Task'))

    expect(useUIStore.getState().activeTaskId).toBe('tsk_1')
    expect(useUIStore.getState().taskDetailOpen).toBe(true)
  })

  it('switches project before opening task detail for cross-project agent', async () => {
    const crossProjectTask = {
      ...makeTask({ id: 'tsk_cross', title: 'Cross-project task', agentStatus: 'running' }),
      projectPath: '/project-b'
    }

    // Multiple open projects triggers cross-project loading
    useWorkspaceStore.setState({
      activeProjectPath: '/project-a',
      openProjects: [
        { path: '/project-a', name: 'Project A' },
        { path: '/project-b', name: 'Project B' }
      ] as any[]
    })

    mockWorkspaceListAllTasks.mockResolvedValue([crossProjectTask])

    render(<AgentSwapWidget />)

    // Wait for cross-project tasks to load
    await waitFor(() => {
      expect(screen.getByLabelText('Cross-project task')).toBeTruthy()
    })

    fireEvent.click(screen.getByLabelText('Cross-project task'))

    // Should have called switchProject with the task's projectPath
    await waitFor(() => {
      expect(mockWorkspaceSetActiveProject).toHaveBeenCalledWith('/project-b')
    })

    // After switching, task detail should open
    await waitFor(() => {
      expect(useUIStore.getState().activeTaskId).toBe('tsk_cross')
      expect(useUIStore.getState().taskDetailOpen).toBe(true)
    })
  })

  it('does not switch project when agent is in the same project', async () => {
    const sameProjectTask = {
      ...makeTask({ id: 'tsk_same', title: 'Same-project task', agentStatus: 'running' }),
      projectPath: '/project-a'
    }

    useWorkspaceStore.setState({
      activeProjectPath: '/project-a',
      openProjects: [
        { path: '/project-a', name: 'Project A' },
        { path: '/project-b', name: 'Project B' }
      ] as any[]
    })

    mockWorkspaceListAllTasks.mockResolvedValue([sameProjectTask])

    render(<AgentSwapWidget />)

    await waitFor(() => {
      expect(screen.getByLabelText('Same-project task')).toBeTruthy()
    })

    fireEvent.click(screen.getByLabelText('Same-project task'))

    // Should NOT switch project
    expect(mockWorkspaceSetActiveProject).not.toHaveBeenCalled()

    // Should still open task detail
    expect(useUIStore.getState().activeTaskId).toBe('tsk_same')
    expect(useUIStore.getState().taskDetailOpen).toBe(true)
  })

  it('switches project for notification from a different project', async () => {
    useWorkspaceStore.setState({
      activeProjectPath: '/project-a',
      openProjects: [
        { path: '/project-a', name: 'Project A' },
        { path: '/project-b', name: 'Project B' }
      ] as any[]
    })

    useNotificationStore.setState({
      workspaceNotifications: [
        {
          id: 'notif_1',
          title: 'Agent stopped',
          body: '',
          read: false,
          taskId: 'tsk_remote',
          createdAt: '2026-01-01T00:00:00Z',
          projectPath: '/project-b'
        }
      ]
    })

    render(<AgentSwapWidget />)
    fireEvent.click(screen.getByLabelText('Agent stopped'))

    await waitFor(() => {
      expect(mockWorkspaceSetActiveProject).toHaveBeenCalledWith('/project-b')
    })

    await waitFor(() => {
      expect(useUIStore.getState().activeTaskId).toBe('tsk_remote')
      expect(useUIStore.getState().taskDetailOpen).toBe(true)
    })
  })

  it('does not switch project for notification in the same project', () => {
    useNotificationStore.setState({
      workspaceNotifications: [
        {
          id: 'notif_1',
          title: 'Agent done',
          body: '',
          read: false,
          taskId: 'tsk_local',
          createdAt: '2026-01-01T00:00:00Z',
          projectPath: '/project-a'
        }
      ]
    })

    render(<AgentSwapWidget />)
    fireEvent.click(screen.getByLabelText('Agent done'))

    expect(mockWorkspaceSetActiveProject).not.toHaveBeenCalled()
    expect(useUIStore.getState().activeTaskId).toBe('tsk_local')
  })
})
