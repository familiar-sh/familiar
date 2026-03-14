import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '@renderer/stores/ui-store'

describe('useUIStore', () => {
  beforeEach(() => {
    // Reset to defaults
    useUIStore.setState({
      sidebarOpen: true,
      sidebarWidth: 240,
      activeTaskId: null,
      taskDetailOpen: false,
      commandPaletteOpen: false,
      themeMode: 'system',
      darkTheme: 'familiar-dark',
      lightTheme: 'familiar-light',
      filters: {
        search: '',
        priority: [],
        labels: [],
        agentStatus: []
      },
      focusedColumnIndex: 0,
      focusedTaskIndex: 0,
      editorPanelWidth: 400,
      createTaskModalOpen: false
    })
  })

  describe('toggleSidebar', () => {
    it('toggles sidebarOpen from true to false', () => {
      expect(useUIStore.getState().sidebarOpen).toBe(true)
      useUIStore.getState().toggleSidebar()
      expect(useUIStore.getState().sidebarOpen).toBe(false)
    })

    it('toggles sidebarOpen from false to true', () => {
      useUIStore.setState({ sidebarOpen: false })
      useUIStore.getState().toggleSidebar()
      expect(useUIStore.getState().sidebarOpen).toBe(true)
    })
  })

  describe('openTaskDetail / closeTaskDetail', () => {
    it('opens task detail with the given task id', () => {
      useUIStore.getState().openTaskDetail('tsk_abc')
      expect(useUIStore.getState().activeTaskId).toBe('tsk_abc')
      expect(useUIStore.getState().taskDetailOpen).toBe(true)
    })

    it('closes task detail and clears active task id', () => {
      useUIStore.getState().openTaskDetail('tsk_abc')
      useUIStore.getState().closeTaskDetail()
      expect(useUIStore.getState().activeTaskId).toBeNull()
      expect(useUIStore.getState().taskDetailOpen).toBe(false)
    })
  })

  describe('toggleCommandPalette', () => {
    it('toggles from false to true', () => {
      expect(useUIStore.getState().commandPaletteOpen).toBe(false)
      useUIStore.getState().toggleCommandPalette()
      expect(useUIStore.getState().commandPaletteOpen).toBe(true)
    })

    it('toggles from true to false', () => {
      useUIStore.setState({ commandPaletteOpen: true })
      useUIStore.getState().toggleCommandPalette()
      expect(useUIStore.getState().commandPaletteOpen).toBe(false)
    })
  })

  describe('setFilter / clearFilters', () => {
    it('sets a search filter', () => {
      useUIStore.getState().setFilter('search', 'bug fix')
      expect(useUIStore.getState().filters.search).toBe('bug fix')
    })

    it('sets a priority filter', () => {
      useUIStore.getState().setFilter('priority', ['high', 'urgent'])
      expect(useUIStore.getState().filters.priority).toEqual(['high', 'urgent'])
    })

    it('sets a labels filter', () => {
      useUIStore.getState().setFilter('labels', ['feature'])
      expect(useUIStore.getState().filters.labels).toEqual(['feature'])
    })

    it('sets an agentStatus filter', () => {
      useUIStore.getState().setFilter('agentStatus', ['running'])
      expect(useUIStore.getState().filters.agentStatus).toEqual(['running'])
    })

    it('clearFilters resets all filters to defaults', () => {
      useUIStore.getState().setFilter('search', 'test')
      useUIStore.getState().setFilter('priority', ['high'])
      useUIStore.getState().setFilter('labels', ['bug'])
      useUIStore.getState().clearFilters()

      const { filters } = useUIStore.getState()
      expect(filters.search).toBe('')
      expect(filters.priority).toEqual([])
      expect(filters.labels).toEqual([])
      expect(filters.agentStatus).toEqual([])
    })
  })

  describe('setFocusedColumn', () => {
    it('sets focusedColumnIndex and resets focusedTaskIndex to 0', () => {
      useUIStore.setState({ focusedTaskIndex: 5 })
      useUIStore.getState().setFocusedColumn(3)
      expect(useUIStore.getState().focusedColumnIndex).toBe(3)
      expect(useUIStore.getState().focusedTaskIndex).toBe(0)
    })
  })

  describe('setEditorPanelWidth', () => {
    it('clamps to minimum 300px', () => {
      useUIStore.getState().setEditorPanelWidth(50)
      expect(useUIStore.getState().editorPanelWidth).toBe(300)
    })

    it('clamps to maximum 800px', () => {
      useUIStore.getState().setEditorPanelWidth(1200)
      expect(useUIStore.getState().editorPanelWidth).toBe(800)
    })

    it('accepts valid values within range', () => {
      useUIStore.getState().setEditorPanelWidth(500)
      expect(useUIStore.getState().editorPanelWidth).toBe(500)
    })
  })

  describe('pendingDetailFocus', () => {
    it('starts as null', () => {
      expect(useUIStore.getState().pendingDetailFocus).toBeNull()
    })

    it('setPendingDetailFocus sets the target', () => {
      useUIStore.getState().setPendingDetailFocus('terminal')
      expect(useUIStore.getState().pendingDetailFocus).toBe('terminal')
    })

    it('setPendingDetailFocus can set title target', () => {
      useUIStore.getState().setPendingDetailFocus('title')
      expect(useUIStore.getState().pendingDetailFocus).toBe('title')
    })

    it('clearPendingDetailFocus resets to null', () => {
      useUIStore.getState().setPendingDetailFocus('terminal')
      useUIStore.getState().clearPendingDetailFocus()
      expect(useUIStore.getState().pendingDetailFocus).toBeNull()
    })

    it('setPendingDetailFocus(null) clears the focus', () => {
      useUIStore.getState().setPendingDetailFocus('terminal')
      useUIStore.getState().setPendingDetailFocus(null)
      expect(useUIStore.getState().pendingDetailFocus).toBeNull()
    })
  })

  describe('theme state', () => {
    it('has correct theme defaults', () => {
      const state = useUIStore.getState()
      expect(state.themeMode).toBe('system')
      expect(state.darkTheme).toBe('familiar-dark')
      expect(state.lightTheme).toBe('familiar-light')
    })

    it('setThemeMode updates mode', () => {
      useUIStore.getState().setThemeMode('dark')
      expect(useUIStore.getState().themeMode).toBe('dark')
    })

    it('setDarkTheme updates dark theme', () => {
      useUIStore.getState().setDarkTheme('dracula')
      expect(useUIStore.getState().darkTheme).toBe('dracula')
    })

    it('setLightTheme updates light theme', () => {
      useUIStore.getState().setLightTheme('solarized-light')
      expect(useUIStore.getState().lightTheme).toBe('solarized-light')
    })

    it('cycleThemeMode cycles system → light → dark → system', () => {
      const { cycleThemeMode } = useUIStore.getState()
      expect(useUIStore.getState().themeMode).toBe('system')
      cycleThemeMode()
      expect(useUIStore.getState().themeMode).toBe('light')
      cycleThemeMode()
      expect(useUIStore.getState().themeMode).toBe('dark')
      cycleThemeMode()
      expect(useUIStore.getState().themeMode).toBe('system')
    })
  })

  describe('saveProjectTaskState / restoreProjectTaskState', () => {
    it('saves and restores task detail state per project', () => {
      // Open a task in project A
      useUIStore.getState().openTaskDetail('tsk_1')
      expect(useUIStore.getState().activeTaskId).toBe('tsk_1')
      expect(useUIStore.getState().taskDetailOpen).toBe(true)

      // Save project A state
      useUIStore.getState().saveProjectTaskState('/project-a')

      // Switch to project B (no saved state — should clear)
      useUIStore.getState().restoreProjectTaskState('/project-b')
      expect(useUIStore.getState().activeTaskId).toBeNull()
      expect(useUIStore.getState().taskDetailOpen).toBe(false)
      expect(useUIStore.getState().mountedTaskIds.size).toBe(0)

      // Open a task in project B
      useUIStore.getState().openTaskDetail('tsk_2')

      // Save project B state
      useUIStore.getState().saveProjectTaskState('/project-b')

      // Switch back to project A — should restore tsk_1
      useUIStore.getState().restoreProjectTaskState('/project-a')
      expect(useUIStore.getState().activeTaskId).toBe('tsk_1')
      expect(useUIStore.getState().taskDetailOpen).toBe(true)
      expect(useUIStore.getState().mountedTaskIds.has('tsk_1')).toBe(true)
    })

    it('restores closed state for projects with no saved state', () => {
      useUIStore.getState().openTaskDetail('tsk_1')
      useUIStore.getState().restoreProjectTaskState('/unknown-project')
      expect(useUIStore.getState().activeTaskId).toBeNull()
      expect(useUIStore.getState().taskDetailOpen).toBe(false)
    })

    it('preserves mounted task ids across project switches', () => {
      // Open multiple tasks in project A
      useUIStore.getState().openTaskDetail('tsk_1')
      useUIStore.getState().openTaskDetail('tsk_2')
      useUIStore.getState().saveProjectTaskState('/project-a')

      // Switch away and back
      useUIStore.getState().restoreProjectTaskState('/project-b')
      useUIStore.getState().restoreProjectTaskState('/project-a')

      expect(useUIStore.getState().mountedTaskIds.has('tsk_1')).toBe(true)
      expect(useUIStore.getState().mountedTaskIds.has('tsk_2')).toBe(true)
    })
  })

  describe('onboarding', () => {
    it('openOnboarding opens onboarding with explicit=false by default', () => {
      useUIStore.getState().openOnboarding()
      expect(useUIStore.getState().onboardingOpen).toBe(true)
      expect(useUIStore.getState().onboardingExplicit).toBe(false)
    })

    it('openOnboarding(true) sets onboardingExplicit to true', () => {
      useUIStore.getState().openOnboarding(true)
      expect(useUIStore.getState().onboardingOpen).toBe(true)
      expect(useUIStore.getState().onboardingExplicit).toBe(true)
    })

    it('closeOnboarding resets both onboardingOpen and onboardingExplicit', () => {
      useUIStore.getState().openOnboarding(true)
      useUIStore.getState().closeOnboarding()
      expect(useUIStore.getState().onboardingOpen).toBe(false)
      expect(useUIStore.getState().onboardingExplicit).toBe(false)
    })

    it('openOnboarding closes task detail, settings, and command palette', () => {
      useUIStore.setState({ taskDetailOpen: true, settingsOpen: true, commandPaletteOpen: true })
      useUIStore.getState().openOnboarding()
      expect(useUIStore.getState().taskDetailOpen).toBe(false)
      expect(useUIStore.getState().settingsOpen).toBe(false)
      expect(useUIStore.getState().commandPaletteOpen).toBe(false)
    })
  })

  describe('createTaskModal', () => {
    it('opens and closes the create task modal', () => {
      expect(useUIStore.getState().createTaskModalOpen).toBe(false)

      useUIStore.getState().openCreateTaskModal()
      expect(useUIStore.getState().createTaskModalOpen).toBe(true)

      useUIStore.getState().closeCreateTaskModal()
      expect(useUIStore.getState().createTaskModalOpen).toBe(false)
    })

    it('opens modal in fork mode with parent task ID', () => {
      useUIStore.getState().openCreateTaskModalForFork('tsk_parent')
      expect(useUIStore.getState().createTaskModalOpen).toBe(true)
      expect(useUIStore.getState().createTaskForkFrom).toBe('tsk_parent')
    })

    it('clears fork state when modal is closed', () => {
      useUIStore.getState().openCreateTaskModalForFork('tsk_parent')
      useUIStore.getState().closeCreateTaskModal()
      expect(useUIStore.getState().createTaskModalOpen).toBe(false)
      expect(useUIStore.getState().createTaskForkFrom).toBeNull()
    })

    it('openCreateTaskModal clears any existing fork state', () => {
      useUIStore.getState().openCreateTaskModalForFork('tsk_parent')
      useUIStore.getState().closeCreateTaskModal()
      useUIStore.getState().openCreateTaskModal()
      expect(useUIStore.getState().createTaskModalOpen).toBe(true)
      expect(useUIStore.getState().createTaskForkFrom).toBeNull()
    })
  })
})
