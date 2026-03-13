import { useState, useEffect, useCallback } from 'react'
import styles from './UpdateBanner.module.css'

export interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  releaseUrl: string
  releaseNotes: string
  publishedAt: string
}

export function UpdateBanner(): React.JSX.Element | null {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)

  useEffect(() => {
    // Listen for background update checks from main process
    const unsubscribe = window.api.onUpdateAvailable((info) => {
      setUpdateInfo(info)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const handleDownload = useCallback(() => {
    if (updateInfo) {
      window.api.downloadUpdate(updateInfo.releaseUrl)
    }
  }, [updateInfo])

  const handleDismiss = useCallback(() => {
    if (updateInfo) {
      window.api.dismissUpdate(updateInfo.latestVersion)
      setUpdateInfo(null)
    }
  }, [updateInfo])

  if (!updateInfo) return null

  return (
    <div className={styles.banner} data-testid="update-banner">
      <div className={styles.message}>
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
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>
          A new version is available:{' '}
          <span className={styles.versionBadge}>v{updateInfo.latestVersion}</span>
          {' '}(current: v{updateInfo.currentVersion})
        </span>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.downloadButton}
          onClick={handleDownload}
          data-testid="update-download-button"
        >
          Download
        </button>
        <button
          className={styles.dismissButton}
          onClick={handleDismiss}
          title="Dismiss"
          data-testid="update-dismiss-button"
        >
          <svg
            width="12"
            height="12"
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
