import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { formatRelativeTime } from '@renderer/lib/format-time'
import { APP_NAME } from '@shared/constants'
import { AgentSwapWidget } from './AgentSwapWidget'
import styles from './Navbar.module.css'

export function Navbar(): React.JSX.Element {
  const projectState = useTaskStore((s) => s.projectState)
  const activeProjectPath = useWorkspaceStore((s) => s.activeProjectPath)
  const [folderName, setFolderName] = useState<string | null>(null)
  const [projectRoot, setProjectRoot] = useState<string | null>(null)

  // Derive project name from workspace store's activeProjectPath
  const workspaceProjectName = activeProjectPath
    ? activeProjectPath.split('/').pop() || activeProjectPath
    : null

  // Fall back to fetching project root when no activeProjectPath
  useEffect(() => {
    if (activeProjectPath) {
      // Use activeProjectPath directly — no need to fetch
      setProjectRoot(activeProjectPath)
      return
    }
    if (!projectState) return
    window.api.getProjectRoot().then((root: string) => {
      const name = root.split('/').pop() || root
      setFolderName(name)
      setProjectRoot(root)
    })
  }, [projectState, activeProjectPath])

  const sidebarVisible = useWorkspaceStore((s) => s.sidebarVisible)
  const toggleSidebarVisible = useWorkspaceStore((s) => s.toggleSidebarVisible)

  const projectName = workspaceProjectName ?? folderName ?? projectState?.projectName ?? APP_NAME
  const taskDetailOpen = useUIStore((s) => s.taskDetailOpen)
  const closeTaskDetail = useUIStore((s) => s.closeTaskDetail)
  const openTaskDetail = useUIStore((s) => s.openTaskDetail)
  const settingsOpen = useUIStore((s) => s.settingsOpen)
  const openSettings = useUIStore((s) => s.openSettings)
  const closeSettings = useUIStore((s) => s.closeSettings)
  const openShortcutsModal = useUIStore((s) => s.openShortcutsModal)
  const themeMode = useUIStore((s) => s.themeMode)
  const cycleThemeMode = useUIStore((s) => s.cycleThemeMode)

  const notifications = useNotificationStore((s) => s.workspaceNotifications.length > 0 ? s.workspaceNotifications : s.notifications)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const clearAll = useNotificationStore((s) => s.clearAll)
  const workspaceUnreadCount = useNotificationStore((s) => s.workspaceUnreadCount)
  const unreadCount = useNotificationStore((s) => s.unreadCount)

  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const bellBtnRef = useRef<HTMLButtonElement>(null)

  const [showHelpMenu, setShowHelpMenu] = useState(false)
  const helpMenuRef = useRef<HTMLDivElement>(null)
  const helpBtnRef = useRef<HTMLButtonElement>(null)

  // Position state for portal-rendered dropdowns
  const [helpPos, setHelpPos] = useState({ top: 0, right: 0 })
  const [notifPos, setNotifPos] = useState({ top: 0, right: 0 })

  // Update help dropdown position when it opens
  useEffect(() => {
    if (showHelpMenu && helpBtnRef.current) {
      const rect = helpBtnRef.current.getBoundingClientRect()
      setHelpPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
      })
    }
  }, [showHelpMenu])

  // Update notification dropdown position when it opens
  useEffect(() => {
    if (showDropdown && bellBtnRef.current) {
      const rect = bellBtnRef.current.getBoundingClientRect()
      setNotifPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right
      })
    }
  }, [showDropdown])

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return
    const handleClick = (e: MouseEvent): void => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        bellBtnRef.current && !bellBtnRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showDropdown])

  // Close help menu on click outside
  useEffect(() => {
    if (!showHelpMenu) return
    const handleClick = (e: MouseEvent): void => {
      if (
        helpMenuRef.current && !helpMenuRef.current.contains(e.target as Node) &&
        helpBtnRef.current && !helpBtnRef.current.contains(e.target as Node)
      ) {
        setShowHelpMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showHelpMenu])

  const wsCount = workspaceUnreadCount()
  const count = wsCount > 0 ? wsCount : unreadCount()

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

        {/* Toggle project sidebar */}
        <button
          className={`${styles.navButton} ${sidebarVisible ? styles.navButtonActive : ''}`}
          onClick={toggleSidebarVisible}
          title="Projects (⌘B)"
          data-testid="sidebar-toggle-nav"
        >
          {/* Sidebar/panel-left icon */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            <line x1="5.5" y1="2" x2="5.5" y2="14" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>

      </div>

      <div className={styles.navGroupRight}>
        {/* Keyboard shortcuts cheatsheet */}
        <button
          className={styles.navButton}
          onClick={openShortcutsModal}
          title="Keyboard shortcuts (?)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
          </svg>
        </button>

        {/* Theme toggle */}
        <button
          className={styles.navButton}
          onClick={cycleThemeMode}
          title={`Theme: ${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}`}
        >
          {themeMode === 'system' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          ) : themeMode === 'light' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Settings gear */}
        <button
          className={`${styles.navButton} ${settingsOpen ? styles.navButtonActive : ''}`}
          onClick={settingsOpen ? closeSettings : openSettings}
          title="Settings (⌘,)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        {/* Help / agent setup prompts */}
        <button
          ref={helpBtnRef}
          className={`${styles.navButton} ${showHelpMenu ? styles.navButtonActive : ''}`}
          onClick={() => setShowHelpMenu(!showHelpMenu)}
          title="Agent setup prompts"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>

        {showHelpMenu && createPortal(
          <div
            ref={helpMenuRef}
            className={styles.helpDropdownPortal}
            style={{ top: helpPos.top, right: helpPos.right }}
          >
            <button
              className={styles.helpDropdownItem}
              onClick={() => {
                useUIStore.getState().openOnboarding(true)
                setShowHelpMenu(false)
              }}
            >
              <span className={styles.helpDropdownIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                  <path d="M9 18h6" />
                  <path d="M10 22h4" />
                </svg>
              </span>
              <span className={styles.helpDropdownText}>
                <span className={styles.helpDropdownTitle}>Run Onboarding</span>
                <span className={styles.helpDropdownDesc}>Re-run setup wizard</span>
              </span>
            </button>
            <div className={styles.helpDropdownDivider} />
            <button
              className={styles.helpDropdownItem}
              onClick={() => {
                useUIStore.getState().openAboutDialog()
                setShowHelpMenu(false)
              }}
              data-testid="help-about-button"
            >
              <span className={styles.helpDropdownIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
              <span className={styles.helpDropdownText}>
                <span className={styles.helpDropdownTitle}>About Familiar</span>
                <span className={styles.helpDropdownDesc}>Version and info</span>
              </span>
            </button>
          </div>,
          document.body
        )}

        {/* Agent quick-swap dots */}
        <AgentSwapWidget />

        {/* Notification bell */}
        <button
          ref={bellBtnRef}
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

        {showDropdown && createPortal(
          <div
            ref={dropdownRef}
            className={styles.notificationDropdownPortal}
            style={{ top: notifPos.top, right: notifPos.right }}
          >
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
          </div>,
          document.body
        )}
      </div>
    </nav>
  )
}
