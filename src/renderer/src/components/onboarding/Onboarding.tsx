import { useState, useCallback } from 'react'
import type { CodingAgent, ProjectSettings } from '@shared/types'
import { CODING_AGENT_LABELS } from '@shared/types/settings'
import { useTaskStore } from '@renderer/stores/task-store'
import { useUIStore } from '@renderer/stores/ui-store'

type OnboardingStep = 'open-folder' | 'select-agent' | 'doctor'

interface OnboardingProps {
  /** Whether a project is already loaded (folder already open) */
  hasProject: boolean
  /** Called when the full onboarding is complete */
  onComplete: () => void
}

export function Onboarding({ hasProject, onComplete }: OnboardingProps): React.JSX.Element {
  const [step, setStep] = useState<OnboardingStep>(hasProject ? 'select-agent' : 'open-folder')
  const [skipDoctor, setSkipDoctor] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<CodingAgent | null>(null)
  const [copied, setCopied] = useState(false)
  const openWorkspace = useTaskStore((s) => s.openWorkspace)

  const handleOpenFolder = useCallback(async () => {
    const success = await openWorkspace()
    if (!success) return

    // Check if agent is already configured
    try {
      const settings = await window.api.readSettings()
      if (settings.codingAgent) {
        // Agent already configured — skip to doctor or finish
        if (settings.skipDoctor || skipDoctor) {
          onComplete()
        } else {
          setSelectedAgent(settings.codingAgent)
          setStep('doctor')
        }
        return
      }
    } catch {
      // Settings not available yet — continue onboarding
    }

    setStep('select-agent')
  }, [openWorkspace, skipDoctor, onComplete])

  const handleSelectAgent = useCallback(
    async (agent: CodingAgent) => {
      setSelectedAgent(agent)

      // Save agent choice to settings
      try {
        const settings = await window.api.readSettings()
        const updated: ProjectSettings = { ...settings, codingAgent: agent, skipDoctor }
        await window.api.writeSettings(updated)
      } catch {
        // Will be saved later
      }

      if (skipDoctor) {
        onComplete()
      } else {
        setStep('doctor')
      }
    },
    [skipDoctor, onComplete]
  )

  const handleCopyDoctor = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(DOCTOR_PROMPT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API may fail
    }
  }, [])

  const handleRunDoctor = useCallback(async () => {
    // Save skipDoctor preference
    try {
      const settings = await window.api.readSettings()
      const updated: ProjectSettings = { ...settings, skipDoctor }
      await window.api.writeSettings(updated)
    } catch {
      // ignore
    }

    // Create a doctor check task with the prompt as the document
    const { addTask } = useTaskStore.getState()
    const task = await addTask('Doctor Check', { status: 'in-progress', labels: ['chore'] })
    await window.api.writeTaskDocument(task.id, DOCTOR_PROMPT)

    // Warmup tmux session so the terminal is ready
    window.api.warmupTmuxSession(task.id).catch(() => {})

    // Complete onboarding, then open the task detail after a tick
    onComplete()
    setTimeout(() => {
      useUIStore.getState().openTaskDetail(task.id)

      // Send the agent command to the terminal after session is ready
      const sessionName = `familiar-${task.id}`
      setTimeout(async () => {
        if (selectedAgent === 'claude-code') {
          try {
            await window.api.tmuxSendKeys(
              sessionName,
              'familiar doctor --copy | claude --print',
              true
            )
          } catch {
            // Terminal may not be ready yet — user can start manually
          }
        }
      }, 3000)
    }, 100)
  }, [selectedAgent, skipDoctor, onComplete])

  const handleSkipDoctor = useCallback(async () => {
    try {
      const settings = await window.api.readSettings()
      const updated: ProjectSettings = { ...settings, skipDoctor: true }
      await window.api.writeSettings(updated)
    } catch {
      // ignore
    }
    onComplete()
  }, [onComplete])

  // Step 1: Open Folder
  if (step === 'open-folder') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.stepIndicator}>
            <StepDot active />
            <StepLine />
            <StepDot />
            <StepLine />
            <StepDot />
          </div>

          <div style={styles.iconContainer}>
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </div>

          <h1 style={styles.title}>Welcome to Familiar</h1>
          <p style={styles.subtitle}>
            Open a project folder to get started. If the folder already has a Familiar project, it
            will be loaded automatically.
          </p>

          <button style={styles.primaryButton} onClick={handleOpenFolder}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Open Folder
          </button>

          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={skipDoctor}
              onChange={(e) => setSkipDoctor(e.target.checked)}
              style={styles.checkbox}
            />
            <span style={styles.checkboxText}>Skip environment check on setup</span>
          </label>
        </div>
      </div>
    )
  }

  // Step 2: Select Agent
  if (step === 'select-agent') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.stepIndicator}>
            <StepDot completed />
            <StepLine completed />
            <StepDot active />
            <StepLine />
            <StepDot />
          </div>

          <div style={styles.iconContainer}>
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 17l6-6-6-6" />
              <path d="M12 19h8" />
            </svg>
          </div>

          <h1 style={styles.title}>Select Your Coding Agent</h1>
          <p style={styles.subtitle}>
            Choose which AI coding agent you use. This configures how Familiar interacts with your
            agent.
          </p>

          <div style={styles.agentGrid}>
            <button style={styles.agentCard} onClick={() => handleSelectAgent('claude-code')}>
              <div style={styles.agentIcon}>
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 17l6-6-6-6" />
                  <path d="M12 19h8" />
                </svg>
              </div>
              <span style={styles.agentName}>{CODING_AGENT_LABELS['claude-code']}</span>
              <span style={styles.agentBadge}>Recommended</span>
            </button>

            <button style={styles.agentCard} onClick={() => handleSelectAgent('other')}>
              <div style={styles.agentIcon}>
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <span style={styles.agentName}>Other</span>
              <span style={styles.agentDescription}>Not fully tested</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Step 3: Doctor Check
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.stepIndicator}>
          <StepDot completed />
          <StepLine completed />
          <StepDot completed />
          <StepLine completed />
          <StepDot active />
        </div>

        <div style={styles.iconContainer}>
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>

        <h1 style={styles.title}>Environment Check</h1>
        <p style={styles.subtitle}>
          Run the doctor command to verify your environment is properly configured for{' '}
          {selectedAgent ? CODING_AGENT_LABELS[selectedAgent] : 'your agent'}.
        </p>

        <div style={styles.doctorPreview}>
          <div style={styles.doctorHeader}>
            <span style={styles.doctorLabel}>Doctor Prompt</span>
            <button style={styles.copyButton} onClick={handleCopyDoctor}>
              {copied ? (
                <>
                  <CheckIcon />
                  Copied
                </>
              ) : (
                <>
                  <CopyIcon />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre style={styles.doctorCode}>{DOCTOR_PROMPT}</pre>
        </div>

        <div style={styles.doctorActions}>
          <button style={styles.primaryButton} onClick={handleRunDoctor}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Run Doctor
          </button>
          <button style={styles.secondaryButton} onClick={handleSkipDoctor}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

// Small icon components
function CheckIcon(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function CopyIcon(): React.JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

// Step indicator components
function StepDot({
  active,
  completed
}: {
  active?: boolean
  completed?: boolean
}): React.JSX.Element {
  const dotStyle: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: completed || active ? 'var(--accent)' : 'var(--bg-elevated)',
    border: active ? '2px solid var(--accent)' : completed ? 'none' : '2px solid var(--border)',
    boxShadow: active ? '0 0 0 3px var(--accent-subtle)' : 'none',
    transition: 'all 0.2s ease'
  }
  return <div style={dotStyle} />
}

function StepLine({ completed }: { completed?: boolean }): React.JSX.Element {
  return (
    <div
      style={{
        width: 40,
        height: 2,
        backgroundColor: completed ? 'var(--accent)' : 'var(--border)',
        transition: 'background-color 0.2s ease'
      }}
    />
  )
}

const DOCTOR_PROMPT = `# Familiar Environment Diagnostic

Please run a full diagnostic of this machine's Familiar setup. Check each item below, report the results, then offer to fix any issues found.

## Checks to perform

### 1. tmux
- Is tmux installed? (which tmux && tmux -V)
- Can we create and destroy a tmux session?
- Is mouse support configured in ~/.tmux.conf?
- Is clipboard integration (OSC 52 / pbcopy) configured?

### 2. familiar CLI
- Is the CLI installed and in PATH? (which familiar)
- Can it run? (familiar --version)

### 3. Project setup
- Is .familiar/ initialized in the current directory?
- Is state.json present?

### 4. Environment variables
- Is FAMILIAR_TASK_ID set?
- Is FAMILIAR_PROJECT_ROOT set?
- Is FAMILIAR_SETTINGS_PATH set?

### 5. AI agent hooks
- Check if lifecycle hooks are configured for the selected agent
- For Claude Code: check .claude/settings.json for hooks
- Verify hook scripts exist and are executable

After running all checks, summarize Pass/Warn/Fail items and offer to fix any issues.`

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: '24px',
    backgroundColor: 'var(--bg-primary)'
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: 520,
    width: '100%',
    padding: '40px 32px',
    gap: '20px'
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    marginBottom: '8px'
  },
  iconContainer: {
    color: 'var(--accent)',
    marginBottom: '4px'
  },
  title: {
    fontSize: '22px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0,
    textAlign: 'center' as const
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    textAlign: 'center' as const,
    lineHeight: 1.6,
    maxWidth: 380,
    margin: 0
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    height: '40px',
    padding: '8px 24px',
    backgroundColor: 'var(--accent)',
    color: 'var(--text-primary)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    marginTop: '4px'
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    height: '40px',
    padding: '8px 24px',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    cursor: 'pointer',
    transition: 'all 150ms ease'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    marginTop: '4px'
  },
  checkbox: {
    accentColor: 'var(--accent)',
    width: '14px',
    height: '14px',
    cursor: 'pointer',
    margin: 0,
    border: 'none',
    padding: 0
  },
  checkboxText: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  agentGrid: {
    display: 'flex',
    gap: '12px',
    width: '100%',
    marginTop: '4px'
  },
  agentCard: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '8px',
    padding: '20px 16px',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    color: 'var(--text-primary)'
  },
  agentIcon: {
    color: 'var(--text-secondary)',
    marginBottom: '4px'
  },
  agentName: {
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  agentBadge: {
    fontSize: '10px',
    fontWeight: 500,
    color: 'var(--accent)',
    backgroundColor: 'var(--accent-subtle)',
    padding: '2px 8px',
    borderRadius: '10px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  agentDescription: {
    fontSize: '11px',
    color: 'var(--text-tertiary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  doctorPreview: {
    width: '100%',
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    overflow: 'hidden'
  },
  doctorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg-elevated)'
  },
  doctorLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  copyButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--text-secondary)',
    backgroundColor: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    transition: 'all 100ms ease'
  },
  doctorCode: {
    padding: '12px',
    fontSize: '11px',
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    margin: 0,
    maxHeight: '200px',
    overflowY: 'auto' as const,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const
  },
  doctorActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '4px'
  }
}
