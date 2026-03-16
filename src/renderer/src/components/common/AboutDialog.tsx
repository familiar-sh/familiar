import { useState, useEffect } from 'react'
import { useUIStore } from '@renderer/stores/ui-store'

const dialogStyles = {
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    WebkitAppRegion: 'no-drag' as const
  },
  dialog: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    padding: '24px',
    minWidth: 280,
    maxWidth: 360,
    textAlign: 'center' as const
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  title: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: 'var(--font-weight-semibold)' as any,
    color: 'var(--text-primary)',
    margin: 0
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-tertiary)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer'
  },
  version: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-secondary)',
    margin: '0 0 12px'
  },
  description: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-tertiary)',
    margin: '0 0 12px',
    lineHeight: 1.5
  },
  copyright: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-tertiary)',
    margin: 0
  }
}

export function AboutDialog(): React.JSX.Element | null {
  const aboutDialogOpen = useUIStore((s) => s.aboutDialogOpen)
  const closeAboutDialog = useUIStore((s) => s.closeAboutDialog)
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.api.getVersion().then(setAppVersion).catch(() => {})
  }, [])

  if (!aboutDialogOpen) return null

  return (
    <div
      style={dialogStyles.overlay}
      onClick={closeAboutDialog}
      data-testid="about-overlay"
    >
      <div
        style={dialogStyles.dialog}
        onClick={(e) => e.stopPropagation()}
        data-testid="about-dialog"
      >
        <div style={dialogStyles.header}>
          <h2 style={dialogStyles.title}>Familiar</h2>
          <button
            style={dialogStyles.closeButton}
            onClick={closeAboutDialog}
            aria-label="Close"
          >
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <p style={dialogStyles.version}>Version {appVersion || '...'}</p>
        <p style={dialogStyles.description}>
          A kanban board with embedded terminals for agentic AI coding workflows.
        </p>
        <p style={dialogStyles.copyright}>
          &copy; {new Date().getFullYear()} Familiar
        </p>
      </div>
    </div>
  )
}
