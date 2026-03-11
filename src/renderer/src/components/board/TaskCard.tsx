import { useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskStatus, Priority } from '@shared/types'
import { PRIORITY_COLORS } from '@shared/constants'
import { useContextMenu } from '@renderer/hooks/useContextMenu'
import { useTaskStore } from '@renderer/stores/task-store'
import { ContextMenu, AgentStatusBadge } from '@renderer/components/common'
import type { ContextMenuItem } from '@renderer/components/common'
import styles from './TaskCard.module.css'

interface TaskCardProps {
  task: Task
  onClick: () => void
  isDragging?: boolean
  isSelected?: boolean
  isFocused?: boolean
}

export function TaskCard({
  task,
  onClick,
  isDragging = false,
  isSelected = false,
  isFocused = false
}: TaskCardProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({ id: task.id })

  const { updateTask, deleteTask } = useTaskStore()
  const contextMenu = useContextMenu()

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1
  }

  const cardClass = [
    styles.card,
    isSelected ? styles.cardSelected : '',
    isDragging || isSortableDragging ? styles.cardDragging : '',
    isFocused ? styles.cardFocused : ''
  ]
    .filter(Boolean)
    .join(' ')

  const handleStatusChange = useCallback(
    (status: TaskStatus) => {
      updateTask({ ...task, status })
    },
    [task, updateTask]
  )

  const handlePriorityChange = useCallback(
    (priority: Priority) => {
      updateTask({ ...task, priority })
    },
    [task, updateTask]
  )

  const handleDelete = useCallback(() => {
    const confirmed = window.confirm(`Delete task "${task.title}"?`)
    if (confirmed) {
      deleteTask(task.id)
    }
  }, [task, deleteTask])

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(task.id)
  }, [task.id])

  const contextMenuItems: ContextMenuItem[] = [
    {
      label: 'Move to Backlog',
      onClick: () => handleStatusChange('backlog'),
      shortcut: ''
    },
    {
      label: 'Move to Todo',
      onClick: () => handleStatusChange('todo'),
      shortcut: ''
    },
    {
      label: 'Move to In Progress',
      onClick: () => handleStatusChange('in-progress'),
      shortcut: ''
    },
    {
      label: 'Move to Done',
      onClick: () => handleStatusChange('done'),
      shortcut: ''
    },
    { label: '', onClick: () => {}, divider: true },
    {
      label: 'Urgent',
      onClick: () => handlePriorityChange('urgent'),
      shortcut: '1'
    },
    {
      label: 'High',
      onClick: () => handlePriorityChange('high'),
      shortcut: '2'
    },
    {
      label: 'Medium',
      onClick: () => handlePriorityChange('medium'),
      shortcut: '3'
    },
    {
      label: 'Low',
      onClick: () => handlePriorityChange('low'),
      shortcut: '4'
    },
    { label: '', onClick: () => {}, divider: true },
    {
      label: 'Copy ID',
      onClick: handleCopyId,
      shortcut: ''
    },
    { label: '', onClick: () => {}, divider: true },
    {
      label: 'Delete',
      onClick: handleDelete,
      danger: true,
      shortcut: 'Del'
    }
  ]

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cardClass}
        onClick={onClick}
        onContextMenu={contextMenu.open}
        role="button"
        tabIndex={0}
        data-task-id={task.id}
        {...attributes}
        {...listeners}
      >
        <div className={styles.topRow}>
          <span
            className={styles.priorityDot}
            style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
            title={`Priority: ${task.priority}`}
          />
          <span className={styles.title}>{task.title}</span>
          <AgentStatusBadge status={task.agentStatus} />
        </div>

        <div className={styles.bottomRow}>
          {task.labels.map((label) => (
            <span key={label} className={styles.label}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {contextMenu.isOpen && (
        <ContextMenu
          items={contextMenuItems}
          position={contextMenu.position}
          onClose={contextMenu.close}
        />
      )}
    </>
  )
}

/** Plain TaskCard without dnd-kit for use in DragOverlay */
export function TaskCardOverlay({
  task
}: {
  task: Task
}): React.JSX.Element {
  return (
    <div className={`${styles.card} ${styles.cardDragging}`}>
      <div className={styles.topRow}>
        <span
          className={styles.priorityDot}
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
        />
        <span className={styles.title}>{task.title}</span>
      </div>
      <div className={styles.bottomRow}>
        {task.labels.map((label) => (
          <span key={label} className={styles.label}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
