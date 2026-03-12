import { useEffect, useRef, useCallback } from 'react'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import styles from './BlockEditor.module.css'

interface BlockEditorProps {
  taskId: string
  initialContent?: string // markdown content
  onChange?: (markdown: string) => void
}

export function BlockEditor({ taskId, initialContent, onChange }: BlockEditorProps): React.JSX.Element {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const taskIdRef = useRef(taskId)
  const isLoadingContentRef = useRef(false)
  taskIdRef.current = taskId

  const uploadFile = useCallback(
    async (file: File): Promise<string> => {
      const timestamp = Date.now()
      const fileName = `${timestamp}-${file.name}`
      const arrayBuffer = await file.arrayBuffer()
      const filePath = await window.api.saveAttachment(taskIdRef.current, fileName, arrayBuffer)
      // Return a custom protocol URL so the editor can display the image inline
      // file:// URLs are blocked by Electron's security policy in the renderer
      return `kanban-attachment://file${filePath}`
    },
    []
  )

  const editor = useCreateBlockNote(
    {
      uploadFile,
    },
    [uploadFile]
  )

  // Load initial content from markdown
  useEffect(() => {
    if (!editor || initialContent === undefined) return
    // Skip loading if content is empty — editor default state is fine
    if (initialContent === '') return
    let cancelled = false

    async function loadContent(): Promise<void> {
      try {
        isLoadingContentRef.current = true
        const blocks = await editor.tryParseMarkdownToBlocks(initialContent!)
        if (!cancelled && blocks.length > 0) {
          editor.replaceBlocks(editor.document, blocks)
        }
      } catch (err) {
        console.error('Failed to parse markdown into blocks:', err)
      } finally {
        // Delay clearing the flag so the onChange triggered by replaceBlocks is suppressed
        setTimeout(() => {
          isLoadingContentRef.current = false
        }, 0)
      }
    }

    loadContent()
    return () => {
      cancelled = true
    }
  }, [editor, initialContent])

  const handleChange = useCallback(async () => {
    if (!editor || isLoadingContentRef.current) return

    // Clear any pending save timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    // Debounce: wait 1 second before saving
    saveTimerRef.current = setTimeout(async () => {
      try {
        const markdown = await editor.blocksToMarkdownLossy(editor.document)
        onChange?.(markdown)
        await window.api.writeTaskDocument(taskIdRef.current, markdown)
      } catch (err) {
        console.error('Failed to save document:', err)
      }
    }, 1000)
  }, [editor, onChange])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [])

  return (
    <div className={styles.editorWrapper} data-testid="block-editor">
      <BlockNoteView
        editor={editor}
        theme="dark"
        onChange={handleChange}
      />
    </div>
  )
}
