import { useState, useEffect, useCallback } from 'react'
import styles from './WorkspaceHealthBanner.module.css'
import { useWorkspaceStore } from '../../stores/workspace-store'

interface HealthIssue {
  id: string
  severity: 'error' | 'warning'
  title: string
  description: string
  fixable: boolean
}

interface HealthCheckResult {
  issues: HealthIssue[]
  cliAvailable: boolean
  agentHarnessConfigured: boolean
  claudeAvailable: boolean | null
  hooksConfigured: boolean | null
  skillInstalled: boolean | null
}

type BannerState = 'checking' | 'healthy' | 'issues' | 'fixing' | 'dismissed'

export function WorkspaceHealthBanner(): React.JSX.Element | null {
  const [state, setState] = useState<BannerState>('checking')
  const [issues, setIssues] = useState<HealthIssue[]>([])
  const [fixingCli, setFixingCli] = useState(false)
  const [cliShell, setCliShell] = useState('')
  const activeProjectPath = useWorkspaceStore((s) => s.activeProjectPath)

  const runChecks = useCallback(async (excludeIssueIds?: string[]) => {
    setState('checking')
    try {
      const result: HealthCheckResult = await window.api.healthCheck()
      const filteredIssues = excludeIssueIds
        ? result.issues.filter((i) => !excludeIssueIds.includes(i.id))
        : result.issues
      if (filteredIssues.length === 0) {
        setState('healthy')
      } else {
        setIssues(filteredIssues)
        setState('issues')
      }
    } catch {
      setState('healthy') // Don't show banner on error
    }
  }, [])

  // Run checks on mount and when active project changes
  useEffect(() => {
    runChecks()
  }, [runChecks, activeProjectPath])

  const handleFixAll = useCallback(async () => {
    setState('fixing')
    const excludeFromRecheck: string[] = []

    // Handle CLI install separately
    const cliIssue = issues.find((i) => i.id === 'cli-not-installed')
    if (cliIssue) {
      setFixingCli(true)
      try {
        const result = await window.api.cliInstallToPath()
        if (result.success) {
          setCliShell(result.shell)
          // CLI was installed successfully — exclude from re-check since the
          // Electron process may not detect it until the next app launch
          excludeFromRecheck.push('cli-not-installed')
        }
      } catch {
        // Continue fixing other issues
      }
      setFixingCli(false)
    }

    // Fix remaining auto-fixable issues
    await window.api.healthFixAll()

    // Re-run checks, excluding successfully fixed CLI issue
    await runChecks(excludeFromRecheck)
  }, [issues, runChecks])

  const handleFix = useCallback(
    async (issueId: string) => {
      if (issueId === 'cli-not-installed') {
        setFixingCli(true)
        try {
          const result = await window.api.cliInstallToPath()
          if (result.success) {
            setCliShell(result.shell)
            // CLI was installed successfully — exclude from re-check since the
            // Electron process may not detect it until the next app launch
            setFixingCli(false)
            await runChecks(['cli-not-installed'])
            return
          }
        } catch {
          // ignore
        }
        setFixingCli(false)
      } else {
        await window.api.healthFix(issueId)
      }
      // Re-run checks
      await runChecks()
    },
    [runChecks]
  )

  const handleDismiss = useCallback(() => {
    setState('dismissed')
  }, [])

  if (state === 'checking' || state === 'healthy' || state === 'dismissed') return null

  const fixableIssues = issues.filter((i) => i.fixable)
  const hasFixableIssues = fixableIssues.length > 0

  return (
    <div className={styles.banner}>
      <svg
        className={styles.icon}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div className={styles.content}>
        <div className={styles.title}>
          Setup incomplete — {issues.length} issue{issues.length !== 1 ? 's' : ''} found
        </div>
        <ul className={styles.issueList}>
          {issues.map((issue) => (
            <li key={issue.id} className={styles.issueItem}>
              <span className={styles.issueDot} data-severity={issue.severity} />
              <span className={styles.issueTitle}>{issue.title}</span>
              <span className={styles.issueDesc}> — {issue.description}</span>
              {issue.fixable && (
                <button
                  className={styles.fixLink}
                  onClick={() => handleFix(issue.id)}
                  disabled={state === 'fixing' || (issue.id === 'cli-not-installed' && fixingCli)}
                >
                  {issue.id === 'cli-not-installed' && fixingCli ? 'Installing...' : 'Fix'}
                </button>
              )}
            </li>
          ))}
        </ul>
        {cliShell && (
          <div className={styles.cliSuccess}>
            CLI installed successfully.
          </div>
        )}
      </div>
      <div className={styles.actions}>
        {hasFixableIssues && (
          <button
            className={styles.fixAllButton}
            onClick={handleFixAll}
            disabled={state === 'fixing'}
          >
            {state === 'fixing' ? 'Fixing...' : 'Fix All'}
          </button>
        )}
        <button className={styles.dismissButton} onClick={handleDismiss} title="Dismiss">
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
    </div>
  )
}
