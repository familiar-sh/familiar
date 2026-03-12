import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
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
import type { Task, TaskStatus, Snippet } from '@shared/types'
import { DEFAULT_SNIPPETS } from '@shared/types/settings'
import { DEFAULT_COLUMNS } from '@shared/constants'
import { filterTasks } from '@shared/utils/task-utils'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useBoardStore } from '@renderer/stores/board-store'
import { useKeyboardNavigation } from '@renderer/hooks/useKeyboardNavigation'
import { useMarqueeSelection } from '@renderer/hooks/useMarqueeSelection'
import { LoadingSpinner } from '@renderer/components/common'
import { KanbanColumn } from './KanbanColumn'
import type { PendingImage, PendingPastedFile } from './KanbanColumn'
import { TaskCardOverlay } from './TaskCard'
import { CliSetupBanner } from './CliSetupBanner'
import styles from './KanbanBoard.module.css'

export interface DropIndicator {
  column: TaskStatus
  index: number
}

export function KanbanBoard(): React.JSX.Element {
  const { projectState, isLoading, addTask, moveTask, reorderTask, moveTasks, archiveAllDone } =
    useTaskStore()
  const { filters, openTaskDetail, activeTaskId, focusedColumnIndex, focusedTaskIndex, taskDetailOpen, settingsOpen } =
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

  const [snippets, setSnippets] = useState<Snippet[]>(DEFAULT_SNIPPETS)

  useEffect(() => {
    async function loadSnippets(): Promise<void> {
      try {
        const settings = await window.api.readSettings()
        if (settings.snippets && settings.snippets.length > 0) {
          setSnippets(settings.snippets)
        }
      } catch {
        // Use defaults
      }
    }
    loadSnippets()

    // Re-load when snippets are saved from the settings modal
    function handleSnippetsUpdated(e: Event): void {
      const detail = (e as CustomEvent<Snippet[]>).detail
      setSnippets(detail.length > 0 ? detail : DEFAULT_SNIPPETS)
    }
    window.addEventListener('snippets-updated', handleSnippetsUpdated)
    return () => window.removeEventListener('snippets-updated', handleSnippetsUpdated)
  }, [])

  const dashboardSnippets = useMemo(
    () => snippets.filter((s) => s.showInDashboard),
    [snippets]
  )

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

  const handleFocusInput = useCallback((colIndex: number) => {
    const status = columnOrder[colIndex]
    if (status) {
      window.dispatchEvent(new CustomEvent('focus-column-input', { detail: { status } }))
    }
  }, [columnOrder])

  useKeyboardNavigation({
    tasksByStatus,
    columnOrder,
    onCreateTask: handleKeyboardCreate,
    onFocusInput: handleFocusInput
  })

  // Auto-focus the new task input when the board is the active view,
  // but only if no card is keyboard-focused (so returning from task detail
  // preserves the focused card for immediate re-entry with Enter).
  // When a card IS focused, blur the active element so the browser doesn't
  // auto-shift DOM focus to the input (which would clear keyboard nav state).
  const boardIsActive = !taskDetailOpen && !settingsOpen && !isLoading
  useEffect(() => {
    if (boardIsActive && focusedColumnIndex < 0) {
      // Small delay to let any closing animations/transitions complete
      const timer = setTimeout(() => {
        window.dispatchEvent(new Event('focus-new-task-input'))
      }, 50)
      return () => clearTimeout(timer)
    }
    if (boardIsActive && focusedColumnIndex >= 0) {
      // Remove DOM focus from any element (e.g. terminal inside task detail)
      // so the browser doesn't auto-move it to the input when the overlay hides
      ;(document.activeElement as HTMLElement)?.blur?.()
    }
  }, [boardIsActive, focusedColumnIndex])

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
    async (status: TaskStatus, title: string, document?: string, enabledSnippets?: Snippet[], pendingImages?: PendingImage[], pendingPastedFiles?: PendingPastedFile[]) => {
      const task = await addTask(title, { status })
      if (document) {
        await window.api.writeTaskDocument(task.id, document)
      }
      // Copy pending images from temp to task attachments
      if (pendingImages && pendingImages.length > 0) {
        const attachmentPaths: string[] = []
        for (const img of pendingImages) {
          try {
            const absPath = await window.api.copyTempToAttachment(task.id, img.tempPath, img.fileName)
            attachmentPaths.push(absPath)
          } catch {
            console.warn('Failed to copy image to task attachments:', img.fileName)
          }
        }
        if (attachmentPaths.length > 0) {
          const { updateTask } = useTaskStore.getState()
          await updateTask({ ...task, attachments: attachmentPaths })
        }
      }
      // Save pasted files to task folder
      if (pendingPastedFiles && pendingPastedFiles.length > 0) {
        const pastedFiles = [...(task.pastedFiles ?? [])]
        for (const pf of pendingPastedFiles) {
          try {
            await window.api.savePastedFile(task.id, pf.meta.filename, pf.content)
            pastedFiles.push(pf.meta)
          } catch {
            console.warn('Failed to save pasted file:', pf.meta.filename)
          }
        }
        if (pastedFiles.length > 0) {
          const { updateTask } = useTaskStore.getState()
          await updateTask({ ...task, pastedFiles })
        }
      }
      // Auto-run enabled snippets 5 seconds after creation
      if (enabledSnippets && enabledSnippets.length > 0) {
        const taskId = task.id
        // Warmup tmux session immediately so it's ready
        window.api.warmupTmuxSession(taskId).catch(() => {})
        setTimeout(async () => {
          const sessionName = `familiar-${taskId}`
          for (const snippet of enabledSnippets) {
            try {
              await window.api.tmuxSendKeys(sessionName, snippet.command, snippet.pressEnter)
            } catch {
              // Session may not be ready — skip
            }
          }
        }, 5000)
      }
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

  const handleCompleteAllInReview = useCallback(async () => {
    const inReviewTasks = (tasksByStatus['in-review'] ?? [])
    if (inReviewTasks.length === 0) return
    const doneTasks = tasksByStatus['done'] ?? []
    await moveTasks(
      inReviewTasks.map((t) => t.id),
      'done',
      doneTasks.length
    )
  }, [tasksByStatus, moveTasks])

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
        <h2>Familiar</h2>
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
    <div className={styles.boardWrapper}>
      <CliSetupBanner />
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
              dashboardSnippets={dashboardSnippets}
              allSnippets={snippets}
              onTaskClick={handleTaskClick}
              onMultiSelect={handleMultiSelect}
              onCreateTask={(title, document, enabledSnippets, pendingImages, pendingPastedFiles) => handleCreateTask(status, title, document, enabledSnippets, pendingImages, pendingPastedFiles)}
              selectedTaskId={activeTaskId}
              multiSelectedIds={selectedTaskIds}
              draggedTaskId={activeTask?.id ?? null}
              dropIndicator={
                dropIndicator && dropIndicator.column === status ? dropIndicator : null
              }
              focusedTaskIndex={focusedTaskIndex}
              isFocusedColumn={focusedColumnIndex === colIndex}
              alwaysShowInput={status === 'todo'}
              showCreateInput={createColumnIndex === colIndex}
              onCreateInputShown={() => setCreateColumnIndex(null)}
              onInputExit={() => {
                useUIStore.getState().setFocusedColumn(colIndex)
                useUIStore.getState().setFocusedTask(0)
              }}
              headerAction={
                status === 'done' && (tasksByStatus['done'] ?? []).length > 0 ? (
                  <button
                    className={styles.archiveDoneButton}
                    onClick={handleArchiveDone}
                    title="Move all done tasks to archive"
                  >
                    Archive all
                  </button>
                ) : status === 'in-review' && (tasksByStatus['in-review'] ?? []).length > 0 ? (
                  <button
                    className={styles.archiveDoneButton}
                    onClick={handleCompleteAllInReview}
                    title="Move all in-review tasks to done"
                  >
                    Complete all
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
    </div>
  )
}
