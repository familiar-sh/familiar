import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal } from './Terminal'
import { LucideIconByName } from './IconPicker'
import { Tooltip } from '@renderer/components/common'
import type { Snippet } from '@shared/types'
import { DEFAULT_SNIPPETS } from '@shared/types/settings'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'

interface TerminalPanelProps {
  taskId: string
  visible?: boolean
}

export function TerminalPanel({ taskId }: TerminalPanelProps): React.JSX.Element {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [snippets, setSnippets] = useState<Snippet[]>(DEFAULT_SNIPPETS)
  const [isStopping, setIsStopping] = useState(false)
  const [isStopped, setIsStopped] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  const sessionIdRef = useRef<string | null>(null)
  const task = useTaskStore((s) => s.getTaskById(taskId))
  const isArchived = task?.status === 'archived'
  const updateTask = useTaskStore((s) => s.updateTask)
  const openSettings = useUIStore((s) => s.openSettings)

  const createSession = useCallback(async () => {
    try {
      const cwd = await window.api.getProjectRoot()
      const sid = await window.api.ptyCreate(taskId, 'main', cwd)
      return sid
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    }
  }, [taskId])

  useEffect(() => {
    // Don't create terminal sessions for archived tasks
    if (isArchived) return

    let cancelled = false

    async function init(): Promise<void> {
      const sid = await createSession()
      if (cancelled) {
        if (sid) window.api.ptyDestroy(sid).catch(console.error)
        return
      }
      if (sid) {
        sessionIdRef.current = sid
        setSessionId(sid)
        setIsStopped(false)
      }
    }

    init()

    return () => {
      cancelled = true
      // Destroy the old PTY attach process to prevent leaking tmux client connections.
      // The underlying tmux session survives (only the attach-session client is killed),
      // so reconnection on re-mount is instant.
      const oldSid = sessionIdRef.current
      if (oldSid) {
        window.api.ptyDestroy(oldSid).catch(console.error)
        sessionIdRef.current = null
      }
    }
  }, [taskId, createSession, isArchived])

  // Load snippets from settings and listen for updates
  useEffect(() => {
    async function loadSnippets(): Promise<void> {
      try {
        const settings = await window.api.readSettings()
        if (settings.snippets && settings.snippets.length > 0) {
          setSnippets(settings.snippets)
        }
      } catch {
        // Use defaults
      }
    }
    loadSnippets()

    // Re-load when snippets are saved from the settings modal
    function handleSnippetsUpdated(e: Event): void {
      const detail = (e as CustomEvent<Snippet[]>).detail
      setSnippets(detail.length > 0 ? detail : DEFAULT_SNIPPETS)
    }
    window.addEventListener('snippets-updated', handleSnippetsUpdated)
    return () => window.removeEventListener('snippets-updated', handleSnippetsUpdated)
  }, [])

  const handleSnippet = useCallback(
    (snippet: Snippet) => {
      const sid = sessionIdRef.current
      if (!sid) return
      const data = snippet.pressEnter ? snippet.command + '\r' : snippet.command
      window.api.ptyWrite(sid, data)
    },
    []
  )

  const handleStopAgent = useCallback(async () => {
    if (isStopping) return
    setIsStopping(true)
    try {
      // Find and kill all tmux sessions for this task
      const sessions = await window.api.tmuxList()
      const taskSessions = sessions.filter((s) => s.startsWith(`familiar-${taskId}`))
      for (const session of taskSessions) {
        await window.api.tmuxKill(session)
      }

      // Destroy the PTY session
      const sid = sessionIdRef.current
      if (sid) {
        await window.api.ptyDestroy(sid)
        sessionIdRef.current = null
        setSessionId(null)
      }

      // Update agent status to idle — but only if currently running.
      // If the agent already set itself to 'done', respect that.
      // Re-read from store to avoid spreading stale task data.
      const freshTask = useTaskStore.getState().getTaskById(taskId)
      if (freshTask && freshTask.agentStatus === 'running') {
        await updateTask({ ...freshTask, agentStatus: 'idle' })
      }

      setIsStopped(true)
    } catch (err) {
      console.error('Failed to stop agent:', err)
    } finally {
      setIsStopping(false)
    }
  }, [taskId, task, updateTask, isStopping])

  const handleRestartSession = useCallback(async () => {
    if (isRestarting) return
    setIsRestarting(true)
    try {
      const sid = await createSession()
      if (sid) {
        sessionIdRef.current = sid
        setSessionId(sid)
        setIsStopped(false)
      }
    } finally {
      setIsRestarting(false)
    }
  }, [createSession, isRestarting])


  // Show archived state — no terminal for archived tasks
  if (task?.status === 'archived') {
    return (
      <div style={panelStyles.container}>
        <div style={panelStyles.stoppedContainer}>
          <div style={panelStyles.stoppedIcon}>&#128451;</div>
          <div style={panelStyles.stoppedTitle}>Task archived</div>
          <div style={panelStyles.stoppedMessage}>
            Terminal sessions are stopped for archived tasks.
            <br />
            Move this task back to In Progress to start a new terminal session.
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={panelStyles.container}>
        <div style={panelStyles.status}>Terminal error: {error}</div>
      </div>
    )
  }

  if (!sessionId && isStopped) {
    return (
      <div style={panelStyles.container}>
        <div style={panelStyles.stoppedContainer}>
          <div style={panelStyles.stoppedIcon}>&#9632;</div>
          <div style={panelStyles.stoppedTitle}>Agent stopped</div>
          <div style={panelStyles.stoppedMessage}>
            The agent was terminated and the previous tmux session was discarded.
            <br />
            Task documents and activity log have been preserved.
          </div>
          <button
            style={{
              ...panelStyles.restartButton,
              ...(isRestarting ? { opacity: 0.5, cursor: 'not-allowed' } : {})
            }}
            onClick={handleRestartSession}
            disabled={isRestarting}
          >
            {isRestarting ? 'Starting...' : 'New Terminal Session'}
          </button>
        </div>
      </div>
    )
  }

  if (!sessionId) {
    return (
      <div style={panelStyles.container}>
        <div style={panelStyles.status}>Connecting...</div>
      </div>
    )
  }

  return (
    <div style={panelStyles.container}>
      <div style={panelStyles.snippetBar}>
        {snippets.map((snippet, i) => (
          <Tooltip
            key={i}
            placement="bottom"
            content={
              <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginBottom: 4 }}>
                  {snippet.title}
                </div>
                <code
                  style={{
                    fontSize: '11px',
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    color: 'var(--accent-hover)',
                    wordBreak: 'break-all'
                  }}
                >
                  {snippet.command}
                </code>
                <div style={{ marginTop: 4, fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  {snippet.pressEnter
                    ? 'Runs immediately (Enter is sent automatically)'
                    : 'Pastes command only (you press Enter to run)'}
                </div>
              </div>
            }
          >
            <button
              style={panelStyles.snippetButton}
              onClick={() => handleSnippet(snippet)}
            >
              {snippet.icon && <LucideIconByName name={snippet.icon} size={14} />}
              {!(snippet.icon && snippet.showIconInTerminal) && snippet.title}
            </button>
          </Tooltip>
        ))}
        <Tooltip placement="bottom" content="Open settings">
          <button
            style={panelStyles.gearButton}
            onClick={openSettings}
          >
            &#9881;
          </button>
        </Tooltip>
        <div style={{ flex: 1 }} />
        <Tooltip placement="bottom" content="Terminate the running agent and kill the tmux session">
          <button
            style={{
              ...panelStyles.snippetButton,
              ...panelStyles.stopButton,
              ...(isStopping ? { opacity: 0.5, cursor: 'not-allowed' } : {})
            }}
            onClick={handleStopAgent}
            disabled={isStopping}
          >
            {isStopping ? 'Stopping...' : 'Stop Agent'}
          </button>
        </Tooltip>
      </div>
      <div style={panelStyles.terminalArea}>
        <Terminal sessionId={sessionId} />
      </div>
    </div>
  )
}

