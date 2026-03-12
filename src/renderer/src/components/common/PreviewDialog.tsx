import { useState, useEffect, useCallback } from 'react'
import type { TaskPastedFile } from '@shared/types'
import styles from './PreviewDialog.module.css'

const MAX_PREVIEW_LINES = 500

export interface PreviewDialogProps {
  taskId: string
  file: TaskPastedFile
  onClose: () => void
}

export function PreviewDialog({ taskId, file, onClose }: PreviewDialogProps): React.JSX.Element {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (file.type !== 'text') return
    let cancelled = false
    window.api
      .readPastedFile(taskId, file.filename)
      .then((text) => {
        if (!cancelled) setContent(text)
      })
      .catch((err) => {
        if (!cancelled) setError(String(err))
      })
    return () => {
      cancelled = true
    }
  }, [taskId, file.filename, file.type])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose]
  )

  const sizeLabel =
    file.size < 1024
      ? `${file.size} B`
      : file.size < 1024 * 1024
        ? `${(file.size / 1024).toFixed(1)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(1)} MB`

  const lines = content?.split('\n') ?? []
  const isTruncated = !showAll && lines.length > MAX_PREVIEW_LINES
  const visibleContent = isTruncated ? lines.slice(0, MAX_PREVIEW_LINES).join('\n') : content

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.filename}>{file.filename}</span>
            <span className={styles.headerMeta}>
              {sizeLabel}
              {file.lineCount != null && ` \u00b7 ${file.lineCount} lines`}
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close preview">
            &times;
          </button>
        </div>
        <div className={styles.body}>
          {file.type === 'text' && (
            <>
              {content === null && !error && (
                <div className={styles.loading}>Loading...</div>
              )}
              {error && <div className={styles.error}>{error}</div>}
              {visibleContent !== null && (
                <pre className={styles.codeBlock}>{visibleContent}</pre>
              )}
              {isTruncated && (
                <button
                  className={styles.showMoreBtn}
                  onClick={() => setShowAll(true)}
                  type="button"
                >
                  Show all {lines.length} lines
                </button>
              )}
            </>
          )}
          {file.type === 'image' && (
            <div className={styles.imageContainer}>
              <img
                src={`familiar-attachment://file${file.filename}`}
                alt={file.label}
                className={styles.previewImage}
              />
            </div>
          )}
          {file.type === 'binary' && (
            <div className={styles.binaryInfo}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Binary file — preview not available</span>
              <span className={styles.headerMeta}>{sizeLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
