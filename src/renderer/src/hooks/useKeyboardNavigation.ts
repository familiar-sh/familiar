import { useEffect, useCallback } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useBoardStore } from '@renderer/stores/board-store'
import type { Task, TaskStatus, Priority } from '@shared/types'

interface UseKeyboardNavigationOptions {
  tasksByStatus: Record<string, Task[]>
  columnOrder: TaskStatus[]
  onCreateTask?: (columnIndex: number) => void
}

export function useKeyboardNavigation({
  tasksByStatus,
  columnOrder,
  onCreateTask
}: UseKeyboardNavigationOptions): void {
  const {
    focusedColumnIndex,
    focusedTaskIndex,
    setFocusedColumn,
    setFocusedTask,
    openTaskDetail,
    closeTaskDetail,
    taskDetailOpen
  } = useUIStore()

  const { updateTask, deleteTask, deleteTasks } = useTaskStore()
  const { selectedTaskIds, clearSelection } = useBoardStore()

  const getFocusedTask = useCallback((): Task | undefined => {
    const column = columnOrder[focusedColumnIndex]
    if (!column) return undefined
    const tasks = tasksByStatus[column]
    if (!tasks || tasks.length === 0) return undefined
    return tasks[focusedTaskIndex]
  }, [columnOrder, focusedColumnIndex, tasksByStatus, focusedTaskIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      // When task detail is open, only allow Escape to close it
      if (taskDetailOpen && e.key !== 'Escape') {
        return
      }

      const currentColumn = columnOrder[focusedColumnIndex]
      const currentTasks = currentColumn ? (tasksByStatus[currentColumn] ?? []) : []

      switch (e.key) {
        case 'j':
        case 'ArrowDown': {
          // Move down within column
          e.preventDefault()
          if (currentTasks.length > 0) {
            const next = Math.min(focusedTaskIndex + 1, currentTasks.length - 1)
            setFocusedTask(next)
          }
          break
        }

        case 'k':
        case 'ArrowUp': {
          // Move up within column
          e.preventDefault()
          if (currentTasks.length > 0) {
            const prev = Math.max(focusedTaskIndex - 1, 0)
            setFocusedTask(prev)
          }
          break
        }

        case 'h':
        case 'ArrowLeft': {
          // Move to previous column
          e.preventDefault()
          if (focusedColumnIndex > 0) {
            setFocusedColumn(focusedColumnIndex - 1)
          }
          break
        }

        case 'l':
        case 'ArrowRight': {
          // Move to next column
          e.preventDefault()
          if (focusedColumnIndex < columnOrder.length - 1) {
            setFocusedColumn(focusedColumnIndex + 1)
          }
          break
        }

        case 'Enter': {
          // Open focused task detail
          e.preventDefault()
          const task = getFocusedTask()
          if (task) {
            openTaskDetail(task.id)
          }
          break
        }

        case 'Escape': {
          // Close task detail / deselect
          // Shift+Escape also works (needed when terminal has focus)
          e.preventDefault()
          if (taskDetailOpen) {
            closeTaskDetail()
          }
          break
        }

        case 'c': {
          // Open create task input in focused column
          e.preventDefault()
          if (onCreateTask) {
            onCreateTask(focusedColumnIndex)
          }
          break
        }

        case '1':
        case '2':
        case '3':
        case '4': {
          // Set priority of focused task
          e.preventDefault()
          const task = getFocusedTask()
          if (task) {
            const priorityMap: Record<string, Priority> = {
              '1': 'urgent',
              '2': 'high',
              '3': 'medium',
              '4': 'low'
            }
            const newPriority = priorityMap[e.key]
            if (newPriority) {
              updateTask({ ...task, priority: newPriority })
            }
          }
          break
        }

        case 'Backspace':
        case 'Delete': {
          // Delete selected tasks (multi-select) or focused task
          e.preventDefault()
          if (selectedTaskIds.size > 0) {
            const count = selectedTaskIds.size
            const confirmed = window.confirm(
              `Delete ${count} selected task${count > 1 ? 's' : ''}?`
            )
            if (confirmed) {
              const idsToDelete = Array.from(selectedTaskIds)
              clearSelection()
              deleteTasks(idsToDelete)
            }
          } else {
            const task = getFocusedTask()
            if (task) {
              const confirmed = window.confirm(
                `Delete task "${task.title}"?`
              )
              if (confirmed) {
                deleteTask(task.id)
              }
            }
          }
          break
        }

        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    columnOrder,
    focusedColumnIndex,
    focusedTaskIndex,
    tasksByStatus,
    taskDetailOpen,
    setFocusedColumn,
    setFocusedTask,
    openTaskDetail,
    closeTaskDetail,
    updateTask,
    deleteTask,
    deleteTasks,
    getFocusedTask,
    onCreateTask,
    selectedTaskIds,
    clearSelection
  ])
}
