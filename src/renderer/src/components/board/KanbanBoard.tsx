import { useState, useCallback, useMemo, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { Task, TaskStatus } from '@shared/types'
import { DEFAULT_COLUMNS } from '@shared/constants'
import { filterTasks } from '@shared/utils/task-utils'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useBoardStore } from '@renderer/stores/board-store'
import { useKeyboardNavigation } from '@renderer/hooks/useKeyboardNavigation'
import { LoadingSpinner, EmptyState } from '@renderer/components/common'
import { KanbanColumn } from './KanbanColumn'
import { TaskCardOverlay } from './TaskCard'
import styles from './KanbanBoard.module.css'

export function KanbanBoard(): React.JSX.Element {
  const { projectState, isLoading, addTask, moveTask, reorderTask } = useTaskStore()
  const { filters, openTaskDetail, activeTaskId, focusedColumnIndex, focusedTaskIndex } =
    useUIStore()
  const { setDraggedTask, setDragOverColumn } = useBoardStore()

  const [initName, setInitName] = useState('')
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [createColumnIndex, setCreateColumnIndex] = useState<number | null>(null)

  const columnOrder = projectState?.columnOrder ?? DEFAULT_COLUMNS

  // dnd-kit sensors
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }
  })
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates
  })
  const sensors = useSensors(pointerSensor, keyboardSensor)

  // Filter tasks using shared utility
  const filteredTasks = useMemo(() => {
    if (!projectState) return []
    return filterTasks(projectState.tasks, {
      search: filters.search || undefined,
      priority: filters.priority.length > 0 ? filters.priority : undefined,
      labels: filters.labels.length > 0 ? filters.labels : undefined,
      agentStatus: filters.agentStatus.length > 0 ? filters.agentStatus : undefined
    })
  }, [projectState, filters])

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const status of columnOrder) {
      map[status] = filteredTasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return map
  }, [filteredTasks, columnOrder])

  // Keyboard navigation
  const handleKeyboardCreate = useCallback((colIndex: number) => {
    setCreateColumnIndex(colIndex)
  }, [])

  useKeyboardNavigation({
    tasksByStatus,
    columnOrder,
    onCreateTask: handleKeyboardCreate
  })

  const handleTaskClick = useCallback(
    (taskId: string) => {
      openTaskDetail(taskId)
    },
    [openTaskDetail]
  )

  const handleCreateTask = useCallback(
    async (status: TaskStatus, title: string) => {
      await addTask(title, { status })
    },
    [addTask]
  )

  // Find which column a task belongs to
  const findTaskColumn = useCallback(
    (taskId: string): TaskStatus | null => {
      for (const status of columnOrder) {
        const tasks = tasksByStatus[status] ?? []
        if (tasks.some((t) => t.id === taskId)) {
          return status
        }
      }
      return null
    },
    [columnOrder, tasksByStatus]
  )

  // Find a task by ID across all columns
  const findTask = useCallback(
    (taskId: string): Task | undefined => {
      return filteredTasks.find((t) => t.id === taskId)
    },
    [filteredTasks]
  )

  // DnD handlers
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      const task = findTask(active.id as string)
      if (task) {
        setActiveTask(task)
        setDraggedTask(task.id)
      }
    },
    [findTask, setDraggedTask]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over } = event
      if (!over) {
        setDragOverColumn(null)
        return
      }

      // Determine which column we're over
      const overId = over.id as string
      if (overId.startsWith('column-')) {
        const status = overId.replace('column-', '') as TaskStatus
        setDragOverColumn(status)
      } else {
        // Over a task — find its column
        const col = findTaskColumn(overId)
        if (col) {
          setDragOverColumn(col)
        }
      }
    },
    [findTaskColumn, setDragOverColumn]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveTask(null)
      setDraggedTask(null)
      setDragOverColumn(null)

      if (!over) return

      const activeId = active.id as string
      const overId = over.id as string

      // Determine target column
      let targetStatus: TaskStatus
      let targetIndex: number

      if (overId.startsWith('column-')) {
        // Dropped on column itself — append at end
        targetStatus = overId.replace('column-', '') as TaskStatus
        targetIndex = (tasksByStatus[targetStatus] ?? []).length
      } else {
        // Dropped on another task
        const col = findTaskColumn(overId)
        if (!col) return
        targetStatus = col
        const targetTasks = tasksByStatus[col] ?? []
        const overIndex = targetTasks.findIndex((t) => t.id === overId)
        targetIndex = overIndex >= 0 ? overIndex : targetTasks.length
      }

      const sourceColumn = findTaskColumn(activeId)
      if (!sourceColumn) return

      if (sourceColumn === targetStatus) {
        // Same column reorder
        await reorderTask(activeId, targetIndex)
      } else {
        // Move to different column
        await moveTask(activeId, targetStatus, targetIndex)
      }
    },
    [tasksByStatus, findTaskColumn, moveTask, reorderTask, setDraggedTask, setDragOverColumn]
  )

  const handleInitProject = useCallback(async () => {
    if (initName.trim()) {
      const { initProject } = useTaskStore.getState()
      await initProject(initName.trim())
    }
  }, [initName])

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loading}>
        <LoadingSpinner label="Loading project..." />
      </div>
    )
  }

  // No project state — show init screen
  if (!projectState) {
    return (
      <div className={styles.emptyProject}>
        <h2>Welcome to Kanban Agent</h2>
        <p>Create a new project to get started with your AI-powered kanban board.</p>
        <div className={styles.initForm}>
          <input
            className={styles.initInput}
            type="text"
            placeholder="Project name..."
            value={initName}
            onChange={(e) => setInitName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInitProject()
            }}
          />
          <button className={styles.initButton} onClick={handleInitProject}>
            Create Project
          </button>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.board}>
        {columnOrder.map((status, colIndex) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status] ?? []}
            onTaskClick={handleTaskClick}
            onCreateTask={(title) => handleCreateTask(status, title)}
            selectedTaskId={activeTaskId}
            focusedTaskIndex={focusedTaskIndex}
            isFocusedColumn={focusedColumnIndex === colIndex}
            showCreateInput={createColumnIndex === colIndex}
            onCreateInputShown={() => setCreateColumnIndex(null)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskCardOverlay task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
