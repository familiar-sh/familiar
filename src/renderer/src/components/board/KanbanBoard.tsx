import { useState, useCallback, useMemo, useRef } from 'react'
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

export interface DropIndicator {
  column: TaskStatus
  index: number
}

export function KanbanBoard(): React.JSX.Element {
  const { projectState, isLoading, addTask, moveTask, reorderTask, moveTasks, archiveAllDone } =
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

  // Drop indicator: tracks where the card would land.
  // Uses state for rendering but avoids DOM-changing updates that cause
  // dnd-kit measurement cascades (SortableContext items never change).
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null)

  // Ref mirror of dropIndicator for use in handleDragEnd (avoids stale closure)
  const dropIndicatorRef = useRef<DropIndicator | null>(null)

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
      const filtered = pointerCollisions.filter((c) => c.id !== activeId)
      if (filtered.length > 0) {
        const taskCollision = filtered.find(
          (c) => !(c.id as string).startsWith('column-')
        )
        return [taskCollision ?? filtered[0]]
      }
      const columnCollision = pointerCollisions.find(
        (c) => (c.id as string).startsWith('column-')
      )
      if (columnCollision) return [columnCollision]
    }
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

  // Find which column a task belongs to (always uses real data, not virtual)
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
        if (!selectedTaskIds.has(task.id)) {
          clearSelection()
        }
      }
    },
    [findTask, setDraggedTask, selectedTaskIds, clearSelection]
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) {
        setDragOverColumn(null)
        setDropIndicator(null)
        dropIndicatorRef.current = null
        return
      }

      const activeId = active.id as string
      const overId = over.id as string

      let targetStatus: TaskStatus | null = null
      let targetIndex: number

      if (overId.startsWith('column-')) {
        targetStatus = overId.replace('column-', '') as TaskStatus
        // Dropping on empty column area → append to end
        const colTasks = tasksByStatus[targetStatus] ?? []
        targetIndex = colTasks.filter((t) => t.id !== activeId).length
      } else {
        // Over a task — find its column and index
        targetStatus = findTaskColumn(overId)
        if (!targetStatus) return
        const colTasks = tasksByStatus[targetStatus] ?? []
        const overIdx = colTasks.findIndex((t) => t.id === overId)
        targetIndex = overIdx >= 0 ? overIdx : colTasks.length
      }

      setDragOverColumn(targetStatus)

      const newIndicator: DropIndicator = { column: targetStatus, index: targetIndex }
      // Only update state if the indicator actually changed (avoids unnecessary renders)
      setDropIndicator((prev) => {
        if (prev && prev.column === newIndicator.column && prev.index === newIndicator.index) {
          return prev
        }
        return newIndicator
      })
      dropIndicatorRef.current = newIndicator
    },
    [findTaskColumn, setDragOverColumn, tasksByStatus]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      const indicator = dropIndicatorRef.current
      setActiveTask(null)
      setDraggedTask(null)
      setDragOverColumn(null)
      setDropIndicator(null)
      dropIndicatorRef.current = null

      if (!over || !indicator) return

      const activeId = active.id as string
      const sourceColumn = findTaskColumn(activeId)
      if (!sourceColumn) return

      const { column: targetStatus, index: targetIndex } = indicator

      // Multi-select: move all selected tasks together
      const draggedIds =
        selectedTaskIds.has(activeId) && selectedTaskIds.size > 1
          ? Array.from(selectedTaskIds)
          : [activeId]

      if (draggedIds.length > 1) {
        const idsToMove = draggedIds.filter((id) => findTaskColumn(id) !== targetStatus)
        if (idsToMove.length > 0) {
          await moveTasks(idsToMove, targetStatus, targetIndex)
        }
        clearSelection()
      } else {
        if (sourceColumn === targetStatus) {
          await reorderTask(activeId, targetIndex)
        } else {
          await moveTask(activeId, targetStatus, targetIndex)
        }
      }
    },
    [
      findTaskColumn,
      moveTask,
      reorderTask,
      moveTasks,
      setDraggedTask,
      setDragOverColumn,
      selectedTaskIds,
      clearSelection
    ]
  )

  const handleDragCancel = useCallback(() => {
    setActiveTask(null)
    setDraggedTask(null)
    setDragOverColumn(null)
    setDropIndicator(null)
    dropIndicatorRef.current = null
  }, [setDraggedTask, setDragOverColumn])

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
      onDragCancel={handleDragCancel}
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
            draggedTaskId={activeTask?.id ?? null}
            dropIndicator={
              dropIndicator && dropIndicator.column === status ? dropIndicator : null
            }
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
