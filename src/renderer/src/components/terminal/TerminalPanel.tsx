import { useState, useCallback } from 'react'
import { nanoid } from 'nanoid'
import type { TerminalPane } from '@shared/types/terminal'
import { Terminal } from './Terminal'
import { TerminalTabs } from './TerminalTabs'

interface TerminalPanelProps {
  taskId: string
}

function createPane(index: number): TerminalPane {
  const id = nanoid(8)
  return {
    id,
    sessionName: '',
    title: `Terminal ${index + 1}`
  }
}

export function TerminalPanel({ taskId }: TerminalPanelProps): JSX.Element {
  const [panes, setPanes] = useState<TerminalPane[]>(() => [createPane(0)])
  const [activePane, setActivePane] = useState<string>(() => panes[0].id)
  const [sessions, setSessions] = useState<Record<string, string>>({})

  const initSession = useCallback(
    async (paneId: string) => {
      if (sessions[paneId]) return
      try {
        const sessionId = await window.api.ptyCreate(taskId, paneId, process.cwd?.() ?? '/')
        setSessions((prev) => ({ ...prev, [paneId]: sessionId }))
      } catch (err) {
        console.error('Failed to create PTY session:', err)
      }
    },
    [taskId, sessions]
  )

  const handleAddPane = useCallback(() => {
    const newPane = createPane(panes.length)
    setPanes((prev) => [...prev, newPane])
    setActivePane(newPane.id)
  }, [panes.length])

  const handleClosePane = useCallback(
    (paneId: string) => {
      const sessionId = sessions[paneId]
      if (sessionId) {
        window.api.ptyDestroy(sessionId).catch(console.error)
      }
      setPanes((prev) => {
        const next = prev.filter((p) => p.id !== paneId)
        if (next.length === 0) {
          const fresh = createPane(0)
          setActivePane(fresh.id)
          return [fresh]
        }
        if (activePane === paneId) {
          setActivePane(next[next.length - 1].id)
        }
        return next
      })
      setSessions((prev) => {
        const next = { ...prev }
        delete next[paneId]
        return next
      })
    },
    [sessions, activePane]
  )

  // Initialize session for active pane if not yet created
  const activePaneObj = panes.find((p) => p.id === activePane)
  if (activePaneObj && !sessions[activePaneObj.id]) {
    initSession(activePaneObj.id)
  }

  const activeSessionId = activePane ? sessions[activePane] : undefined

  return (
    <div style={styles.container}>
      <TerminalTabs
        taskId={taskId}
        panes={panes}
        activePane={activePane}
        onSelectPane={setActivePane}
        onAddPane={handleAddPane}
        onClosePane={handleClosePane}
      />
      <div style={styles.terminalArea}>
        {activeSessionId ? (
          <Terminal sessionId={activeSessionId} />
        ) : (
          <div style={styles.loading}>Connecting...</div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: '#0d0d12'
  },
  terminalArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative'
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    color: '#5c5c6e',
    fontSize: '13px',
    fontFamily: "'SF Mono', monospace"
  }
}
