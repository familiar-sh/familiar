import { useEffect, useCallback } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'

/**
 * Centralized global keyboard shortcut system.
 * Handles Cmd+K, Cmd+N, Cmd+F, Cmd+,, Escape.
 * Does not fire when typing in inputs/textareas.
 */
export function useGlobalShortcuts(): void {
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const closeTaskDetail = useUIStore((s) => s.closeTaskDetail)
  const taskDetailOpen = useUIStore((s) => s.taskDetailOpen)
  const commandPaletteOpen = useUIStore((s) => s.commandPaletteOpen)
  const openSettings = useUIStore((s) => s.openSettings)
  const closeSettings = useUIStore((s) => s.closeSettings)
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const openCreateTaskModal = useUIStore((s) => s.openCreateTaskModal)
  const shortcutsModalOpen = useUIStore((s) => s.shortcutsModalOpen)
  const openShortcutsModal = useUIStore((s) => s.openShortcutsModal)
  const closeShortcutsModal = useUIStore((s) => s.closeShortcutsModal)
  const addTask = useTaskStore((s) => s.addTask)
  const projectState = useTaskStore((s) => s.projectState)
  const toggleSidebarVisible = useWorkspaceStore((s) => s.toggleSidebarVisible)

  const isInputFocused = useCallback((): boolean => {
    const target = document.activeElement as HTMLElement | null
    if (!target) return false
    return (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    )
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const meta = e.metaKey || e.ctrlKey

      // Cmd+Enter — focus terminal (works from anywhere in task detail)
      if (meta && e.key === 'Enter' && taskDetailOpen) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('task-detail-focus', { detail: 'terminal' }))
        return
      }

      // Cmd+K — toggle command palette (always, even in inputs)
      if (meta && e.key === 'k') {
        e.preventDefault()
        toggleCommandPalette()
        return
      }

      // Cmd+N — create new task
      // In task detail view: open modal (don't lose context)
      // In board view: focus the new task input in the todo column
      if (meta && e.key === 'n') {
        e.preventDefault()
        if (projectState) {
          if (taskDetailOpen || settingsOpen) {
            // Open modal overlay without closing the current view
            if (commandPaletteOpen) toggleCommandPalette()
            openCreateTaskModal()
          } else {
            // On the board: focus the always-visible input in the todo column
            if (commandPaletteOpen) toggleCommandPalette()
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('focus-new-task-input'))
            }, 0)
          }
        }
        return
      }

      // Cmd+B — toggle project sidebar visibility
      if (meta && e.key === 'b') {
        e.preventDefault()
        toggleSidebarVisible()
        return
      }

      // Cmd+F — focus search (open command palette as search)
      if (meta && e.key === 'f') {
        e.preventDefault()
        if (!commandPaletteOpen) {
          toggleCommandPalette()
        }
        return
      }

      // Cmd+, — open settings
      if (meta && e.key === ',') {
        e.preventDefault()
        openSettings()
        return
      }

      // ? — toggle keyboard shortcuts modal (not in inputs)
      if (e.key === '?' && !meta && !isInputFocused()) {
        e.preventDefault()
        if (shortcutsModalOpen) {
          closeShortcutsModal()
        } else {
          openShortcutsModal()
        }
        return
      }

      // Escape or Shift+Escape — close whatever's open (detail, palette, etc.)
      // Shift+Escape is needed because plain Escape is consumed by xterm/Claude Code
      if (e.key === 'Escape') {
        // Don't handle if typing in inputs (let other handlers deal with it)
        // Exception: Shift+Escape always closes (it's the explicit "close task view" shortcut)
        if (!e.shiftKey && isInputFocused()) return

        if (shortcutsModalOpen) {
          e.preventDefault()
          closeShortcutsModal()
          return
        }
        if (commandPaletteOpen) {
          e.preventDefault()
          toggleCommandPalette()
          return
        }
        if (settingsOpen) {
          e.preventDefault()
          closeSettings()
          return
        }
        if (taskDetailOpen) {
          e.preventDefault()
          closeTaskDetail()
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    toggleCommandPalette,
    toggleSidebar,
    closeTaskDetail,
    taskDetailOpen,
    commandPaletteOpen,
    openSettings,
    closeSettings,
    settingsOpen,
    openCreateTaskModal,
    shortcutsModalOpen,
    openShortcutsModal,
    closeShortcutsModal,
    addTask,
    projectState,
    isInputFocused,
    toggleSidebarVisible
  ])
}
