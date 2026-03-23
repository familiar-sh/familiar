import { useEffect, useState, useRef, useCallback } from 'react'
import { useWorkspaceStore } from '@renderer/stores/workspace-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useNotificationStore } from '@renderer/stores/notification-store'
import { ContextMenu } from '@renderer/components/common/ContextMenu'
import type { ContextMenuItem } from '@renderer/components/common/ContextMenu'
import type { WorktreeEnvVariable } from '@shared/types/settings'
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
  const renameWorktree = useWorkspaceStore((s) => s.renameWorktree)
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

  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState<{
    worktreePath: string
    currentSlug: string
  } | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // Remove worktree dialog state
  const [removeDialog, setRemoveDialog] = useState<{
    worktreePath: string
    slug: string
  } | null>(null)
  const [removeKeepTasks, setRemoveKeepTasks] = useState(true)
  const [isRemoving, setIsRemoving] = useState(false)
  // Track worktrees currently being deleted (for spinner display)
  const [deletingWorktrees, setDeletingWorktrees] = useState<Set<string>>(new Set())

  // Create worktree dialog state
  const [createDialog, setCreateDialog] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createEnvVars, setCreateEnvVars] = useState<WorktreeEnvVariable[]>([])
  const [hookPath, setHookPath] = useState<string | null>(null)
  const [hookExists, setHookExists] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const createInputRef = useRef<HTMLInputElement>(null)

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (): void => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [contextMenu])

  // Focus rename input when dialog opens
  useEffect(() => {
    if (renameDialog) {
      setTimeout(() => {
        renameInputRef.current?.focus()
        renameInputRef.current?.select()
      }, 0)
    }
  }, [renameDialog])

  // Focus create input when dialog opens + load settings
  useEffect(() => {
    if (createDialog) {
      setTimeout(() => {
        createInputRef.current?.focus()
      }, 0)
      // Load hook path and last-used env vars
      window.api.worktreeGetHookPath().then(setHookPath)
      window.api.worktreeHookExists().then(setHookExists)
      window.api.readSettings().then((s) => {
        if (s.worktreeEnvVariables && s.worktreeEnvVariables.length > 0) {
          setCreateEnvVars(s.worktreeEnvVariables)
        }
      })
    }
  }, [createDialog])

  const handleRenameConfirm = useCallback(async (): Promise<void> => {
    if (!renameDialog) return
    const trimmed = renameValue.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
    if (!trimmed || trimmed === renameDialog.currentSlug) {
      setRenameDialog(null)
      return
    }
    try {
      await renameWorktree(renameDialog.worktreePath, trimmed)
    } catch (err) {
      console.error('Failed to rename worktree:', err)
    }
    setRenameDialog(null)
  }, [renameDialog, renameValue, renameWorktree])

  const handleRenameCancel = useCallback((): void => {
    setRenameDialog(null)
  }, [])

  const handleRenameKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameConfirm()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      handleRenameCancel()
    }
  }, [handleRenameConfirm, handleRenameCancel])

  const handleOpenCreateDialog = useCallback((): void => {
    setCreateName('')
    setCreateEnvVars([])
    setCreateDialog(true)
  }, [])

  const handleCreateCancel = useCallback((): void => {
    setCreateDialog(false)
    setIsCreating(false)
  }, [])

  const handleCreateConfirm = useCallback(async (): Promise<void> => {
    const slug = createName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    setIsCreating(true)
    try {
      const worktree = await createWorktree(slug || undefined)
      await window.api.workspaceAddProject(worktree.path)
      const { loadOpenProjects } = useWorkspaceStore.getState()
      await loadOpenProjects()
      await loadWorktrees()

      // Save env vars to settings for next time
      const userEnvVars = createEnvVars.filter((v) => v.name.trim())
      if (userEnvVars.length > 0) {
        const settings = await window.api.readSettings()
        settings.worktreeEnvVariables = userEnvVars
        await window.api.writeSettings(settings)
      }

      // Run post-create hook
      const envRecord: Record<string, string> = {}
      for (const v of userEnvVars) {
        if (v.name.trim()) {
          envRecord[v.name.trim()] = v.value
        }
      }
      await window.api.worktreeRunPostCreateHook(worktree.path, envRecord)

      setCreateDialog(false)
      await handleSwitchProject(worktree.path)
    } catch (err) {
      console.error('Failed to create worktree:', err)
    } finally {
      setIsCreating(false)
    }
  }, [createName, createEnvVars, createWorktree, loadWorktrees])

  const handleCreateKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCreateConfirm()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCreateCancel()
    }
  }, [handleCreateConfirm, handleCreateCancel])

  const handleAddEnvVar = useCallback((): void => {
    setCreateEnvVars((prev) => [...prev, { name: '', value: '' }])
  }, [])

  const handleRemoveEnvVar = useCallback((index: number): void => {
    setCreateEnvVars((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleUpdateEnvVar = useCallback((index: number, field: 'name' | 'value', val: string): void => {
    setCreateEnvVars((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: field === 'name' ? val.toUpperCase().replace(/[^A-Z0-9_]/g, '_') : val } : v))
    )
  }, [])

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

  const handleCreateWorktree = (): void => {
    handleOpenCreateDialog()
  }

  const handleOpenWorktree = async (worktreePath: string): Promise<void> => {
    // Ensure worktree is registered as a project (for DataService/FileWatcher)
    const isOpen = openProjects.some((p) => p.path === worktreePath)
    if (!isOpen) {
      await window.api.workspaceAddProject(worktreePath)
      const { loadOpenProjects } = useWorkspaceStore.getState()
      await loadOpenProjects()
      // loadWorktrees will filter the worktree out of the main project list
      await loadWorktrees()
    }
    await handleSwitchProject(worktreePath)
  }

  const handleRemoveWorktree = (worktreePath: string, slug: string): void => {
    setRemoveKeepTasks(true)
    setRemoveDialog({ worktreePath, slug })
  }

  const handleRemoveWorktreeConfirm = async (): Promise<void> => {
    if (!removeDialog || isRemoving) return
    const { worktreePath, slug } = removeDialog
    const keepTasks = removeKeepTasks

    // Close dialog immediately so the UI doesn't hang
    setRemoveDialog(null)
    setDeletingWorktrees((prev) => new Set(prev).add(worktreePath))

    try {
      if (keepTasks) {
        const mainProject = openProjects.find(
          (p) => !p.isWorktree && p.worktrees?.some((w) => w.path === worktreePath)
        )
        if (mainProject) {
          await window.api.worktreeMigrateTasks(worktreePath, mainProject.path, slug)
        }
      }
      // Run pre-delete hook before removing (this can be slow)
      await window.api.worktreeRunPreDeleteHook(worktreePath, {})
      await removeWorktree(worktreePath)
      if (keepTasks) {
        await loadProjectState()
      }
    } catch (err) {
      console.error('Failed to remove worktree:', err)
    } finally {
      setDeletingWorktrees((prev) => {
        const next = new Set(prev)
        next.delete(worktreePath)
        return next
      })
    }
  }

  const handleAbortWorktreeDelete = async (worktreePath: string): Promise<void> => {
    await window.api.worktreeAbortPreDeleteHook(worktreePath)
    // The running promise will resolve/reject and clean up deletingWorktrees
  }

  const handleRemoveWorktreeCancel = (): void => {
    setRemoveDialog(null)
  }

  const handleOpenRenameDialog = (worktreePath: string, currentSlug: string): void => {
    setRenameValue(currentSlug)
    setRenameDialog({ worktreePath, currentSlug })
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

  const handleWorktreeContextMenu = (e: React.MouseEvent, worktreePath: string, slug: string): void => {
    e.preventDefault()
    e.stopPropagation()

    const items: ContextMenuItem[] = [
      {
        label: 'Rename Worktree',
        onClick: () => handleOpenRenameDialog(worktreePath, slug)
      },
      {
        label: 'Open in Finder',
        onClick: () => window.api.openPath(worktreePath)
      },
      { label: '', onClick: () => {}, divider: true },
      {
        label: 'Remove Worktree',
        danger: true,
        onClick: () => handleRemoveWorktree(worktreePath, slug)
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
        {openProjects.filter((p) => !p.isWorktree).map((project) => {
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
                    onContextMenu={(e) => handleWorktreeContextMenu(e, wt.path, wt.slug)}
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
                      deletingWorktrees.has(wt.path) ? (
                        <button
                          className={`${styles.removeButton} ${styles.deletingSpinner}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAbortWorktreeDelete(wt.path)
                          }}
                          title="Click to abort deletion"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={styles.spinnerSvg}>
                            <circle cx="6" cy="6" r="4.5" strokeDasharray="7 3" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          className={styles.removeButton}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveWorktree(wt.path, wt.slug)
                          }}
                          title="Remove worktree"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <line x1="3" y1="3" x2="9" y2="9" />
                            <line x1="9" y1="3" x2="3" y2="9" />
                          </svg>
                        </button>
                      )
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

      {/* Rename dialog */}
      {renameDialog && (
        <div style={dialogStyles.overlay} onClick={(e) => { if (e.target === e.currentTarget) handleRenameCancel() }}>
          <div style={dialogStyles.wrapper}>
            <div style={dialogStyles.header}>Rename Worktree</div>
            <div style={dialogStyles.body}>
              <label style={dialogStyles.label}>New name</label>
              <input
                ref={renameInputRef}
                style={dialogStyles.input}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={handleRenameKeyDown}
                placeholder="e.g. fuzzy-otter"
              />
            </div>
            <div style={dialogStyles.footer}>
              <button style={dialogStyles.cancelButton} onClick={handleRenameCancel}>
                Cancel
              </button>
              <button
                style={{
                  ...dialogStyles.confirmButton,
                  opacity: renameValue.trim() ? 1 : 0.5
                }}
                onClick={handleRenameConfirm}
                disabled={!renameValue.trim()}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove worktree dialog */}
      {removeDialog && (
        <div style={dialogStyles.overlay} onClick={(e) => { if (e.target === e.currentTarget) handleRemoveWorktreeCancel() }}>
          <div style={dialogStyles.wrapper}>
            <div style={dialogStyles.header}>Remove Worktree</div>
            <div style={dialogStyles.body}>
              <p style={removeDialogStyles.description}>
                This will delete the worktree directory and its branch for <strong>{removeDialog.slug}</strong>.
              </p>
              <label style={removeDialogStyles.toggleRow}>
                <div style={removeDialogStyles.toggleTrack} onClick={() => setRemoveKeepTasks(!removeKeepTasks)}>
                  <div style={{
                    ...removeDialogStyles.toggleThumb,
                    ...(removeKeepTasks ? removeDialogStyles.toggleThumbActive : {})
                  }} />
                </div>
                <div style={removeDialogStyles.toggleText}>
                  <span style={removeDialogStyles.toggleLabel}>Keep tasks</span>
                  <span style={removeDialogStyles.toggleHint}>
                    Move all tasks to the main project, label them with &quot;{removeDialog.slug}&quot;, and archive them.
                  </span>
                </div>
              </label>
            </div>
            <div style={dialogStyles.footer}>
              <button style={dialogStyles.cancelButton} onClick={handleRemoveWorktreeCancel}>
                Cancel
              </button>
              <button
                style={{
                  ...removeDialogStyles.deleteButton,
                  opacity: isRemoving ? 0.5 : 1
                }}
                onClick={handleRemoveWorktreeConfirm}
                disabled={isRemoving}
              >
                {isRemoving ? 'Removing...' : 'Remove Worktree'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create worktree dialog */}
      {createDialog && (
        <div style={dialogStyles.overlay} onClick={(e) => { if (e.target === e.currentTarget) handleCreateCancel() }}>
          <div style={{ ...dialogStyles.wrapper, maxWidth: 460 }}>
            <div style={dialogStyles.header}>New Worktree</div>
            <div style={dialogStyles.body}>
              <label style={dialogStyles.label}>Name</label>
              <input
                ref={createInputRef}
                style={dialogStyles.input}
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                placeholder="e.g. fuzzy-otter (leave empty for random)"
              />

              {/* Hook info */}
              <div style={createDialogStyles.hookInfo}>
                <div style={createDialogStyles.hookLabel}>
                  Post-create hook
                  <span style={{ ...createDialogStyles.hookStatus, color: hookExists ? 'var(--color-green)' : 'var(--text-tertiary)' }}>
                    {hookExists ? 'configured' : 'not found'}
                  </span>
                </div>
                <code style={createDialogStyles.hookPath}>{hookPath || '.familiar/hooks/after-worktree-create.sh'}</code>
                <div style={createDialogStyles.hookHint}>
                  {hookExists
                    ? 'This script will run in the new worktree directory after creation.'
                    : 'Create this script to run commands after worktree creation (e.g. install deps, setup .env).'}
                </div>
              </div>

              {/* Built-in env vars */}
              <div style={createDialogStyles.envSection}>
                <div style={{ ...dialogStyles.label, marginBottom: 8, marginTop: 16 }}>
                  Environment Variables
                  <span style={createDialogStyles.envHint}> — passed to worktree hooks</span>
                </div>

                {/* Built-in vars (non-removable) */}
                {[
                  ['MAIN_WORKTREE_DIR', 'main project path'],
                  ['MAIN_WORKTREE_BRANCH', 'main worktree branch'],
                  ['MAIN_WORKTREE_PROJECT', 'main project name'],
                  ['NEW_WORKTREE_DIR', 'new worktree path'],
                  ['NEW_WORKTREE_NAME', 'new worktree slug name'],
                  ['NEW_WORKTREE_BRANCH', 'new worktree git branch']
                ].map(([name, desc]) => (
                  <div key={name} style={createDialogStyles.envRow}>
                    <input style={{ ...createDialogStyles.envName, opacity: 0.6 }} value={name} disabled />
                    <input style={{ ...createDialogStyles.envValue, opacity: 0.6 }} value={`(auto: ${desc})`} disabled />
                    <div style={createDialogStyles.envRemoveSpacer} />
                  </div>
                ))}

                {/* User-defined env vars */}
                {createEnvVars.map((v, i) => (
                  <div key={i} style={createDialogStyles.envRow}>
                    <input
                      style={createDialogStyles.envName}
                      value={v.name}
                      onChange={(e) => handleUpdateEnvVar(i, 'name', e.target.value)}
                      placeholder="VAR_NAME"
                    />
                    <input
                      style={createDialogStyles.envValue}
                      value={v.value}
                      onChange={(e) => handleUpdateEnvVar(i, 'value', e.target.value)}
                      placeholder="value"
                    />
                    <button
                      style={createDialogStyles.envRemoveButton}
                      onClick={() => handleRemoveEnvVar(i)}
                      title="Remove variable"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <line x1="3" y1="3" x2="9" y2="9" />
                        <line x1="9" y1="3" x2="3" y2="9" />
                      </svg>
                    </button>
                  </div>
                ))}

                <button style={createDialogStyles.addVarButton} onClick={handleAddEnvVar}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="6" y1="2" x2="6" y2="10" />
                    <line x1="2" y1="6" x2="10" y2="6" />
                  </svg>
                  Add Variable
                </button>
              </div>
            </div>
            <div style={dialogStyles.footer}>
              <button style={dialogStyles.cancelButton} onClick={handleCreateCancel}>
                Cancel
              </button>
              <button
                style={{
                  ...dialogStyles.confirmButton,
                  opacity: isCreating ? 0.5 : 1
                }}
                onClick={handleCreateConfirm}
                disabled={isCreating}
              >
                {isCreating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const dialogStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '20vh',
    zIndex: 600,
    animation: 'cmdkFadeIn 120ms ease'
  },
  wrapper: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 8,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden'
  },
  header: {
    padding: '12px 18px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  body: {
    padding: '16px 18px'
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 14,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    outline: 'none',
    boxSizing: 'border-box' as const
  },
  footer: {
    padding: '12px 18px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8
  },
  cancelButton: {
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 6,
    cursor: 'pointer'
  },
  confirmButton: {
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#fff',
    backgroundColor: 'var(--accent)',
    border: '1px solid var(--accent)',
    borderRadius: 6,
    cursor: 'pointer'
  }
}

const createDialogStyles: Record<string, React.CSSProperties> = {
  hookInfo: {
    marginTop: 16,
    padding: '10px 12px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 6
  },
  hookLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  hookStatus: {
    fontSize: 11,
    fontWeight: 400
  },
  hookPath: {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-tertiary)',
    marginTop: 4,
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
    wordBreak: 'break-all' as const
  },
  hookHint: {
    fontSize: 11,
    color: 'var(--text-tertiary)',
    marginTop: 4,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  envSection: {
    marginTop: 0
  },
  envHint: {
    fontWeight: 400,
    color: 'var(--text-tertiary)',
    fontSize: 11
  },
  envRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 6,
    alignItems: 'center'
  },
  envName: {
    width: '40%',
    padding: '6px 8px',
    fontSize: 12,
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    outline: 'none',
    boxSizing: 'border-box' as const
  },
  envValue: {
    flex: 1,
    padding: '6px 8px',
    fontSize: 12,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    outline: 'none',
    boxSizing: 'border-box' as const
  },
  envRemoveButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    padding: 0,
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    borderRadius: 4,
    flexShrink: 0
  },
  envRemoveSpacer: {
    width: 24,
    height: 24,
    flexShrink: 0
  },
  addVarButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: 'var(--text-tertiary)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: 4,
    marginTop: 2
  }
}

const removeDialogStyles: Record<string, React.CSSProperties> = {
  description: {
    margin: '0 0 16px 0',
    fontSize: 13,
    lineHeight: '1.5',
    color: 'var(--text-secondary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    cursor: 'pointer',
    padding: '10px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-primary)'
  },
  toggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'var(--border)',
    position: 'relative' as const,
    flexShrink: 0,
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    marginTop: 1
  },
  toggleThumb: {
    position: 'absolute' as const,
    top: 2,
    left: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'var(--text-tertiary)',
    transition: 'transform 150ms ease, background-color 150ms ease'
  },
  toggleThumbActive: {
    transform: 'translateX(16px)',
    backgroundColor: 'var(--accent)'
  },
  toggleText: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    flex: 1
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  toggleHint: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    lineHeight: '1.4',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  deleteButton: {
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#fff',
    backgroundColor: '#ef4444',
    border: '1px solid #ef4444',
    borderRadius: 6,
    cursor: 'pointer'
  }
}
