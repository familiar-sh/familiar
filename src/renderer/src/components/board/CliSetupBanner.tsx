import { useState, useEffect, useCallback } from 'react'
import styles from './CliSetupBanner.module.css'

type BannerState = 'checking' | 'not-installed' | 'installing' | 'success' | 'error' | 'hidden'

export function CliSetupBanner(): React.JSX.Element | null {
  const [state, setState] = useState<BannerState>('checking')
  const [shellName, setShellName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    window.api.cliCheckAvailable().then((available) => {
      if (cancelled) return
      if (available) {
        setState('hidden')
      } else {
        setState('not-installed')
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleInstall = useCallback(async () => {
    setState('installing')
    const result = await window.api.cliInstallToPath()
    if (result.success) {
      setShellName(result.shell)
      setState('success')
    } else {
      setErrorMsg(result.error || 'Unknown error')
      setState('error')
    }
  }, [])

  const handleDismiss = useCallback(() => {
    setState('hidden')
  }, [])

  if (state === 'checking' || state === 'hidden') return null

  if (state === 'success') {
    return (
      <div className={styles.bannerSuccess}>
        <svg className={styles.iconSuccess} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <div className={styles.content}>
          <div className={styles.title}>CLI installed</div>
          <div className={styles.description}>
            The <code>familiar</code> CLI is now available in new terminal sessions.
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.dismissButton} onClick={handleDismiss} title="Dismiss">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.banner}>
      <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
      <div className={styles.content}>
        <div className={styles.title}>CLI not found</div>
        <div className={styles.description}>
          {state === 'error'
            ? `Installation failed: ${errorMsg}`
            : 'Install the familiar CLI to manage tasks from your terminal.'}
        </div>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.installButton}
          onClick={handleInstall}
          disabled={state === 'installing'}
        >
          {state === 'installing' ? 'Installing...' : 'Install CLI'}
        </button>
        <button className={styles.dismissButton} onClick={handleDismiss} title="Dismiss">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
