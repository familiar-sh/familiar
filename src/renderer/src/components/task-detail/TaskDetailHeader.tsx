import { useState, useCallback, useRef, useEffect } from 'react'
import type { Task, TaskStatus, Priority, AgentStatus } from '@shared/types'
import { DEFAULT_LABEL_COLOR } from '@shared/constants'
import { formatRelativeTime } from '@renderer/lib/format-time'
import { Tooltip } from '@renderer/components/common'
import { useProjectLabels } from '@renderer/hooks/useProjectLabels'
import { useUIStore } from '@renderer/stores/ui-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { StatusSelect } from './StatusSelect'
import { AgentStatusSelect } from './AgentStatusSelect'
import { PrioritySelect } from './PrioritySelect'
import { LabelSelect } from './LabelSelect'
import styles from './TaskDetailHeader.module.css'

function TaskIdBadge({ id }: { id: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(id)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }, [id])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <Tooltip placement="bottom" content={copied ? 'Copied!' : 'Copy task ID'}>
      <button className={styles.taskIdBadge} onClick={handleCopy}>
        <span className={styles.taskIdText}>{id}</span>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          {copied ? (
            <path
              d="M3.5 8.5L6.5 11.5L12.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <>
              <rect
                x="5.5"
                y="5.5"
                width="8"
                height="8"
                rx="1.5"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="M10.5 5.5V3.5C10.5 2.67 9.83 2 9 2H3.5C2.67 2 2 2.67 2 3.5V9C2 9.83 2.67 10.5 3.5 10.5H5.5"
                stroke="currentColor"
                strokeWidth="1.3"
              />
            </>
          )}
        </svg>
      </button>
    </Tooltip>
  )
}

function CopyDocumentButton({ taskId }: { taskId: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleCopy = useCallback(async () => {
    try {
      const content = await window.api.readTaskDocument(taskId)
      await navigator.clipboard?.writeText(content || '')
      setCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.warn('Failed to copy document:', err)
    }
  }, [taskId])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <Tooltip placement="bottom" content={copied ? 'Copied!' : 'Copy document as markdown'}>
      <button className={styles.closeButton} onClick={handleCopy}>
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M3.5 8.5L6.5 11.5L12.5 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect
              x="5.5"
              y="5.5"
              width="8"
              height="8"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M10.5 5.5V3.5C10.5 2.67 9.83 2 9 2H3.5C2.67 2 2 2.67 2 3.5V9C2 9.83 2.67 10.5 3.5 10.5H5.5"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M8 8.5V12"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M8 8.5L10 10.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <path
              d="M8 8.5L6 10.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </Tooltip>
  )
}

interface TaskDetailHeaderProps {
  task: Task
  onUpdate: (updates: Partial<Task>) => void
  onClose: () => void
}

