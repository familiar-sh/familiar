import { create } from 'zustand'
import type { Priority, AgentStatus } from '@shared/types'

interface TaskFilters {
  search: string
  priority: Priority[]
  labels: string[]
  agentStatus: AgentStatus[]
}

interface PerProjectTaskState {
  activeTaskId: string | null
  taskDetailOpen: boolean
  mountedTaskIds: Set<string>
}

interface UIState {
  // Sidebar
  sidebarOpen: boolean
  sidebarWidth: number

  // Active views
  activeTaskId: string | null
  taskDetailOpen: boolean
  mountedTaskIds: Set<string> // Tasks kept mounted (hidden) for instant reopen

  // Per-project task detail state (preserved across project switches)
  projectTaskStates: Map<string, PerProjectTaskState>

  // Command palette
  commandPaletteOpen: boolean

  // Settings page
  settingsOpen: boolean

  // Theme
  themeMode: 'system' | 'light' | 'dark'
  darkTheme: string
  lightTheme: string

  // Create task modal (used when creating from task detail view)
  createTaskModalOpen: boolean
  createTaskForkFrom: string | null // parent task ID when forking

  // Keyboard shortcuts modal
  shortcutsModalOpen: boolean

  // About dialog
  aboutDialogOpen: boolean

  // Onboarding wizard (can be re-triggered from help menu)
  onboardingOpen: boolean
  onboardingExplicit: boolean // true when opened explicitly from menu (not auto-triggered)

  // Board filters
  filters: TaskFilters

  // Board keyboard navigation
  focusedColumnIndex: number
  focusedTaskIndex: number

  // Pending focus target when opening task detail
  pendingDetailFocus: 'terminal' | 'title' | null

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
  setThemeMode: (mode: 'system' | 'light' | 'dark') => void
  setDarkTheme: (themeId: string) => void
  setLightTheme: (themeId: string) => void
  cycleThemeMode: () => void
  openCreateTaskModal: () => void
  openCreateTaskModalForFork: (taskId: string) => void
  closeCreateTaskModal: () => void
  openShortcutsModal: () => void
  closeShortcutsModal: () => void
  openAboutDialog: () => void
  closeAboutDialog: () => void
  openOnboarding: (explicit?: boolean) => void
  closeOnboarding: () => void
  setFilter: <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => void
  clearFilters: () => void
  setFocusedColumn: (index: number) => void
  setFocusedTask: (index: number) => void
  setEditorPanelWidth: (width: number) => void
  setPendingDetailFocus: (target: 'terminal' | 'title' | null) => void
  clearPendingDetailFocus: () => void

  // Per-project task state
  saveProjectTaskState: (projectPath: string) => void
  restoreProjectTaskState: (projectPath: string) => void
}

const DEFAULT_SIDEBAR_WIDTH = 240
const MIN_SIDEBAR_WIDTH = 180
const MAX_SIDEBAR_WIDTH = 480
const DEFAULT_EDITOR_PANEL_WIDTH = 500
const MIN_EDITOR_PANEL_WIDTH = 300
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

  // Per-project task detail state
  projectTaskStates: new Map<string, PerProjectTaskState>(),

  // Command palette
  commandPaletteOpen: false,

  // Settings page
  settingsOpen: false,

  // Theme
  themeMode: 'system',
  darkTheme: 'familiar-dark',
  lightTheme: 'familiar-light',

  // Create task modal
  createTaskModalOpen: false,
  createTaskForkFrom: null,

  // Keyboard shortcuts modal
  shortcutsModalOpen: false,

  // About dialog
  aboutDialogOpen: false,

  // Onboarding
  onboardingOpen: false,
  onboardingExplicit: false,

  // Board filters
  filters: { ...defaultFilters },

  // Board keyboard navigation (-1 means no card is focused, e.g. when input has focus)
  focusedColumnIndex: -1,
  focusedTaskIndex: -1,

  // Pending focus
  pendingDetailFocus: null,

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

  closeTaskDetail: () => {
    // Blur before state change so the element inside the task-detail overlay
    // loses focus BEFORE visibility:hidden is applied. This prevents the
    // browser from auto-shifting focus to the create-task input.
    ;(document.activeElement as HTMLElement)?.blur?.()
    set({ activeTaskId: null, taskDetailOpen: false })
  },

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

  setThemeMode: (mode) => set({ themeMode: mode }),
  setDarkTheme: (themeId) => set({ darkTheme: themeId }),
  setLightTheme: (themeId) => set({ lightTheme: themeId }),
  cycleThemeMode: () =>
    set((state) => {
      const next =
        state.themeMode === 'system' ? 'light' : state.themeMode === 'light' ? 'dark' : 'system'
      return { themeMode: next }
    }),

  openCreateTaskModal: () =>
    set({ createTaskModalOpen: true, createTaskForkFrom: null }),

  openCreateTaskModalForFork: (taskId: string) =>
    set({ createTaskModalOpen: true, createTaskForkFrom: taskId }),

  closeCreateTaskModal: () =>
    set({ createTaskModalOpen: false, createTaskForkFrom: null }),

  openShortcutsModal: () =>
    set({ shortcutsModalOpen: true }),

  closeShortcutsModal: () =>
    set({ shortcutsModalOpen: false }),

  openAboutDialog: () =>
    set({ aboutDialogOpen: true }),

  closeAboutDialog: () =>
    set({ aboutDialogOpen: false }),

  openOnboarding: (explicit = false) =>
    set({ onboardingOpen: true, onboardingExplicit: explicit, taskDetailOpen: false, settingsOpen: false, commandPaletteOpen: false }),

  closeOnboarding: () =>
    set({ onboardingOpen: false, onboardingExplicit: false }),

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  clearFilters: () =>
    set({ filters: { ...defaultFilters } }),

  setFocusedColumn: (index: number) =>
    set({ focusedColumnIndex: index, focusedTaskIndex: index < 0 ? -1 : 0 }),

  setFocusedTask: (index: number) =>
    set({ focusedTaskIndex: index }),

  setEditorPanelWidth: (width: number) =>
    set({ editorPanelWidth: Math.max(MIN_EDITOR_PANEL_WIDTH, Math.min(MAX_EDITOR_PANEL_WIDTH, width)) }),

  setPendingDetailFocus: (target) =>
    set({ pendingDetailFocus: target }),

  clearPendingDetailFocus: () =>
    set({ pendingDetailFocus: null }),

  saveProjectTaskState: (projectPath: string) =>
    set((state) => {
      const projectTaskStates = new Map(state.projectTaskStates)
      projectTaskStates.set(projectPath, {
        activeTaskId: state.activeTaskId,
        taskDetailOpen: state.taskDetailOpen,
        mountedTaskIds: new Set(state.mountedTaskIds)
      })
      return { projectTaskStates }
    }),

  restoreProjectTaskState: (projectPath: string) =>
    set((state) => {
      const saved = state.projectTaskStates.get(projectPath)
      if (saved) {
        return {
          activeTaskId: saved.activeTaskId,
          taskDetailOpen: saved.taskDetailOpen,
          mountedTaskIds: new Set(saved.mountedTaskIds)
        }
      }
      // No saved state — close task detail and clear mounted tasks
      return { activeTaskId: null, taskDetailOpen: false, mountedTaskIds: new Set<string>() }
    })
}))
