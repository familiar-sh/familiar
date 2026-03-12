import { useState, useCallback, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, TaskStatus, Snippet } from '@shared/types'
import { COLUMN_LABELS } from '@shared/constants'
import { useContextMenu } from '@renderer/hooks/useContextMenu'
import { ContextMenu } from '@renderer/components/common'
import type { ContextMenuItem } from '@renderer/components/common'
import type { DropIndicator } from './KanbanBoard'
import { TaskCard } from './TaskCard'
import styles from './KanbanColumn.module.css'

interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  onTaskClick: (taskId: string) => void
  onMultiSelect: (taskId: string, append: boolean) => void
  onCreateTask: (title: string, document?: string) => void
  selectedTaskId?: string | null
  multiSelectedIds?: Set<string>
  draggedTaskId?: string | null
  dropIndicator?: DropIndicator | null
  focusedTaskIndex?: number
  isFocusedColumn?: boolean
  showCreateInput?: boolean
  onCreateInputShown?: () => void
  headerAction?: React.ReactNode
  dashboardSnippets?: Snippet[]
  alwaysShowInput?: boolean
}

const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: 'var(--status-todo)',
  'in-progress': 'var(--status-in-progress)',
  'in-review': 'var(--status-in-review)',
  done: 'var(--status-done)',
  archived: 'var(--status-archived)'
}

export function KanbanColumn({
  status,
  tasks,
  onTaskClick,
  onMultiSelect,
  onCreateTask,
  selectedTaskId,
  multiSelectedIds,
  draggedTaskId,
  dropIndicator,
  focusedTaskIndex = -1,
  isFocusedColumn = false,
  showCreateInput = false,
  onCreateInputShown,
  headerAction,
  dashboardSnippets = [],
  alwaysShowInput = false
}: KanbanColumnProps): React.JSX.Element {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const contextMenu = useContextMenu()

  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status}`,
    data: { type: 'column', status }
  })

  const taskIds = tasks.map((t) => t.id)

  // Show create input when triggered externally (keyboard shortcut)
  useEffect(() => {
    if (showCreateInput && !isCreating) {
      setIsCreating(true)
      onCreateInputShown?.()
    }
  }, [showCreateInput, isCreating, onCreateInputShown])

  // Auto-focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  // Listen for focus-new-task-input event (triggered by Cmd+N)
  useEffect(() => {
    if (!alwaysShowInput) return
    const handleFocus = (): void => {
      inputRef.current?.focus()
    }
    window.addEventListener('focus-new-task-input', handleFocus)
    return () => window.removeEventListener('focus-new-task-input', handleFocus)
  }, [alwaysShowInput])

  const handlePlusClick = useCallback(() => {
    setIsCreating(true)
  }, [])

  const resizeCreateTextarea = useCallback(() => {
    const el = inputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [])

  useEffect(() => {
    resizeCreateTextarea()
  }, [newTaskTitle, resizeCreateTextarea])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && newTaskTitle.trim()) {
        e.preventDefault()
        const lines = newTaskTitle.trim().split('\n')
        const title = lines[0].trim()
        const document = lines.slice(1).join('\n').trim() || undefined
        if (title) {
          onCreateTask(title, document)
          setNewTaskTitle('')
        }
      }
      if (e.key === 'Escape') {
        setNewTaskTitle('')
        if (!alwaysShowInput) {
          setIsCreating(false)
        }
        ;(e.target as HTMLTextAreaElement).blur()
      }
    },
    [newTaskTitle, onCreateTask]
  )

  const handleBlur = useCallback(() => {
    if (!alwaysShowInput && !newTaskTitle.trim()) {
      setIsCreating(false)
    }
  }, [newTaskTitle, alwaysShowInput])

  const columnContextItems: ContextMenuItem[] = [
    ...(status !== 'archived'
      ? [
          {
            label: 'Create task',
            onClick: () => setIsCreating(true),
            shortcut: 'C'
          },
          { label: '', onClick: () => {}, divider: true } as ContextMenuItem
        ]
      : []),
    {
      label: `Clear column (${tasks.length})`,
      onClick: () => {},
      danger: tasks.length > 0
    }
  ]

  // Build the task list with drop indicator inserted at the right position
  const renderTasks = (): React.ReactNode => {
    if (tasks.length === 0 && !isCreating && !dropIndicator) {
      return (
        <div className={styles.empty}>
          <span style={{ opacity: 0.6 }}>No tasks</span>
        </div>
      )
    }

    const indicator = (
      <div
        key="drop-indicator"
        className={styles.dropIndicator}
      />
    )

    const elements: React.ReactNode[] = []

    // If there are no tasks but we have a drop indicator, just show the indicator
    if (tasks.length === 0 && dropIndicator) {
      return indicator
    }

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]

      // Insert drop indicator before this task if needed
      if (dropIndicator && dropIndicator.index === i && task.id !== draggedTaskId) {
        elements.push(indicator)
      }

      elements.push(
        <TaskCard
          key={task.id}
          task={task}
          onClick={() => onTaskClick(task.id)}
          onMultiSelect={onMultiSelect}
          isSelected={selectedTaskId === task.id}
          isMultiSelected={multiSelectedIds?.has(task.id) ?? false}
          isFocused={isFocusedColumn && focusedTaskIndex === i}
          dashboardSnippets={dashboardSnippets}
        />
      )
    }

    // Drop indicator at the end (after all cards)
    if (dropIndicator && dropIndicator.index >= tasks.length) {
      elements.push(indicator)
    }

    return elements
  }

  return (
    <div
      ref={setNodeRef}
      className={`${styles.column} ${isOver ? styles.columnDragOver : ''}`}
      onContextMenu={contextMenu.open}
    >
      <div className={styles.header}>
        <span
          className={styles.statusDot}
          style={{ backgroundColor: STATUS_COLORS[status] }}
        />
        <span className={styles.statusName}>{COLUMN_LABELS[status]}</span>
        <span className={styles.taskCount}>{tasks.length}</span>
        {headerAction}
        {status !== 'archived' && (
          <button
            className={styles.addButton}
            onClick={handlePlusClick}
            title="Create task (c)"
            aria-label={`Create task in ${COLUMN_LABELS[status]}`}
          >
            +
          </button>
        )}
      </div>

      {(alwaysShowInput || isCreating) && (
        <div className={styles.createArea}>
          <textarea
            ref={inputRef}
            className={styles.createInput}
            placeholder="Task title... (Shift+Enter for notes, Enter to create)"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            rows={1}
          />
        </div>
      )}

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className={`${styles.taskList} ${isOver ? styles.dropTarget : ''}`}>
          {renderTasks()}
        </div>
      </SortableContext>

      {contextMenu.isOpen && (
        <ContextMenu
          items={columnContextItems}
          position={contextMenu.position}
          onClose={contextMenu.close}
        />
      )}
    </div>
  )
}
