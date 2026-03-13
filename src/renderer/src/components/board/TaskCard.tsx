import { useCallback, useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task, TaskStatus, Priority, AgentStatus, Snippet, LabelConfig } from '@shared/types'
import { DEFAULT_LABEL_COLOR } from '@shared/constants'
import { LucideIconByName } from '@renderer/components/terminal/IconPicker'
import { useContextMenu } from '@renderer/hooks/useContextMenu'
import { useDropdownPosition } from '@renderer/hooks/useDropdownPosition'
import { useProjectLabels } from '@renderer/hooks/useProjectLabels'
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

  const { updateTask, deleteTask, deleteTasks, moveTasks, setTasksPriority } = useTaskStore()
  const projectLabels = useProjectLabels()
  const contextMenu = useContextMenu()
  const [priorityOpen, setPriorityOpen] = useState(false)
  const priorityRef = useRef<HTMLButtonElement>(null)
  const priorityDropdownRef = useRef<HTMLDivElement>(null)
  useDropdownPosition(priorityDropdownRef, priorityOpen)
  const notifications = useNotificationStore((s) => s.notifications)
  const hasUnread = notifications.some((n) => !n.read && n.taskId === task.id)
  const markReadByTaskId = useNotificationStore((s) => s.markReadByTaskId)
  const selectedTaskIds = useBoardStore((s) => s.selectedTaskIds)
  const clearSelection = useBoardStore((s) => s.clearSelection)

  // Inline title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState(task.title)
  const titleInputRef = useRef<HTMLTextAreaElement>(null)

  // Description preview
  const [documentContent, setDocumentContent] = useState<string | null>(null)

  // Load document content on mount
  useEffect(() => {
    let cancelled = false
    window.api.readTaskDocument(task.id).then((content) => {
      if (!cancelled) setDocumentContent(content || '')
    }).catch(() => {
      if (!cancelled) setDocumentContent('')
    })
    return () => { cancelled = true }
  }, [task.id])

  // Auto-resize textarea to fit content
  const resizeTitleTextarea = useCallback(() => {
    const el = titleInputRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [])

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
      resizeTitleTextarea()
    }
  }, [isEditingTitle, resizeTitleTextarea])

  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEditTitleValue(task.title)
    setIsEditingTitle(true)
  }, [task.title])

  const handleTitleSave = useCallback(() => {
    const trimmed = editTitleValue.trim()
    if (trimmed && trimmed !== task.title) {
      updateTask({ ...task, title: trimmed })
    }
    setIsEditingTitle(false)
  }, [editTitleValue, task, updateTask])

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
    }
  }, [handleTitleSave])

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
      if (isMultiSelected && selectedTaskIds.size > 1) {
        moveTasks(Array.from(selectedTaskIds), status, Infinity)
        clearSelection()
      } else {
        updateTask({ ...task, status })
      }
    },
    [task, updateTask, isMultiSelected, selectedTaskIds, moveTasks, clearSelection]
  )

  const handlePriorityChange = useCallback(
    (priority: Priority) => {
      if (isMultiSelected && selectedTaskIds.size > 1) {
        setTasksPriority(Array.from(selectedTaskIds), priority)
        clearSelection()
      } else {
        updateTask({ ...task, priority })
      }
    },
    [task, updateTask, isMultiSelected, selectedTaskIds, setTasksPriority, clearSelection]
  )

  const handleDelete = useCallback(() => {
    if (isMultiSelected && selectedTaskIds.size > 1) {
      const count = selectedTaskIds.size
      const confirmed = window.confirm(`Delete ${count} selected tasks?`)
      if (confirmed) {
        const idsToDelete = Array.from(selectedTaskIds)
        clearSelection()
        deleteTasks(idsToDelete)
      }
    } else {
      const confirmed = window.confirm(`Delete task "${task.title}"?`)
      if (confirmed) {
        deleteTask(task.id)
      }
    }
  }, [task, deleteTask, deleteTasks, isMultiSelected, selectedTaskIds, clearSelection])

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(task.id)
  }, [task.id])

  const [snippetCooldowns, setSnippetCooldowns] = useState<Record<number, boolean>>({})

  const handleSnippetClick = useCallback(
    (e: React.MouseEvent, snippet: Snippet, index: number) => {
      e.stopPropagation()
      if (snippetCooldowns[index]) return
      const sessionName = `familiar-${task.id}`
      window.api.tmuxSendKeys(sessionName, snippet.command, snippet.pressEnter).catch((err) => {
        console.warn('Failed to send snippet command:', err)
      })
      setSnippetCooldowns((prev) => ({ ...prev, [index]: true }))
      setTimeout(() => {
        setSnippetCooldowns((prev) => {
          const next = { ...prev }
          delete next[index]
          return next
        })
      }, 5000)
    },
    [task.id, snippetCooldowns]
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

  const isMulti = isMultiSelected && selectedTaskIds.size > 1

  const contextMenuItems: ContextMenuItem[] = [
    ...(hasUnreadInSelection
      ? [
          {
            label: isMulti
              ? `Mark ${selectedTaskIds.size} as Read`
              : 'Mark as Read',
            onClick: handleMarkAsRead,
            shortcut: 'R'
          },
          { label: '', onClick: () => {}, divider: true } as ContextMenuItem
        ]
      : []),
    {
      label: isMulti ? `Move ${selectedTaskIds.size} to Todo` : 'Move to Todo',
      onClick: () => handleStatusChange('todo'),
      shortcut: ''
    },
    {
      label: isMulti ? `Move ${selectedTaskIds.size} to In Progress` : 'Move to In Progress',
      onClick: () => handleStatusChange('in-progress'),
      shortcut: ''
    },
    {
      label: isMulti ? `Move ${selectedTaskIds.size} to Done` : 'Move to Done',
      onClick: () => handleStatusChange('done'),
      shortcut: ''
    },
    { label: '', onClick: () => {}, divider: true },
    {
      label: isMulti ? `Set ${selectedTaskIds.size} Urgent` : 'Urgent',
      onClick: () => handlePriorityChange('urgent'),
      shortcut: '1'
    },
    {
      label: isMulti ? `Set ${selectedTaskIds.size} High` : 'High',
      onClick: () => handlePriorityChange('high'),
      shortcut: '2'
    },
    {
      label: isMulti ? `Set ${selectedTaskIds.size} Medium` : 'Medium',
      onClick: () => handlePriorityChange('medium'),
      shortcut: '3'
    },
    {
      label: isMulti ? `Set ${selectedTaskIds.size} Low` : 'Low',
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
      label: isMulti
        ? `Delete ${selectedTaskIds.size} Tasks`
        : 'Delete',
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
            aria-label={`Priority: ${task.priority}`}
          >
            <PriorityIcon priority={task.priority} size={14} />
            {priorityOpen && (
              <div ref={priorityDropdownRef} className={styles.priorityDropdown}>
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
          {isEditingTitle ? (
            <textarea
              ref={titleInputRef}
              className={styles.titleInput}
              value={editTitleValue}
              onChange={(e) => {
                setEditTitleValue(e.target.value)
                resizeTitleTextarea()
              }}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              onClick={(e) => e.stopPropagation()}
              rows={1}
            />
          ) : (
            <span className={styles.title} onClick={handleTitleClick}>{task.title}</span>
          )}
          <span
            className={`${styles.agentDot}${task.agentStatus === 'running' ? ` ${styles.agentRunning}` : ''}`}
            style={{ backgroundColor: AGENT_STATUS_COLORS[task.agentStatus] }}
            aria-label={`Agent: ${task.agentStatus}`}
          />
          {hasUnread && <span className={styles.notificationDot} aria-label="Has notifications" />}
        </div>

        {/* Image attachments */}
        {task.attachments && task.attachments.length > 0 && (
          <div className={styles.attachmentThumbs}>
            {task.attachments.slice(0, 4).map((absPath, i) => (
              <img
                key={i}
                className={styles.attachmentThumb}
                src={`familiar-attachment://file${absPath}`}
                alt="attachment"
                draggable={false}
              />
            ))}
            {task.attachments.length > 4 && (
              <span className={styles.attachmentMore}>+{task.attachments.length - 4}</span>
            )}
          </div>
        )}

        {/* Pasted file indicators */}
        {task.pastedFiles && task.pastedFiles.length > 0 && (
          <div className={styles.pastedFileIndicators}>
            {task.pastedFiles.slice(0, 3).map((pf) => (
              <span key={pf.filename} className={styles.pastedFileChip} title={pf.label}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {pf.lineCount ? `${pf.lineCount}L` : pf.label.slice(0, 12)}
              </span>
            ))}
            {task.pastedFiles.length > 3 && (
              <span className={styles.pastedFileChip}>+{task.pastedFiles.length - 3}</span>
            )}
          </div>
        )}

        {/* Description preview — click opens task detail */}
        {documentContent !== null && documentContent.length > 0 && (
          <div className={styles.descriptionPreview}>
            {documentContent.split('\n').filter(Boolean).slice(0, 3).map((line, i) => (
              <div key={i} className={styles.descriptionLine}>{line}</div>
            ))}
          </div>
        )}

        {(dashboardSnippets.length > 0 || task.labels.length > 0) && (
          <div className={styles.footer}>
            {dashboardSnippets.slice(0, 4).map((snippet, i) => {
              const iconOnly = snippet.icon && snippet.showIconInDashboard
              const isCooling = !!snippetCooldowns[i]
              return (
                <button
                  key={i}
                  className={`${styles.snippetBtn} ${i === 0 && !isCooling ? styles.snippetBtnPrimary : ''} ${iconOnly && !isCooling ? styles.snippetBtnIcon : ''} ${isCooling ? styles.snippetBtnSent : ''}`}
                  onClick={(e) => handleSnippetClick(e, snippet, i)}
                  aria-label={isCooling ? 'Sent!' : `${snippet.title}: ${snippet.command}`}
                  disabled={isCooling}
                >
                  {isCooling ? (
                    <>
                      <LucideIconByName name="Check" size={12} />
                      Sent
                    </>
                  ) : (
                    <>
                      {snippet.icon && <LucideIconByName name={snippet.icon} size={12} />}
                      {!iconOnly && snippet.title}
                    </>
                  )}
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
            style={{ backgroundColor: AGENT_STATUS_COLORS[task.agentStatus] }}
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
