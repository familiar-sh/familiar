import { create } from 'zustand'
import type { TaskStatus } from '@shared/types'

interface BoardStore {
  draggedTaskId: string | null
  dragOverColumn: TaskStatus | null
  selectedTaskIds: Set<string>
  setDraggedTask: (taskId: string | null) => void
  setDragOverColumn: (column: TaskStatus | null) => void
  toggleTaskSelection: (taskId: string, append: boolean) => void
  setSelectedTaskIds: (ids: Set<string>) => void
  clearSelection: () => void
  isSelected: (taskId: string) => boolean
}

export const useBoardStore = create<BoardStore>((set, get) => ({
  draggedTaskId: null,
  dragOverColumn: null,
  selectedTaskIds: new Set<string>(),

  setDraggedTask: (taskId: string | null): void => {
    set({ draggedTaskId: taskId })
  },

  setDragOverColumn: (column: TaskStatus | null): void => {
    set({ dragOverColumn: column })
  },

  toggleTaskSelection: (taskId: string, append: boolean): void => {
    const { selectedTaskIds } = get()
    const next = new Set(append ? selectedTaskIds : [])
    if (next.has(taskId)) {
      next.delete(taskId)
    } else {
      next.add(taskId)
    }
    set({ selectedTaskIds: next })
  },

  setSelectedTaskIds: (ids: Set<string>): void => {
    set({ selectedTaskIds: ids })
  },

  clearSelection: (): void => {
    set({ selectedTaskIds: new Set<string>() })
  },

  isSelected: (taskId: string): boolean => {
    return get().selectedTaskIds.has(taskId)
  }
}))