const panelStyles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--bg-primary)'
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    color: '#5c5c6e',
    fontSize: '13px',
    fontFamily: "'SF Mono', monospace"
  },
  snippetBar: {
    display: 'flex',
    gap: '6px',
    padding: '6px 10px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0
  },
  snippetButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 10px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    borderRadius: '4px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'background-color 0.15s, color 0.15s'
  },
  gearButton: {
    padding: '3px 8px',
    fontSize: '16px',
    lineHeight: 1,
    borderRadius: '4px',
    border: '1px solid transparent',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    opacity: 0.5,
    transition: 'opacity 0.15s, background-color 0.15s'
  },
  stopButton: {
    border: '1px solid rgba(231, 76, 60, 0.3)',
    color: '#e74c3c',
    backgroundColor: 'rgba(231, 76, 60, 0.08)'
  },
  stoppedContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    gap: '12px',
    padding: '32px'
  },
  stoppedIcon: {
    fontSize: '28px',
    color: '#e74c3c',
    lineHeight: 1
  },
  stoppedTitle: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  stoppedMessage: {
    fontSize: '13px',
    color: '#8e8ea0',
    textAlign: 'center' as const,
    lineHeight: 1.5,
    maxWidth: '360px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  restartButton: {
    marginTop: '8px',
    padding: '8px 20px',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background-color 0.15s, border-color 0.15s'
  },
  terminalArea: {
    flex: 1,
    overflow: 'hidden'
  },
}
