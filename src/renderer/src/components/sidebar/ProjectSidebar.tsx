import { useEffect, useState } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { ContextMenu } from '@renderer/components/common/ContextMenu'
import type { ContextMenuItem } from '@renderer/components/common/ContextMenu'
import styles from './ProjectSidebar.module.css'

// Generate a consistent color from project name
function getProjectColor(name: string): string {
  const colors = [
    '#5e6ad2', '#e89b3e', '#27ae60', '#e74c3c', '#9b59b6',
    '#3498db', '#1abc9c', '#f39c12', '#e67e22', '#2ecc71'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// Git branch icon (small)
function BranchIcon(): React.JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" opacity="0.6">
      <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
    </svg>
  )
}

export function ProjectSidebar(): React.JSX.Element | null {
  const openProjects = useWorkspaceStore((s) => s.openProjects)
  const activeProjectPath = useWorkspaceStore((s) => s.activeProjectPath)
  const sidebarExpanded = useWorkspaceStore((s) => s.sidebarExpanded)
  const sidebarVisible = useWorkspaceStore((s) => s.sidebarVisible)
  const switchProject = useWorkspaceStore((s) => s.switchProject)
  const addProject = useWorkspaceStore((s) => s.addProject)
  const removeProject = useWorkspaceStore((s) => s.removeProject)
  const toggleSidebar = useWorkspaceStore((s) => s.toggleSidebar)
  const loadWorktrees = useWorkspaceStore((s) => s.loadWorktrees)
  const createWorktree = useWorkspaceStore((s) => s.createWorktree)
  const removeWorktree = useWorkspaceStore((s) => s.removeWorktree)
  const loadProjectState = useTaskStore((s) => s.loadProjectState)
  const loadNotifications = useNotificationStore((s) => s.loadNotifications)
  const loadWorkspaceNotifications = useNotificationStore((s) => s.loadWorkspaceNotifications)
  const workspaceUnreadCountForProject = useNotificationStore((s) => s.workspaceUnreadCountForProject)
  const saveProjectTaskState = useUIStore((s) => s.saveProjectTaskState)
  const restoreProjectTaskState = useUIStore((s) => s.restoreProjectTaskState)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number }
    items: ContextMenuItem[]
  } | null>(null)

  // Load worktrees on mount and when projects change
  useEffect(() => {
    loadWorktrees()
  }, [activeProjectPath])

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (): void => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  if (!sidebarVisible) return null

  const handleSwitchProject = async (path: string): Promise<void> => {
    if (path === activeProjectPath) return
    if (activeProjectPath) {
      saveProjectTaskState(activeProjectPath)
    }
    await switchProject(path)
    await loadProjectState()
    await loadNotifications()
    await loadWorkspaceNotifications()
    restoreProjectTaskState(path)
  }

  const handleAddProject = async (): Promise<void> => {
    const path = await addProject()
    if (path) {
      await handleSwitchProject(path)
    }
  }

  const handleCreateWorktree = async (): Promise<void> => {
    try {
      const worktree = await createWorktree()
      await window.api.workspaceAddProject(worktree.path)
      const { loadOpenProjects } = useWorkspaceStore.getState()
      await loadOpenProjects()
      await handleSwitchProject(worktree.path)
    } catch (err) {
      console.error('Failed to create worktree:', err)
    }
  }

  const handleOpenWorktree = async (worktreePath: string): Promise<void> => {
    if (!openProjects.some((p) => p.path === worktreePath)) {
      await window.api.workspaceAddProject(worktreePath)
      const { loadOpenProjects } = useWorkspaceStore.getState()
      await loadOpenProjects()
    }
    await handleSwitchProject(worktreePath)
  }

  const handleRemoveWorktree = async (worktreePath: string): Promise<void> => {
    if (!confirm('Remove this worktree? This will delete the worktree directory and its branch.')) return
    try {
      await removeWorktree(worktreePath)
    } catch (err) {
      console.error('Failed to remove worktree:', err)
    }
  }

  const handleProjectContextMenu = (e: React.MouseEvent, projectPath: string): void => {
    e.preventDefault()
    e.stopPropagation()

    const items: ContextMenuItem[] = [
      {
        label: 'New Worktree',
        icon: <BranchIcon />,
        onClick: handleCreateWorktree
      },
      {
        label: 'Open in Finder',
        onClick: () => window.api.openPath(projectPath)
      }
    ]

    // Add remove option if not the only project
    if (openProjects.length > 1 && projectPath !== activeProjectPath) {
      items.push(
        { label: '', onClick: () => {}, divider: true },
        {
          label: 'Remove Project',
          danger: true,
          onClick: () => removeProject(projectPath)
        }
      )
    }

    setContextMenu({ position: { x: e.clientX, y: e.clientY }, items })
  }

  const handleWorktreeContextMenu = (e: React.MouseEvent, worktreePath: string): void => {
    e.preventDefault()
    e.stopPropagation()

    const items: ContextMenuItem[] = [
      {
        label: 'Open in Finder',
        onClick: () => window.api.openPath(worktreePath)
      },
      { label: '', onClick: () => {}, divider: true },
      {
        label: 'Remove Worktree',
        danger: true,
        onClick: () => handleRemoveWorktree(worktreePath)
      }
    ]

    setContextMenu({ position: { x: e.clientX, y: e.clientY }, items })
  }

  return (
    <div
      className={`${styles.sidebar} ${sidebarExpanded ? styles.sidebarExpanded : styles.sidebarCollapsed}`}
      data-testid="project-sidebar"
    >
      {/* Toggle button */}
      <button
        className={styles.toggleButton}
        onClick={toggleSidebar}
        title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        data-testid="sidebar-toggle"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {sidebarExpanded ? (
            <polyline points="9 3 5 7 9 11" />
          ) : (
            <polyline points="5 3 9 7 5 11" />
          )}
        </svg>
        {sidebarExpanded && <span className={styles.toggleLabel}>Collapse</span>}
      </button>

      {/* Project list */}
      <div className={styles.projectList}>
        {openProjects.map((project) => {
          const isActive = project.path === activeProjectPath
          const color = getProjectColor(project.name)
          const initial = project.name.charAt(0).toUpperCase()
          const unread = workspaceUnreadCountForProject(project.path)
          const worktrees = project.worktrees || []

          return (
            <div key={project.path}>
              {/* Main project item */}
              <div
                className={`${styles.projectItem} ${isActive ? styles.projectItemActive : ''}`}
                onClick={() => handleSwitchProject(project.path)}
                onContextMenu={(e) => handleProjectContextMenu(e, project.path)}
                title={project.path}
                data-testid={`project-item-${project.name}`}
              >
                <div className={styles.projectIconWrapper}>
                  <div
                    className={styles.projectIcon}
                    style={{ backgroundColor: color }}
                  >
                    {initial}
                  </div>
                  {!sidebarExpanded && unread > 0 && (
                    <span className={styles.iconBadge} data-testid={`badge-${project.name}`}>
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </div>
                {sidebarExpanded && (
                  <div className={styles.projectInfo}>
                    <span className={styles.projectName}>{project.name}</span>
                    {unread > 0 && (
                      <span className={styles.projectUnread}>{unread} unread</span>
                    )}
                  </div>
                )}
                {sidebarExpanded && !isActive && openProjects.length > 1 && (
                  <button
                    className={styles.removeButton}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeProject(project.path)
                    }}
                    title="Remove project"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <line x1="3" y1="3" x2="9" y2="9" />
                      <line x1="9" y1="3" x2="3" y2="9" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Worktrees under this project */}
              {worktrees.map((wt) => {
                const isWtActive = wt.path === activeProjectPath
                return (
                  <div
                    key={wt.path}
                    className={`${styles.worktreeItem} ${isWtActive ? styles.projectItemActive : ''}`}
                    onClick={() => handleOpenWorktree(wt.path)}
                    onContextMenu={(e) => handleWorktreeContextMenu(e, wt.path)}
                    title={`${wt.branch}\n${wt.path}`}
                    data-testid={`worktree-item-${wt.slug}`}
                  >
                    <div className={styles.worktreeIcon}>
                      <BranchIcon />
                    </div>
                    {sidebarExpanded && (
                      <div className={styles.projectInfo}>
                        <span className={styles.worktreeName}>{wt.slug}</span>
                      </div>
                    )}
                    {sidebarExpanded && (
                      <button
                        className={styles.removeButton}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveWorktree(wt.path)
                        }}
                        title="Remove worktree"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <line x1="3" y1="3" x2="9" y2="9" />
                          <line x1="9" y1="3" x2="3" y2="9" />
                        </svg>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Add project button */}
      <button
        className={styles.addButton}
        onClick={handleAddProject}
        title="Add project"
        data-testid="add-project-button"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="7" y1="3" x2="7" y2="11" />
          <line x1="3" y1="7" x2="11" y2="7" />
        </svg>
        {sidebarExpanded && <span>Add Project</span>}
      </button>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
