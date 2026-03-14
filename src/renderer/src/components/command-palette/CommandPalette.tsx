import { useCallback, useState, useEffect } from 'react'
import { Command } from 'cmdk'
import { useUIStore } from '../../stores/ui-store'
import { useTaskStore } from '../../stores/task-store'
import type { TaskStatus, ProjectSettings } from '@shared/types'

const COLUMN_LABELS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'Todo' },
  { status: 'in-progress', label: 'In Progress' },
  { status: 'in-review', label: 'In Review' },
  { status: 'done', label: 'Done' },
  { status: 'archived', label: 'Archive' }
]

export function CommandPalette(): React.JSX.Element | null {
  const open = useUIStore((s) => s.commandPaletteOpen)
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette)
  const openTaskDetail = useUIStore((s) => s.openTaskDetail)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const openSettings = useUIStore((s) => s.openSettings)
  const setFocusedColumn = useUIStore((s) => s.setFocusedColumn)

  const activeTaskId = useUIStore((s) => s.activeTaskId)

  const projectState = useTaskStore((s) => s.projectState)
  const addTask = useTaskStore((s) => s.addTask)
  const tasks = projectState?.tasks ?? []

  const [settings, setSettings] = useState<ProjectSettings | null>(null)
  useEffect(() => {
    if (open && window.api?.readSettings) {
      window.api.readSettings().then(setSettings).catch(() => setSettings(null))
    }
  }, [open])

  // Cmd+K is now handled by useGlobalShortcuts in App.tsx

  const handleClose = useCallback(() => {
    if (open) toggleCommandPalette()
  }, [open, toggleCommandPalette])

  const handleRunDoctor = useCallback((autoFix: boolean) => {
    if (!activeTaskId) return
    const isClaudeCode = settings?.codingAgent === 'claude-code'
    let command: string
    if (isClaudeCode) {
      const flags = autoFix ? ' --allow-dangerously-skip-permissions --permission-mode bypassPermissions' : ''
      const doctorFlags = autoFix ? ' --auto-fix' : ''
      command = `familiar doctor${doctorFlags} | claude${flags}`
    } else {
      command = 'familiar doctor'
    }
    window.dispatchEvent(new CustomEvent('run-doctor', { detail: { taskId: activeTaskId, command } }))
    handleClose()
  }, [activeTaskId, settings, handleClose])

  if (!open) return null

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.wrapper} onClick={(e) => e.stopPropagation()}>
        <Command style={styles.command} label="Command palette">
          <Command.Input
            style={styles.input}
            placeholder="Type a command or search..."
            autoFocus
          />
          <Command.List style={styles.list}>
            <Command.Empty style={styles.empty}>No results found.</Command.Empty>

            {/* Tasks section */}
            <Command.Group heading="Tasks" style={styles.group}>
              {tasks.map((task) => (
                <Command.Item
                  key={task.id}
                  value={`task ${task.title} ${task.id}`}
                  onSelect={() => {
                    openTaskDetail(task.id)
                    handleClose()
                  }}
                  style={styles.item}
                >
                  <span style={styles.itemIcon}>
                    <StatusDot status={task.status} />
                  </span>
                  <span style={styles.itemLabel}>{task.title}</span>
                  <span style={styles.itemMeta}>{task.id}</span>
                </Command.Item>
              ))}
            </Command.Group>

            {/* Actions section */}
            <Command.Group heading="Actions" style={styles.group}>
              <Command.Item
                value="create new task"
                onSelect={async () => {
                  await addTask('New task')
                  handleClose()
                }}
                style={styles.item}
              >
                <span style={styles.itemIcon}>+</span>
                <span style={styles.itemLabel}>Create Task</span>
                <span style={styles.shortcut}>
                  <kbd style={styles.kbd}>C</kbd>
                </span>
              </Command.Item>
              <Command.Item
                value="toggle sidebar"
                onSelect={() => {
                  toggleSidebar()
                  handleClose()
                }}
                style={styles.item}
              >
                <span style={styles.itemIcon}>&laquo;</span>
                <span style={styles.itemLabel}>Toggle Sidebar</span>
                <span style={styles.shortcut}>
                  <kbd style={styles.kbd}>&#8984;</kbd>
                  <kbd style={styles.kbd}>B</kbd>
                </span>
              </Command.Item>
              <Command.Item
                value="open settings preferences"
                onSelect={() => {
                  openSettings()
                  handleClose()
                }}
                style={styles.item}
              >
                <span style={styles.itemIcon}>&#9881;</span>
                <span style={styles.itemLabel}>Open Settings</span>
                <span style={styles.shortcut}>
                  <kbd style={styles.kbd}>&#8984;</kbd>
                  <kbd style={styles.kbd}>,</kbd>
                </span>
              </Command.Item>
              {activeTaskId && (
                <>
                  <Command.Item
                    value="run doctor environment check diagnostic"
                    onSelect={() => handleRunDoctor(false)}
                    style={styles.item}
                  >
                    <span style={styles.itemIcon}>&#9829;</span>
                    <span style={styles.itemLabel}>Run Doctor</span>
                  </Command.Item>
                  <Command.Item
                    value="run doctor auto-fix environment check diagnostic"
                    onSelect={() => handleRunDoctor(true)}
                    style={styles.item}
                  >
                    <span style={styles.itemIcon}>&#9889;</span>
                    <span style={styles.itemLabel}>Run Doctor (Auto-fix)</span>
                  </Command.Item>
                </>
              )}
            </Command.Group>

            {/* Navigation section */}
            <Command.Group heading="Navigation" style={styles.group}>
              {COLUMN_LABELS.map((col, idx) => (
                <Command.Item
                  key={col.status}
                  value={`go to column ${col.label}`}
                  onSelect={() => {
                    setFocusedColumn(idx)
                    handleClose()
                  }}
                  style={styles.item}
                >
                  <span style={styles.itemIcon}>
                    <StatusDot status={col.status} />
                  </span>
                  <span style={styles.itemLabel}>Go to {col.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: TaskStatus }): React.JSX.Element {
  const colorMap: Record<TaskStatus, string> = {
    todo: 'var(--status-todo)',
    'in-progress': 'var(--status-in-progress)',
    'in-review': 'var(--status-in-review)',
    done: 'var(--status-done)',
    archived: 'var(--status-archived)'
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: colorMap[status] ?? 'var(--agent-idle)'
      }}
    />
  )
}

