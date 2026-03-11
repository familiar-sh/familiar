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

type RightTab = 'terminal' | 'activity'

export function TaskDetailContent({ taskId }: TaskDetailContentProps): JSX.Element {
  const editorPanelWidth = useUIStore((s) => s.editorPanelWidth)
  const setEditorPanelWidth = useUIStore((s) => s.setEditorPanelWidth)
  const [rightTab, setRightTab] = useState<RightTab>('terminal')
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
          <div className={styles.editorPlaceholder}>
            {documentLoaded ? (
              <BlockEditor
                key={taskId}
                taskId={taskId}
                initialContent={documentContent}
              />
            ) : (
              <div className={styles.editorArea}>Loading...</div>
            )}
            <ActivityTimeline taskId={taskId} />
          </div>
        }
        right={
          <div className={styles.rightPanel}>
            <div className={styles.tabBar}>
              <button
                className={`${styles.tab} ${rightTab === 'terminal' ? styles.tabActive : ''}`}
                onClick={() => setRightTab('terminal')}
              >
                Terminal
              </button>
              <button
                className={`${styles.tab} ${rightTab === 'activity' ? styles.tabActive : ''}`}
                onClick={() => setRightTab('activity')}
              >
                Activity
              </button>
            </div>
            <div className={styles.tabContent}>
              {rightTab === 'terminal' ? (
                <TerminalPanel taskId={taskId} />
              ) : (
                <ActivityTimeline taskId={taskId} />
              )}
            </div>
          </div>
        }
        defaultLeftWidth={editorPanelWidth}
        minLeftWidth={20}
        maxLeftWidth={80}
        onWidthChange={setEditorPanelWidth}
      />
    </div>
  )
}
