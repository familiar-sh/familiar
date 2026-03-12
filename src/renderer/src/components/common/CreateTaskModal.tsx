import { useState, useCallback, useRef, useEffect } from 'react'
import type { TaskPastedFile } from '@shared/types'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import { isLargePaste, createPastedFileMeta } from '@renderer/lib/paste-utils'
import { PastedFileCard } from './PastedFileCard'
import { PreviewDialog } from './PreviewDialog'

interface PendingPastedFile {
  meta: TaskPastedFile
  content: string
}

export function CreateTaskModal(): React.JSX.Element | null {
  const open = useUIStore((s) => s.createTaskModalOpen)
  const closeModal = useUIStore((s) => s.closeCreateTaskModal)
  const addTask = useTaskStore((s) => s.addTask)

  const [title, setTitle] = useState('')
  const [pendingPasted, setPendingPasted] = useState<PendingPastedFile[]>([])
  const [previewFile, setPreviewFile] = useState<PendingPastedFile | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setTitle('')
      setPendingPasted([])
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain')
    if (text && isLargePaste(text)) {
      e.preventDefault()
      const meta = createPastedFileMeta(text)
      setPendingPasted((prev) => [...prev, { meta, content: text }])
    }
  }, [])

  const handleCreate = useCallback(async () => {
    const lines = title.trim().split('\n')
    const taskTitle = lines[0].trim()
    const documentContent = lines.slice(1).join('\n').trim() || undefined
    if (taskTitle || pendingPasted.length > 0) {
      const task = await addTask(taskTitle || 'Untitled')
      if (documentContent) {
        await window.api.writeTaskDocument(task.id, documentContent)
      }
      // Save pasted files
      if (pendingPasted.length > 0) {
        const pastedFiles: TaskPastedFile[] = []
        for (const pf of pendingPasted) {
          await window.api.savePastedFile(task.id, pf.meta.filename, pf.content)
          pastedFiles.push(pf.meta)
        }
        const { updateTask } = useTaskStore.getState()
        await updateTask({ ...task, pastedFiles })
      }
      setTitle('')
      setPendingPasted([])
      closeModal()
    }
  }, [title, pendingPasted, addTask, closeModal])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleCreate()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        closeModal()
      }
    },
    [handleCreate, closeModal]
  )

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeModal()
      }
    },
    [closeModal]
  )

  if (!open) return null

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.wrapper}>
        <div style={styles.header}>New Task</div>
        <textarea
          ref={inputRef}
          style={styles.input}
          placeholder="Task title... (Shift+Enter for notes, Enter to create)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
        />
        {pendingPasted.length > 0 && (
          <div style={styles.pendingFiles}>
            {pendingPasted.map((pf, i) => (
              <PastedFileCard
                key={pf.meta.filename}
                file={pf.meta}
                onClick={() => setPreviewFile(pf)}
                onRemove={() => setPendingPasted((prev) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        )}
        <div style={styles.footer}>
          <span style={styles.hint}>
            <kbd style={styles.kbd}>Enter</kbd> to create
            <span style={styles.hintSep}>&middot;</span>
            <kbd style={styles.kbd}>Esc</kbd> to cancel
          </span>
        </div>
        {previewFile && (
          <PreviewDialog
            taskId=""
            file={previewFile.meta}
            onClose={() => setPreviewFile(null)}
          />
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '20vh',
    zIndex: 500,
    animation: 'cmdkFadeIn 120ms ease'
  },
  wrapper: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 8,
    border: '1px solid #2a2a3c',
    backgroundColor: '#1a1a27',
    boxShadow: '0 16px 70px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden'
  },
  header: {
    padding: '12px 18px',
    fontSize: 13,
    fontWeight: 500,
    color: '#8e8ea0',
    borderBottom: '1px solid #2a2a3c',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
  },
  input: {
    width: '100%',
    padding: '14px 18px',
    fontSize: 15,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#f0f0f4',
    backgroundColor: 'transparent',
    border: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'none',
    minHeight: 44,
    lineHeight: '1.5'
  },
  pendingFiles: {
    padding: '0 12px 8px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6
  },
  footer: {
    padding: '8px 18px',
    borderTop: '1px solid #2a2a3c',
    display: 'flex',
    justifyContent: 'flex-end'
  },
  hint: {
    fontSize: 11,
    color: '#5c5c6e',
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  hintSep: {
    color: '#3a3a4c'
  },
  kbd: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    padding: '0 5px',
    fontSize: 11,
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    color: '#8e8ea0',
    backgroundColor: '#232334',
    borderRadius: 4,
    border: '1px solid #2a2a3c'
  }
}
