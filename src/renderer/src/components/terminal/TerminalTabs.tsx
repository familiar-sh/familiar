import type { TerminalPane } from '@shared/types/terminal'

interface TerminalTabsProps {
  taskId: string
  panes: TerminalPane[]
  activePane: string
  onSelectPane: (paneId: string) => void
  onAddPane: () => void
  onClosePane: (paneId: string) => void
}

export function TerminalTabs({
  panes,
  activePane,
  onSelectPane,
  onAddPane,
  onClosePane
}: TerminalTabsProps): JSX.Element {
  return (
    <div style={styles.tabBar}>
      {panes.map((pane) => (
        <button
          key={pane.id}
          onClick={() => onSelectPane(pane.id)}
          style={{
            ...styles.tab,
            ...(pane.id === activePane ? styles.tabActive : {})
          }}
        >
          <span style={styles.tabTitle}>{pane.title}</span>
          {panes.length > 1 && (
            <span
              onClick={(e) => {
                e.stopPropagation()
                onClosePane(pane.id)
              }}
              style={styles.closeButton}
            >
              &times;
            </span>
          )}
        </button>
      ))}
      <button onClick={onAddPane} style={styles.addButton} title="New terminal">
        +
      </button>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  tabBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '1px',
    padding: '0 4px',
    height: '32px',
    backgroundColor: '#0d0d12',
    borderBottom: '1px solid #2a2a3c',
    flexShrink: 0
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    height: '28px',
    fontSize: '12px',
    fontFamily: "'Inter', sans-serif",
    color: '#8e8ea0',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px 4px 0 0',
    cursor: 'pointer',
    transition: 'color 150ms ease, background-color 150ms ease',
    whiteSpace: 'nowrap'
  },
  tabActive: {
    color: '#f0f0f4',
    backgroundColor: '#1a1a27'
  },
  tabTitle: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '120px'
  },
  closeButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    fontSize: '14px',
    lineHeight: 1,
    borderRadius: '3px',
    color: '#5c5c6e',
    cursor: 'pointer'
  },
  addButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    fontSize: '16px',
    color: '#5c5c6e',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    flexShrink: 0
  }
}
