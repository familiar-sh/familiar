import { useEffect, useCallback } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'

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
  const setFilter = useUIStore((s) => s.setFilter)
  const addTask = useTaskStore((s) => s.addTask)
  const projectState = useTaskStore((s) => s.projectState)

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

      // Cmd+K — toggle command palette (always, even in inputs)
      if (meta && e.key === 'k') {
        e.preventDefault()
        toggleCommandPalette()
        return
      }

      // Cmd+N — create new task
      if (meta && e.key === 'n') {
        e.preventDefault()
        if (projectState) {
          addTask('New task')
        }
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

      // Cmd+, — toggle sidebar
      if (meta && e.key === ',') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      // Escape — close whatever's open (detail, palette, etc.)
      if (e.key === 'Escape') {
        // Don't handle if typing in inputs (let other handlers deal with it)
        if (isInputFocused()) return

        if (commandPaletteOpen) {
          e.preventDefault()
          toggleCommandPalette()
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
    addTask,
    projectState,
    isInputFocused,
    setFilter
  ])
}
