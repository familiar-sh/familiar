import { useCallback, useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskStatus, Priority, AgentStatus, Snippet, LabelConfig } from '@shared/types'
import { DEFAULT_LABEL_COLOR } from '@shared/constants'
import { LucideIconByName } from '@renderer/components/terminal/IconPicker'
import { useContextMenu } from '@renderer/hooks/useContextMenu'
import { useTaskStore } from '@renderer/stores/task-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { useBoardStore } from '@renderer/stores/board-store'
import { ContextMenu, PriorityIcon } from '@renderer/components/common'
import type { ContextMenuItem } from '@renderer/components/common'
import styles from './TaskCard.module.css'

function getLabelColor(name: string, projectLabels: LabelConfig[]): string {
  const config = projectLabels.find((l) => l.name === name)
  return config?.color ?? DEFAULT_LABEL_COLOR
}

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
  dashboardSnippets?: Snippet[]
}

export function TaskCard({
  task,
  onClick,
  onMultiSelect,
  isDragging = false,
  isSelected = false,
  isMultiSelected = false,
  isFocused = false,
  dashboardSnippets = []
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
  const projectLabels = useTaskStore((s) => s.projectState?.labels ?? [])
  const contextMenu = useContextMenu()
  const [priorityOpen, setPriorityOpen] = useState(false)
  const priorityRef = useRef<HTMLButtonElement>(null)
  const notifications = useNotificationStore((s) => s.notifications)
  const hasUnread = notifications.some((n) => !n.read && n.taskId === task.id)
  const markReadByTaskId = useNotificationStore((s) => s.markReadByTaskId)
  const selectedTaskIds = useBoardStore((s) => s.selectedTaskIds)

  useEffect(() => {
    if (!priorityOpen) return
    function handleClickOutside(e: MouseEvent): void {
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) {
        setPriorityOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [priorityOpen])

  const handlePriorityIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setPriorityOpen((prev) => !prev)
  }, [])

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

  const handleSnippetClick = useCallback(
    (e: React.MouseEvent, snippet: Snippet) => {
      e.stopPropagation()
      const sessionName = `kanban-${task.id}`
      window.api.tmuxSendKeys(sessionName, snippet.command, snippet.pressEnter).catch((err) => {
        console.warn('Failed to send snippet command:', err)
      })
    },
    [task.id]
  )

  const handleMarkAsRead = useCallback(async () => {
    // If multiple cards are selected and this card is among them, mark all selected as read
    if (isMultiSelected && selectedTaskIds.size > 1) {
      for (const id of selectedTaskIds) {
        await markReadByTaskId(id)
      }
    } else {
      await markReadByTaskId(task.id)
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
          <button
            ref={priorityRef}
            className={styles.priorityBtn}
            onClick={handlePriorityIconClick}
            title={`Priority: ${task.priority}`}
          >
            <PriorityIcon priority={task.priority} size={14} />
            {priorityOpen && (
              <div className={styles.priorityDropdown}>
                {(['urgent', 'high', 'medium', 'low', 'none'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    className={`${styles.priorityOption} ${p === task.priority ? styles.priorityOptionActive : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePriorityChange(p)
                      setPriorityOpen(false)
                    }}
                  >
                    <PriorityIcon priority={p} size={14} />
                    <span>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                  </button>
                ))}
              </div>
            )}
          </button>
          <span className={styles.title}>{task.title}</span>
          <span
            className={`${styles.agentDot}${task.agentStatus === 'running' ? ` ${styles.agentRunning}` : ''}`}
            style={{ backgroundColor: getAgentDotColor(task.agentStatus, task.status) }}
            title={`Agent: ${task.agentStatus}`}
          />
          {hasUnread && <span className={styles.notificationDot} title="Has notifications" />}
        </div>

        {(dashboardSnippets.length > 0 || task.labels.length > 0) && (
          <div className={styles.footer}>
            {dashboardSnippets.slice(0, 4).map((snippet, i) => {
              const iconOnly = snippet.icon && snippet.showIconInDashboard
              return (
                <button
                  key={i}
                  className={`${styles.snippetBtn} ${i === 0 ? styles.snippetBtnPrimary : ''} ${iconOnly ? styles.snippetBtnIcon : ''}`}
                  onClick={(e) => handleSnippetClick(e, snippet)}
                  title={`${snippet.title}: ${snippet.command}`}
                >
                  {snippet.icon && <LucideIconByName name={snippet.icon} size={12} />}
                  {!iconOnly && snippet.title}
                </button>
              )
            })}
            {dashboardSnippets.length > 0 && task.labels.length > 0 && (
              <div className={styles.footerSpacer} />
            )}
            {task.labels.map((label) => {
              const color = getLabelColor(label, projectLabels)
              return (
                <span
                  key={label}
                  className={styles.label}
                  style={{
                    backgroundColor: `${color}20`,
                    borderColor: `${color}40`,
                    color
                  }}
                >
                  {label}
                </span>
              )
            })}
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
          <PriorityIcon priority={task.priority} size={14} />
          <span className={styles.title}>{task.title}</span>
          <span
            className={`${styles.agentDot}${task.agentStatus === 'running' ? ` ${styles.agentRunning}` : ''}`}
            style={{ backgroundColor: getAgentDotColor(task.agentStatus, task.status) }}
          />
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
