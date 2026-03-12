import { useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskStatus, Priority, AgentStatus } from '@shared/types'
import { useContextMenu } from '@renderer/hooks/useContextMenu'
import { useTaskStore } from '@renderer/stores/task-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { useBoardStore } from '@renderer/stores/board-store'
import { ContextMenu } from '@renderer/components/common'
import type { ContextMenuItem } from '@renderer/components/common'
import styles from './TaskCard.module.css'

const AGENT_STATUS_COLORS: Record<AgentStatus, string> = {
  idle: '#5c5c6e',
  running: '#5e6ad2',
  done: '#27ae60',
  error: '#e74c3c'
}

/** Green "done" dot only shows when task is in the done column; otherwise gray */
function getAgentDotColor(agentStatus: AgentStatus, taskStatus: TaskStatus): string {
  if (agentStatus === 'done' && taskStatus !== 'done') {
    return AGENT_STATUS_COLORS.idle
  }
  return AGENT_STATUS_COLORS[agentStatus]
}

interface TaskCardProps {
  task: Task
  onClick: () => void
  onMultiSelect?: (taskId: string, append: boolean) => void
  isDragging?: boolean
  isSelected?: boolean
  isMultiSelected?: boolean
  isFocused?: boolean
}

export function TaskCard({
  task,
  onClick,
  onMultiSelect,
  isDragging = false,
  isSelected = false,
  isMultiSelected = false,
  isFocused = false
}: TaskCardProps): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({
    id: task.id,
    data: { type: 'task', task, status: task.status }
  })

  const { updateTask, deleteTask } = useTaskStore()
  const contextMenu = useContextMenu()
  const notifications = useNotificationStore((s) => s.notifications)
  const hasUnread = notifications.some((n) => !n.read && n.taskId === task.id)
  const markReadByTaskId = useNotificationStore((s) => s.markReadByTaskId)
  const selectedTaskIds = useBoardStore((s) => s.selectedTaskIds)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1
  }

  const cardClass = [
    styles.card,
    isSelected ? styles.cardSelected : '',
    isMultiSelected ? styles.cardMultiSelected : '',
    isDragging || isSortableDragging ? styles.cardDragging : '',
    isFocused ? styles.cardFocused : '',
    hasUnread ? styles.cardNotified : ''
  ]
    .filter(Boolean)
    .join(' ')

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.stopPropagation()
        onMultiSelect?.(task.id, true)
      } else {
        if (hasUnread) {
          markReadByTaskId(task.id)
        }
        onClick()
      }
    },
    [onClick, onMultiSelect, task.id, hasUnread, markReadByTaskId]
  )

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

  const handleMarkAsRead = useCallback(() => {
    // If multiple cards are selected and this card is among them, mark all selected as read
    if (isMultiSelected && selectedTaskIds.size > 1) {
      for (const id of selectedTaskIds) {
        markReadByTaskId(id)
      }
    } else {
      markReadByTaskId(task.id)
    }
  }, [isMultiSelected, selectedTaskIds, markReadByTaskId, task.id])

  // Check if any of the selected tasks (or this task) have unread notifications
  const hasUnreadInSelection =
    isMultiSelected && selectedTaskIds.size > 1
      ? notifications.some((n) => !n.read && n.taskId && selectedTaskIds.has(n.taskId))
      : hasUnread

  const contextMenuItems: ContextMenuItem[] = [
    ...(hasUnreadInSelection
      ? [
          {
            label:
              isMultiSelected && selectedTaskIds.size > 1
                ? `Mark ${selectedTaskIds.size} as Read`
                : 'Mark as Read',
            onClick: handleMarkAsRead,
            shortcut: 'R'
          },
          { label: '', onClick: () => {}, divider: true } as ContextMenuItem
        ]
      : []),
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
        onClick={handleClick}
        onContextMenu={contextMenu.open}
        data-task-id={task.id}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
      >
        <div className={styles.topRow}>
          <span
            className={`${styles.agentDot}${task.agentStatus === 'running' ? ` ${styles.agentRunning}` : ''}`}
            style={{ backgroundColor: getAgentDotColor(task.agentStatus, task.status) }}
            title={`Agent: ${task.agentStatus}`}
          />
          <span className={styles.title}>{task.title}</span>
          {hasUnread && <span className={styles.notificationDot} title="Has notifications" />}
        </div>

        {task.labels.length > 0 && (
          <div className={styles.bottomRow}>
            {task.labels.map((label) => (
              <span key={label} className={styles.label}>
                {label}
              </span>
            ))}
          </div>
        )}
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
  task,
  count = 1
}: {
  task: Task
  count?: number
}): React.JSX.Element {
  return (
    <div className={styles.overlayWrapper}>
      {count > 1 && (
        <>
          {count > 2 && <div className={styles.stackedCard} style={{ height: '100%' }} />}
          <div className={styles.stackedCard} style={{ height: '100%' }} />
          <span className={styles.selectionBadge}>{count}</span>
        </>
      )}
      <div className={`${styles.card} ${styles.cardDragging}`} style={{ position: 'relative' }}>
        <div className={styles.topRow}>
          <span
            className={`${styles.agentDot}${task.agentStatus === 'running' ? ` ${styles.agentRunning}` : ''}`}
            style={{ backgroundColor: getAgentDotColor(task.agentStatus, task.status) }}
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
    </div>
  )
}
