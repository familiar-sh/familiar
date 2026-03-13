import { create } from 'zustand'
import type { Workspace } from '@shared/types'

export interface ProjectInfo {
  path: string
  name: string
  taskCount?: number // non-archived task count
}

interface WorkspaceState {
  // Workspace data
  workspaces: Workspace[]
  activeWorkspace: Workspace | null

  // Multi-project state
  openProjects: ProjectInfo[]
  activeProjectPath: string | null

  // Sidebar state
  sidebarExpanded: boolean // Icon strip vs full sidebar
  sidebarVisible: boolean // Whether sidebar is visible at all (only when 2+ projects)

  // Workspace picker
  showWorkspacePicker: boolean

  // Actions
  loadWorkspaces: () => Promise<void>
  loadOpenProjects: () => Promise<void>
  openWorkspace: (workspaceId: string) => Promise<void>
  openSingleProject: (path: string) => Promise<void>
  switchProject: (path: string) => Promise<void>
  addProject: () => Promise<string | null>
  removeProject: (path: string) => Promise<void>
  toggleSidebar: () => void
  toggleSidebarVisible: () => void
  setSidebarExpanded: (expanded: boolean) => void
  setShowWorkspacePicker: (show: boolean) => void

  updateProjectTaskCount: (projectPath: string, count: number) => void

  createWorkspace: (name: string, paths: string[]) => Promise<Workspace>
  updateWorkspace: (id: string, updates: Partial<Workspace>) => Promise<Workspace>
  deleteWorkspace: (id: string) => Promise<void>
}

function getProjectName(projectPath: string): string {
  return projectPath.split('/').pop() || projectPath
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  // State
  workspaces: [],
  activeWorkspace: null,
  openProjects: [],
  activeProjectPath: null,
  sidebarExpanded: false,
  sidebarVisible: false,
  showWorkspacePicker: false,

  // Actions
  loadWorkspaces: async (): Promise<void> => {
    const workspaces = await window.api.workspaceList()
    set({ workspaces })
  },

  loadOpenProjects: async (): Promise<void> => {
    const paths = await window.api.workspaceGetOpenProjects()
    const activeProjectPath = await window.api.workspaceGetActiveProject()
    const openProjects: ProjectInfo[] = paths.map((p) => ({
      path: p,
      name: getProjectName(p)
    }))
    set((s) => ({
      openProjects,
      activeProjectPath,
      // Auto-show sidebar when multiple projects are open, but never auto-hide
      sidebarVisible: s.sidebarVisible || openProjects.length >= 2
    }))
  },

  openWorkspace: async (workspaceId: string): Promise<void> => {
    await window.api.workspaceOpen(workspaceId)
    const { loadOpenProjects, loadWorkspaces } = get()
    await loadOpenProjects()
    await loadWorkspaces()
    const config = await window.api.workspaceGetConfig()
    const ws = config.workspaces.find((w) => w.id === workspaceId)
    set({ activeWorkspace: ws ?? null, showWorkspacePicker: false })
  },

  openSingleProject: async (path: string): Promise<void> => {
    await window.api.workspaceOpenSingle(path)
    const { loadOpenProjects } = get()
    await loadOpenProjects()
    set({ activeWorkspace: null, showWorkspacePicker: false })
  },

  switchProject: async (path: string): Promise<void> => {
    await window.api.workspaceSetActiveProject(path)
    set({ activeProjectPath: path })
  },

  addProject: async (): Promise<string | null> => {
    const selectedPath = await window.api.openDirectory()
    if (!selectedPath) return null

    await window.api.workspaceAddProject(selectedPath)

    // If we now have 2+ projects and no workspace, create an implicit one
    const { openProjects, activeWorkspace } = get()
    if (openProjects.length >= 1 && !activeWorkspace) {
      // Check if there's no saved workspace yet
      const config = await window.api.workspaceGetConfig()
      if (config.workspaces.length === 0) {
        // Create implicit workspace with all open projects
        const allPaths = [...openProjects.map((p) => p.path), selectedPath]
        const ws = await window.api.workspaceCreate('', allPaths)
        set({ activeWorkspace: ws })
      }
    }

    const { loadOpenProjects } = get()
    await loadOpenProjects()
    return selectedPath
  },

  removeProject: async (path: string): Promise<void> => {
    await window.api.workspaceRemoveProject(path)
    const { loadOpenProjects } = get()
    await loadOpenProjects()
  },

  toggleSidebar: (): void => {
    set((s) => ({ sidebarExpanded: !s.sidebarExpanded }))
  },

  toggleSidebarVisible: (): void => {
    set((s) => ({ sidebarVisible: !s.sidebarVisible }))
  },

  setSidebarExpanded: (expanded: boolean): void => {
    set({ sidebarExpanded: expanded })
  },

  setShowWorkspacePicker: (show: boolean): void => {
    set({ showWorkspacePicker: show })
  },

  updateProjectTaskCount: (projectPath: string, count: number): void => {
    set((s) => ({
      openProjects: s.openProjects.map((p) =>
        p.path === projectPath ? { ...p, taskCount: count } : p
      )
    }))
  },

  createWorkspace: async (name: string, paths: string[]): Promise<Workspace> => {
    const ws = await window.api.workspaceCreate(name, paths)
    const { loadWorkspaces } = get()
    await loadWorkspaces()
    return ws
  },

  updateWorkspace: async (id: string, updates: Partial<Workspace>): Promise<Workspace> => {
    const ws = await window.api.workspaceUpdate(id, updates)
    const { loadWorkspaces } = get()
    await loadWorkspaces()
    return ws
  },

  deleteWorkspace: async (id: string): Promise<void> => {
    await window.api.workspaceDelete(id)
    const { loadWorkspaces } = get()
    await loadWorkspaces()
  }
}))
