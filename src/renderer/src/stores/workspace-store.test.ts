import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorkspaceStore } from './workspace-store'
import type { Workspace } from '@shared/types'

// Mock window.api
const mockApi = {
  workspaceList: vi.fn(),
  workspaceCreate: vi.fn(),
  workspaceUpdate: vi.fn(),
  workspaceDelete: vi.fn(),
  workspaceOpen: vi.fn(),
  workspaceOpenSingle: vi.fn(),
  workspaceAddProject: vi.fn(),
  workspaceRemoveProject: vi.fn(),
  workspaceGetConfig: vi.fn(),
  workspaceGetOpenProjects: vi.fn(),
  workspaceGetActiveProject: vi.fn(),
  workspaceSetActiveProject: vi.fn(),
  workspaceSetActiveWorkspaceId: vi.fn(),
  openDirectory: vi.fn(),
  worktreeList: vi.fn(),
  worktreeGetGitRoot: vi.fn(),
  worktreeCreate: vi.fn(),
  worktreeRename: vi.fn(),
  worktreeRemove: vi.fn()
}

vi.stubGlobal('window', {
  api: mockApi
})

beforeEach(() => {
  vi.clearAllMocks()
  // Reset store
  useWorkspaceStore.setState({
    workspaces: [],
    activeWorkspace: null,
    openProjects: [],
    activeProjectPath: null,
    sidebarExpanded: false,
    sidebarVisible: false,
    showWorkspacePicker: false
  })
})

