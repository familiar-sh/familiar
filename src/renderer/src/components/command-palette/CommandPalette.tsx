import { useCallback } from 'react'
import { Command } from 'cmdk'
import { useUIStore } from '../../stores/ui-store'
import { useTaskStore } from '../../stores/task-store'
import type { TaskStatus } from '@shared/types'

const COLUMN_LABELS: { status: TaskStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'todo', label: 'Todo' },
  { status: 'in-progress', label: 'In Progress' },
  { status: 'in-review', label: 'In Review' },
  { status: 'done', label: 'Done' },
  { status: 'cancelled', label: 'Cancelled' }
]

export function CommandPalette(): JSX.Element | null {
  const open = useUIStore((s) => s.commandPaletteOpen)
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette)
  const openTaskDetail = useUIStore((s) => s.openTaskDetail)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const setFocusedColumn = useUIStore((s) => s.setFocusedColumn)

  const projectState = useTaskStore((s) => s.projectState)
  const addTask = useTaskStore((s) => s.addTask)
  const tasks = projectState?.tasks ?? []

  // Cmd+K is now handled by useGlobalShortcuts in App.tsx

  const handleClose = useCallback(() => {
    if (open) toggleCommandPalette()
  }, [open, toggleCommandPalette])

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

function StatusDot({ status }: { status: TaskStatus }): JSX.Element {
  const colorMap: Record<TaskStatus, string> = {
    backlog: '#5c5c6e',
    todo: '#f0f0f4',
    'in-progress': '#f2c94c',
    'in-review': '#5e6ad2',
    done: '#27ae60',
    cancelled: '#e74c3c'
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: colorMap[status] ?? '#5c5c6e'
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
    border: '1px solid #2a2a3c',
    backgroundColor: '#1a1a27',
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
    color: '#f0f0f4',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '1px solid #2a2a3c',
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
    color: '#5c5c6e',
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
    color: '#f0f0f4',
    cursor: 'pointer',
    borderRadius: 0,
    transition: 'background-color 100ms ease'
  },
  itemIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    color: '#8e8ea0',
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
    color: '#5c5c6e',
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
    color: '#8e8ea0',
    backgroundColor: '#232334',
    borderRadius: 4,
    border: '1px solid #2a2a3c'
  }
}