export function TaskDetailHeader({ task, onUpdate, onClose }: TaskDetailHeaderProps): React.JSX.Element {
  const [_editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(task.title)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const openCreateTaskModalForFork = useUIStore((s) => s.openCreateTaskModalForFork)
  const markUnread = useNotificationStore((s) => s.markUnread)

  const handleMarkUnread = useCallback(() => {
    markUnread(task.id, task.title)
    onClose()
  }, [task.id, task.title, markUnread, onClose])

  const projectLabels = useProjectLabels()

  const resizeTitleTextarea = useCallback(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [])

  // Sync local title state when task.title changes externally (e.g. file watcher)
  useEffect(() => {
    if (!_editingTitle) {
      setTitleValue(task.title)
    }
  }, [task.title, _editingTitle])

  useEffect(() => {
    resizeTitleTextarea()
  }, [titleValue, resizeTitleTextarea])

  const handleTitleSubmit = useCallback(() => {
    const trimmed = titleValue.trim()
    if (trimmed && trimmed !== task.title) {
      onUpdate({ title: trimmed })
    } else {
      setTitleValue(task.title)
    }
    setEditingTitle(false)
  }, [titleValue, task.title, onUpdate])

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleTitleSubmit()
        // Move focus to the editor/notes
        window.dispatchEvent(new CustomEvent('task-detail-focus', { detail: 'editor' }))
      } else if (e.key === 'Escape') {
        setTitleValue(task.title)
        setEditingTitle(false)
        titleRef.current?.blur()
      }
    },
    [handleTitleSubmit, task.title]
  )

  // Listen for focus requests from keyboard navigation (Cmd+Enter dispatches event directly)
  useEffect(() => {
    const handleFocusRequest = (e: Event): void => {
      const target = (e as CustomEvent).detail
      if (target === 'title') {
        titleRef.current?.focus()
        titleRef.current?.select()
      }
    }
    window.addEventListener('task-detail-focus', handleFocusRequest)
    return () => window.removeEventListener('task-detail-focus', handleFocusRequest)
  }, [])

  // Consume pendingDetailFocus for title focus (e.g. Space key from board)
  const activeTaskId = useUIStore((s) => s.activeTaskId)
  const pendingDetailFocus = useUIStore((s) => s.pendingDetailFocus)
  const clearPendingDetailFocus = useUIStore((s) => s.clearPendingDetailFocus)

  useEffect(() => {
    if (pendingDetailFocus === 'title' && activeTaskId === task.id) {
      // Use rAF + setTimeout to ensure the overlay is visible and focusable
      let cancelled = false
      requestAnimationFrame(() => {
        if (cancelled) return
        setTimeout(() => {
          if (cancelled) return
          titleRef.current?.focus()
          titleRef.current?.select()
          clearPendingDetailFocus()
        }, 30)
      })
      return () => { cancelled = true }
    }
  }, [pendingDetailFocus, activeTaskId, task.id, clearPendingDetailFocus])

  const handleStatusChange = useCallback(
    (status: TaskStatus) => {
      onUpdate({ status })
    },
    [onUpdate]
  )

  const handleAgentStatusChange = useCallback(
    (agentStatus: AgentStatus) => {
      onUpdate({ agentStatus })
    },
    [onUpdate]
  )

  const handlePriorityChange = useCallback(
    (priority: Priority) => {
      onUpdate({ priority })
    },
    [onUpdate]
  )

  const handleToggleLabel = useCallback(
    (label: string) => {
      if (task.labels.includes(label)) {
        onUpdate({ labels: task.labels.filter((l) => l !== label) })
      } else {
        onUpdate({ labels: [...task.labels, label] })
      }
    },
    [onUpdate, task.labels]
  )

  const getLabelColor = useCallback(
    (name: string): string => {
      const config = projectLabels.find((l) => l.name === name)
      return config?.color ?? DEFAULT_LABEL_COLOR
    },
    [projectLabels]
  )

  return (
    <div className={styles.header}>
      <div className={styles.topBar}>
        <div className={styles.timestamps}>
          <span>Created {formatRelativeTime(task.createdAt)}</span>
          <span>Updated {formatRelativeTime(task.updatedAt)}</span>
        </div>
        <div className={styles.topBarActions}>
          <TaskIdBadge id={task.id} />
          <CopyDocumentButton taskId={task.id} />
          <Tooltip placement="bottom" content="Fork this task session">
            <button
              className={styles.closeButton}
              onClick={() => openCreateTaskModalForFork(task.id)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="18" r="3" />
                <circle cx="6" cy="6" r="3" />
                <circle cx="18" cy="6" r="3" />
                <path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9" />
                <path d="M12 12v3" />
              </svg>
            </button>
          </Tooltip>
          <Tooltip placement="bottom" content="Open task folder in Finder">
            <button
              className={styles.closeButton}
              onClick={() => {
                window.api
                  .getProjectRoot()
                  .then((root) =>
                    window.api.openPath(`${root}/.familiar/tasks/${task.id}`)
                  )
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 3.5C2 2.67 2.67 2 3.5 2H6l1.5 1.5H12.5C13.33 3.5 14 4.17 14 5v7.5c0 .83-.67 1.5-1.5 1.5h-9C2.67 14 2 13.33 2 12.5v-9z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </Tooltip>
          <Tooltip placement="bottom" content="Mark as unread and close">
            <button className={styles.closeButton} onClick={handleMarkUnread}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="6" r="3" fill="currentColor" />
                <path d="M22 8.608v8.142a2.25 2.25 0 0 1-2.25 2.25H4.25A2.25 2.25 0 0 1 2 16.75V7.25A2.25 2.25 0 0 1 4.25 5h9.5" />
                <polyline points="22 7.25 12 13 2 7.25" />
              </svg>
            </button>
          </Tooltip>
          <Tooltip placement="bottom" content="Back to dashboard (Esc)">
            <button className={styles.closeButton} onClick={onClose}>
              &#x2715;
            </button>
          </Tooltip>
        </div>
      </div>

      <div className={styles.titleRow}>
        <textarea
          ref={titleRef}
          className={styles.titleInput}
          value={titleValue}
          onChange={(e) => setTitleValue(e.target.value)}
          onFocus={() => setEditingTitle(true)}
          onBlur={handleTitleSubmit}
          onKeyDown={handleTitleKeyDown}
          spellCheck={false}
          rows={1}
        />
      </div>

      <div className={styles.metaRow}>
        <div className={styles.metaGroup}>
          <span className={styles.metaLabel}>Status</span>
          <StatusSelect value={task.status} onChange={handleStatusChange} />
        </div>

        <div className={styles.separator} />

        <div className={styles.metaGroup}>
          <span className={styles.metaLabel}>Agent</span>
          <AgentStatusSelect value={task.agentStatus} onChange={handleAgentStatusChange} />
        </div>

        <div className={styles.separator} />

        <div className={styles.metaBlockGroup}>
          <div className={styles.metaGroup}>
            <span className={styles.metaLabel}>Priority</span>
            <PrioritySelect value={task.priority} onChange={handlePriorityChange} />
          </div>

          <div className={styles.separator} />

          <div className={styles.metaGroup}>
            <span className={styles.metaLabel}>Labels</span>
            <div className={styles.labelsSection}>
              {task.labels.map((label) => (
                <span
                  key={label}
                  className={styles.label}
                  style={{
                    backgroundColor: `${getLabelColor(label)}20`,
                    borderColor: `${getLabelColor(label)}40`,
                    color: getLabelColor(label)
                  }}
                >
                  {label}
                  <button
                    className={styles.labelRemove}
                    onClick={() => handleToggleLabel(label)}
                    style={{ color: getLabelColor(label) }}
                  >
                    &#x2715;
                  </button>
                </span>
              ))}
              <LabelSelect taskLabels={task.labels} onToggle={handleToggleLabel} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
