import { useEffect } from 'react'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { useGlobalShortcuts } from '@renderer/hooks/useGlobalShortcuts'
import { AppShell, Navbar } from '@renderer/components/layout'
import { KanbanBoard } from '@renderer/components/board'
import { CommandPalette } from './components/command-palette'
import { TaskDetail } from './components/task-detail'
import { SettingsPage } from './components/settings'
import { CreateTaskModal } from './components/common'

function App(): React.JSX.Element {
  const loadProjectState = useTaskStore((s) => s.loadProjectState)
  const loadNotifications = useNotificationStore((s) => s.loadNotifications)
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
  }, [loadProjectState, loadNotifications])

  // Reload state when external changes are detected (e.g. CLI updates)
  useEffect(() => {
    const unwatch = window.api.watchProjectDir(() => {
      loadProjectState()
      loadNotifications()
    })
    return () => {
      unwatch()
    }
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

  return (
    <>
      <Navbar />
      <AppShell>
        <KanbanBoard />
        <CommandPalette />
        <CreateTaskModal />
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
    </>
  )
}

export default App
