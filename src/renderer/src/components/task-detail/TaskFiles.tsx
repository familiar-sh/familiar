import { useState, useEffect, useCallback } from 'react'
import { onFileChange } from '@renderer/lib/file-change-hub'
import styles from './TaskFiles.module.css'

interface TaskFileEntry {
  name: string
  size: number
  isDir: boolean
  path: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp'])

function getFileExt(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

function FileIcon({ name, isDir }: { name: string; isDir: boolean }): React.JSX.Element {
  if (isDir) {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M2 3.5C2 2.67 2.67 2 3.5 2H6l1.5 1.5H12.5C13.33 3.5 14 4.17 14 5v7.5c0 .83-.67 1.5-1.5 1.5h-9C2.67 14 2 13.33 2 12.5v-9z" />
      </svg>
    )
  }

  const ext = getFileExt(name)
  if (IMAGE_EXTS.has(ext)) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    )
  }

  if (ext === 'md') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    )
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

interface TaskFilesProps {
  taskId: string
}

export function TaskFiles({ taskId }: TaskFilesProps): React.JSX.Element {
  const [files, setFiles] = useState<TaskFileEntry[]>([])

  const loadFiles = useCallback(async () => {
    try {
      const entries = await window.api.listTaskFiles(taskId)
      entries.sort((a, b) => a.name.localeCompare(b.name))
      setFiles(entries)
    } catch {
      setFiles([])
    }
  }, [taskId])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  // Reload when filesystem changes
  useEffect(() => {
    return onFileChange(() => {
      loadFiles()
    })
  }, [loadFiles])

  const handleOpenFolder = useCallback(async () => {
    const root = await window.api.getProjectRoot()
    window.api.openPath(`${root}/.familiar/tasks/${taskId}`)
  }, [taskId])

  const handleFileClick = useCallback((file: TaskFileEntry) => {
    window.api.openPath(file.path)
  }, [])

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.title}>Task Files</span>
        <button className={styles.openFolderBtn} onClick={handleOpenFolder} type="button">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
            <path d="M2 3.5C2 2.67 2.67 2 3.5 2H6l1.5 1.5H12.5C13.33 3.5 14 4.17 14 5v7.5c0 .83-.67 1.5-1.5 1.5h-9C2.67 14 2 13.33 2 12.5v-9z" />
          </svg>
          Open Folder
        </button>
      </div>
      {files.length === 0 ? (
        <div className={styles.empty}>No files yet</div>
      ) : (
        <div className={styles.fileList}>
          {files.map((file) => (
            <button
              key={file.name}
              className={styles.fileItem}
              onClick={() => handleFileClick(file)}
              type="button"
            >
              <span className={styles.fileIcon}>
                <FileIcon name={file.name} isDir={file.isDir} />
              </span>
              <span className={styles.fileName}>{file.name}</span>
              {!file.isDir && (
                <span className={styles.fileSize}>{formatSize(file.size)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
