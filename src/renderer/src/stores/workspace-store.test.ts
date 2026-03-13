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
  openDirectory: vi.fn()
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
      mockApi.openDirectory.mockResolvedValue('/tmp/new')
      mockApi.workspaceAddProject.mockResolvedValue(undefined)
      mockApi.workspaceGetOpenProjects.mockResolvedValue(['/tmp/a', '/tmp/new'])
      mockApi.workspaceGetActiveProject.mockResolvedValue('/tmp/a')
      mockApi.workspaceGetConfig.mockResolvedValue({ workspaces: [], lastWorkspaceId: null })

      // Set initial state with one project
      useWorkspaceStore.setState({
        openProjects: [{ path: '/tmp/a', name: 'a' }],
        activeProjectPath: '/tmp/a'
      })

      const result = await useWorkspaceStore.getState().addProject()
      expect(result).toBe('/tmp/new')
      expect(mockApi.workspaceAddProject).toHaveBeenCalledWith('/tmp/new')
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
})
