import { useState, useEffect, useCallback } from 'react'
import type { TaskPastedFile } from '@shared/types'
import { SplitPanel } from './SplitPanel'
import { ActivityTimeline } from './ActivityTimeline'
import { TerminalPanel } from '@renderer/components/terminal/TerminalPanel'
import { BlockEditor } from '@renderer/components/editor'
import { PastedFileCard, PreviewDialog } from '@renderer/components/common'
import { useUIStore } from '@renderer/stores/ui-store'
import { useTaskStore } from '@renderer/stores/task-store'
import styles from './TaskDetailContent.module.css'

interface TaskDetailContentProps {
  taskId: string
  visible?: boolean
}

export function TaskDetailContent({ taskId, visible }: TaskDetailContentProps): React.JSX.Element {
  const editorPanelWidth = useUIStore((s) => s.editorPanelWidth)
  const setEditorPanelWidth = useUIStore((s) => s.setEditorPanelWidth)
  const [documentContent, setDocumentContent] = useState<string | undefined>(undefined)
  const [documentLoaded, setDocumentLoaded] = useState(false)
  const [previewFile, setPreviewFile] = useState<TaskPastedFile | null>(null)

  const task = useTaskStore((s) => s.getTaskById(taskId))
  const updateTask = useTaskStore((s) => s.updateTask)
  const pastedFiles = task?.pastedFiles ?? []

  const handleRemovePastedFile = useCallback(
    async (filename: string) => {
      if (!task) return
      try {
        await window.api.deletePastedFile(taskId, filename)
        const updated = (task.pastedFiles ?? []).filter((f) => f.filename !== filename)
        await updateTask({ ...task, pastedFiles: updated.length > 0 ? updated : undefined })
      } catch (err) {
        console.warn('Failed to delete pasted file:', err)
      }
    },
    [task, taskId, updateTask]
  )

  // Load document content on mount / taskId change
  useEffect(() => {
    let cancelled = false

    async function loadDocument(): Promise<void> {
      try {
        const content = await window.api.readTaskDocument(taskId)
        if (!cancelled) {
          setDocumentContent(content || '')
          setDocumentLoaded(true)
        }
      } catch {
        // Document may not exist yet — that's fine
        if (!cancelled) {
          setDocumentContent('')
          setDocumentLoaded(true)
        }
      }
    }

    setDocumentLoaded(false)
    loadDocument()

    return () => {
      cancelled = true
    }
  }, [taskId])

  return (
    <div className={styles.container}>
      <SplitPanel
        left={
          <div className={styles.leftPanel}>
            <div className={styles.editorSection}>
              {documentLoaded ? (
                <BlockEditor
                  key={taskId}
                  taskId={taskId}
                  initialContent={documentContent}
                />
              ) : (
                <div className={styles.editorArea}>Loading...</div>
              )}
            </div>
            {pastedFiles.length > 0 && (
              <div className={styles.pastedFilesSection}>
                <div className={styles.pastedFilesHeader}>Pasted Files</div>
                <div className={styles.pastedFilesList}>
                  {pastedFiles.map((pf) => (
                    <PastedFileCard
                      key={pf.filename}
                      file={pf}
                      onClick={() => setPreviewFile(pf)}
                      onRemove={() => handleRemovePastedFile(pf.filename)}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className={styles.activitySection}>
              <ActivityTimeline taskId={taskId} />
            </div>
          </div>
        }
        right={
          <TerminalPanel taskId={taskId} visible={visible} />
        }
        defaultLeftWidth={editorPanelWidth}
        minLeftWidth={200}
        maxLeftWidth={800}
        onWidthChange={setEditorPanelWidth}
      />
      {previewFile && (
        <PreviewDialog
          taskId={taskId}
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  )
}
