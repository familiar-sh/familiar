import { create } from 'zustand'
import type { Priority, AgentStatus } from '@shared/types'

interface TaskFilters {
  search: string
  priority: Priority[]
  labels: string[]
  agentStatus: AgentStatus[]
}

interface UIState {
  // Sidebar
  sidebarOpen: boolean
  sidebarWidth: number

  // Active views
  activeTaskId: string | null
  taskDetailOpen: boolean
  mountedTaskIds: Set<string> // Tasks kept mounted (hidden) for instant reopen

  // Command palette
  commandPaletteOpen: boolean

  // Settings page
  settingsOpen: boolean

  // Create task modal (used when creating from task detail view)
  createTaskModalOpen: boolean

  // Board filters
  filters: TaskFilters

  // Board keyboard navigation
  focusedColumnIndex: number
  focusedTaskIndex: number

  // Split panel
  editorPanelWidth: number // pixels

  // Actions
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  openTaskDetail: (taskId: string) => void
  closeTaskDetail: () => void
  unmountTask: (taskId: string) => void
  toggleCommandPalette: () => void
  openSettings: () => void
  closeSettings: () => void
  openCreateTaskModal: () => void
  closeCreateTaskModal: () => void
  setFilter: <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => void
  clearFilters: () => void
  setFocusedColumn: (index: number) => void
  setFocusedTask: (index: number) => void
  setEditorPanelWidth: (width: number) => void
}

const DEFAULT_SIDEBAR_WIDTH = 240
const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 480
const DEFAULT_EDITOR_PANEL_WIDTH = 400
const MIN_EDITOR_PANEL_WIDTH = 200
const MAX_EDITOR_PANEL_WIDTH = 800

const defaultFilters: TaskFilters = {
  search: '',
  priority: [],
  labels: [],
  agentStatus: []
}

export const useUIStore = create<UIState>((set) => ({
  // Sidebar
  sidebarOpen: true,
  sidebarWidth: DEFAULT_SIDEBAR_WIDTH,

  // Active views
  activeTaskId: null,
  taskDetailOpen: false,
  mountedTaskIds: new Set<string>(),

  // Command palette
  commandPaletteOpen: false,

  // Settings page
  settingsOpen: false,

  // Create task modal
  createTaskModalOpen: false,

  // Board filters
  filters: { ...defaultFilters },

  // Board keyboard navigation
  focusedColumnIndex: 0,
  focusedTaskIndex: 0,

  // Split panel
  editorPanelWidth: DEFAULT_EDITOR_PANEL_WIDTH,

  // Actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  setSidebarWidth: (width: number) =>
    set({ sidebarWidth: Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, width)) }),

  openTaskDetail: (taskId: string) =>
    set((state) => {
      const mounted = new Set(state.mountedTaskIds)
      mounted.add(taskId)
      return { activeTaskId: taskId, taskDetailOpen: true, mountedTaskIds: mounted }
    }),

  closeTaskDetail: () =>
    set({ activeTaskId: null, taskDetailOpen: false }),

  unmountTask: (taskId: string) =>
    set((state) => {
      const mounted = new Set(state.mountedTaskIds)
      mounted.delete(taskId)
      return { mountedTaskIds: mounted }
    }),

  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  openSettings: () =>
    set({ settingsOpen: true, taskDetailOpen: false, commandPaletteOpen: false }),

  closeSettings: () =>
    set({ settingsOpen: false }),

  openCreateTaskModal: () =>
    set({ createTaskModalOpen: true }),

  closeCreateTaskModal: () =>
    set({ createTaskModalOpen: false }),

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  clearFilters: () =>
    set({ filters: { ...defaultFilters } }),

  setFocusedColumn: (index: number) =>
    set({ focusedColumnIndex: index, focusedTaskIndex: 0 }),

  setFocusedTask: (index: number) =>
    set({ focusedTaskIndex: index }),

  setEditorPanelWidth: (width: number) =>
    set({ editorPanelWidth: Math.max(MIN_EDITOR_PANEL_WIDTH, Math.min(MAX_EDITOR_PANEL_WIDTH, width)) })
}))
