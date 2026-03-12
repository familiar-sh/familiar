import { useState, useEffect } from 'react'
import { SplitPanel } from './SplitPanel'
import { ActivityTimeline } from './ActivityTimeline'
import { TerminalPanel } from '@renderer/components/terminal/TerminalPanel'
import { BlockEditor } from '@renderer/components/editor'
import { useUIStore } from '@renderer/stores/ui-store'
import styles from './TaskDetailContent.module.css'

interface TaskDetailContentProps {
  taskId: string
}

export function TaskDetailContent({ taskId }: TaskDetailContentProps): React.JSX.Element {
  const editorPanelWidth = useUIStore((s) => s.editorPanelWidth)
  const setEditorPanelWidth = useUIStore((s) => s.setEditorPanelWidth)
  const [documentContent, setDocumentContent] = useState<string | undefined>(undefined)
  const [documentLoaded, setDocumentLoaded] = useState(false)

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
            <div className={styles.activitySection}>
              <ActivityTimeline taskId={taskId} />
            </div>
          </div>
        }
        right={
          <TerminalPanel taskId={taskId} />
        }
        defaultLeftWidth={editorPanelWidth}
        minLeftWidth={20}
        maxLeftWidth={80}
        onWidthChange={setEditorPanelWidth}
      />
    </div>
  )
}
