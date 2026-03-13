import { useEffect, useCallback } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: ShortcutItem[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['⌘', 'F'], description: 'Search' },
      { keys: ['⌘', 'N'], description: 'Create new task' },
      { keys: ['⌘', ','], description: 'Open settings' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
      { keys: ['Esc'], description: 'Close current panel' },
      { keys: ['⇧', 'Esc'], description: 'Force close (works in terminals)' }
    ]
  },
  {
    title: 'Board Navigation',
    shortcuts: [
      { keys: ['j', '↓'], description: 'Move down in column' },
      { keys: ['k', '↑'], description: 'Move up in column' },
      { keys: ['h', '←'], description: 'Move to previous column' },
      { keys: ['l', '→'], description: 'Move to next column' },
      { keys: ['⇧', '↑'], description: 'Select previous card' },
      { keys: ['⇧', '↓'], description: 'Select next card' },
      { keys: ['⌥', '↑'], description: 'Move card up' },
      { keys: ['⌥', '↓'], description: 'Move card down' },
      { keys: ['Enter'], description: 'Open selected task' },
      { keys: ['c'], description: 'Create task in focused column' }
    ]
  },
  {
    title: 'Task Actions',
    shortcuts: [
      { keys: ['1'], description: 'Set priority: Urgent' },
      { keys: ['2'], description: 'Set priority: High' },
      { keys: ['3'], description: 'Set priority: Medium' },
      { keys: ['4'], description: 'Set priority: Low' },
      { keys: ['s'], description: 'Move task to status (then press 1–5)' },
      { keys: ['s', '1'], description: 'Move to Todo' },
      { keys: ['s', '2'], description: 'Move to In Progress' },
      { keys: ['s', '3'], description: 'Move to In Review' },
      { keys: ['s', '4'], description: 'Move to Done' },
      { keys: ['s', '5'], description: 'Move to Archived' },
      { keys: ['r'], description: 'Mark as read' },
      { keys: ['⌫'], description: 'Delete selected task(s)' }
    ]
  }
]

export function KeyboardShortcutsModal(): React.JSX.Element | null {
  const open = useUIStore((s) => s.shortcutsModalOpen)
  const closeModal = useUIStore((s) => s.closeShortcutsModal)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeModal()
      }
    },
    [closeModal]
  )

  useEffect(() => {
    if (!open) return
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, handleKeyDown])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeModal()
      }
    },
    [closeModal]
  )

  if (!open) return null

  return (
    <div style={modalStyles.overlay} onClick={handleOverlayClick} data-testid="shortcuts-overlay">
      <div style={modalStyles.wrapper}>
        <div style={modalStyles.header}>
          <span style={modalStyles.headerTitle}>Keyboard Shortcuts</span>
          <button style={modalStyles.closeButton} onClick={closeModal}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M11 3L3 11M3 3l8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div style={modalStyles.body}>
          {shortcutGroups.map((group) => (
            <div key={group.title} style={modalStyles.group}>
              <div style={modalStyles.groupTitle}>{group.title}</div>
              {group.shortcuts.map((shortcut, i) => (
                <div key={i} style={modalStyles.row}>
                  <span style={modalStyles.description}>{shortcut.description}</span>
                  <span style={modalStyles.keys}>
                    {shortcut.keys.map((key, ki) => (
                      <span key={ki}>
                        {ki > 0 && <span style={modalStyles.keySep}>+</span>}
                        <kbd style={modalStyles.kbd}>{key}</kbd>
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={modalStyles.footer}>
          <span style={modalStyles.hint}>
            Press <kbd style={modalStyles.kbd}>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '12vh',
    zIndex: 500,
    animation: 'cmdkFadeIn 120ms ease'
  },
  wrapper: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 8,
    border: '1px solid #2a2a3c',
    backgroundColor: '#1a1a27',
    boxShadow: '0 16px 70px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
    maxHeight: '75vh',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    padding: '12px 18px',
    borderBottom: '1px solid #2a2a3c',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: '#8e8ea0',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#5c5c6e',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  body: {
    padding: '8px 18px 16px',
    overflowY: 'auto',
    flex: 1
  },
  group: {
    marginTop: 12
  },
  groupTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#5c5c6e',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: 6,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '5px 0',
    borderBottom: '1px solid #1f1f30'
  },
  description: {
    fontSize: 13,
    color: '#c8c8d0',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  keys: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
    marginLeft: 16
  },
  keySep: {
    color: '#3a3a4c',
    fontSize: 11,
    margin: '0 1px'
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    fontSize: 11,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    color: '#8e8ea0',
    backgroundColor: '#232334',
    borderRadius: 4,
    border: '1px solid #2a2a3c'
  },
  footer: {
    padding: '8px 18px',
    borderTop: '1px solid #2a2a3c',
    display: 'flex',
    justifyContent: 'center'
  },
  hint: {
    fontSize: 11,
    color: '#5c5c6e',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  }
}
