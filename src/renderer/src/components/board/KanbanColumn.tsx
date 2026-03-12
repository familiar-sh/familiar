import { useState, useCallback, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, TaskStatus } from '@shared/types'
import { COLUMN_LABELS } from '@shared/constants'
import { useContextMenu } from '@renderer/hooks/useContextMenu'
import { ContextMenu } from '@renderer/components/common'
import type { ContextMenuItem } from '@renderer/components/common'
import { TaskCard } from './TaskCard'
import styles from './KanbanColumn.module.css'

interface KanbanColumnProps {
  status: TaskStatus
  tasks: Task[]
  onTaskClick: (taskId: string) => void
  onMultiSelect: (taskId: string, append: boolean) => void
  onCreateTask: (title: string) => void
  selectedTaskId?: string | null
  multiSelectedIds?: Set<string>
  focusedTaskIndex?: number
  isFocusedColumn?: boolean
  showCreateInput?: boolean
  onCreateInputShown?: () => void
  headerAction?: React.ReactNode
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
  focusedTaskIndex = -1,
  isFocusedColumn = false,
  showCreateInput = false,
  onCreateInputShown,
  headerAction
}: KanbanColumnProps): React.JSX.Element {
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
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

  const handlePlusClick = useCallback(() => {
    setIsCreating(true)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && newTaskTitle.trim()) {
        onCreateTask(newTaskTitle.trim())
        setNewTaskTitle('')
        // Keep input open for rapid creation
      }
      if (e.key === 'Escape') {
        setNewTaskTitle('')
        setIsCreating(false)
        ;(e.target as HTMLInputElement).blur()
      }
    },
    [newTaskTitle, onCreateTask]
  )

  const handleBlur = useCallback(() => {
    if (!newTaskTitle.trim()) {
      setIsCreating(false)
    }
  }, [newTaskTitle])

  const columnContextItems: ContextMenuItem[] = [
    {
      label: 'Create task',
      onClick: () => setIsCreating(true),
      shortcut: 'C'
    },
    { label: '', onClick: () => {}, divider: true },
    {
      label: `Clear column (${tasks.length})`,
      onClick: () => {
        // This is a UI action - handled by parent
      },
      danger: tasks.length > 0
    }
  ]

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
        <button
          className={styles.addButton}
          onClick={handlePlusClick}
          title="Create task (c)"
          aria-label={`Create task in ${COLUMN_LABELS[status]}`}
        >
          +
        </button>
      </div>

      {isCreating && (
        <div className={styles.createArea}>
          <input
            ref={inputRef}
            className={styles.createInput}
            type="text"
            placeholder="Task title... (Enter to create, Esc to cancel)"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
        </div>
      )}

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className={`${styles.taskList} ${isOver ? styles.dropTarget : ''}`}>
          {tasks.length === 0 && !isCreating ? (
            <div className={styles.empty}>
              <span style={{ opacity: 0.6 }}>No tasks</span>
            </div>
          ) : (
            tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
                onMultiSelect={onMultiSelect}
                isSelected={selectedTaskId === task.id}
                isMultiSelected={multiSelectedIds?.has(task.id) ?? false}
                isFocused={isFocusedColumn && focusedTaskIndex === index}
              />
            ))
          )}
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
