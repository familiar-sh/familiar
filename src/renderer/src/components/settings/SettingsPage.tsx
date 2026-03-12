import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
import type { ProjectSettings, CodingAgent } from '@shared/types'
import { DEFAULT_SETTINGS, DEFAULT_SNIPPETS, CODING_AGENT_LABELS } from '@shared/types/settings'
import { DEFAULT_LABELS } from '@shared/constants'
import { SnippetSettings } from './SnippetSettings'
import { LabelSettings } from './LabelSettings'

export function SettingsPage(): React.JSX.Element {
  const closeSettings = useUIStore((s) => s.closeSettings)
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS)
  const [isDirty, setIsDirty] = useState(false)

  // Load settings on mount
  useEffect(() => {
    async function load(): Promise<void> {
      try {
        const s = await window.api.readSettings()
        setSettings(s)
      } catch {
        // Use defaults
      }
    }
    load()
  }, [])

  const handleChange = useCallback(
    <K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }))
      setIsDirty(true)
    },
    []
  )

  const handleSave = useCallback(async () => {
    try {
      // Filter out empty entries before saving
      const toSave = { ...settings }
      if (toSave.snippets) {
        toSave.snippets = toSave.snippets.filter((s) => s.title.trim() && s.command.trim())
      }
      if (toSave.labels) {
        toSave.labels = toSave.labels.filter((l) => l.name.trim())
      }
      await window.api.writeSettings(toSave)
      // Notify consumers
      window.dispatchEvent(
        new CustomEvent('snippets-updated', {
          detail: toSave.snippets ?? DEFAULT_SNIPPETS
        })
      )
      window.dispatchEvent(
        new CustomEvent('labels-updated', {
          detail: toSave.labels ?? DEFAULT_LABELS
        })
      )
      setSettings(toSave)
      setIsDirty(false)
    } catch (err) {
      console.error('Failed to save settings:', err)
    }
  }, [settings])

  const handleCancel = useCallback(() => {
    closeSettings()
  }, [closeSettings])

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>Settings</h1>
          <button style={styles.closeButton} onClick={handleCancel} title="Close (Escape)">
            &times;
          </button>
        </div>

        <div style={styles.body}>
          {/* Terminal section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Terminal</h2>

            <div style={styles.settingRow}>
              <div style={styles.settingInfo}>
                <label style={styles.settingLabel}>Default Command</label>
                <span style={styles.settingDescription}>
                  Command to run automatically when a new task terminal is created
                </span>
              </div>
              <input
                style={styles.textInput}
                type="text"
                value={settings.defaultCommand ?? ''}
                onChange={(e) => handleChange('defaultCommand', e.target.value || undefined)}
                placeholder="e.g. claude --dangerously-skip-permissions"
              />
            </div>
          </div>

          {/* Agent section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Agent</h2>

            <div style={styles.settingRow}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={styles.settingInfo}>
                  <label style={styles.settingLabel}>Simplify Task Titles</label>
                  <span style={styles.settingDescription}>
                    Agents will shorten verbose task titles and move the original prompt to the task
                    notes
                  </span>
                </div>
                <button
                  style={{
                    ...styles.toggleButton,
                    ...(settings.simplifyTaskTitles ? styles.toggleButtonActive : {})
                  }}
                  onClick={() => handleChange('simplifyTaskTitles', !settings.simplifyTaskTitles)}
                  role="switch"
                  aria-checked={settings.simplifyTaskTitles ?? false}
                >
                  <span
                    style={{
                      ...styles.toggleKnob,
                      ...(settings.simplifyTaskTitles ? styles.toggleKnobActive : {})
                    }}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Coding Agent section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Coding Agent</h2>

            <div style={styles.settingRow}>
              <div style={styles.settingInfo}>
                <label style={styles.settingLabel}>Agent Harness</label>
                <span style={styles.settingDescription}>
                  The coding agent used in this project
                </span>
              </div>
              <select
                style={styles.textInput}
                value={settings.codingAgent ?? ''}
                onChange={(e) =>
                  handleChange(
                    'codingAgent',
                    (e.target.value as CodingAgent) || undefined
                  )
                }
              >
                <option value="">Not configured</option>
                {(Object.keys(CODING_AGENT_LABELS) as CodingAgent[]).map((key) => (
                  <option key={key} value={key}>
                    {CODING_AGENT_LABELS[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Labels section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Labels</h2>
            <p style={styles.settingDescription}>
              Labels available for categorizing tasks across the project
            </p>
            <LabelSettings
              labels={settings.labels ?? DEFAULT_LABELS}
              onChange={(labels) => handleChange('labels', labels)}
            />
          </div>

          {/* Snippets section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Snippets</h2>
            <p style={styles.settingDescription}>
              Terminal command shortcuts shown as buttons above the terminal
            </p>
            <SnippetSettings
              snippets={settings.snippets ?? DEFAULT_SNIPPETS}
              onChange={(snippets) => handleChange('snippets', snippets)}
            />
          </div>
        </div>

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={handleCancel}>
            Cancel
          </button>
          <button
            style={{
              ...styles.saveButton,
              ...(isDirty ? {} : { opacity: 0.5, cursor: 'default' })
            }}
            onClick={handleSave}
            disabled={!isDirty}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties & Record<string, unknown>> = {
  container: {
    position: 'fixed',
    inset: 0,
    top: 40, // Below navbar
    backgroundColor: 'var(--bg-primary)',
    zIndex: 300,
    display: 'flex',
    justifyContent: 'center',
    overflowY: 'auto',
    WebkitAppRegion: 'no-drag'
  },
  content: {
    width: '100%',
    maxWidth: 960,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    padding: '0 16px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 0 16px',
    borderBottom: '1px solid var(--border)'
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '22px',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1
  },
  body: {
    flex: 1,
    padding: '16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px'
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0
  },
  settingRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  settingInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  settingLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text-primary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  settingDescription: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    margin: 0
  },
  textInput: {
    padding: '8px 12px',
    fontSize: '13px',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    padding: '16px 0',
    borderTop: '1px solid var(--border)'
  },
  cancelButton: {
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '5px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer'
  },
  toggleButton: {
    width: 40,
    height: 22,
    borderRadius: 11,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--bg-surface)',
    cursor: 'pointer',
    position: 'relative' as const,
    padding: 0,
    flexShrink: 0,
    transition: 'background-color 0.15s ease'
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    borderColor: 'rgba(99, 102, 241, 0.5)'
  },
  toggleKnob: {
    display: 'block',
    width: 16,
    height: 16,
    borderRadius: '50%',
    backgroundColor: 'var(--text-tertiary)',
    position: 'absolute' as const,
    top: 2,
    left: 2,
    transition: 'transform 0.15s ease, background-color 0.15s ease'
  },
  toggleKnobActive: {
    transform: 'translateX(18px)',
    backgroundColor: '#818cf8'
  },
  saveButton: {
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    borderRadius: '5px',
    border: '1px solid rgba(99, 102, 241, 0.4)',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#818cf8',
    cursor: 'pointer'
  }
}
