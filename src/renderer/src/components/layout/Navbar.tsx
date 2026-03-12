import { useState, useEffect, useRef } from 'react'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { formatRelativeTime } from '@renderer/lib/format-time'
import { APP_NAME } from '@shared/constants'
import { AgentSwapWidget } from './AgentSwapWidget'
import styles from './Navbar.module.css'

export function Navbar(): React.JSX.Element {
  const projectState = useTaskStore((s) => s.projectState)
  const [folderName, setFolderName] = useState<string | null>(null)
  const [projectRoot, setProjectRoot] = useState<string | null>(null)

  // Fetch the actual project root folder name
  useEffect(() => {
    if (!projectState) return
    window.api.getProjectRoot().then((root: string) => {
      const name = root.split('/').pop() || root
      setFolderName(name)
      setProjectRoot(root)
    })
  }, [projectState])

  const projectName = folderName ?? projectState?.projectName ?? APP_NAME
  const taskDetailOpen = useUIStore((s) => s.taskDetailOpen)
  const closeTaskDetail = useUIStore((s) => s.closeTaskDetail)
  const openTaskDetail = useUIStore((s) => s.openTaskDetail)

  const notifications = useNotificationStore((s) => s.notifications)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const clearAll = useNotificationStore((s) => s.clearAll)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return
    const handleClick = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showDropdown])

  const count = unreadCount()

  const handleNotificationClick = (notification: (typeof notifications)[0]): void => {
    if (!notification.read) {
      markRead(notification.id)
    }
    if (notification.taskId) {
      openTaskDetail(notification.taskId)
      setShowDropdown(false)
    }
  }

  return (
    <nav className={styles.navbar}>
      <span className={styles.projectName}>{projectName}</span>

      <div className={styles.navGroup}>
        {/* Dashboard / home button */}
        <button
          className={`${styles.navButton} ${!taskDetailOpen ? styles.navButtonActive : ''}`}
          onClick={() => {
            if (taskDetailOpen) closeTaskDetail()
          }}
          title="Dashboard"
        >
          {/* Grid/board icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

        {/* Open project folder in Finder */}
        <button
          className={styles.navButton}
          onClick={() => {
            if (projectRoot) window.api.openPath(projectRoot)
          }}
          title="Open in Finder"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 3.5C2 2.67 2.67 2 3.5 2H6l1.5 1.5H12.5C13.33 3.5 14 4.17 14 5v7.5c0 .83-.67 1.5-1.5 1.5h-9C2.67 14 2 13.33 2 12.5v-9z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className={styles.navGroupRight}>
        {/* Agent quick-swap dots */}
        <AgentSwapWidget />

        {/* Notification bell */}
        <div className={styles.dropdownAnchor} ref={dropdownRef}>
          <button
            className={`${styles.navButton} ${showDropdown ? styles.navButtonActive : ''}`}
            onClick={() => setShowDropdown(!showDropdown)}
            title="Notifications"
          >
            {/* Bell icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 1.5C5.5 1.5 3.5 3.5 3.5 6v2.5L2 10.5v1h12v-1l-1.5-2V6c0-2.5-2-4.5-4.5-4.5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M6 12.5c0 1.1.9 2 2 2s2-.9 2-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            {count > 0 && (
              <span className={styles.badge}>{count > 99 ? '99+' : count}</span>
            )}
          </button>

          {showDropdown && (
            <div className={styles.notificationDropdown}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownTitle}>Notifications</span>
                <div className={styles.dropdownActions}>
                  {count > 0 && (
                    <button
                      className={styles.dropdownActionButton}
                      onClick={() => markAllRead()}
                    >
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      className={styles.dropdownActionButton}
                      onClick={() => {
                        clearAll()
                        setShowDropdown(false)
                      }}
                    >
                      Clear all
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.notificationList}>
                {notifications.length === 0 ? (
                  <div className={styles.emptyNotifications}>No notifications</div>
                ) : (
                  [...notifications]
                    .reverse()
                    .map((n) => (
                      <div
                        key={n.id}
                        className={`${styles.notificationItem} ${!n.read ? styles.notificationUnread : ''}`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <span className={styles.notificationTitle}>{n.title}</span>
                        {n.body && (
                          <span className={styles.notificationBody}>{n.body}</span>
                        )}
                        <span className={styles.notificationTime}>
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
