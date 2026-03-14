/**
 * Integration test for multi-project workspace switching.
 *
 * Simulates the full flow: two projects with different tasks,
 * switching between them via the sidebar, and verifying that
 * the correct project's data is loaded each time.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useTaskStore } from './task-store'
import { useWorkspaceStore } from './workspace-store'
import { useNotificationStore } from './notification-store'
import type { ProjectState, Task, AppNotification } from '@shared/types'

// ─── Mock data ──────────────────────────────────────────────────

const PROJECT_A_PATH = '/Users/test/project-alpha'
const PROJECT_B_PATH = '/Users/test/project-beta'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `tsk_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test task',
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

const projectAState: ProjectState = {
  version: 1,
  projectName: 'Alpha',
  tasks: [
    makeTask({ id: 'tsk_alpha1', title: 'Alpha Task 1' }),
    makeTask({ id: 'tsk_alpha2', title: 'Alpha Task 2', status: 'in-progress', agentStatus: 'running' })
  ],
  columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
  labels: []
}

const projectBState: ProjectState = {
  version: 1,
  projectName: 'Beta',
  tasks: [
    makeTask({ id: 'tsk_beta1', title: 'Beta Task 1' }),
    makeTask({ id: 'tsk_beta2', title: 'Beta Task 2' }),
    makeTask({ id: 'tsk_beta3', title: 'Beta Task 3' })
  ],
  columnOrder: ['todo', 'in-progress', 'in-review', 'done', 'archived'],
  labels: []
}

const notificationsA: AppNotification[] = [
  { id: 'notif_a1', title: 'Alpha done', taskId: 'tsk_alpha1', read: false, createdAt: '2026-01-01T00:00:00Z' }
]
const notificationsB: AppNotification[] = [
  { id: 'notif_b1', title: 'Beta done', taskId: 'tsk_beta1', read: false, createdAt: '2026-01-01T00:00:00Z' },
  { id: 'notif_b2', title: 'Beta review', taskId: 'tsk_beta2', read: true, createdAt: '2026-01-01T00:01:00Z' }
]

// ─── Mock API ────────────────────────────────────────────────────

// Tracks which project the backend "points to" — simulates the shared dataService
let activeBackendProject = PROJECT_A_PATH

const projectData: Record<string, { state: ProjectState; notifications: AppNotification[] }> = {
  [PROJECT_A_PATH]: { state: projectAState, notifications: notificationsA },
  [PROJECT_B_PATH]: { state: projectBState, notifications: notificationsB }
}

const mockApi = {
  // File handlers — read from whichever project the backend points to
  isInitialized: vi.fn(async () => {
    return !!projectData[activeBackendProject]
  }),
  readProjectState: vi.fn(async () => {
    const data = projectData[activeBackendProject]
    if (!data) throw new Error('Not initialized')
    return data.state
  }),
  writeProjectState: vi.fn(),
  initProject: vi.fn(),
  getProjectRoot: vi.fn(async () => activeBackendProject),

  // Notification handlers — read from current backend project
  listNotifications: vi.fn(async () => {
    return projectData[activeBackendProject]?.notifications ?? []
  }),
  listAllNotifications: vi.fn(async () => {
    const all: (AppNotification & { projectPath: string })[] = []
    for (const [path, data] of Object.entries(projectData)) {
      for (const n of data.notifications) {
        all.push({ ...n, projectPath: path })
      }
    }
    return all
  }),
  markNotificationRead: vi.fn(),
  markNotificationsByTaskRead: vi.fn(),
  markNotificationsByTaskIds: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  clearNotifications: vi.fn(),
  appendNotification: vi.fn(),

  // Workspace handlers
  workspaceSetActiveProject: vi.fn(async (path: string) => {
    // Simulates what the backend does: switch the shared dataService
    activeBackendProject = path
  }),
  workspaceGetOpenProjects: vi.fn(async () => [PROJECT_A_PATH, PROJECT_B_PATH]),
  workspaceGetActiveProject: vi.fn(async () => activeBackendProject),
  workspaceAddProject: vi.fn(),
  workspaceRemoveProject: vi.fn(),
  workspaceOpen: vi.fn(),
  workspaceOpenSingle: vi.fn(),
  workspaceList: vi.fn(async () => []),
  workspaceCreate: vi.fn(),
  workspaceUpdate: vi.fn(),
  workspaceDelete: vi.fn(),
  workspaceGetConfig: vi.fn(async () => ({ workspaces: [], lastWorkspaceId: null })),
  workspaceSetActiveWorkspaceId: vi.fn(),
  workspaceListAllTasks: vi.fn(async () => {
    const all: (Task & { projectPath: string })[] = []
    for (const [path, data] of Object.entries(projectData)) {
      for (const t of data.state.tasks) {
        all.push({ ...t, projectPath: path })
      }
    }
    return all
  }),

  // Other mocks needed by stores
  openDirectory: vi.fn(),
  setProjectRoot: vi.fn(),
  tmuxList: vi.fn(async () => []),
  tmuxKill: vi.fn(),
  warmupTmuxSession: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  readSettings: vi.fn(async () => ({ codingAgent: 'claude-code', skipDoctor: true })),
  writeSettings: vi.fn(),
  readTaskDocument: vi.fn(),
  writeTaskDocument: vi.fn(),
  readTaskActivity: vi.fn(async () => []),
  appendActivity: vi.fn()
}

Object.defineProperty(globalThis, 'window', {
  value: { api: mockApi },
  writable: true
})

// ─── Tests ───────────────────────────────────────────────────────

describe('Project switching integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    activeBackendProject = PROJECT_A_PATH

    // Reset stores
    useTaskStore.setState({ projectState: null, isLoading: false, error: null })
    useWorkspaceStore.setState({
      openProjects: [
        { path: PROJECT_A_PATH, name: 'project-alpha' },
        { path: PROJECT_B_PATH, name: 'project-beta' }
      ],
      activeProjectPath: PROJECT_A_PATH,
      sidebarVisible: true,
      sidebarExpanded: false
    })
    useNotificationStore.setState({
      notifications: [],
      workspaceNotifications: []
    })
  })

  describe('loadProjectState reads from the correct project', () => {
    it('loads project A tasks when A is active', async () => {
      activeBackendProject = PROJECT_A_PATH
      await useTaskStore.getState().loadProjectState()

      const state = useTaskStore.getState().projectState
      expect(state).not.toBeNull()
      expect(state!.projectName).toBe('Alpha')
      expect(state!.tasks).toHaveLength(2)
      expect(state!.tasks[0].id).toBe('tsk_alpha1')
    })

    it('loads project B tasks when B is active', async () => {
      activeBackendProject = PROJECT_B_PATH
      await useTaskStore.getState().loadProjectState()

      const state = useTaskStore.getState().projectState
      expect(state).not.toBeNull()
      expect(state!.projectName).toBe('Beta')
      expect(state!.tasks).toHaveLength(3)
      expect(state!.tasks[0].id).toBe('tsk_beta1')
    })
  })

  describe('switchProject + loadProjectState flow', () => {
    it('switching from A to B loads B tasks', async () => {
      // Start with A loaded
      await useTaskStore.getState().loadProjectState()
      expect(useTaskStore.getState().projectState!.projectName).toBe('Alpha')

      // Switch to B (simulates ProjectSidebar.handleSwitchProject)
      await useWorkspaceStore.getState().switchProject(PROJECT_B_PATH)
      expect(activeBackendProject).toBe(PROJECT_B_PATH)
      expect(useWorkspaceStore.getState().activeProjectPath).toBe(PROJECT_B_PATH)

      await useTaskStore.getState().loadProjectState()

      const state = useTaskStore.getState().projectState
      expect(state!.projectName).toBe('Beta')
      expect(state!.tasks).toHaveLength(3)
    })

    it('switching from B back to A loads A tasks', async () => {
      // Start with B
      activeBackendProject = PROJECT_B_PATH
      useWorkspaceStore.setState({ activeProjectPath: PROJECT_B_PATH })
      await useTaskStore.getState().loadProjectState()
      expect(useTaskStore.getState().projectState!.projectName).toBe('Beta')

      // Switch to A
      await useWorkspaceStore.getState().switchProject(PROJECT_A_PATH)
      await useTaskStore.getState().loadProjectState()

      const state = useTaskStore.getState().projectState
      expect(state!.projectName).toBe('Alpha')
      expect(state!.tasks).toHaveLength(2)
    })

    it('rapid A→B→A switching ends with A tasks', async () => {
      await useTaskStore.getState().loadProjectState()
      expect(useTaskStore.getState().projectState!.projectName).toBe('Alpha')

      // Switch to B
      await useWorkspaceStore.getState().switchProject(PROJECT_B_PATH)
      await useTaskStore.getState().loadProjectState()
      expect(useTaskStore.getState().projectState!.projectName).toBe('Beta')

      // Switch back to A
      await useWorkspaceStore.getState().switchProject(PROJECT_A_PATH)
      await useTaskStore.getState().loadProjectState()
      expect(useTaskStore.getState().projectState!.projectName).toBe('Alpha')
    })
  })

  describe('notifications load for correct project', () => {
    it('loadNotifications returns active project notifications', async () => {
      activeBackendProject = PROJECT_A_PATH
      await useNotificationStore.getState().loadNotifications()
      expect(useNotificationStore.getState().notifications).toHaveLength(1)
      expect(useNotificationStore.getState().notifications[0].id).toBe('notif_a1')
    })

    it('switching to B loads B notifications', async () => {
      await useWorkspaceStore.getState().switchProject(PROJECT_B_PATH)
      await useNotificationStore.getState().loadNotifications()

      const notifications = useNotificationStore.getState().notifications
      expect(notifications).toHaveLength(2)
      expect(notifications[0].id).toBe('notif_b1')
    })

    it('workspace notifications aggregate all projects', async () => {
      await useNotificationStore.getState().loadWorkspaceNotifications()
      const wsNotifs = useNotificationStore.getState().workspaceNotifications
      expect(wsNotifs).toHaveLength(3) // 1 from A + 2 from B
      expect(wsNotifs.some((n) => n.projectPath === PROJECT_A_PATH)).toBe(true)
      expect(wsNotifs.some((n) => n.projectPath === PROJECT_B_PATH)).toBe(true)
    })

    it('workspaceUnreadCountForProject returns correct per-project counts', async () => {
      await useNotificationStore.getState().loadWorkspaceNotifications()
      const countA = useNotificationStore.getState().workspaceUnreadCountForProject(PROJECT_A_PATH)
      const countB = useNotificationStore.getState().workspaceUnreadCountForProject(PROJECT_B_PATH)
      expect(countA).toBe(1) // notif_a1 is unread
      expect(countB).toBe(1) // notif_b1 is unread, notif_b2 is read
    })
  })

  describe('full handleSwitchProject simulation', () => {
    /**
     * Simulates exactly what ProjectSidebar.handleSwitchProject does:
     * 1. switchProject(path)
     * 2. loadProjectState()
     * 3. loadNotifications()
     * 4. loadWorkspaceNotifications()
     */
    async function simulateHandleSwitchProject(path: string): Promise<void> {
      await useWorkspaceStore.getState().switchProject(path)
      await useTaskStore.getState().loadProjectState()
      await useNotificationStore.getState().loadNotifications()
      await useNotificationStore.getState().loadWorkspaceNotifications()
    }

    it('full switch from A to B shows B dashboard', async () => {
      // Initial load of A
      await useTaskStore.getState().loadProjectState()
      await useNotificationStore.getState().loadNotifications()
      expect(useTaskStore.getState().projectState!.projectName).toBe('Alpha')
      expect(useNotificationStore.getState().notifications).toHaveLength(1)

      // Full switch to B
      await simulateHandleSwitchProject(PROJECT_B_PATH)

      // Verify B's data is loaded
      expect(activeBackendProject).toBe(PROJECT_B_PATH)
      expect(useWorkspaceStore.getState().activeProjectPath).toBe(PROJECT_B_PATH)
      expect(useTaskStore.getState().projectState!.projectName).toBe('Beta')
      expect(useTaskStore.getState().projectState!.tasks).toHaveLength(3)
      expect(useNotificationStore.getState().notifications).toHaveLength(2)
    })

    it('full switch B→A shows A dashboard', async () => {
      // Start at B
      activeBackendProject = PROJECT_B_PATH
      useWorkspaceStore.setState({ activeProjectPath: PROJECT_B_PATH })
      await useTaskStore.getState().loadProjectState()
      expect(useTaskStore.getState().projectState!.projectName).toBe('Beta')

      // Full switch to A
      await simulateHandleSwitchProject(PROJECT_A_PATH)

      expect(useTaskStore.getState().projectState!.projectName).toBe('Alpha')
      expect(useTaskStore.getState().projectState!.tasks).toHaveLength(2)
      expect(useNotificationStore.getState().notifications).toHaveLength(1)
    })

    it('multiple switches always show the final project', async () => {
      await useTaskStore.getState().loadProjectState()

      await simulateHandleSwitchProject(PROJECT_B_PATH)
      expect(useTaskStore.getState().projectState!.projectName).toBe('Beta')

      await simulateHandleSwitchProject(PROJECT_A_PATH)
      expect(useTaskStore.getState().projectState!.projectName).toBe('Alpha')

      await simulateHandleSwitchProject(PROJECT_B_PATH)
      expect(useTaskStore.getState().projectState!.projectName).toBe('Beta')
    })
  })

  describe('generation counter does not discard legitimate loads', () => {
    it('sequential loadProjectState calls all apply (no spurious drops)', async () => {
      // Call 1: load A
      await useTaskStore.getState().loadProjectState()
      expect(useTaskStore.getState().projectState!.projectName).toBe('Alpha')

      // Switch backend to B
      activeBackendProject = PROJECT_B_PATH

      // Call 2: load B
      await useTaskStore.getState().loadProjectState()
      expect(useTaskStore.getState().projectState!.projectName).toBe('Beta')
    })

    it('concurrent calls: only latest applies', async () => {
      // Make the first call slow
      let resolveSlowInit!: (v: boolean) => void
      mockApi.isInitialized.mockReturnValueOnce(
        new Promise<boolean>((r) => { resolveSlowInit = r })
      )

      // Start slow call (reads from A)
      const call1 = useTaskStore.getState().loadProjectState()

      // Switch to B and start fast call
      activeBackendProject = PROJECT_B_PATH
      const call2 = useTaskStore.getState().loadProjectState()
      await call2
      expect(useTaskStore.getState().projectState!.projectName).toBe('Beta')

      // Now let slow call finish — it should be discarded
      resolveSlowInit(true)
      await call1
      // Store should STILL have Beta, not Alpha
      expect(useTaskStore.getState().projectState!.projectName).toBe('Beta')
    })
  })

  describe('IPC calls go to the correct backend project', () => {
    it('switchProject calls workspaceSetActiveProject with correct path', async () => {
      await useWorkspaceStore.getState().switchProject(PROJECT_B_PATH)
      expect(mockApi.workspaceSetActiveProject).toHaveBeenCalledWith(PROJECT_B_PATH)
    })

    it('workspaceSetActiveProject updates the backend active project', async () => {
      expect(activeBackendProject).toBe(PROJECT_A_PATH)
      await useWorkspaceStore.getState().switchProject(PROJECT_B_PATH)
      expect(activeBackendProject).toBe(PROJECT_B_PATH)
    })

    it('readProjectState reads from the active backend project after switch', async () => {
      await useWorkspaceStore.getState().switchProject(PROJECT_B_PATH)

      const state = await mockApi.readProjectState()
      expect(state.projectName).toBe('Beta')
    })
  })
})
