import { useState, useEffect, useCallback } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'
import type { ProjectSettings } from '@shared/types'
import { DEFAULT_SETTINGS, DEFAULT_SNIPPETS } from '@shared/types/settings'

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
      // Filter out empty snippets before saving
      const toSave = { ...settings }
      if (toSave.snippets) {
        toSave.snippets = toSave.snippets.filter((s) => s.title.trim() && s.command.trim())
      }
      await window.api.writeSettings(toSave)
      // Notify snippet consumers
      window.dispatchEvent(
        new CustomEvent('snippets-updated', {
          detail: toSave.snippets ?? DEFAULT_SNIPPETS
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

          {/* Snippets section — placeholder until SnippetSettings is integrated */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Snippets</h2>
            <p style={styles.settingDescription}>
              Terminal command shortcuts shown as buttons above the terminal
            </p>
            {/* SnippetSettings will be embedded here in Task 8 */}
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

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    inset: 0,
    top: 40, // Below navbar
    backgroundColor: 'var(--bg-primary)',
    zIndex: 300,
    display: 'flex',
    justifyContent: 'center',
    overflowY: 'auto'
  },
  content: {
    width: '100%',
    maxWidth: 720,
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
