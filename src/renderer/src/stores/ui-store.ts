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

  // Command palette
  commandPaletteOpen: boolean

  // Board filters
  filters: TaskFilters

  // Board keyboard navigation
  focusedColumnIndex: number
  focusedTaskIndex: number

  // Split panel
  editorPanelWidth: number // percentage 0-100

  // Actions
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  openTaskDetail: (taskId: string) => void
  closeTaskDetail: () => void
  toggleCommandPalette: () => void
  setFilter: <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => void
  clearFilters: () => void
  setFocusedColumn: (index: number) => void
  setFocusedTask: (index: number) => void
  setEditorPanelWidth: (width: number) => void
}

const DEFAULT_SIDEBAR_WIDTH = 240
const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 480
const DEFAULT_EDITOR_PANEL_WIDTH = 50

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

  // Command palette
  commandPaletteOpen: false,

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
    set({ activeTaskId: taskId, taskDetailOpen: true }),

  closeTaskDetail: () =>
    set({ activeTaskId: null, taskDetailOpen: false }),

  toggleCommandPalette: () =>
    set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  clearFilters: () =>
    set({ filters: { ...defaultFilters } }),

  setFocusedColumn: (index: number) =>
    set({ focusedColumnIndex: index, focusedTaskIndex: 0 }),

  setFocusedTask: (index: number) =>
    set({ focusedTaskIndex: index }),

  setEditorPanelWidth: (width: number) =>
    set({ editorPanelWidth: Math.max(20, Math.min(80, width)) })
}))
