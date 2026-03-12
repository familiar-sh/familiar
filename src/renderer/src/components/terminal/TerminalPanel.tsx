import { useState, useEffect, useRef, useCallback } from 'react'
import { Terminal } from './Terminal'
import { SnippetSettingsModal } from './SnippetSettingsModal'
import { LucideIconByName } from './IconPicker'
import { Tooltip } from '@renderer/components/common'
import type { Snippet } from '@shared/types'
import { DEFAULT_SNIPPETS } from '@shared/types/settings'
import { useTaskStore } from '@renderer/stores/task-store'
import { TMUX_SETUP_PROMPT, DOCTOR_PROMPT, BASE_AGENTS_MD } from '@shared/prompts'

interface TerminalPanelProps {
  taskId: string
}

export function TerminalPanel({ taskId }: TerminalPanelProps): React.JSX.Element {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [snippets, setSnippets] = useState<Snippet[]>(DEFAULT_SNIPPETS)
  const [isStopping, setIsStopping] = useState(false)
  const [isStopped, setIsStopped] = useState(false)
  const [isRestarting, setIsRestarting] = useState(false)
  const [showSnippetSettings, setShowSnippetSettings] = useState(false)
  const [showHelpMenu, setShowHelpMenu] = useState(false)
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const helpMenuRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string | null>(null)
  const task = useTaskStore((s) => s.getTaskById(taskId))
  const updateTask = useTaskStore((s) => s.updateTask)

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
    if (task?.status === 'archived') return

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
      // Do NOT destroy PTY on unmount — task details stay mounted but hidden
      // for instant reopen. PTY is only destroyed via explicit "Stop Agent" action.
    }
  }, [taskId, createSession, task?.status])

  // Load snippets from settings
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
  }, [])

  const handleCopyPrompt = useCallback(async (label: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedItem(label)
      setTimeout(() => setCopiedItem(null), 1500)
    } catch {
      console.error('Failed to copy to clipboard')
    }
  }, [])

  // Close help menu on click outside
  useEffect(() => {
    if (!showHelpMenu) return
    function handleClickOutside(e: MouseEvent): void {
      if (helpMenuRef.current && !helpMenuRef.current.contains(e.target as Node)) {
        setShowHelpMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHelpMenu])

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
      const taskSessions = sessions.filter((s) => s.startsWith(`kanban-${taskId}`))
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

      // Update agent status to idle
      if (task) {
        await updateTask({ ...task, agentStatus: 'idle' })
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
        <Tooltip placement="bottom" content="Configure snippet buttons">
          <button
            style={panelStyles.gearButton}
            onClick={() => setShowSnippetSettings(true)}
          >
            &#9881;
          </button>
        </Tooltip>
        <div style={{ position: 'relative' }} ref={helpMenuRef}>
          <Tooltip placement="bottom" content="Agent setup prompts">
            <button
              style={panelStyles.gearButton}
              onClick={() => setShowHelpMenu((prev) => !prev)}
            >
              ?
            </button>
          </Tooltip>
          {showHelpMenu && (
            <div style={panelStyles.helpDropdown}>
              <button
                style={panelStyles.helpDropdownItem}
                onClick={() => handleCopyPrompt('setup', TMUX_SETUP_PROMPT)}
              >
                <span style={panelStyles.helpDropdownIcon}>&#9881;</span>
                <span style={panelStyles.helpDropdownText}>
                  <span style={panelStyles.helpDropdownTitle}>Copy Tmux Setup Prompt</span>
                  <span style={panelStyles.helpDropdownDesc}>Configure tmux for Kanban Agent</span>
                </span>
                {copiedItem === 'setup' && <span style={panelStyles.copiedBadge}>Copied!</span>}
              </button>
              <button
                style={panelStyles.helpDropdownItem}
                onClick={() => handleCopyPrompt('doctor', DOCTOR_PROMPT)}
              >
                <span style={panelStyles.helpDropdownIcon}>&#128269;</span>
                <span style={panelStyles.helpDropdownText}>
                  <span style={panelStyles.helpDropdownTitle}>Copy Doctor Prompt</span>
                  <span style={panelStyles.helpDropdownDesc}>Diagnose environment issues</span>
                </span>
                {copiedItem === 'doctor' && <span style={panelStyles.copiedBadge}>Copied!</span>}
              </button>
              <button
                style={panelStyles.helpDropdownItem}
                onClick={() => handleCopyPrompt('agents', BASE_AGENTS_MD)}
              >
                <span style={panelStyles.helpDropdownIcon}>&#128196;</span>
                <span style={panelStyles.helpDropdownText}>
                  <span style={panelStyles.helpDropdownTitle}>Copy AGENTS.md</span>
                  <span style={panelStyles.helpDropdownDesc}>Agent onboarding instructions</span>
                </span>
                {copiedItem === 'agents' && <span style={panelStyles.copiedBadge}>Copied!</span>}
              </button>
            </div>
          )}
        </div>
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
      {showSnippetSettings && (
        <SnippetSettingsModal
          snippets={snippets}
          onSave={(updated) => {
            setSnippets(updated.length > 0 ? updated : DEFAULT_SNIPPETS)
            setShowSnippetSettings(false)
          }}
          onClose={() => setShowSnippetSettings(false)}
        />
      )}
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
  helpDropdown: {
    position: 'absolute' as const,
    top: '100%',
    left: 0,
    marginTop: '4px',
    width: '260px',
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
    zIndex: 100,
    overflow: 'hidden'
  },
  helpDropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'background-color 0.1s',
    borderBottom: '1px solid var(--border)'
  },
  helpDropdownIcon: {
    fontSize: '16px',
    flexShrink: 0,
    width: '20px',
    textAlign: 'center' as const
  },
  helpDropdownText: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    flex: 1,
    minWidth: 0
  },
  helpDropdownTitle: {
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-primary)'
  },
  helpDropdownDesc: {
    fontSize: '11px',
    color: 'var(--text-tertiary)'
  },
  copiedBadge: {
    fontSize: '11px',
    fontWeight: 500,
    color: '#4caf50',
    flexShrink: 0
  }
}
