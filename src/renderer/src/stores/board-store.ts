import { create } from 'zustand'
import type { TaskStatus } from '@shared/types'

interface BoardStore {
  draggedTaskId: string | null
  dragOverColumn: TaskStatus | null
  setDraggedTask: (taskId: string | null) => void
  setDragOverColumn: (column: TaskStatus | null) => void
}

export const useBoardStore = create<BoardStore>((set) => ({
  draggedTaskId: null,
  dragOverColumn: null,

  setDraggedTask: (taskId: string | null): void => {
    set({ draggedTaskId: taskId })
  },

  setDragOverColumn: (column: TaskStatus | null): void => {
    set({ dragOverColumn: column })
  }
}))
