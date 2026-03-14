import { useEffect } from 'react'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useGlobalShortcuts } from '@renderer/hooks/useGlobalShortcuts'
import { onFileChange } from '@renderer/lib/file-change-hub'
import { AppShell, Navbar } from '@renderer/components/layout'
import { KanbanBoard } from '@renderer/components/board'
import { CommandPalette } from './components/command-palette'
import { TaskDetail } from './components/task-detail'
import { SettingsPage } from './components/settings'
import { CreateTaskModal, KeyboardShortcutsModal, UpdateBanner, WorkspaceNameDialog } from './components/common'
import { WorkspacePicker } from './components/workspace-picker'
import { ThemeProvider } from './components/ThemeProvider'

function App(): React.JSX.Element {
  const loadProjectState = useTaskStore((s) => s.loadProjectState)
  const projectState = useTaskStore((s) => s.projectState)
  const loadNotifications = useNotificationStore((s) => s.loadNotifications)
  const loadOpenProjects = useWorkspaceStore((s) => s.loadOpenProjects)
  const showWorkspacePicker = useWorkspaceStore((s) => s.showWorkspacePicker)
  const setShowWorkspacePicker = useWorkspaceStore((s) => s.setShowWorkspacePicker)
  const taskDetailOpen = useUIStore((s) => s.taskDetailOpen)
  const activeTaskId = useUIStore((s) => s.activeTaskId)
  const closeTaskDetail = useUIStore((s) => s.closeTaskDetail)
  const mountedTaskIds = useUIStore((s) => s.mountedTaskIds)
  const settingsOpen = useUIStore((s) => s.settingsOpen)

  // Centralized global keyboard shortcuts
  useGlobalShortcuts()

  useEffect(() => {
    loadProjectState()
    loadNotifications()
    loadOpenProjects()

    // Load theme preferences from settings
    window.api
      .readSettings()
      .then((settings) => {
        const store = useUIStore.getState()
        if (settings.themeMode) store.setThemeMode(settings.themeMode)
        if (settings.darkTheme) store.setDarkTheme(settings.darkTheme)
        if (settings.lightTheme) store.setLightTheme(settings.lightTheme)
      })
      .catch(() => {
        /* use defaults */
      })
  }, [loadProjectState, loadNotifications, loadOpenProjects])

  // When switching to an uninitialized project, open onboarding.
  // When switching to an initialized project, close onboarding.
  // On first app launch with no project at all, show workspace picker.
  const openOnboarding = useUIStore((s) => s.openOnboarding)
  const onboardingOpen = useUIStore((s) => s.onboardingOpen)
  const closeOnboarding = useUIStore((s) => s.closeOnboarding)
  const activeProjectPath = useWorkspaceStore((s) => s.activeProjectPath)
  useEffect(() => {
    async function checkInitialized(): Promise<void> {
      const initialized = await window.api.isInitialized()
      if (!initialized) {
        if (activeProjectPath) {
          // Project added but not configured — run onboarding for it
          openOnboarding()
        } else if (!projectState) {
          // No project at all on initial launch — show workspace picker
          setShowWorkspacePicker(true)
        }
      } else if (onboardingOpen) {
        // Switched to an initialized project — close onboarding
        closeOnboarding()
      }
    }
    checkInitialized()
  }, [projectState, activeProjectPath, setShowWorkspacePicker, openOnboarding, closeOnboarding, onboardingOpen])

  // Reload state when external changes are detected (e.g. CLI updates).
  // Only reload when the change is for the active project — file watchers
  // from non-active projects in a multi-project workspace should not trigger
  // a reload (they would just re-read the active project's data anyway, and
  // the overlapping async calls can race with project switches).
  useEffect(() => {
    return onFileChange((changedProjectPath) => {
      const currentActive = useWorkspaceStore.getState().activeProjectPath
      if (changedProjectPath && currentActive && changedProjectPath !== currentActive) {
        return // Ignore file changes from non-active projects
      }
      loadProjectState()
      loadNotifications()
    })
  }, [loadProjectState, loadNotifications])

  // Listen for "Open Workspace" from the application menu
  const openWorkspace = useTaskStore((s) => s.openWorkspace)
  useEffect(() => {
    const unsubscribe = window.api.onMenuOpenWorkspace(() => {
      openWorkspace()
    })
    return () => {
      unsubscribe()
    }
  }, [openWorkspace])

  // Listen for "Add Project" from the application menu
  const addProject = useWorkspaceStore((s) => s.addProject)
  useEffect(() => {
    const unsubscribe = window.api.onMenuAddProject(() => {
      addProject()
    })
    return () => {
      unsubscribe()
    }
  }, [addProject])

  // Listen for "Show Workspace Picker" from the application menu
  useEffect(() => {
    const unsubscribe = window.api.onMenuShowWorkspacePicker(() => {
      setShowWorkspacePicker(true)
    })
    return () => {
      unsubscribe()
    }
  }, [setShowWorkspacePicker])

  // Listen for "Run Onboarding" from the application menu
  useEffect(() => {
    const unsubscribe = window.api.onMenuRunOnboarding(() => {
      openOnboarding()
    })
    return () => {
      unsubscribe()
    }
  }, [openOnboarding])

  return (
    <ThemeProvider>
      <UpdateBanner />
      <Navbar />
      <AppShell>
        <KanbanBoard />
        <CommandPalette />
        <CreateTaskModal />
        <KeyboardShortcutsModal />
        {settingsOpen && <SettingsPage />}
        {Array.from(mountedTaskIds).map((taskId) => (
          <TaskDetail
            key={taskId}
            taskId={taskId}
            visible={taskDetailOpen && activeTaskId === taskId}
            onClose={closeTaskDetail}
          />
        ))}
      </AppShell>
      <WorkspaceNameDialog />
      {showWorkspacePicker && <WorkspacePicker />}
    </ThemeProvider>
  )
}

export default App
