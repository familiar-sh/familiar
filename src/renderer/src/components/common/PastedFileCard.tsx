import { useCallback } from 'react'
import type { TaskPastedFile } from '@shared/types'
import styles from './PastedFileCard.module.css'

export interface PastedFileCardProps {
  file: TaskPastedFile
  onClick: () => void
  onRemove?: () => void
  compact?: boolean
}

export function PastedFileCard({
  file,
  onClick,
  onRemove,
  compact = false
}: PastedFileCardProps): React.JSX.Element {
  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onRemove?.()
    },
    [onRemove]
  )

  const sizeLabel =
    file.size < 1024
      ? `${file.size} B`
      : file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`

  if (compact) {
    return (
      <button
        className={styles.compactCard}
        onClick={onClick}
        title={`${file.label} (${sizeLabel})`}
        type="button"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        <span className={styles.compactCount}>
          {file.lineCount ? `${file.lineCount}L` : sizeLabel}
        </span>
      </button>
    )
  }

  return (
    <div className={styles.card} onClick={onClick} role="button" tabIndex={0}>
      <div className={styles.iconCol}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <div className={styles.info}>
        <div className={styles.label}>{file.label}</div>
        <div className={styles.meta}>
          {file.filename}
          <span className={styles.metaSep}>&middot;</span>
          {sizeLabel}
          {file.lineCount != null && (
            <>
              <span className={styles.metaSep}>&middot;</span>
              {file.lineCount} lines
            </>
          )}
        </div>
      </div>
      {onRemove && (
        <button
          className={styles.removeBtn}
          onClick={handleRemove}
          type="button"
          aria-label="Remove pasted file"
        >
          &times;
        </button>
      )}
    </div>
  )
}
