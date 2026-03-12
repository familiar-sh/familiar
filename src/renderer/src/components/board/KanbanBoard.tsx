import { useState, useCallback, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection
} from '@dnd-kit/core'
import type {
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  CollisionDetection
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import type { Task, TaskStatus } from '@shared/types'
import { DEFAULT_COLUMNS } from '@shared/constants'
import { filterTasks } from '@shared/utils/task-utils'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useBoardStore } from '@renderer/stores/board-store'
import { useKeyboardNavigation } from '@renderer/hooks/useKeyboardNavigation'
import { useMarqueeSelection } from '@renderer/hooks/useMarqueeSelection'
import { LoadingSpinner } from '@renderer/components/common'
import { KanbanColumn } from './KanbanColumn'
import { TaskCardOverlay } from './TaskCard'
import styles from './KanbanBoard.module.css'

export function KanbanBoard(): React.JSX.Element {
  const { projectState, isLoading, addTask, moveTask, moveTasks, reorderTask, archiveAllDone } =
    useTaskStore()
  const { filters, openTaskDetail, activeTaskId, focusedColumnIndex, focusedTaskIndex } =
    useUIStore()
  const {
    setDraggedTask,
    setDragOverColumn,
    selectedTaskIds,
    toggleTaskSelection,
    setSelectedTaskIds,
    clearSelection
  } = useBoardStore()

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

  // Custom collision detection: prefer pointerWithin (detects the column the pointer
  // is inside), then fall back to rectIntersection for edge cases (e.g. fast drags).
  // Active item is excluded to prevent self-collision no-ops.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeId = args.active.id
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) {
      // Filter out the active (dragged) item — its droppable stays registered
      // at the original DOM position and can cause false self-collisions.
      const filtered = pointerCollisions.filter((c) => c.id !== activeId)
      if (filtered.length > 0) {
        // Prefer sortable task items over column droppables so that
        // drop-between-cards positioning works correctly.
        const taskCollision = filtered.find(
          (c) => !(c.id as string).startsWith('column-')
        )
        return [taskCollision ?? filtered[0]]
      }
      // Only self-collision detected — fall back to column collision
      const columnCollision = pointerCollisions.find(
        (c) => (c.id as string).startsWith('column-')
      )
      if (columnCollision) return [columnCollision]
    }

    // Fallback to rect intersection for fast drags (also excluding active item)
    const rectCollisions = rectIntersection(args)
    return rectCollisions.filter((c) => c.id !== activeId)
  }, [])

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

  // Marquee (lasso) selection
  const handleMarqueeSelect = useCallback(
    (ids: Set<string>) => {
      setSelectedTaskIds(ids)
    },
    [setSelectedTaskIds]
  )

  const { containerRef, marqueeRect, isSelecting, handleMouseDown, consumeMarqueeClick } = useMarqueeSelection({
    itemSelector: '[data-task-id]',
    onSelect: handleMarqueeSelect
  })

  // Sync containerRef with the board div
  const boardRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node
    },
    [containerRef]
  )

  const handleTaskClick = useCallback(
    (taskId: string) => {
      clearSelection()
      openTaskDetail(taskId)
    },
    [openTaskDetail, clearSelection]
  )

  const handleMultiSelect = useCallback(
    (taskId: string, append: boolean) => {
      toggleTaskSelection(taskId, append)
    },
    [toggleTaskSelection]
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
        // If dragging a task not in the selection, clear selection and select only this task
        if (!selectedTaskIds.has(task.id)) {
          clearSelection()
        }
      }
    },
    [findTask, setDraggedTask, selectedTaskIds, clearSelection]
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

      // Dropped on itself — no-op (single card only)
      if (activeId === overId && selectedTaskIds.size <= 1) return

      // Determine target column
      let targetStatus: TaskStatus
      let targetIndex: number

      if (overId.startsWith('column-')) {
        targetStatus = overId.replace('column-', '') as TaskStatus
        targetIndex = (tasksByStatus[targetStatus] ?? []).length
      } else {
        const col = findTaskColumn(overId)
        if (!col) return
        targetStatus = col
        const targetTasks = tasksByStatus[col] ?? []
        const overIndex = targetTasks.findIndex((t) => t.id === overId)
        targetIndex = overIndex >= 0 ? overIndex : targetTasks.length
      }

      // Multi-select: move all selected tasks together
      const draggedIds =
        selectedTaskIds.has(activeId) && selectedTaskIds.size > 1
          ? Array.from(selectedTaskIds)
          : [activeId]

      if (draggedIds.length > 1) {
        await moveTasks(draggedIds, targetStatus, targetIndex)
        clearSelection()
      } else {
        const sourceColumn = findTaskColumn(activeId)
        if (!sourceColumn) return

        if (sourceColumn === targetStatus) {
          await reorderTask(activeId, targetIndex)
        } else {
          await moveTask(activeId, targetStatus, targetIndex)
        }
      }
    },
    [
      tasksByStatus,
      findTaskColumn,
      moveTask,
      moveTasks,
      reorderTask,
      setDraggedTask,
      setDragOverColumn,
      selectedTaskIds,
      clearSelection
    ]
  )

  const handleArchiveDone = useCallback(async () => {
    const doneTasks = (tasksByStatus['done'] ?? [])
    if (doneTasks.length === 0) return
    await archiveAllDone()
  }, [tasksByStatus, archiveAllDone])

  const handleOpenWorkspace = useCallback(async () => {
    const { openWorkspace } = useTaskStore.getState()
    await openWorkspace()
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.loading}>
        <LoadingSpinner label="Loading project..." />
      </div>
    )
  }

  // No project state — show open workspace screen
  if (!projectState) {
    return (
      <div className={styles.emptyProject}>
        <div className={styles.workspaceIcon}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h2>Kanban Agent</h2>
        <p>Open a folder to get started. If the folder already contains a project, it will be loaded automatically.</p>
        <button className={styles.openWorkspaceButton} onClick={handleOpenWorkspace}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Open Workspace
        </button>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={boardRef}
        className={styles.board}
        onClick={() => { if (!consumeMarqueeClick()) clearSelection() }}
        onMouseDown={handleMouseDown}
      >
        {columnOrder.map((status, colIndex) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status] ?? []}
            onTaskClick={handleTaskClick}
            onMultiSelect={handleMultiSelect}
            onCreateTask={(title) => handleCreateTask(status, title)}
            selectedTaskId={activeTaskId}
            multiSelectedIds={selectedTaskIds}
            focusedTaskIndex={focusedTaskIndex}
            isFocusedColumn={focusedColumnIndex === colIndex}
            showCreateInput={createColumnIndex === colIndex}
            onCreateInputShown={() => setCreateColumnIndex(null)}
            headerAction={
              status === 'done' && (tasksByStatus['done'] ?? []).length > 0 ? (
                <button
                  className={styles.archiveDoneButton}
                  onClick={handleArchiveDone}
                  title="Move all done tasks to archive"
                >
                  Archive all
                </button>
              ) : undefined
            }
          />
        ))}
      </div>

      {isSelecting && marqueeRect && (
        <div
          className={styles.marquee}
          style={{
            position: 'fixed',
            left: marqueeRect.x,
            top: marqueeRect.y,
            width: marqueeRect.width,
            height: marqueeRect.height
          }}
        />
      )}

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <TaskCardOverlay
            task={activeTask}
            count={selectedTaskIds.has(activeTask.id) ? selectedTaskIds.size : 1}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