describe('workspace-store', () => {
  describe('loadWorkspaces', () => {
    it('loads workspaces from IPC', async () => {
      const workspaces: Workspace[] = [
        {
          id: 'ws_1',
          name: 'Test',
          projectPaths: ['/tmp/a'],
          lastOpenedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        }
      ]
      mockApi.workspaceList.mockResolvedValue(workspaces)

      await useWorkspaceStore.getState().loadWorkspaces()
      expect(useWorkspaceStore.getState().workspaces).toEqual(workspaces)
    })
  })

  describe('loadOpenProjects', () => {
    it('loads open projects and active project from IPC', async () => {
      mockApi.workspaceGetOpenProjects.mockResolvedValue(['/tmp/a', '/tmp/b'])
      mockApi.workspaceGetActiveProject.mockResolvedValue('/tmp/a')

      await useWorkspaceStore.getState().loadOpenProjects()

      const state = useWorkspaceStore.getState()
      expect(state.openProjects).toHaveLength(2)
      expect(state.openProjects[0].path).toBe('/tmp/a')
      expect(state.openProjects[0].name).toBe('a')
      expect(state.openProjects[1].path).toBe('/tmp/b')
      expect(state.openProjects[1].name).toBe('b')
      expect(state.activeProjectPath).toBe('/tmp/a')
    })

    it('makes sidebar visible when 2+ projects are open', async () => {
      mockApi.workspaceGetOpenProjects.mockResolvedValue(['/tmp/a', '/tmp/b'])
      mockApi.workspaceGetActiveProject.mockResolvedValue('/tmp/a')

      await useWorkspaceStore.getState().loadOpenProjects()
      expect(useWorkspaceStore.getState().sidebarVisible).toBe(true)
    })

    it('hides sidebar when only 1 project open', async () => {
      mockApi.workspaceGetOpenProjects.mockResolvedValue(['/tmp/a'])
      mockApi.workspaceGetActiveProject.mockResolvedValue('/tmp/a')

      await useWorkspaceStore.getState().loadOpenProjects()
      expect(useWorkspaceStore.getState().sidebarVisible).toBe(false)
    })
  })

  describe('switchProject', () => {
    it('calls IPC and updates activeProjectPath', async () => {
      mockApi.workspaceSetActiveProject.mockResolvedValue(undefined)

      await useWorkspaceStore.getState().switchProject('/tmp/b')
      expect(mockApi.workspaceSetActiveProject).toHaveBeenCalledWith('/tmp/b')
      expect(useWorkspaceStore.getState().activeProjectPath).toBe('/tmp/b')
    })
  })

  describe('openWorkspace', () => {
    it('calls IPC and reloads state', async () => {
      mockApi.workspaceOpen.mockResolvedValue(undefined)
      mockApi.workspaceGetOpenProjects.mockResolvedValue(['/tmp/a', '/tmp/b'])
      mockApi.workspaceGetActiveProject.mockResolvedValue('/tmp/a')
      mockApi.workspaceList.mockResolvedValue([])
      mockApi.workspaceGetConfig.mockResolvedValue({
        workspaces: [{ id: 'ws_1', name: 'Test', projectPaths: ['/tmp/a', '/tmp/b'], lastOpenedAt: '', createdAt: '' }],
        lastWorkspaceId: 'ws_1'
      })

      await useWorkspaceStore.getState().openWorkspace('ws_1')
      expect(mockApi.workspaceOpen).toHaveBeenCalledWith('ws_1')
      expect(useWorkspaceStore.getState().showWorkspacePicker).toBe(false)
    })
  })

  describe('sidebar state', () => {
    it('toggleSidebar toggles expanded state', () => {
      expect(useWorkspaceStore.getState().sidebarExpanded).toBe(false)
      useWorkspaceStore.getState().toggleSidebar()
      expect(useWorkspaceStore.getState().sidebarExpanded).toBe(true)
      useWorkspaceStore.getState().toggleSidebar()
      expect(useWorkspaceStore.getState().sidebarExpanded).toBe(false)
    })

    it('setSidebarExpanded sets expanded to a specific value', () => {
      useWorkspaceStore.getState().setSidebarExpanded(true)
      expect(useWorkspaceStore.getState().sidebarExpanded).toBe(true)
    })
  })

  describe('workspace picker', () => {
    it('setShowWorkspacePicker toggles picker visibility', () => {
      useWorkspaceStore.getState().setShowWorkspacePicker(true)
      expect(useWorkspaceStore.getState().showWorkspacePicker).toBe(true)
      useWorkspaceStore.getState().setShowWorkspacePicker(false)
      expect(useWorkspaceStore.getState().showWorkspacePicker).toBe(false)
    })
  })

  describe('addProject', () => {
    it('returns null when directory picker is cancelled', async () => {
      mockApi.openDirectory.mockResolvedValue(null)

      const result = await useWorkspaceStore.getState().addProject()
      expect(result).toBeNull()
      expect(mockApi.workspaceAddProject).not.toHaveBeenCalled()
    })

    it('adds project and reloads when path selected', async () => {
      const implicitWs: Workspace = {
        id: 'ws_implicit',
        name: 'My Workspace',
        projectPaths: ['/tmp/a', '/tmp/new'],
        lastOpenedAt: '2026-01-01T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z'
      }
      mockApi.openDirectory.mockResolvedValue('/tmp/new')
      mockApi.workspaceAddProject.mockResolvedValue(undefined)
      mockApi.workspaceGetOpenProjects.mockResolvedValue(['/tmp/a', '/tmp/new'])
      mockApi.workspaceGetActiveProject.mockResolvedValue('/tmp/a')
      mockApi.workspaceCreate.mockResolvedValue(implicitWs)
      mockApi.workspaceSetActiveWorkspaceId.mockResolvedValue(undefined)

      // Set initial state with one project
      useWorkspaceStore.setState({
        openProjects: [{ path: '/tmp/a', name: 'a' }],
        activeProjectPath: '/tmp/a'
      })

      // addProject calls promptWorkspaceName when no workspace exists.
      // Resolve the prompt asynchronously to unblock the flow.
      const addPromise = useWorkspaceStore.getState().addProject()
      // Wait a tick for the prompt to be set up
      await new Promise((r) => setTimeout(r, 0))
      useWorkspaceStore.getState().resolveWorkspaceNamePrompt('My Workspace')

      const result = await addPromise
      expect(result).toBe('/tmp/new')
      expect(mockApi.workspaceAddProject).toHaveBeenCalledWith('/tmp/new')
      // Should create a workspace with the user-provided name and sync backend activeWorkspaceId
      expect(mockApi.workspaceCreate).toHaveBeenCalledWith('My Workspace', ['/tmp/a', '/tmp/new'])
      expect(mockApi.workspaceSetActiveWorkspaceId).toHaveBeenCalledWith('ws_implicit')
    })

    it('updates existing workspace when adding a third project', async () => {
      const existingWs: Workspace = {
        id: 'ws_existing',
        name: '',
        projectPaths: ['/tmp/a', '/tmp/b'],
        lastOpenedAt: '2026-01-01T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z'
      }
      const updatedWs: Workspace = {
        ...existingWs,
        projectPaths: ['/tmp/a', '/tmp/b', '/tmp/c']
      }
      mockApi.openDirectory.mockResolvedValue('/tmp/c')
      mockApi.workspaceAddProject.mockResolvedValue(undefined)
      mockApi.workspaceUpdate.mockResolvedValue(updatedWs)
      mockApi.workspaceGetOpenProjects.mockResolvedValue(['/tmp/a', '/tmp/b', '/tmp/c'])
      mockApi.workspaceGetActiveProject.mockResolvedValue('/tmp/a')

      // Set initial state with two projects and an active workspace
      useWorkspaceStore.setState({
        openProjects: [{ path: '/tmp/a', name: 'a' }, { path: '/tmp/b', name: 'b' }],
        activeProjectPath: '/tmp/a',
        activeWorkspace: existingWs
      })

      const result = await useWorkspaceStore.getState().addProject()
      expect(result).toBe('/tmp/c')
      // Should update the existing workspace config with the new path
      expect(mockApi.workspaceUpdate).toHaveBeenCalledWith('ws_existing', {
        projectPaths: ['/tmp/a', '/tmp/b', '/tmp/c']
      })
      // activeWorkspace should be updated
      const { activeWorkspace } = useWorkspaceStore.getState()
      expect(activeWorkspace?.projectPaths).toEqual(['/tmp/a', '/tmp/b', '/tmp/c'])
    })

    it('returns null when user cancels workspace name prompt', async () => {
      // Set initial state with one project and no workspace
      useWorkspaceStore.setState({
        openProjects: [{ path: '/tmp/a', name: 'a' }],
        activeProjectPath: '/tmp/a'
      })

      const addPromise = useWorkspaceStore.getState().addProject()
      // Wait a tick for the prompt to be set up
      await new Promise((r) => setTimeout(r, 0))
      expect(useWorkspaceStore.getState().showWorkspaceNamePrompt).toBe(true)

      // Cancel the prompt
      useWorkspaceStore.getState().resolveWorkspaceNamePrompt(null)

      const result = await addPromise
      expect(result).toBeNull()
      expect(mockApi.openDirectory).not.toHaveBeenCalled()
    })
  })

  describe('removeProject', () => {
    it('calls IPC and reloads open projects', async () => {
      mockApi.workspaceRemoveProject.mockResolvedValue(undefined)
      mockApi.workspaceGetOpenProjects.mockResolvedValue(['/tmp/a'])
      mockApi.workspaceGetActiveProject.mockResolvedValue('/tmp/a')

      await useWorkspaceStore.getState().removeProject('/tmp/b')
      expect(mockApi.workspaceRemoveProject).toHaveBeenCalledWith('/tmp/b')
    })
  })

  describe('createWorkspace', () => {
    it('creates workspace and reloads list', async () => {
      const ws: Workspace = {
        id: 'ws_new',
        name: 'New',
        projectPaths: ['/tmp/a'],
        lastOpenedAt: new Date().toISOString(),
        createdAt: new Date().toISOString()
      }
      mockApi.workspaceCreate.mockResolvedValue(ws)
      mockApi.workspaceList.mockResolvedValue([ws])

      const result = await useWorkspaceStore.getState().createWorkspace('New', ['/tmp/a'])
      expect(result).toEqual(ws)
      expect(mockApi.workspaceCreate).toHaveBeenCalledWith('New', ['/tmp/a'])
    })
  })

  describe('updateProjectTaskCount', () => {
    it('updates task count for a specific project', () => {
      useWorkspaceStore.setState({
        openProjects: [
          { path: '/tmp/a', name: 'a' },
          { path: '/tmp/b', name: 'b' }
        ]
      })

      useWorkspaceStore.getState().updateProjectTaskCount('/tmp/a', 5)
      const state = useWorkspaceStore.getState()
      expect(state.openProjects[0].taskCount).toBe(5)
      expect(state.openProjects[1].taskCount).toBeUndefined()
    })

    it('does not modify other projects', () => {
      useWorkspaceStore.setState({
        openProjects: [
          { path: '/tmp/a', name: 'a', taskCount: 3 },
          { path: '/tmp/b', name: 'b', taskCount: 7 }
        ]
      })

      useWorkspaceStore.getState().updateProjectTaskCount('/tmp/a', 10)
      const state = useWorkspaceStore.getState()
      expect(state.openProjects[0].taskCount).toBe(10)
      expect(state.openProjects[1].taskCount).toBe(7)
    })

    it('handles non-existent project path gracefully', () => {
      useWorkspaceStore.setState({
        openProjects: [
          { path: '/tmp/a', name: 'a', taskCount: 3 }
        ]
      })

      useWorkspaceStore.getState().updateProjectTaskCount('/tmp/nonexistent', 5)
      const state = useWorkspaceStore.getState()
      expect(state.openProjects[0].taskCount).toBe(3)
    })
  })

  describe('deleteWorkspace', () => {
    it('deletes workspace and reloads list', async () => {
      mockApi.workspaceDelete.mockResolvedValue(undefined)
      mockApi.workspaceList.mockResolvedValue([])

      await useWorkspaceStore.getState().deleteWorkspace('ws_1')
      expect(mockApi.workspaceDelete).toHaveBeenCalledWith('ws_1')
      expect(useWorkspaceStore.getState().workspaces).toEqual([])
    })
  })

  describe('loadWorktrees', () => {
    it('loads worktrees for each open project individually', async () => {
      useWorkspaceStore.setState({
        openProjects: [
          { path: '/tmp/project-a', name: 'project-a' },
          { path: '/tmp/project-b', name: 'project-b' }
        ]
      })

      mockApi.worktreeGetGitRoot.mockImplementation((projectPath?: string) => {
        if (projectPath === '/tmp/project-a') return Promise.resolve('/tmp/project-a')
        if (projectPath === '/tmp/project-b') return Promise.resolve('/tmp/project-b')
        return Promise.resolve(null)
      })

      mockApi.worktreeList.mockImplementation((projectPath?: string) => {
        if (projectPath === '/tmp/project-a') {
          return Promise.resolve([
            { path: '/tmp/project-a', branch: 'main', slug: 'project-a', isMain: true },
            { path: '/tmp/project-a/.familiar/worktrees/feat-x', branch: 'familiar-worktree/feat-x', slug: 'feat-x', isMain: false }
          ])
        }
        if (projectPath === '/tmp/project-b') {
          return Promise.resolve([
            { path: '/tmp/project-b', branch: 'main', slug: 'project-b', isMain: true }
          ])
        }
        return Promise.resolve([])
      })

      await useWorkspaceStore.getState().loadWorktrees()

      const state = useWorkspaceStore.getState()
      // Project A should have worktrees attached
      expect(state.openProjects[0].worktrees).toHaveLength(1)
      expect(state.openProjects[0].worktrees![0].slug).toBe('feat-x')
      // Project B should have no worktrees
      expect(state.openProjects[1].worktrees).toBeUndefined()
    })

    it('clears worktree info when no projects have git repos', async () => {
      useWorkspaceStore.setState({
        openProjects: [
          { path: '/tmp/no-git', name: 'no-git', worktrees: [{ path: '/tmp/stale', branch: 'x', slug: 'stale', isMain: false }] }
        ]
      })

      mockApi.worktreeGetGitRoot.mockResolvedValue(null)

      await useWorkspaceStore.getState().loadWorktrees()

      const state = useWorkspaceStore.getState()
      expect(state.openProjects[0].worktrees).toBeUndefined()
      expect(state.openProjects[0].isWorktree).toBe(false)
    })

    it('marks open worktree projects as isWorktree=true', async () => {
      useWorkspaceStore.setState({
        openProjects: [
          { path: '/tmp/project-a', name: 'project-a' },
          { path: '/tmp/project-a/.familiar/worktrees/feat-x', name: 'feat-x' }
        ]
      })

      mockApi.worktreeGetGitRoot.mockImplementation((projectPath?: string) => {
        // Both resolve to the same git root
        return Promise.resolve('/tmp/project-a')
      })

      mockApi.worktreeList.mockImplementation((projectPath?: string) => {
        return Promise.resolve([
          { path: '/tmp/project-a', branch: 'main', slug: 'project-a', isMain: true },
          { path: '/tmp/project-a/.familiar/worktrees/feat-x', branch: 'familiar-worktree/feat-x', slug: 'feat-x', isMain: false }
        ])
      })

      await useWorkspaceStore.getState().loadWorktrees()

      const state = useWorkspaceStore.getState()
      expect(state.openProjects[0].isWorktree).toBe(false)
      expect(state.openProjects[0].worktrees).toHaveLength(1)
      expect(state.openProjects[1].isWorktree).toBe(true)
      expect(state.openProjects[1].worktrees).toBeUndefined()
    })

    it('shows sidebar when worktrees exist', async () => {
      useWorkspaceStore.setState({
        openProjects: [{ path: '/tmp/project-a', name: 'project-a' }],
        sidebarVisible: false
      })

      mockApi.worktreeGetGitRoot.mockResolvedValue('/tmp/project-a')
      mockApi.worktreeList.mockResolvedValue([
        { path: '/tmp/project-a', branch: 'main', slug: 'project-a', isMain: true },
        { path: '/tmp/project-a/.familiar/worktrees/feat-x', branch: 'familiar-worktree/feat-x', slug: 'feat-x', isMain: false }
      ])

      await useWorkspaceStore.getState().loadWorktrees()

      expect(useWorkspaceStore.getState().sidebarVisible).toBe(true)
    })

    it('marks worktree as isWorktree even when it has nested worktrees', async () => {
      // Bug: when a worktree has its own nested worktrees (e.g. created while
      // the worktree was active), the worktree would appear as a parent project
      // instead of being hidden as a child worktree.
      useWorkspaceStore.setState({
        openProjects: [
          { path: '/tmp/project', name: 'project' },
          { path: '/tmp/project/.familiar/worktrees/feat-x', name: 'feat-x' },
          { path: '/tmp/project/.familiar/worktrees/feat-y', name: 'feat-y' }
        ]
      })

      mockApi.worktreeGetGitRoot.mockImplementation((projectPath?: string) => {
        // Worktrees return their own --show-toplevel
        if (projectPath === '/tmp/project') return Promise.resolve('/tmp/project')
        if (projectPath === '/tmp/project/.familiar/worktrees/feat-x') return Promise.resolve('/tmp/project/.familiar/worktrees/feat-x')
        if (projectPath === '/tmp/project/.familiar/worktrees/feat-y') return Promise.resolve('/tmp/project/.familiar/worktrees/feat-y')
        return Promise.resolve(null)
      })

      mockApi.worktreeList.mockImplementation((projectPath?: string) => {
        // Main project lists all worktrees correctly
        if (projectPath === '/tmp/project') {
          return Promise.resolve([
            { path: '/tmp/project', branch: 'main', slug: 'project', isMain: true },
            { path: '/tmp/project/.familiar/worktrees/feat-x', branch: 'familiar-worktree/feat-x', slug: 'feat-x', isMain: false },
            { path: '/tmp/project/.familiar/worktrees/feat-y', branch: 'familiar-worktree/feat-y', slug: 'feat-y', isMain: false }
          ])
        }
        // Worktree returns itself as main (git bug when --show-toplevel differs)
        return Promise.resolve([
          { path: projectPath, branch: 'some-branch', slug: 'self', isMain: true }
        ])
      })

      await useWorkspaceStore.getState().loadWorktrees()

      const state = useWorkspaceStore.getState()
      // Main project should be parent with worktrees
      expect(state.openProjects[0].isWorktree).toBe(false)
      expect(state.openProjects[0].worktrees).toHaveLength(2)
      // Both worktrees should be marked as worktrees (hidden from main list)
      expect(state.openProjects[1].isWorktree).toBe(true)
      expect(state.openProjects[1].worktrees).toBeUndefined()
      expect(state.openProjects[2].isWorktree).toBe(true)
      expect(state.openProjects[2].worktrees).toBeUndefined()
    })

    it('deduplicates by canonical root when worktrees return different git roots', async () => {
      // When worktreeGetGitRoot returns different values for worktrees vs main,
      // but worktreeList correctly identifies the main worktree, we should
      // still deduplicate and only call worktreeList once per canonical root.
      useWorkspaceStore.setState({
        openProjects: [
          { path: '/tmp/project', name: 'project' },
          { path: '/tmp/project/.familiar/worktrees/feat-x', name: 'feat-x' }
        ]
      })

      mockApi.worktreeGetGitRoot.mockImplementation((projectPath?: string) => {
        // Each returns its own --show-toplevel
        return Promise.resolve(projectPath)
      })

      mockApi.worktreeList.mockImplementation(() => {
        return Promise.resolve([
          { path: '/tmp/project', branch: 'main', slug: 'project', isMain: true },
          { path: '/tmp/project/.familiar/worktrees/feat-x', branch: 'familiar-worktree/feat-x', slug: 'feat-x', isMain: false }
        ])
      })

      await useWorkspaceStore.getState().loadWorktrees()

      const state = useWorkspaceStore.getState()
      expect(state.openProjects[0].isWorktree).toBe(false)
      expect(state.openProjects[0].worktrees).toHaveLength(1)
      expect(state.openProjects[1].isWorktree).toBe(true)
    })

    it('does not query same git root twice', async () => {
      useWorkspaceStore.setState({
        openProjects: [
          { path: '/tmp/project-a', name: 'project-a' },
          { path: '/tmp/project-a/.familiar/worktrees/feat-x', name: 'feat-x' }
        ]
      })

      mockApi.worktreeGetGitRoot.mockResolvedValue('/tmp/project-a')
      mockApi.worktreeList.mockResolvedValue([
        { path: '/tmp/project-a', branch: 'main', slug: 'project-a', isMain: true },
        { path: '/tmp/project-a/.familiar/worktrees/feat-x', branch: 'familiar-worktree/feat-x', slug: 'feat-x', isMain: false }
      ])

      await useWorkspaceStore.getState().loadWorktrees()

      // worktreeList should only be called once since both projects share the same git root
      expect(mockApi.worktreeList).toHaveBeenCalledTimes(1)
    })
  })
})
