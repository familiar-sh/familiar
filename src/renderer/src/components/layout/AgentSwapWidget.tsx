import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTaskStore } from '@renderer/stores/task-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { formatRelativeTime } from '@renderer/lib/format-time'
import type { Task, ActivityEntry, AppNotification } from '@shared/types'
import styles from './AgentSwapWidget.module.css'

interface PreviewState {
  type: 'agent' | 'notification'
  id: string // taskId or notificationId
}

export function AgentSwapWidget(): React.JSX.Element | null {
  const projectState = useTaskStore((s) => s.projectState)
  const notifications = useNotificationStore((s) => s.notifications)
  const openTaskDetail = useUIStore((s) => s.openTaskDetail)
  const markRead = useNotificationStore((s) => s.markRead)

  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [lastActivity, setLastActivity] = useState<string | null>(null)
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get active agents (running or error status only — hide idle/done)
  const activeAgents = useMemo(() => {
    if (!projectState) return []
    return projectState.tasks
      .filter(
        (t: Task) =>
          t.status !== 'archived' &&
          (t.agentStatus === 'running' || t.agentStatus === 'error')
      )
      .sort((a: Task, b: Task) => {
        // Running first, then error
        if (a.agentStatus === 'running' && b.agentStatus !== 'running') return -1
        if (b.agentStatus === 'running' && a.agentStatus !== 'running') return 1
        return a.updatedAt < b.updatedAt ? 1 : -1
      })
  }, [projectState])

  // Get unread notifications (grouped by task — one dot per task, plus non-task notifications)
  const unreadNotifications = useMemo(() => {
    const unread = notifications.filter((n) => !n.read)
    // Deduplicate by taskId — show latest per task
    const byTask = new Map<string, AppNotification>()
    const noTask: AppNotification[] = []
    for (const n of unread) {
      if (n.taskId) {
        const existing = byTask.get(n.taskId)
        if (!existing || n.createdAt > existing.createdAt) {
          byTask.set(n.taskId, n)
        }
      } else {
        noTask.push(n)
      }
    }
    return [...byTask.values(), ...noTask]
  }, [notifications])

  // Nothing to show — hide widget entirely
  if (activeAgents.length === 0 && unreadNotifications.length === 0) {
    return null
  }

  // Load last activity for agent preview
  const loadLastActivity = useCallback(async (taskId: string) => {
    try {
      const entries: ActivityEntry[] = await window.api.readTaskActivity(taskId)
      if (entries.length > 0) {
        const last = entries[entries.length - 1]
        setLastActivity(last.message)
      } else {
        setLastActivity(null)
      }
    } catch {
      setLastActivity(null)
    }
  }, [])

  const handleDotEnter = useCallback(
    (type: 'agent' | 'notification', id: string) => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
      previewTimeoutRef.current = setTimeout(() => {
        setPreview({ type, id })
        if (type === 'agent') {
          loadLastActivity(id)
        }
      }, 200)
    },
    [loadLastActivity]
  )

  const handleDotLeave = useCallback(() => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(() => {
      setPreview(null)
      setLastActivity(null)
    }, 150)
  }, [])

  const handlePreviewEnter = useCallback(() => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
  }, [])

  const handlePreviewLeave = useCallback(() => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(() => {
      setPreview(null)
      setLastActivity(null)
    }, 150)
  }, [])

  // Close preview on outside click
  useEffect(() => {
    if (!preview) return
    const handleClick = (e: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPreview(null)
        setLastActivity(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [preview])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    }
  }, [])

  const handleAgentClick = (taskId: string): void => {
    openTaskDetail(taskId)
    setPreview(null)
  }

  const handleNotificationClick = (notification: AppNotification): void => {
    if (!notification.read) markRead(notification.id)
    if (notification.taskId) {
      openTaskDetail(notification.taskId)
    }
    setPreview(null)
  }

  // Find the previewed task/notification
  const previewedTask =
    preview?.type === 'agent'
      ? activeAgents.find((t) => t.id === preview.id)
      : null
  const previewedNotification =
    preview?.type === 'notification'
      ? unreadNotifications.find((n) => n.id === preview.id)
      : null

  const hasAgents = activeAgents.length > 0
  const hasNotifications = unreadNotifications.length > 0

  return (
    <div className={styles.container} ref={containerRef}>
      {/* Agent dots */}
      {activeAgents.map((task) => (
        <div key={task.id} className={styles.previewAnchor}>
          <div
            className={`${styles.dot} ${task.agentStatus === 'running' ? styles.dotRunning : styles.dotError}`}
            onClick={() => handleAgentClick(task.id)}
            onMouseEnter={() => handleDotEnter('agent', task.id)}
            onMouseLeave={handleDotLeave}
            title={task.title}
          />
          {preview?.type === 'agent' && preview.id === task.id && previewedTask && (
            <div
              className={styles.preview}
              onMouseEnter={handlePreviewEnter}
              onMouseLeave={handlePreviewLeave}
            >
              <span className={styles.previewTitle}>{previewedTask.title}</span>
              <div className={styles.previewMeta}>
                <span
                  className={styles.previewStatusDot}
                  style={{
                    backgroundColor:
                      previewedTask.agentStatus === 'running' ? '#5e6ad2' : '#e74c3c'
                  }}
                />
                <span className={styles.previewLabel}>
                  {previewedTask.agentStatus === 'running' ? 'Running' : 'Error'}
                </span>
                <span>·</span>
                <span>{formatRelativeTime(previewedTask.updatedAt)}</span>
              </div>
              {lastActivity && (
                <span className={styles.previewActivity}>{lastActivity}</span>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Separator between agent dots and notification dots */}
      {hasAgents && hasNotifications && <div className={styles.separator} />}

      {/* Notification dots */}
      {unreadNotifications.map((notification) => (
        <div key={notification.id} className={styles.previewAnchor}>
          <div
            className={`${styles.dot} ${styles.dotNotification}`}
            onClick={() => handleNotificationClick(notification)}
            onMouseEnter={() => handleDotEnter('notification', notification.id)}
            onMouseLeave={handleDotLeave}
            title={notification.title}
          />
          {preview?.type === 'notification' &&
            preview.id === notification.id &&
            previewedNotification && (
              <div
                className={styles.preview}
                onMouseEnter={handlePreviewEnter}
                onMouseLeave={handlePreviewLeave}
              >
                <span className={styles.previewNotifTitle}>
                  {previewedNotification.title}
                </span>
                {previewedNotification.body && (
                  <span className={styles.previewNotifBody}>
                    {previewedNotification.body}
                  </span>
                )}
                <span className={styles.previewActivity}>
                  {formatRelativeTime(previewedNotification.createdAt)}
                </span>
              </div>
            )}
        </div>
      ))}
    </div>
  )
}