const styles: Record<string, React.CSSProperties> = {
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
    zIndex: 400,
    animation: 'cmdkFadeIn 120ms ease'
  },
  wrapper: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 8,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    boxShadow: '0 16px 70px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden'
  },
  command: {
    width: '100%',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  input: {
    width: '100%',
    padding: '14px 18px',
    fontSize: 15,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border)',
    outline: 'none',
    boxSizing: 'border-box'
  },
  list: {
    maxHeight: 360,
    overflowY: 'auto',
    padding: '8px 0'
  },
  empty: {
    padding: '24px 18px',
    color: 'var(--text-tertiary)',
    fontSize: 13,
    textAlign: 'center'
  },
  group: {
    padding: '4px 0'
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 18px',
    fontSize: 13,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    borderRadius: 0,
    transition: 'background-color 100ms ease'
  },
  itemIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    color: 'var(--text-secondary)',
    fontSize: 14,
    flexShrink: 0
  },
  itemLabel: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  itemMeta: {
    color: 'var(--text-tertiary)',
    fontSize: 11,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    flexShrink: 0
  },
  shortcut: {
    display: 'flex',
    gap: 4,
    flexShrink: 0
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    padding: '0 5px',
    fontSize: 11,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-elevated)',
    borderRadius: 4,
    border: '1px solid var(--border)'
  }
}
